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
import { appendJournalEvent } from "./journal.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	generateBatchId,
	saveSpineBatchState,
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
 */
export function mergeLaneToOrch({ projectRoot, baseBranch, orchBranch, taskBranch, batchId }) {
	const previous = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	try {
		git(projectRoot, ["checkout", orchBranch]);
		git(projectRoot, ["merge", "--no-ff", taskBranch, "-m", `merge ${taskBranch} into ${orchBranch}`]);
		const mergeCommit = git(projectRoot, ["rev-parse", "HEAD"]);
		return { ok: true, mergeCommit };
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
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.scope]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipPreflight]
 */
export function startBatch({
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
	appendJournalEvent(projectRoot, batchId, "batch.started", { baseBranch, orchBranch });

	try {
		ensureOrchBranch(projectRoot, baseBranch, orchBranch);
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const { worktreePath: wt } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});
		appendJournalEvent(projectRoot, batchId, "lane.provisioned", {
			laneNumber: 1,
			worktreePath: wt,
			taskBranch,
		});

		state.tasks[0].status = "running";
		state.tasks[0].startedAt = Date.now();
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1 });

		const taskFolderInWorktree = path.join(wt, taskFolderRel);
		const workerResult = runWorker({ worktreePath: wt, taskFolder: taskFolderInWorktree });

		if (!workerResult.ok) {
			state.tasks[0].status = "failed";
			state.tasks[0].endedAt = Date.now();
			state.tasks[0].exitReason = workerResult.classification ?? "worker_failed";
			state.failedTasks = 1;
			state.phase = "failed";
			state.endedAt = Date.now();
			state.lastError = workerResult.output?.slice(0, 500) ?? "worker failed";
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "task.failed", { taskId, ...workerResult });
			appendJournalEvent(projectRoot, batchId, "batch.failed", { taskId });
			return {
				ok: false,
				exitCode: workerResult.exitCode ?? 1,
				batchId,
				taskId,
				error: "worker_failed",
				output: workerResult.output,
			};
		}

		state.tasks[0].status = "succeeded";
		state.tasks[0].endedAt = Date.now();
		state.tasks[0].doneFileFound = true;
		state.tasks[0].exitReason = "done";
		state.succeededTasks = 1;
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "task.completed", { taskId });

		appendJournalEvent(projectRoot, batchId, "batch.merge_started", { taskBranch, orchBranch });
		const merge = mergeLaneToOrch({ projectRoot, baseBranch, orchBranch, taskBranch, batchId });
		if (!merge.ok) {
			state.phase = "failed";
			state.endedAt = Date.now();
			state.lastError = merge.error ?? "merge failed";
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "batch.failed", { reason: "merge" });
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

		state.phase = "completed";
		state.endedAt = Date.now();
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "batch.completed", { taskId, mergeCommit: merge.mergeCommit });

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
		state.phase = "failed";
		state.endedAt = Date.now();
		state.lastError = message;
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "batch.failed", { error: message });
		removeLaneWorktree(projectRoot, batchId, 1);
		return { ok: false, exitCode: 1, batchId, error: message };
	}
}
