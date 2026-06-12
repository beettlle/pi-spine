/**
 * Lane task execution, file-scope loading, and orch merge wiring (extracted from engine.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";
import {
	buildTasksAndLanesFromPlan,
	loadTaskFileScopePaths,
	recordLaneTaskMetric,
	recordPromptParseFailure,
	skipTaskDoneOnDisk,
} from "./engine-lanes/queue.mjs";
import {
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
	loadRulesManifest,
	fingerprintRulesManifest,
} from "../config/cursor-rules/discover.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import {
	commitLaneWorktree,
	countCommitsAhead,
	filterPorcelain,
	gitPorcelain,
} from "./lane-commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";
import {
	buildReviewArtifactPath,
	findCodeReviewStepNumber,
	findCompletedCodeReview,
	findCompletedFinalReview,
	findFinalReviewStepNumber,
	formatReviewTimestamp,
	readReviewLevel,
	runStepReview,
} from "./review.mjs";
import { REVIEW_DEFAULTS } from "../config/defaults.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { shouldRunContractVerify, verifyContract } from "./contract-verify.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {{ throwOnError?: boolean }} [options]
 */
function git(projectRoot, args, { throwOnError = true } = {}) {
	return gitExec(projectRoot, args, { throwOnError, projectRoot });
}

/**
 * @param {string} projectRoot
 */
function abortInProgressMerge(projectRoot) {
	try {
		execFileSync("git", ["merge", "--abort"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
	} catch {
		// best effort — leave checkout restoration to caller
	}
}

/**
 * @param {string} projectRoot
 */
function listUnmergedPaths(projectRoot) {
	const output = git(projectRoot, ["diff", "--name-only", "--diff-filter=U"], {
		throwOnError: false,
	});
	if (!output) return [];
	return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function readRulesManifestFromRef(projectRoot, ref) {
	const output = git(projectRoot, ["show", `${ref}:${RULES_MANIFEST_REL_PATH}`], {
		throwOnError: false,
	});
	if (output == null) {
		return { ok: false, error: `missing ${RULES_MANIFEST_REL_PATH} at ${ref}` };
	}
	return parseRulesManifestJson(output);
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function extractPorcelainPath(line) {
	if (!line.trim()) return null;
	let filePath = line.length > 2 && line[2] === " " ? line.slice(3) : line.slice(2);
	filePath = filePath.trim();
	if (!filePath) return null;
	if (filePath.includes(" -> ")) {
		return filePath.split(" -> ").pop()?.trim() ?? null;
	}
	return filePath;
}

/**
 * @param {string} projectRoot
 */
function listDirtyPaths(projectRoot) {
	const output = gitPorcelain(projectRoot);
	if (!output) return [];
	return output
		.split("\n")
		.map((line) => extractPorcelainPath(line))
		.filter((entry) => Boolean(entry));
}

/**
 * Before orch→main integrate, auto-resolve uncommitted generatedAt-only drift on rules-manifest.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 */
export function resolveRulesManifestIntegrateDrift({ projectRoot, baseBranch, orchBranch }) {
	const dirtyPaths = listDirtyPaths(projectRoot);
	if (dirtyPaths.length === 0) {
		return { ok: true, resolved: false };
	}
	if (dirtyPaths.length !== 1 || dirtyPaths[0] !== RULES_MANIFEST_REL_PATH) {
		return { ok: true, resolved: false };
	}

	const working = loadRulesManifest(projectRoot);
	if (!working) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: `${RULES_MANIFEST_REL_PATH} is dirty but unreadable`,
		};
	}

	const headResult = readRulesManifestFromRef(projectRoot, baseBranch);
	const orchResult = readRulesManifestFromRef(projectRoot, orchBranch);
	if (!headResult.ok || !orchResult.ok) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: "unable to read rules-manifest from base or orch branch",
		};
	}

	if (fingerprintRulesManifest(working) !== fingerprintRulesManifest(headResult.manifest)) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error:
				`${RULES_MANIFEST_REL_PATH} has uncommitted content changes beyond generatedAt — commit or stash before integrate`,
		};
	}

	if (fingerprintRulesManifest(headResult.manifest) !== fingerprintRulesManifest(orchResult.manifest)) {
		const contentMerge = resolveRulesManifestGeneratedAtMerge({
			ours: headResult.manifest,
			theirs: orchResult.manifest,
		});
		if (!contentMerge.ok) {
			return contentMerge;
		}
	}

	gitExec(
		projectRoot,
		["restore", "--source=HEAD", "--staged", "--worktree", RULES_MANIFEST_REL_PATH],
		{ projectRoot },
	);
	return {
		ok: true,
		resolved: true,
		action: "restored_head_for_merge",
	};
}

/**
 * @param {string} projectRoot
 * @param {2 | 3} stage
 */
function readRulesManifestMergeStage(projectRoot, stage) {
	const output = git(projectRoot, ["show", `:${stage}:${RULES_MANIFEST_REL_PATH}`], {
		throwOnError: false,
	});
	if (output == null) {
		return { ok: false, error: `missing merge stage ${stage} for ${RULES_MANIFEST_REL_PATH}` };
	}
	return parseRulesManifestJson(output);
}

/**
 * @param {string} projectRoot
 */
export function tryAutoResolveRulesManifestMergeConflict(projectRoot) {
	const unmerged = listUnmergedPaths(projectRoot);
	if (unmerged.length === 0) {
		return {
			ok: false,
			error: "merge failed without unmerged paths",
		};
	}
	if (unmerged.length !== 1 || unmerged[0] !== RULES_MANIFEST_REL_PATH) {
		return {
			ok: false,
			failureClass: "MergeConflict",
			error:
				`merge conflict on ${unmerged.join(", ")}; automatic resolution only supports ${RULES_MANIFEST_REL_PATH}`,
		};
	}

	const oursResult = readRulesManifestMergeStage(projectRoot, 2);
	const theirsResult = readRulesManifestMergeStage(projectRoot, 3);
	if (!oursResult.ok || !theirsResult.ok) {
		return {
			ok: false,
			error: "unable to read rules-manifest merge stages",
		};
	}

	const resolved = resolveRulesManifestGeneratedAtMerge({
		ours: oursResult.manifest,
		theirs: theirsResult.manifest,
	});
	if (!resolved.ok) {
		return resolved;
	}

	writeRulesManifestAtomic(projectRoot, resolved.manifest);
	gitExec(projectRoot, ["add", RULES_MANIFEST_REL_PATH], { projectRoot });
	return {
		ok: true,
		autoResolved: true,
		generatedAt: resolved.manifest.generatedAt,
	};
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function gitStrict(projectRoot, args) {
	return git(projectRoot, args);
}

/**
 * @param {object} params
 * @param {boolean} [params.requireLaneCommits] When true, task branch must be ahead of orch before merge (post lane auto-commit).
 */
export function mergeLaneToOrch({
	projectRoot,
	baseBranch,
	orchBranch,
	taskBranch,
	batchId,
	requireLaneCommits = false,
}) {
	const previous = gitStrict(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	let mergeInProgress = false;
	try {
		const orchHeadBefore = gitStrict(projectRoot, ["rev-parse", orchBranch]);
		const commitsAhead = countCommitsAhead(projectRoot, orchBranch, taskBranch);

		if (requireLaneCommits && commitsAhead === 0) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Task branch ${taskBranch} has no commits ahead of ${orchBranch} after lane auto-commit. ` +
					`Worker may have created .DONE without persisting file changes to git.`,
			};
		}

		gitStrict(projectRoot, ["checkout", orchBranch]);
		try {
			gitStrict(projectRoot, [
				"merge",
				"--no-ff",
				taskBranch,
				"-m",
				`merge ${taskBranch} into ${orchBranch}`,
			]);
		} catch {
			mergeInProgress = true;
			const autoResolved = tryAutoResolveRulesManifestMergeConflict(projectRoot);
			if (!autoResolved.ok) {
				abortInProgressMerge(projectRoot);
				return {
					ok: false,
					failureClass: autoResolved.failureClass ?? "MergeConflict",
					error: autoResolved.error ?? "merge conflict",
				};
			}
			gitStrict(projectRoot, ["commit", "--no-edit"]);
		}

		const mergeCommit = gitStrict(projectRoot, ["rev-parse", "HEAD"]);

		if (requireLaneCommits && mergeCommit === orchHeadBefore) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Merge into ${orchBranch} did not advance HEAD (still ${orchHeadBefore.slice(0, 7)}). ` +
					`Lane work was not integrated.`,
			};
		}

		return { ok: true, mergeCommit, commitsAhead };
	} catch (err) {
		if (mergeInProgress) {
			abortInProgressMerge(projectRoot);
		}
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		try {
			gitStrict(projectRoot, ["checkout", previous || baseBranch]);
		} catch {
			gitStrict(projectRoot, ["checkout", baseBranch]);
		}
	}
}

/**
 * @param {string} fromPhase
 * @param {string} toPhase
 */
function phaseTransitionEventType(fromPhase, toPhase) {
	if (fromPhase === "planning" && toPhase === "running") return "batch.started";
	if (toPhase === "completed") return "batch.completed";
	if (toPhase === "failed") return "batch.failed";
	if (toPhase === "aborted") return "batch.aborted";
	return null;
}

/**
 * @param {object} params
 */
function recordPhaseTransition({ projectRoot, batchId, fromPhase, toPhase, extra = {} }) {
	const type = phaseTransitionEventType(fromPhase, toPhase);
	if (!type) return null;
	return appendJournalEvent(projectRoot, batchId, type, {
		fromPhase,
		toPhase,
		...extra,
	});
}

/**
 * @param {object} state
 * @param {string} newPhase
 * @param {object} ctx
 */
export function transitionPhase(state, newPhase, ctx) {
	const fromPhase = state.phase;
	if (fromPhase === newPhase) return;
	state.phase = newPhase;
	recordPhaseTransition({
		projectRoot: ctx.projectRoot,
		batchId: ctx.batchId,
		fromPhase,
		toPhase: newPhase,
		...ctx.extra,
	});
}

export {
	buildTasksAndLanesFromPlan,
	loadTaskFileScopePaths,
	skipTaskDoneOnDisk,
} from "./engine-lanes/queue.mjs";

/**
 * @param {string} taskFolder
 * @param {Date} [date]
 */
export function buildFinalReviewArtifactPath(taskFolder, date = new Date()) {
	return path.join(taskFolder, ".reviews", `final-${formatReviewTimestamp(date)}.md`);
}

/**
 * @param {string} reviewContent
 * @returns {{ verdict: "PASS"|"REVISE"|"REPLAN"|null, feedback: string }}
 */
export function parseFinalReviewVerdict(reviewContent) {
	const jsonMatch = reviewContent.match(/```json\s*\n([\s\S]*?)\n```/i);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			const verdict = normalizeFinalVerdict(parsed.verdict);
			if (verdict) {
				return {
					verdict,
					feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
				};
			}
		} catch {
			/* fall through */
		}
	}

	const headingMatch = reviewContent.match(/###?\s*Verdict[:\s]*(PASS|REVISE|REPLAN)/i);
	if (headingMatch) {
		return {
			verdict: normalizeFinalVerdict(headingMatch[1]),
			feedback: "",
		};
	}

	return { verdict: null, feedback: "" };
}

/**
 * @param {unknown} value
 * @returns {"PASS"|"REVISE"|"REPLAN"|null}
 */
function normalizeFinalVerdict(value) {
	if (typeof value !== "string") return null;
	const upper = value.trim().toUpperCase();
	return upper === "PASS" || upper === "REVISE" || upper === "REPLAN" ? upper : null;
}

/**
 * @param {unknown} value
 * @returns {"APPROVE"|"REVISE"|null}
 */
function normalizeCodeVerdict(value) {
	if (typeof value !== "string") return null;
	const upper = value.trim().toUpperCase();
	return upper === "APPROVE" || upper === "REVISE" ? upper : null;
}

/**
 * @param {object} params
 */
export function shouldRunCodeReview({ reviewLevel }) {
	return reviewLevel >= 2;
}

/**
 * @param {object} params
 */
export function shouldRunFinalReview({ config, reviewLevel }) {
	const requireFinal = config?.review?.requireFinalVerdict ?? REVIEW_DEFAULTS.requireFinalVerdict;
	return requireFinal && reviewLevel >= 1;
}

/**
 * @returns {"PASS"|"REVISE"|"REPLAN"}
 */
function resolveFinalStubVerdict() {
	const queue = process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS;
	if (queue) {
		const parts = queue.split(",").map((entry) => entry.trim()).filter(Boolean);
		const verdict = parts.shift() ?? "PASS";
		process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS = parts.join(",");
		return normalizeFinalVerdict(verdict) ?? "PASS";
	}
	const single = process.env.SPINE_ENGINE_FINAL_STUB_VERDICT ?? "PASS";
	return normalizeFinalVerdict(single) ?? "PASS";
}

/**
 * @returns {"APPROVE"|"REVISE"}
 */
function resolveCodeStubVerdict() {
	const queue = process.env.SPINE_ENGINE_CODE_STUB_VERDICTS;
	if (queue) {
		const parts = queue.split(",").map((entry) => entry.trim()).filter(Boolean);
		const verdict = parts.shift() ?? "APPROVE";
		process.env.SPINE_ENGINE_CODE_STUB_VERDICTS = parts.join(",");
		return normalizeCodeVerdict(verdict) ?? "APPROVE";
	}
	const single = process.env.SPINE_ENGINE_CODE_STUB_VERDICT ?? "APPROVE";
	return normalizeCodeVerdict(single) ?? "APPROVE";
}

/**
 * @param {object} params
 */
function writeFinalStubReviewArtifact({ artifactPath, verdict, feedback }) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const body = [
		"## Final Review",
		"",
		`### Verdict: ${verdict}`,
		"",
		"### Summary",
		feedback || `Stub final review returned ${verdict}.`,
		"",
		"```json",
		JSON.stringify({ verdict, feedback: feedback || "" }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

/**
 * @param {object} params
 */
export function runEngineFinalReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	contractVerifyResult = null,
	journal,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!shouldRunFinalReview({ config, reviewLevel })) {
		return {
			ok: true,
			skipped: true,
			reviewLevel,
			verdict: null,
			feedback: "",
			artifactPath: "",
			spawnFailed: false,
			exitCode: 0,
		};
	}

	const artifactPath = buildFinalReviewArtifactPath(taskFolder);
	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		process.env.SPINE_WORKER_STUB === "1";

	if (useStub) {
		const verdict = resolveFinalStubVerdict();
		const feedback =
			verdict === "REVISE"
				? "Stub reviewer requested changes."
				: verdict === "REPLAN"
					? "Stub reviewer requested replan."
					: "Stub reviewer passed.";
		writeFinalStubReviewArtifact({ artifactPath, verdict, feedback });
		return {
			ok: verdict === "PASS",
			skipped: false,
			reviewLevel,
			verdict,
			feedback,
			artifactPath,
			spawnFailed: false,
			exitCode: verdict === "PASS" ? 0 : 2,
			attempt,
		};
	}

	const stepNumber = findFinalReviewStepNumber(taskFolder);
	return runStepReview({
		taskFolder,
		worktreePath,
		stepNumber,
		reviewType: "final",
		config,
		journal,
		contractVerifyResult,
	});
}

/**
 * @param {object} params
 */
export function runEngineCodeReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	journal,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!shouldRunCodeReview({ reviewLevel })) {
		return {
			ok: true,
			skipped: true,
			reviewLevel,
			verdict: null,
			feedback: "",
			artifactPath: "",
			spawnFailed: false,
			exitCode: 0,
		};
	}

	const stepNumber = findCodeReviewStepNumber(taskFolder);
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);
	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		process.env.SPINE_WORKER_STUB === "1";

	if (useStub) {
		const verdict = resolveCodeStubVerdict();
		const feedback =
			verdict === "REVISE" ? "Stub reviewer requested changes." : "Stub reviewer approved.";
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.started", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "code",
				reviewLevel,
				artifactPath,
			});
		}
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		const body = [
			"## Code Review",
			"",
			`### Verdict: ${verdict}`,
			"",
			"### Summary",
			feedback,
			"",
			"```json",
			JSON.stringify({ verdict, feedback }, null, 2),
			"```",
			"",
		].join("\n");
		fs.writeFileSync(artifactPath, body, "utf-8");
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.completed", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "code",
				reviewLevel,
				verdict,
				artifactPath,
				stub: true,
			});
		}
		return {
			ok: verdict === "APPROVE",
			skipped: false,
			reviewLevel,
			verdict,
			feedback,
			artifactPath,
			spawnFailed: false,
			exitCode: verdict === "APPROVE" ? 0 : 2,
			attempt,
		};
	}

	return runStepReview({
		taskFolder,
		worktreePath,
		stepNumber,
		reviewType: "code",
		config,
		journal,
	});
}

/**
 * @param {string} taskFolder
 */
function removeDoneFile(taskFolder) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		fs.unlinkSync(donePath);
	}
}

/**
 * @param {object} params
 */
function recordFinalReviewTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	exitReason,
	verdict,
	finalAttempt,
	config,
	taskFolder,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = exitReason;
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: exitReason,
		exitCode: 1,
		finalVerdict: verdict ?? null,
		finalAttempt,
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
	});
}

/**
 * @param {object} params
 */
function recordCodeReviewTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	exitReason,
	verdict,
	codeReviewAttempt,
	config,
	taskFolder,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = exitReason;
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: exitReason,
		exitCode: 1,
		codeVerdict: verdict ?? null,
		codeReviewAttempt,
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
	});
}

/**
 * @param {object} params
 */
async function runCodeReviewPhase({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskFolderInWorktree,
	wt,
	taskBranch,
	laneCorrelationId,
	fileScopePaths,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const reviewLevel = readReviewLevel(taskFolderInWorktree);
	if (!shouldRunCodeReview({ reviewLevel })) {
		return { ok: true, skipped: true };
	}

	const maxCodeReviewAttempts = config?.review?.maxFinalAttempts ?? REVIEW_DEFAULTS.maxFinalAttempts;
	let codeReviewAttempt = task.codeReviewAttempts ?? 0;

	if (codeReviewAttempt === 0) {
		const honored = findCompletedCodeReview({
			taskFolder: taskFolderInWorktree,
			journalEvents: readJournalEvents(projectRoot, batchId),
			taskId,
		});
		if (honored?.verdict === "APPROVE") {
			appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				reviewType: "code",
				verdict: "APPROVE",
				feedback: honored.feedback,
				artifactPath: honored.artifactPath,
				codeReviewAttempt: 1,
				honored: true,
				honorSource: honored.source,
			});
			task.codeReviewAttempts = 1;
			saveSpineBatchState(projectRoot, state);
			return { ok: true, verdict: "APPROVE", codeReviewAttempt: 1, honored: true };
		}
	}

	const journal = {
		projectRoot,
		batchId,
		taskId,
		laneNumber,
		correlationId: laneCorrelationId,
	};

	while (true) {
		const reviewResult = runEngineCodeReview({
			taskFolder: taskFolderInWorktree,
			worktreePath: wt,
			config,
			attempt: codeReviewAttempt + 1,
			journal,
		});

		if (reviewResult.spawnFailed) {
			recordCodeReviewTaskFailure({
				projectRoot,
				state,
				batchId,
				task,
				lane,
				laneCorrelationId,
				exitReason: "code_review_spawn_failed",
				verdict: null,
				codeReviewAttempt,
				config,
				taskFolder: taskFolderInWorktree,
			});
			return {
				ok: false,
				error: "code_review_spawn_failed",
				output: reviewResult.error ?? "code review spawn failed",
			};
		}

		if (reviewResult.skipped) {
			return { ok: true, skipped: true };
		}

		appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			reviewType: "code",
			verdict: reviewResult.verdict,
			feedback: reviewResult.feedback,
			artifactPath: reviewResult.artifactPath,
			codeReviewAttempt: codeReviewAttempt + 1,
		});

		if (reviewResult.verdict === "APPROVE") {
			task.codeReviewAttempts = codeReviewAttempt + 1;
			saveSpineBatchState(projectRoot, state);
			return { ok: true, verdict: "APPROVE", codeReviewAttempt: codeReviewAttempt + 1 };
		}

		if (reviewResult.verdict === "REVISE") {
			codeReviewAttempt++;
			task.codeReviewAttempts = codeReviewAttempt;
			saveSpineBatchState(projectRoot, state);

			if (codeReviewAttempt >= maxCodeReviewAttempts) {
				removeDoneFile(taskFolderInWorktree);
				appendJournalEvent(projectRoot, batchId, "review.exhausted", {
					taskId,
					laneNumber,
					laneId: lane.laneId,
					correlationId: laneCorrelationId,
					codeReviewAttempt,
					maxCodeReviewAttempts,
					reviewType: "code",
				});
				recordCodeReviewTaskFailure({
					projectRoot,
					state,
					batchId,
					task,
					lane,
					laneCorrelationId,
					exitReason: "review_exhausted",
					verdict: "REVISE",
					codeReviewAttempt,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, exitReason: "review_exhausted", verdict: "REVISE" };
			}

			removeDoneFile(taskFolderInWorktree);
			const reworkResult = await runWorker({
				worktreePath: wt,
				taskFolder: taskFolderInWorktree,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneBranch: taskBranch,
				laneCorrelationId,
				fileScopePaths,
				config,
				onHeartbeat: (timestamp) => {
					lane.lastHeartbeatAt = timestamp;
					saveSpineBatchState(projectRoot, state);
				},
				onWorkerPid: (pid) => {
					if (pid > 0) {
						lane.workerPid = pid;
						saveSpineBatchState(projectRoot, state);
					}
				},
			});
			if (!reworkResult.ok) {
				const aborted = reworkResult.classification === "aborted";
				task.status = aborted ? "aborted" : "failed";
				task.endedAt = Date.now();
				task.exitReason = reworkResult.classification ?? "worker_failed";
				updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
				recomputeTaskCounters(state);
				saveSpineBatchState(projectRoot, state);
				recordLaneTaskMetric({
					projectRoot,
					batchId,
					task,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, aborted, workerResult: reworkResult };
			}

			appendJournalEvent(projectRoot, batchId, "lane.completed", {
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				phase: "code_rework",
			});
			continue;
		}

		recordCodeReviewTaskFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			exitReason: "code_review_invalid_verdict",
			verdict: reviewResult.verdict,
			codeReviewAttempt,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "code_review_invalid_verdict",
			output: "code review artifact missing APPROVE or REVISE verdict",
		};
	}
}

/**
 * @param {object} params
 */
async function runFinalReviewPhase({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskFolderInWorktree,
	wt,
	taskBranch,
	laneCorrelationId,
	fileScopePaths,
	baseBranch = "main",
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const reviewLevel = readReviewLevel(taskFolderInWorktree);
	if (!shouldRunFinalReview({ config, reviewLevel })) {
		return { ok: true, skipped: true };
	}

	const maxFinalAttempts = config?.review?.maxFinalAttempts ?? REVIEW_DEFAULTS.maxFinalAttempts;
	let finalAttempt = task.finalAttempts ?? 0;

	if (finalAttempt === 0) {
		const honored = findCompletedFinalReview({
			taskFolder: taskFolderInWorktree,
			journalEvents: readJournalEvents(projectRoot, batchId),
			taskId,
		});
		if (honored?.verdict === "PASS") {
			appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				reviewType: "final",
				verdict: "PASS",
				feedback: honored.feedback,
				artifactPath: honored.artifactPath,
				finalAttempt: 1,
				honored: true,
				honorSource: honored.source,
			});
			task.finalAttempts = 1;
			saveSpineBatchState(projectRoot, state);
			return { ok: true, verdict: "PASS", finalAttempt: 1, honored: true };
		}
	}

	const journal = {
		projectRoot,
		batchId,
		taskId,
		laneNumber,
		correlationId: laneCorrelationId,
	};

	while (true) {
		let contractVerifyResult = null;
		const promptMarkdown = fs.readFileSync(path.join(taskFolderInWorktree, "PROMPT.md"), "utf-8");
		const parsedContract = parseContract(promptMarkdown);
		if (
			process.env.SPINE_WORKER_STUB !== "1" &&
			shouldRunContractVerify(taskId, parsedContract, config)
		) {
			contractVerifyResult = verifyContract(wt, parsedContract, {
				...config,
				baseBranch,
			});
			task.contractOk = contractVerifyResult.ok;
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "contract.verified", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				ok: contractVerifyResult.ok,
				checks: contractVerifyResult.checks,
			});
			if (!contractVerifyResult.ok) {
				finalAttempt++;
				task.finalAttempts = finalAttempt;
				saveSpineBatchState(projectRoot, state);
				appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
					taskId,
					laneNumber,
					laneId: lane.laneId,
					correlationId: laneCorrelationId,
					reviewType: "final",
					verdict: "REVISE",
					feedback: contractVerifyResult.checks
						.filter((check) => !check.ok)
						.map((check) => check.message)
						.join("; "),
					finalAttempt,
					contractOk: false,
				});

				if (finalAttempt >= maxFinalAttempts) {
					removeDoneFile(taskFolderInWorktree);
					appendJournalEvent(projectRoot, batchId, "review.exhausted", {
						taskId,
						laneNumber,
						laneId: lane.laneId,
						correlationId: laneCorrelationId,
						finalAttempt,
						maxFinalAttempts,
					});
					recordFinalReviewTaskFailure({
						projectRoot,
						state,
						batchId,
						task,
						lane,
						laneCorrelationId,
						exitReason: "review_exhausted",
						verdict: "REVISE",
						finalAttempt,
						config,
						taskFolder: taskFolderInWorktree,
					});
					return { ok: false, exitReason: "review_exhausted", verdict: "REVISE" };
				}

				removeDoneFile(taskFolderInWorktree);
				const reworkResult = await runWorker({
					worktreePath: wt,
					taskFolder: taskFolderInWorktree,
					projectRoot,
					batchId,
					laneNumber,
					taskId,
					laneBranch: taskBranch,
					laneCorrelationId,
					fileScopePaths,
					config,
					onHeartbeat: (timestamp) => {
						lane.lastHeartbeatAt = timestamp;
						saveSpineBatchState(projectRoot, state);
					},
					onWorkerPid: (pid) => {
						if (pid > 0) {
							lane.workerPid = pid;
							saveSpineBatchState(projectRoot, state);
						}
					},
				});
				if (!reworkResult.ok) {
					const aborted = reworkResult.classification === "aborted";
					task.status = aborted ? "aborted" : "failed";
					task.endedAt = Date.now();
					task.exitReason = reworkResult.classification ?? "worker_failed";
					updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
					recomputeTaskCounters(state);
					saveSpineBatchState(projectRoot, state);
					recordLaneTaskMetric({
						projectRoot,
						batchId,
						task,
						config,
						taskFolder: taskFolderInWorktree,
					});
					return { ok: false, aborted, workerResult: reworkResult };
				}

				appendJournalEvent(projectRoot, batchId, "lane.completed", {
					laneNumber,
					laneId: lane.laneId,
					taskId,
					correlationId: laneCorrelationId,
					phase: "final_rework",
				});
				continue;
			}
		}

		const reviewResult = runEngineFinalReview({
			taskFolder: taskFolderInWorktree,
			worktreePath: wt,
			config,
			attempt: finalAttempt + 1,
			contractVerifyResult,
			journal,
		});

		if (reviewResult.spawnFailed) {
			recordFinalReviewTaskFailure({
				projectRoot,
				state,
				batchId,
				task,
				lane,
				laneCorrelationId,
				exitReason: "final_review_spawn_failed",
				verdict: null,
				finalAttempt,
				config,
				taskFolder: taskFolderInWorktree,
			});
			return {
				ok: false,
				error: "final_review_spawn_failed",
				output: reviewResult.error ?? "final review spawn failed",
			};
		}

		if (reviewResult.skipped) {
			return { ok: true, skipped: true };
		}

		appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			reviewType: "final",
			verdict: reviewResult.verdict,
			feedback: reviewResult.feedback,
			artifactPath: reviewResult.artifactPath,
			finalAttempt: finalAttempt + 1,
		});

		if (reviewResult.verdict === "PASS") {
			task.finalAttempts = finalAttempt + 1;
			saveSpineBatchState(projectRoot, state);
			return { ok: true, verdict: "PASS", finalAttempt: finalAttempt + 1 };
		}

		if (reviewResult.verdict === "REPLAN") {
			removeDoneFile(taskFolderInWorktree);
			task.finalAttempts = finalAttempt + 1;
			recordFinalReviewTaskFailure({
				projectRoot,
				state,
				batchId,
				task,
				lane,
				laneCorrelationId,
				exitReason: "needs_replan",
				verdict: "REPLAN",
				finalAttempt: finalAttempt + 1,
				config,
				taskFolder: taskFolderInWorktree,
			});
			return { ok: false, exitReason: "needs_replan", verdict: "REPLAN" };
		}

		if (reviewResult.verdict === "REVISE") {
			finalAttempt++;
			task.finalAttempts = finalAttempt;
			saveSpineBatchState(projectRoot, state);

			if (finalAttempt >= maxFinalAttempts) {
				removeDoneFile(taskFolderInWorktree);
				appendJournalEvent(projectRoot, batchId, "review.exhausted", {
					taskId,
					laneNumber,
					laneId: lane.laneId,
					correlationId: laneCorrelationId,
					finalAttempt,
					maxFinalAttempts,
				});
				recordFinalReviewTaskFailure({
					projectRoot,
					state,
					batchId,
					task,
					lane,
					laneCorrelationId,
					exitReason: "review_exhausted",
					verdict: "REVISE",
					finalAttempt,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, exitReason: "review_exhausted", verdict: "REVISE" };
			}

			removeDoneFile(taskFolderInWorktree);
			const reworkResult = await runWorker({
				worktreePath: wt,
				taskFolder: taskFolderInWorktree,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneBranch: taskBranch,
				laneCorrelationId,
				fileScopePaths,
				config,
				onHeartbeat: (timestamp) => {
					lane.lastHeartbeatAt = timestamp;
					saveSpineBatchState(projectRoot, state);
				},
				onWorkerPid: (pid) => {
					if (pid > 0) {
						lane.workerPid = pid;
						saveSpineBatchState(projectRoot, state);
					}
				},
			});
			if (!reworkResult.ok) {
				const aborted = reworkResult.classification === "aborted";
				task.status = aborted ? "aborted" : "failed";
				task.endedAt = Date.now();
				task.exitReason = reworkResult.classification ?? "worker_failed";
				updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
				recomputeTaskCounters(state);
				saveSpineBatchState(projectRoot, state);
				recordLaneTaskMetric({
					projectRoot,
					batchId,
					task,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, aborted, workerResult: reworkResult };
			}

			appendJournalEvent(projectRoot, batchId, "lane.completed", {
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				phase: "final_rework",
			});
			continue;
		}

		recordFinalReviewTaskFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			exitReason: "final_review_invalid_verdict",
			verdict: reviewResult.verdict,
			finalAttempt,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "final_review_invalid_verdict",
			output: "final review artifact missing PASS, REVISE, or REPLAN verdict",
		};
	}
}

/**
 * @param {object} params
 */
export async function runTaskOnLane({
	projectRoot,
	state,
	batchId,
	baseBranch,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch;
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const scopeResult = loadTaskFileScopePaths(path.join(projectRoot, taskFolderRel));
	if (!scopeResult.ok) {
		return recordPromptParseFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			scopeResult,
			config,
			taskFolderPath: path.join(projectRoot, taskFolderRel),
		});
	}
	const fileScopePaths = scopeResult.fileScopePaths;

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
	});

	const workerResult = await runWorker({
		worktreePath: wt,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneBranch: taskBranch,
		laneCorrelationId,
		fileScopePaths,
		config,
		onHeartbeat: (timestamp) => {
			lane.lastHeartbeatAt = timestamp;
			saveSpineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveSpineBatchState(projectRoot, state);
			}
		},
	});

	if (!workerResult.ok) {
		const aborted = workerResult.classification === "aborted";
		appendJournalEvent(projectRoot, batchId, "lane.died", {
			laneNumber,
			laneId: lane.laneId,
			taskId,
			correlationId: laneCorrelationId,
			reason: workerResult.classification ?? "worker_failed",
		});
		task.status = aborted ? "aborted" : "failed";
		task.endedAt = Date.now();
		task.exitReason = workerResult.classification ?? "worker_failed";
		updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		if (!aborted) {
			const salvageFields = recordTaskFailureSalvage({
				projectRoot,
				batchId,
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				worktreePath: wt,
				fileScopePaths,
				taskFolder: taskFolderInWorktree,
				workerResult,
				config,
				batchPhase: state.phase,
				taskBranch,
			});
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				...workerResult,
				...salvageFields,
			});
		}
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return { ok: false, aborted, workerResult };
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

	const codeReview = await runCodeReviewPhase({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
	});
	if (!codeReview.ok) {
		return codeReview;
	}

	const finalReview = await runFinalReviewPhase({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
		baseBranch,
	});
	if (!finalReview.ok) {
		return finalReview;
	}

	if (process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT === "1") {
		const donePath = path.join(taskFolderInWorktree, ".DONE");
		if (fs.existsSync(donePath)) {
			fs.unlinkSync(donePath);
		}
	}

	const ignorePatterns = Array.isArray(config?.worktreeSetupIgnorePaths)
		? config.worktreeSetupIgnorePaths
		: [];
	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: laneCommit.failureClass ?? "lane_commit_failed",
			exitCode: 1,
			output: laneCommit.error,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = filterPorcelain(gitPorcelain(wt), ignorePatterns);
	if (remainingDirty) {
		const dirtyOutput =
			"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "DirtyWorktree",
			exitCode: 1,
			output: dirtyOutput,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: dirtyOutput,
		};
	}

	recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true });
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.completed",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderInWorktree,
	});

	return { ok: true, laneCommit };
}

/**
 * @param {object} params
 */
export async function mergeWaveLanesToOrch({
	projectRoot,
	state,
	batchId,
	baseBranch,
	orchBranch,
	waveIndex,
}) {
	const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
	const needsReplanTask = (state.tasks ?? []).find(
		(entry) =>
			waveTaskIds.includes(entry?.taskId) && entry?.exitReason === "needs_replan",
	);
	if (needsReplanTask) {
		return {
			ok: false,
			error: `wave merge blocked: task ${needsReplanTask.taskId} has exitReason needs_replan`,
			blockedBy: needsReplanTask.taskId,
			exitReason: "needs_replan",
		};
	}

	const lanes = state.lanes ?? [];
	let lastMergeCommit = null;

	for (const lane of lanes) {
		const laneNumber = lane.laneNumber;
		const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
		const laneSucceeded = waveTaskIds.some((taskId) => {
			const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
			return task && task.laneNumber === laneNumber && task.status === "succeeded";
		});
		if (!laneSucceeded) continue;

		const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
			laneNumber,
			waveIndex,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: false,
		});
		if (!merge.ok) {
			return { ok: false, error: merge.error ?? "merge_failed", laneNumber };
		}
		lastMergeCommit = merge.mergeCommit;
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
			laneNumber,
			waveIndex,
		});
	}

	state.mergeResults.push({
		waveIndex,
		status: "succeeded",
		failedLane: null,
		failureReason: null,
		mergeCommit: lastMergeCommit,
	});
	saveSpineBatchState(projectRoot, state);

	return { ok: true, mergeCommit: lastMergeCommit };
}
