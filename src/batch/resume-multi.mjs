/**
 * Multi-task batch resume validation (TP-039) and execution (TP-040).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";
import { resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { assessWaveMergeEligibility } from "./engine-scope.mjs";
import { mergeWaveLanesToOrch } from "./engine-lanes.mjs";
import { recordResumePhaseTransition } from "./resume-common.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { finalizeResumedBatchForIntegrate, isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import {
	countPendingSegments,
	failBatchFromEngineError,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";
import { executeResumeWave, resetFailedTasksForForceResume } from "./resume-multi-lanes.mjs";
import { validateMultiTaskResume } from "./resume-multi-validate.mjs";

export { computePendingTasks, findResumableWave, validateMultiTaskResume } from "./resume-multi-validate.mjs";

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force]
 * @param {object} [params.resumeCheck]
 */
export async function resumeMultiTaskBatch({ projectRoot, force = false, resumeCheck = null }) {
	const check = resumeCheck ?? validateMultiTaskResume({ projectRoot, force });
	if (!check.ok) {
		return check;
	}

	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	const batchId = state.batchId;
	const baseBranch = state.baseBranch ?? "main";
	const orchBranch = state.orchBranch;
	const resumeForced = Boolean(force);
	const fromPhase = phase;

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRootRel = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	resolveTasksRoot(projectRoot, configResult);

	if (phase === "failed" && force) {
		resetFailedTasksForForceResume({ state, pendingTasks: check.pendingTasks });
	}

	if (check.postMergeLimbo) {
		terminateStaleDetachedEngine({
			projectRoot,
			state,
			batchId,
			fromPhase: phase,
		});
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
		return finalizeResumedBatchForIntegrate({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumeForced: resumeForced,
		});
	}

	terminateStaleDetachedEngine({
		projectRoot,
		state,
		batchId,
		fromPhase: phase,
	});

	const pendingSegments = countPendingSegments(state);

	try {
		state.phase = "running";
		state.endedAt = null;
		state.lastError = null;
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);
		recordResumePhaseTransition(projectRoot, batchId, fromPhase, "running", {
			resumeForced,
			pendingSegments,
			repairedLanes: [],
			pendingTaskIds: check.pendingTasks.map((task) => task.taskId),
			resumableWave: check.resumableWave,
		});

		const events = readJournalEvents(projectRoot, batchId);
		let batchAborted = false;
		const startWave = check.resumableWave ?? 0;
		const wavePlan = state.wavePlan ?? [];
		state.mergeResults = state.mergeResults ?? [];

		for (let waveIndex = startWave; waveIndex < wavePlan.length; waveIndex++) {
			state.currentWaveIndex = waveIndex;
			saveSpineBatchState(projectRoot, state);

			const waveTaskIds = wavePlan[waveIndex] ?? [];
			const waveOutcome = await executeResumeWave({
				projectRoot,
				state,
				batchId,
				config,
				tasksRootRel,
				waveIndex,
				waveTaskIds,
				events,
			});

			if (!waveOutcome.ok) {
				return waveOutcome.result;
			}
			if (waveOutcome.batchAborted) {
				batchAborted = true;
			}

			const waveResults = waveOutcome.waveResults;
			if (batchAborted) {
				const abortedTask = state.tasks.find((task) => task.status === "aborted");
				state.endedAt = Date.now();
				state.lastError = "batch aborted";
				state.phase = "aborted";
				saveSpineBatchState(projectRoot, state);
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "aborted",
					taskId: abortedTask?.taskId,
					output: "Batch aborted.\n",
				};
			}

			const failed = waveResults.filter((result) => !result.ok);
			if (failed.length > 0) {
				const first = failed[0];
				state.endedAt = Date.now();
				state.lastError = first.output?.slice(0, 500) ?? first.error ?? "worker failed";
				state.phase = "failed";
				saveSpineBatchState(projectRoot, state);
				return {
					ok: false,
					exitCode: 1,
					batchId,
					taskId: first.taskId,
					error: first.error ?? "worker_failed",
					output: first.output ?? state.lastError,
				};
			}

			const alreadyMerged = (state.mergeResults ?? []).some(
				(entry) => entry.waveIndex === waveIndex && entry.status === "succeeded",
			);
			if (alreadyMerged) {
				continue;
			}

			const mergeEligibility = assessWaveMergeEligibility(state, waveIndex);
			if (!mergeEligibility.ok) {
				state.endedAt = Date.now();
				state.lastError = mergeEligibility.message?.slice(0, 500) ?? "mixed_outcome";
				state.phase = "failed";
				saveSpineBatchState(projectRoot, state);
				appendJournalEvent(projectRoot, batchId, "batch.merge_blocked", {
					waveIndex,
					failedTaskIds: mergeEligibility.failedTaskIds,
					pendingTaskIds: mergeEligibility.pendingTaskIds,
				});
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "mixed_outcome_merge_blocked",
					failedTaskIds: mergeEligibility.failedTaskIds,
					output: `${mergeEligibility.message}\n`,
				};
			}

			const mergeResult = await mergeWaveLanesToOrch({
				projectRoot,
				state,
				batchId,
				baseBranch,
				orchBranch,
				waveIndex,
				resumed: true,
			});
			if (!mergeResult.ok) {
				state.endedAt = Date.now();
				state.lastError = mergeResult.error ?? "merge failed";
				state.phase = "failed";
				saveSpineBatchState(projectRoot, state);
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "merge_failed",
					output: mergeResult.error,
				};
			}

			if (mergeResult.finalized && mergeResult.finalizeResult) {
				return mergeResult.finalizeResult;
			}
		}

		return finalizeResumedBatchForIntegrate({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumeForced: resumeForced,
		});
	} catch (err) {
		/** @type {{ taskId?: string, laneNumber?: number }} */
		const ctx = err && typeof err === "object" ? err : {};
		failBatchFromEngineError({
			projectRoot,
			state,
			batchId,
			error: err,
			taskId: ctx.taskId ?? null,
			laneNumber: ctx.laneNumber ?? null,
		});
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			exitCode: 1,
			batchId,
			taskId: ctx.taskId,
			error: "engine_crashed",
			output: message,
		};
	}
}
