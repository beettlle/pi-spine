/**
 * Batch scope resolution and wave merge policy (extracted from engine.mjs).
 */

import { discoverTasks } from "../tasks/packet/discover.mjs";
import { filterPendingTaskIds } from "../planner/pending.mjs";
import { NO_PENDING_TASKS_ERROR } from "../planner/scope.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	loadSpineBatchState,
	saveSpineBatchState,
} from "./state.mjs";

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
 * @param {string} scope
 */
export function isExplicitBatchScope(scope) {
	const normalized = String(scope ?? "")
		.trim()
		.toLowerCase();
	return Boolean(normalized) && normalized !== "all";
}

/**
 * Batch start resolves bare `all` to pending-filtered IDs (plan CLI keeps full `all`).
 *
 * @param {string} scope
 * @param {string} tasksRoot
 */
export function resolveBatchStartScope(scope, tasksRoot) {
	const trimmed = String(scope ?? "").trim();
	const normalized = trimmed.toLowerCase();

	if (!trimmed || normalized === "all") {
		const discovered = discoverTasks(tasksRoot);
		const pendingIds = filterPendingTaskIds(discovered, tasksRoot);
		if (pendingIds.length === 0) {
			return {
				ok: false,
				error: "no_pending_tasks",
				output: `${NO_PENDING_TASKS_ERROR}\n`,
			};
		}
		return {
			ok: true,
			scope: pendingIds.join(" "),
			policyScope: "pending",
		};
	}

	if (normalized === "pending") {
		return { ok: true, scope: "pending", policyScope: "pending" };
	}

	return { ok: true, scope: trimmed, policyScope: trimmed };
}

/**
 * @param {object} plan
 * @param {string} scope
 */
export function canStartMultiTaskBatch(plan, scope) {
	const taskIds = countPlanTasks(plan);
	if (taskIds.length <= 1) {
		return { ok: true, taskIds };
	}

	const singleWave = (plan.waves?.length ?? 0) === 1;
	const firstWave = plan.waves?.[0];
	const virtualLaneCount = firstWave?.virtualLaneCount ?? 1;
	const multiLane = virtualLaneCount > 1;
	const explicit = isExplicitBatchScope(scope);

	if (explicit || (singleWave && multiLane)) {
		return { ok: true, taskIds };
	}

	return {
		ok: false,
		taskIds,
		error: "multi_task_not_allowed",
		output:
			`Multi-task batches require a single wave with disjoint lanes (virtualLaneCount > 1) or an explicit scope.\n` +
			`Plan selected ${taskIds.length} task(s) across ${plan.waves?.length ?? 0} wave(s); virtualLaneCount=${virtualLaneCount}.\n` +
			`Use: spine batch start TP-001 TP-002  or  spine plan <scope>  to verify lane assignment.\n`,
	};
}

/**
 * @param {object} plan
 */
export function maxLaneNumberForPlan(plan) {
	let max = 1;
	for (const wave of plan.waves ?? []) {
		for (const tick of wave.ticks ?? []) {
			max = Math.max(max, tick.lanes?.length ?? 0);
		}
	}
	return max;
}

/**
 * @param {object} plan
 * @returns {Map<string, { laneNumber: number, waveIndex: number, tickIndex: number }>}
 */
export function buildTaskLaneAssignments(plan) {
	/** @type {Map<string, { laneNumber: number, waveIndex: number, tickIndex: number }>} */
	const map = new Map();
	for (const wave of plan.waves ?? []) {
		for (const tick of wave.ticks ?? []) {
			for (let laneInTick = 0; laneInTick < (tick.lanes?.length ?? 0); laneInTick++) {
				const laneNumber = laneInTick + 1;
				for (const taskId of tick.lanes[laneInTick] ?? []) {
					map.set(taskId, {
						laneNumber,
						waveIndex: wave.index,
						tickIndex: tick.index,
					});
				}
			}
		}
	}
	return map;
}

/**
 * @param {object[]} failedTasks
 * @param {object[]} pendingTasks
 */
export function formatMixedOutcomeMessage(failedTasks, pendingTasks) {
	const failedIds = failedTasks.map((task) => task.taskId);
	const pendingIds = pendingTasks.map((task) => task.taskId);
	const lines = ["Wave merge blocked (§17.4 mixed-outcome policy)."];

	if (failedIds.length > 0) {
		lines.push(`Failed task(s): ${failedIds.join(", ")}.`);
		lines.push(
			`Suggested: ${failedIds.map((id) => `/spine-retry-task ${id}`).join("; ")} then /spine-resume --force`,
		);
		lines.push(`Or skip: ${failedIds.map((id) => `/spine-skip-task ${id}`).join("; ")}`);
	}
	if (pendingIds.length > 0) {
		lines.push(`Pending/running task(s): ${pendingIds.join(", ")}.`);
	}
	lines.push("Do not report batch success while failures remain.");
	return lines.join("\n");
}

/**
 * @param {object} state
 * @param {number} waveIndex
 */
export function assessWaveMergeEligibility(state, waveIndex) {
	const forceMerged = (state.resilience?.forceMergedWaves ?? []).includes(waveIndex);
	if (forceMerged) {
		return { ok: true, forceMerged: true };
	}

	const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
	const tasks = waveTaskIds
		.map((taskId) => (state.tasks ?? []).find((task) => task?.taskId === taskId))
		.filter(Boolean);

	const failed = tasks.filter((task) => task.status === "failed");
	const pending = tasks.filter(
		(task) => task.status === "pending" || task.status === "running",
	);

	if (failed.length === 0 && pending.length === 0) {
		return { ok: true };
	}

	return {
		ok: false,
		failedTaskIds: failed.map((task) => task.taskId),
		pendingTaskIds: pending.map((task) => task.taskId),
		message: formatMixedOutcomeMessage(failed, pending),
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} params.waveIndex
 */
export function forceMergeWave({ projectRoot, waveIndex }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	if (phase !== "failed" && phase !== "paused") {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_force_merge",
			output: `Force-merge is allowed when batch phase is failed or paused (current: ${phase}).\n`,
			batchId: state.batchId,
		};
	}

	state.resilience = state.resilience ?? {};
	state.resilience.forceMergedWaves = [...(state.resilience.forceMergedWaves ?? []), waveIndex];
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, state.batchId, "batch.force_merge_requested", {
		waveIndex,
	});

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		waveIndex,
		output: `Wave ${waveIndex} marked for force-merge. Resume with: spine batch resume --force\n`,
	};
}
