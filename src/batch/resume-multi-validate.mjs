/**
 * Multi-task batch resume validation and worktree health checks (extracted from resume-multi.mjs).
 */

import fs from "node:fs";
import { isProcessAlive } from "../process/liveness.mjs";
import { hasPendingWaveMerge } from "./merge/wave-merge-state.mjs";
import { loadGateRecord } from "./gate.mjs";
import { readJournalEvents } from "./journal.mjs";
import { detectOrphanRunning, journalEventsSinceResume } from "./orphan-detect.mjs";
import { inspectGitState } from "./reconcile.mjs";
import { detectSegmentDrift } from "./retry.mjs";
import {
	classifyTasksForOrphanDetect,
	computePendingTasks,
	detectPostMergeLimboFromResumeSignals,
	findResumableWave,
} from "./resume-validation.mjs";
import { loadSpineBatchState, readBatchEnginePid, validateBatchState } from "./state.mjs";
import {
	assertLaneWorktreeGitHealthy,
	laneWorktreePath,
	repairLaneWorktreeGitMetadata,
} from "./worktree.mjs";

export {
	classifyTasksForOrphanDetect,
	computePendingTasks,
	findResumableWave,
	isTaskResumable,
} from "./resume-validation.mjs";

/**
 * Resume-time limbo detection — state file, git signals, and journal merge events (SP-358, GitHub #41).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 */
export function detectPostMergeLimboForResume({ projectRoot, state }) {
	const batchId = String(state?.batchId ?? "");
	const git = inspectGitState({
		projectRoot,
		batchId,
		baseBranch: state?.baseBranch ?? "main",
		orchBranch: state?.orchBranch ?? null,
	});
	const journalEvents = batchId ? readJournalEvents(projectRoot, batchId) : [];
	const gateRecordExists = batchId ? loadGateRecord(projectRoot, batchId) != null : false;

	return detectPostMergeLimboFromResumeSignals({
		state,
		git,
		journalEvents,
		gateRecordExists,
	});
}

export { hasPendingWaveMerge } from "./merge/wave-merge-state.mjs";

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
	const pendingTasksForResume = computePendingTasks(state);
	const failedTasksCount = Number(state.failedTasks ?? 0);
	const failedPhaseRetryLimbo =
		phase === "failed" && failedTasksCount === 0 && pendingTasksForResume.length > 0;
	const postMergeLimbo = detectPostMergeLimboForResume({ projectRoot, state });
	const orphanEligibility =
		phase === "running"
			? assessRunningPhaseResumeEligibility({ projectRoot, state })
			: { engineConfirmedDead: false, allowOrphanResume: false, orphanKind: null };
	const resumable =
		phase === "paused" ||
		failedPhaseRetryLimbo ||
		(phase === "failed" && force) ||
		(phase === "merge_blocked" && force) ||
		(phase === "running" && postMergeLimbo) ||
		(phase === "running" && orphanEligibility.allowOrphanResume) ||
		(phase === "running" && force && orphanEligibility.engineConfirmedDead);
	if (!resumable) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_resume",
			output:
				phase === "merge_blocked" && !force
					? `Batch ${state.batchId} merge blocked. Resolve conflicts on ${state.orchBranch ?? "orch/spine-*"}, then spine batch resume --force.\n`
					: phase === "failed" && !force
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

	const pendingTasks = pendingTasksForResume;
	const pendingWaveMerge =
		force && (phase === "merge_blocked" || hasPendingWaveMerge(state));
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
