/**
 * Multi-task batch resume validation (TP-039).
 */

import fs from "node:fs";
import { loadSpineBatchState, validateBatchState } from "./state.mjs";
import { laneWorktreePath } from "./worktree.mjs";
import { detectSegmentDrift } from "./retry.mjs";

/**
 * @param {object} state
 * @param {object} task
 */
function isTaskResumable(state, task) {
	const status = String(task.status ?? "").toLowerCase();
	if (status === "pending" || status === "running") return true;

	return (state.segments ?? []).some((segment) => {
		if (!segment || segment.taskId !== task.taskId) return false;
		const segmentStatus = String(segment.status ?? "").toLowerCase();
		return segmentStatus === "pending" || segmentStatus === "running";
	});
}

/**
 * @param {object} state
 */
export function computePendingTasks(state) {
	return (state.tasks ?? []).filter((task) => task && isTaskResumable(state, task));
}

/**
 * @param {object} state
 * @param {object[]} pendingTasks
 */
export function findResumableWave(state, pendingTasks) {
	const pendingIds = new Set(pendingTasks.map((task) => task.taskId));
	const wavePlan = state.wavePlan ?? [];

	for (let waveIndex = 0; waveIndex < wavePlan.length; waveIndex++) {
		const waveTaskIds = wavePlan[waveIndex] ?? [];
		if (waveTaskIds.some((taskId) => pendingIds.has(taskId))) {
			return waveIndex;
		}
	}

	return Number(state.currentWaveIndex ?? 0);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 */
export function validateMultiTaskResume({ projectRoot, force = false }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	const resumable = phase === "paused" || (phase === "failed" && force);
	if (!resumable) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_resume",
			output:
				phase === "failed" && !force
					? `Batch ${state.batchId} failed. Use spine batch resume --force to continue.\n`
					: `Cannot resume batch in phase ${phase}.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	if (detectSegmentDrift(state) && !(phase === "failed" && force)) {
		const driftTask = state.tasks.find(
			(task) =>
				task?.status === "pending" &&
				state.segments?.some(
					(segment) =>
						segment?.taskId === task.taskId &&
						(segment.status === "failed" || segment.status === "succeeded"),
				),
		);
		const driftTaskId = driftTask?.taskId ?? state.tasks[0]?.taskId ?? "unknown";
		return {
			ok: false,
			exitCode: 1,
			error: "RetrySegmentDrift",
			failureClass: "RetrySegmentDrift",
			output: `Segment drift: task ${driftTaskId} is pending but segments are terminal.\n  → spine batch retry ${driftTaskId}\n  → spine batch resume --force\n`,
			batchId: state.batchId,
			taskId: driftTaskId,
		};
	}

	const tasks = state.tasks ?? [];
	const lanes = state.lanes ?? [];
	if (tasks.length < 1 || lanes.length < 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "no_tasks_or_lanes",
			output: "Batch must have at least one task and one lane to resume.\n",
			batchId: state.batchId,
		};
	}

	const batchId = state.batchId;
	for (const lane of lanes) {
		const laneNumber = Number(lane.laneNumber ?? 1);
		const wt = lane.worktreePath ?? laneWorktreePath(projectRoot, batchId, laneNumber);
		if (!fs.existsSync(wt)) {
			return {
				ok: false,
				exitCode: 1,
				error: "worktree_missing",
				output: `Lane ${laneNumber} worktree not found: ${wt}\n`,
				batchId,
				laneNumber,
			};
		}
	}

	const pendingTasks = computePendingTasks(state);
	if (pendingTasks.length < 1) {
		return {
			ok: false,
			exitCode: 1,
			error: "no_pending_tasks",
			output: "No pending tasks to resume.\n",
			batchId: state.batchId,
		};
	}

	const resumableWave = findResumableWave(state, pendingTasks);

	return {
		ok: true,
		batchId,
		phase,
		updatedAt: Number(state.updatedAt ?? 0),
		pendingTasks,
		lanes,
		resumableWave,
	};
}
