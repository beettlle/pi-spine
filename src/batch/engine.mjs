/**
 * pi-spine single-lane batch engine (Phase 2, TP-012).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { discoverTasks } from "../compat/taskplane/discover.mjs";
import { buildPlan } from "../planner/index.mjs";
import { runBatchPreflight, resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import crypto from "node:crypto";
import { appendJournalEvent } from "./journal.mjs";
import { commitLaneWorktree, countCommitsAhead, gitPorcelain } from "./lane-commit.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	generateBatchId,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import {
	ensureOrchBranch,
	laneTaskBranch,
	laneWorktreePath,
	provisionLaneWorktree,
	removeLaneWorktree,
} from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";

/**
 * @param {import("../planner/index.mjs").buildPlan} plan
 */
export function countPlanTasks(plan) {
	const ids = new Set();
	for (const wave of plan.waves ?? []) {
		for (const taskId of wave.taskIds ?? []) {
			ids.add(taskId);
		}
	}
	return [...ids];
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return execFileSync("git", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
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
	const previous = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	try {
		const orchHeadBefore = git(projectRoot, ["rev-parse", orchBranch]);
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

		git(projectRoot, ["checkout", orchBranch]);
		git(projectRoot, ["merge", "--no-ff", taskBranch, "-m", `merge ${taskBranch} into ${orchBranch}`]);
		const mergeCommit = git(projectRoot, ["rev-parse", "HEAD"]);

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
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		try {
			git(projectRoot, ["checkout", previous || baseBranch]);
		} catch {
			git(projectRoot, ["checkout", baseBranch]);
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
function transitionPhase(state, newPhase, ctx) {
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
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.scope]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipPreflight]
 */
export async function startBatch({
	projectRoot,
	scope = "all",
	dryRun = false,
	skipPreflight = false,
}) {
	if (!skipPreflight) {
		const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
		if (!preflight.ok) {
			return {
				ok: false,
				exitCode: preflight.exitCode ?? 1,
				error: "preflight_failed",
				output: preflight.output,
			};
		}
	}

	assertNoActiveBatch(projectRoot);

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRoot) {
		return { ok: false, exitCode: 1, error: "tasks_root_missing" };
	}

	const plan = buildPlan({
		scope,
		config: { ...config, lanes: { maxParallel: 1, queueExcess: false } },
		tasksRoot,
	});

	const taskIds = countPlanTasks(plan);
	if (taskIds.length !== 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "single_task_required",
			output: `TP-012 supports exactly one task per batch; plan selected: ${taskIds.join(", ")}. Use: spine batch start TP-012`,
		};
	}

	const taskId = taskIds[0];
	if (dryRun) {
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			taskId,
			plan,
			output: `Dry run: would start batch for task ${taskId} (1 task, 1 lane).\n`,
		};
	}

	const batchId = generateBatchId();
	const baseBranch = config.baseBranch ?? "main";
	const orchBranch = `orch/spine-${batchId}`;
	const taskBranch = laneTaskBranch(batchId, 1);

	const discovered = discoverTasks(tasksRoot);
	const taskEntry = discovered.find((t) => t.taskId === taskId);
	if (!taskEntry) {
		return { ok: false, exitCode: 1, error: "task_not_found", taskId };
	}

	const taskFolderRel = path.relative(projectRoot, taskEntry.folderPath);
	const worktreePath = laneWorktreePath(projectRoot, batchId, 1);

	const tasks = [
		{
			taskId,
			laneNumber: 1,
			status: "pending",
			taskFolder: taskEntry.folderPath,
			startedAt: null,
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		},
	];

	const lanes = [
		{
			laneNumber: 1,
			laneId: "lane-1",
			worktreePath,
			branch: taskBranch,
			taskIds: [taskId],
			lastHeartbeatAt: null,
		},
	];

	let state = createInitialBatchState({
		batchId,
		baseBranch,
		orchBranch,
		wavePlan: plan.waves.map((w) => w.taskIds),
		tasks,
		lanes,
	});

	saveSpineBatchState(projectRoot, state);

	const laneCorrelationId = crypto.randomUUID();

	try {
		ensureOrchBranch(projectRoot, baseBranch, orchBranch);
		transitionPhase(state, "running", { projectRoot, batchId });
		saveSpineBatchState(projectRoot, state);

		const { worktreePath: wt } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});
		appendJournalEvent(projectRoot, batchId, "lane.provisioned", {
			laneNumber: 1,
			laneId: "lane-1",
			worktreePath: wt,
			taskBranch,
			correlationId: laneCorrelationId,
		});

		state.tasks[0].status = "running";
		state.tasks[0].startedAt = Date.now();
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.started", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
		});

		const taskFolderInWorktree = path.join(wt, taskFolderRel);
		const workerResult = await runWorker({
			worktreePath: wt,
			taskFolder: taskFolderInWorktree,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			laneBranch: taskBranch,
			laneCorrelationId,
			config,
			onHeartbeat: (timestamp) => {
				state.lanes[0].lastHeartbeatAt = timestamp;
				saveSpineBatchState(projectRoot, state);
			},
		});

		if (!workerResult.ok) {
			appendJournalEvent(projectRoot, batchId, "lane.died", {
				laneNumber: 1,
				laneId: "lane-1",
				taskId,
				correlationId: laneCorrelationId,
				reason: workerResult.classification ?? "worker_failed",
			});
			state.tasks[0].status = "failed";
			state.tasks[0].endedAt = Date.now();
			state.tasks[0].exitReason = workerResult.classification ?? "worker_failed";
			updateSegmentForTask(state, taskId, "failed");
			state.failedTasks = 1;
			state.endedAt = Date.now();
			state.lastError = workerResult.output?.slice(0, 500) ?? "worker failed";
			transitionPhase(state, "failed", {
				projectRoot,
				batchId,
				extra: { taskId },
			});
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: 1,
				laneId: "lane-1",
				correlationId: laneCorrelationId,
				...workerResult,
			});
			return {
				ok: false,
				exitCode: workerResult.exitCode ?? 1,
				batchId,
				taskId,
				error: "worker_failed",
				output: workerResult.output,
			};
		}

		appendJournalEvent(projectRoot, batchId, "lane.completed", {
			laneNumber: 1,
			laneId: "lane-1",
			taskId,
			correlationId: laneCorrelationId,
		});
		state.tasks[0].status = "succeeded";
		state.tasks[0].endedAt = Date.now();
		state.tasks[0].doneFileFound = true;
		state.tasks[0].exitReason = "done";
		state.succeededTasks = 1;
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: laneCorrelationId,
		});
		updateSegmentForTask(state, taskId, "succeeded");

		const laneCommit = commitLaneWorktree({
			worktreePath: wt,
			taskBranch,
			taskId,
			batchId,
			taskFolder: taskFolderInWorktree,
		});
		if (!laneCommit.ok) {
			state.tasks[0].status = "failed";
			state.tasks[0].endedAt = Date.now();
			state.tasks[0].exitReason = laneCommit.failureClass ?? "lane_commit_failed";
			state.failedTasks = 1;
			state.succeededTasks = 0;
			updateSegmentForTask(state, taskId, "failed");
			state.endedAt = Date.now();
			state.lastError = laneCommit.error ?? "lane commit failed";
			transitionPhase(state, "failed", {
				projectRoot,
				batchId,
				extra: { taskId, reason: "lane_commit" },
			});
			saveSpineBatchState(projectRoot, state);
			return {
				ok: false,
				exitCode: 1,
				batchId,
				taskId,
				error: "lane_commit_failed",
				output: laneCommit.error,
			};
		}
		if (laneCommit.committed) {
			appendJournalEvent(projectRoot, batchId, "lane.committed", {
				taskId,
				laneNumber: 1,
				commitSha: laneCommit.commitSha,
			});
		}

		const remainingDirty = gitPorcelain(wt);
		if (remainingDirty) {
			state.tasks[0].status = "failed";
			state.tasks[0].endedAt = Date.now();
			state.tasks[0].exitReason = "DirtyWorktree";
			state.failedTasks = 1;
			state.succeededTasks = 0;
			updateSegmentForTask(state, taskId, "failed");
			state.endedAt = Date.now();
			state.lastError =
				"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output";
			transitionPhase(state, "failed", {
				projectRoot,
				batchId,
				extra: { taskId, reason: "dirty_after_commit" },
			});
			saveSpineBatchState(projectRoot, state);
			return {
				ok: false,
				exitCode: 1,
				batchId,
				taskId,
				error: "dirty_after_lane_commit",
				output: state.lastError,
			};
		}

		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
		});
		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: laneCommit.committed,
		});
		if (!merge.ok) {
			state.endedAt = Date.now();
			state.lastError = merge.error ?? "merge failed";
			transitionPhase(state, "failed", {
				projectRoot,
				batchId,
				extra: { reason: "merge" },
			});
			saveSpineBatchState(projectRoot, state);
			return { ok: false, exitCode: 1, batchId, error: "merge_failed", output: merge.error };
		}

		state.mergeResults.push({
			waveIndex: 0,
			status: "succeeded",
			failedLane: null,
			failureReason: null,
			mergeCommit: merge.mergeCommit,
		});
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
		});

		state.endedAt = Date.now();
		transitionPhase(state, "completed", {
			projectRoot,
			batchId,
			extra: { taskId, mergeCommit: merge.mergeCommit },
		});
		saveSpineBatchState(projectRoot, state);

		return {
			ok: true,
			exitCode: 0,
			batchId,
			taskId,
			orchBranch,
			taskBranch,
			mergeCommit: merge.mergeCommit,
			output: `Batch ${batchId} completed: ${taskId} succeeded; merged to ${orchBranch}.\n  → spine batch complete\n  → spine status\n`,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		state.endedAt = Date.now();
		state.lastError = message;
		transitionPhase(state, "failed", {
			projectRoot,
			batchId,
			extra: { error: message },
		});
		saveSpineBatchState(projectRoot, state);
		removeLaneWorktree(projectRoot, batchId, 1);
		return { ok: false, exitCode: 1, batchId, error: message };
	}
}
