/**
 * Batch pause CLI with attached-engine confirmation (SP-376, GitHub #57).
 */

import { isProcessAlive } from "../process/liveness.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recordResumePhaseTransition } from "./resume-common.mjs";
import {
	loadSpineBatchState,
	readBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";

/** Grace period for attached engine to persist phase: paused (SP-376). */
export const PAUSE_CONFIRM_GRACE_MS = 3_000;

/** Poll interval while waiting for pause confirmation. */
export const PAUSE_CONFIRM_POLL_MS = 100;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} [params.confirmGraceMs]
 * @param {number} [params.pollIntervalMs]
 * @param {(ms: number) => Promise<void>} [params.sleepFn]
 */
export async function waitForPauseConfirmation({
	projectRoot,
	confirmGraceMs,
	pollIntervalMs,
	sleepFn = defaultSleep,
}) {
	const deadline = Date.now() + confirmGraceMs;
	while (Date.now() < deadline) {
		const currentPhase = String(loadSpineBatchState(projectRoot).raw?.phase ?? "");
		if (currentPhase === "paused") {
			return true;
		}
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			break;
		}
		await sleepFn(Math.min(pollIntervalMs, remaining));
	}
	return String(loadSpineBatchState(projectRoot).raw?.phase ?? "") === "paused";
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} [params.confirmGraceMs]
 * @param {number} [params.pollIntervalMs]
 * @param {(ms: number) => Promise<void>} [params.sleepFn]
 */
export async function pauseBatch({
	projectRoot,
	confirmGraceMs = PAUSE_CONFIRM_GRACE_MS,
	pollIntervalMs = PAUSE_CONFIRM_POLL_MS,
	sleepFn = defaultSleep,
}) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	if (phase !== "running" && phase !== "planning") {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_pause",
			output: `Cannot pause batch in phase ${phase}. Only running or planning batches can be paused.\n`,
			batchId: state.batchId,
			phase,
		};
	}

	const fromPhase = phase;
	const batchId = state.batchId;
	const enginePid = readBatchEnginePid(state);
	const attachedEngineAlive =
		enginePid != null && enginePid !== process.pid && isProcessAlive(enginePid);

	state.phase = "paused";
	saveSpineBatchState(projectRoot, state);
	recordResumePhaseTransition(projectRoot, batchId, fromPhase, "paused");

	if (attachedEngineAlive) {
		const confirmed = await waitForPauseConfirmation({
			projectRoot,
			confirmGraceMs,
			pollIntervalMs,
			sleepFn,
		});

		if (!confirmed) {
			const current = loadSpineBatchState(projectRoot).raw;
			const currentPhase = String(current?.phase ?? "unknown");
			appendJournalEvent(projectRoot, batchId, "batch.pause_failed", {
				fromPhase,
				enginePid,
				observedPhase: currentPhase,
				graceMs: confirmGraceMs,
			});
			const output =
				`Pause not confirmed: batch-state phase is still "${currentPhase}" after ${confirmGraceMs}ms.\n` +
				`Journal recorded batch.paused but attached engine (PID ${enginePid}) did not persist phase: paused.\n` +
				"Stop the attached engine or wait for the current step to finish, then run spine batch pause again.\n" +
				"spine batch retry is blocked while phase is running — retry only after phase is paused.\n";
			return {
				ok: false,
				exitCode: 1,
				error: "pause_not_confirmed",
				output,
				batchId,
				phase: currentPhase,
				enginePid,
			};
		}
	}

	return {
		ok: true,
		exitCode: 0,
		batchId,
		phase: "paused",
		output: `Batch ${batchId} paused. No new tasks will be scheduled.\n  → spine batch resume\n`,
	};
}
