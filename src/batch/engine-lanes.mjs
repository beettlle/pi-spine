/**
 * Lane task execution, file-scope loading, and orch merge wiring (extracted from engine.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadTaskPacket } from "../tasks/packet/index.mjs";
import {
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
} from "../config/cursor-rules/discover.mjs";
import { appendJournalEvent } from "./journal.mjs";
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
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import { laneTaskBranch, laneWorktreePath } from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {{ throwOnError?: boolean }} [options]
 */
function git(projectRoot, args, { throwOnError = true } = {}) {
	try {
		return execFileSync("git", args, {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (err) {
		if (throwOnError) throw err;
		return null;
	}
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
	execFileSync("git", ["add", RULES_MANIFEST_REL_PATH], {
		cwd: projectRoot,
		stdio: "ignore",
	});
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
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.skipped_done_on_disk", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
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
		return { ok: false, aborted, workerResult };
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

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
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output: dirtyOutput,
		};
	}

	recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true });
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.completed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
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
