/**
 * Multi-task batch resume validation and worktree health checks (extracted from resume-multi.mjs).
 */

import fs from "node:fs";
import { isProcessAlive } from "../process/liveness.mjs";
import {
	findFirstWaveNeedingMerge,
	hasPendingWaveMerge,
} from "./merge/wave-merge-state.mjs";
import { loadGateRecord } from "./gate.mjs";
import { readJournalEvents } from "./journal.mjs";
import { detectOrphanRunning, journalEventsSinceResume } from "./orphan-detect.mjs";
import { isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { inspectGitState } from "./reconcile.mjs";
import { detectSegmentDrift } from "./retry.mjs";
import { loadSpineBatchState, readBatchEnginePid, validateBatchState } from "./state.mjs";
import {
	assertLaneWorktreeGitHealthy,
	laneWorktreePath,
	repairLaneWorktreeGitMetadata,
} from "./worktree.mjs";

/**
 * Resume-time limbo detection — state file, git signals, and journal merge events (SP-358, GitHub #41).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 */
export function detectPostMergeLimboForResume({ projectRoot, state }) {
	if (!state || typeof state !== "object") return false;
	if (String(state.phase ?? "") === "completed") return false;

	if (isPostMergeLimbo(state)) return true;

	const batchId = String(state.batchId ?? "");
	const git = inspectGitState({
		projectRoot,
		batchId,
		baseBranch: state.baseBranch ?? "main",
		orchBranch: state.orchBranch ?? null,
	});
	if (isPostMergeLimbo(state, git)) return true;

	const phase = String(state.phase ?? "");
	if (phase !== "running" && phase !== "merging") return false;
	if (state.endedAt != null) return false;
	if (!git.orchBranchExists || git.orchMergedToBase) return false;
	if (!batchId || loadGateRecord(projectRoot, batchId)) return false;

	const tasks = state.tasks ?? [];
	if (tasks.length === 0) return false;
	const allSucceeded = tasks.every((task) => String(task?.status ?? "") === "succeeded");
	if (!allSucceeded) return false;

	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) return false;

	const events = readJournalEvents(projectRoot, batchId);
	const mergeCompleted = events.filter((event) => event.type === "batch.merge_completed");
	if (mergeCompleted.length < 1) return false;

	const lastWaveIndex = totalWaves - 1;
	return mergeCompleted.some((event) => Number(event.payload?.waveIndex ?? -1) === lastWaveIndex);
}

/**
 * @param {object} state
 * @param {object} task
 */
export function isTaskResumable(state, task) {
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

export { hasPendingWaveMerge } from "./merge/wave-merge-state.mjs";

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

	const pendingMergeWave = findFirstWaveNeedingMerge(state);
	if (pendingMergeWave != null) {
		return pendingMergeWave;
	}

	return Number(state.currentWaveIndex ?? 0);
}

/**
 * Classify tasks for orphan detection during resume validation (status-only).
 *
 * @param {object[]} tasks
 */
function classifyTasksForOrphanDetect(tasks) {
	return (tasks ?? []).map((task) => {
		const status = String(task?.status ?? "").toLowerCase();
		return {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			classification: status === "running" ? "running" : status,
		};
	});
}

/**
 * Assess whether a running-phase batch may resume after a dead detached engine (SP-296).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 */
export function assessRunningPhaseResumeEligibility({ projectRoot, state }) {
	const classifiedTasks = classifyTasksForOrphanDetect(state.tasks);
	const hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
	const journalEvents = readJournalEvents(projectRoot, state.batchId);
	const scopedJournalEvents = journalEventsSinceResume(journalEvents, state);
	const orphanRunning = detectOrphanRunning({
		phase: String(state.phase ?? ""),
		hasRunningTasks,
		tasks: classifiedTasks,
		lanes: state.lanes ?? [],
		raw: state,
		journalEvents: scopedJournalEvents,
	});

	const enginePid = readBatchEnginePid(state);
	const enginePidDead = enginePid != null && !isProcessAlive(enginePid);
	const pidlessEngineOrphan = enginePid == null && orphanRunning?.kind === "engine";
	const engineConfirmedDead = enginePidDead || pidlessEngineOrphan;

	const allowOrphanResume =
		engineConfirmedDead &&
		orphanRunning != null &&
		(orphanRunning.kind === "engine" || orphanRunning.kind === "lane");

	return {
		engineConfirmedDead,
		allowOrphanResume,
		orphanKind: orphanRunning?.kind ?? null,
	};
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
	const postMergeLimbo = detectPostMergeLimboForResume({ projectRoot, state });
	const orphanEligibility =
		phase === "running"
			? assessRunningPhaseResumeEligibility({ projectRoot, state })
			: { engineConfirmedDead: false, allowOrphanResume: false, orphanKind: null };
	const resumable =
		phase === "paused" ||
		(phase === "failed" && force) ||
		(phase === "running" && postMergeLimbo) ||
		(phase === "running" && orphanEligibility.allowOrphanResume) ||
		(phase === "running" && force && orphanEligibility.engineConfirmedDead);
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

		try {
			assertLaneWorktreeGitHealthy(wt);
		} catch {
			try {
				repairLaneWorktreeGitMetadata({ projectRoot, worktreePath: wt });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					ok: false,
					exitCode: 1,
					error: "worktree_unhealthy",
					output: `Lane ${laneNumber} worktree git metadata unhealthy: ${wt}\n  ${message}\n`,
					batchId,
					laneNumber,
				};
			}
		}
	}

	const pendingTasks = computePendingTasks(state);
	const pendingWaveMerge = force && hasPendingWaveMerge(state);
	if (pendingTasks.length < 1 && !postMergeLimbo && !pendingWaveMerge) {
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
		postMergeLimbo,
		orphanResume: orphanEligibility.allowOrphanResume,
		engineConfirmedDead: orphanEligibility.engineConfirmedDead,
	};
}
