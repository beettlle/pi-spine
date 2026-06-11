/**
 * Lane task execution, file-scope loading, and orch merge wiring (extracted from engine.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";
import { loadTaskPacket } from "../tasks/packet/index.mjs";
import {
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
} from "../config/cursor-rules/discover.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recordTaskTerminalMetric } from "./metrics.mjs";
import {
	commitLaneWorktree,
	countCommitsAhead,
	filterPorcelain,
	gitPorcelain,
} from "./lane-commit.mjs";
import { buildTaskLaneAssignments, countPlanTasks } from "./engine-scope.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";
import { formatReviewTimestamp, readReviewLevel } from "./review.mjs";
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

/**
 * @param {object} params
 */
function recordLaneTaskMetric({ projectRoot, batchId, task, config, taskFolder }) {
	recordTaskTerminalMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
	});
}

/**
 * @param {string} taskFolderPath
 */
export function loadTaskFileScopePaths(taskFolderPath) {
	try {
		const packet = loadTaskPacket(taskFolderPath);
		if (!packet.validation?.ok) {
			return {
				ok: false,
				error: packet.validation.errors.join("; "),
				errors: packet.validation.errors,
				promptPath: packet.promptPath,
			};
		}
		return { ok: true, fileScopePaths: packet.prompt?.fileScope ?? [] };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
			promptPath: path.join(taskFolderPath, "PROMPT.md"),
		};
	}
}

/**
 * @param {object} params
 */
function recordPromptParseFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	scopeResult,
	config = {},
	taskFolderPath,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const parseError = scopeResult.error;

	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = "prompt_parse_failed";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "task.prompt_parse_failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		error: parseError,
		errors: scopeResult.errors,
		promptPath: scopeResult.promptPath,
	});
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: "prompt_parse_failed",
		exitCode: 1,
		output: parseError,
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderPath,
	});

	return {
		ok: false,
		workerResult: {
			ok: false,
			classification: "prompt_parse_failed",
			output: parseError,
			exitCode: 1,
		},
	};
}

/**
 * @param {object} params
 */
export function buildTasksAndLanesFromPlan({ plan, discovered, projectRoot, batchId, maxLaneNumber }) {
	const assignments = buildTaskLaneAssignments(plan);
	const taskIds = countPlanTasks(plan);

	/** @type {Record<number, string[]>} */
	const laneTaskIds = {};
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		laneTaskIds[laneNumber] = [];
	}

	const tasks = taskIds.map((taskId) => {
		const entry = discovered.find((task) => task.taskId === taskId);
		const assignment = assignments.get(taskId) ?? { laneNumber: 1 };
		laneTaskIds[assignment.laneNumber].push(taskId);
		return {
			taskId,
			laneNumber: assignment.laneNumber,
			status: "pending",
			taskFolder: entry?.folderPath ?? null,
			startedAt: null,
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		};
	});

	const lanes = [];
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		lanes.push({
			laneNumber,
			laneId: `lane-${laneNumber}`,
			worktreePath: laneWorktreePath(projectRoot, batchId, laneNumber),
			branch: laneTaskBranch(batchId, laneNumber),
			taskIds: laneTaskIds[laneNumber] ?? [],
			lastHeartbeatAt: null,
		});
	}

	return { tasks, lanes, assignments };
}

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

	return {
		ok: false,
		skipped: false,
		reviewLevel,
		verdict: null,
		feedback: "",
		artifactPath,
		spawnFailed: true,
		error: "final review requires SPINE_REVIEW_STUB or spine review step --type final (SP-150)",
		exitCode: 1,
		attempt,
	};
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
export async function skipTaskDoneOnDisk({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	taskFolderPath,
	laneCorrelationId,
	config = {},
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const endedAt = Date.now();
	const startedAt = task.startedAt ?? endedAt;

	recordTaskSucceeded(state, taskId, {
		exitReason: "skipped_done_on_disk",
		doneFileFound: true,
		endedAt,
		startedAt,
	});
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.skipped_done_on_disk",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			taskFolder: taskFolderPath,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderPath,
	});
	return { ok: true, skipped: true };
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
