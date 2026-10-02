// @ts-nocheck
/**
 * Batch pause CLI with attached-engine confirmation (SP-376, GitHub #57).
 * Engine pause propagation helpers (SP-375).
 */

import { isProcessAlive } from "../process/liveness.mjs";
import { withBatchStateLock } from "./batch-state-lock.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { recordResumePhaseTransition } from "./resume-common.mjs";
import {
	loadSpineBatchState,
	readBatchEnginePid,
	saveSpineBatchState,
	updateSpineBatchState,
} from "./state.mjs";

/** Grace period for attached engine to persist phase: paused (SP-376). */
export const PAUSE_CONFIRM_GRACE_MS = 3_000;

/** Poll interval while waiting for pause confirmation. */
export const PAUSE_CONFIRM_POLL_MS = 100;

/**
 * True when the latest batch.paused journal event is newer than the latest batch.resumed.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function isOperatorPauseActive(projectRoot, batchId) {
	const events = readJournalEvents(projectRoot, batchId);
	let lastPauseIdx = -1;
	let lastResumeIdx = -1;
	for (let i = 0; i < events.length; i++) {
		const type = String(events[i].type ?? "");
		if (type === "batch.paused") lastPauseIdx = i;
		if (type === "batch.resumed") lastResumeIdx = i;
	}
	return lastPauseIdx >= 0 && lastPauseIdx > lastResumeIdx;
}

/**
 * Adopt operator pause from disk or journal so engine saves do not clobber phase: paused.
 *
 * @param {string} projectRoot
 * @param {object} state
 * @returns {boolean}
 */
export function mergeEngineStateWithDiskPause(projectRoot, state) {
	const loaded = loadSpineBatchState(projectRoot);
	const diskPhase = String(loaded.raw?.phase ?? "");
	const batchId = String(state.batchId ?? loaded.raw?.batchId ?? "");
	if (diskPhase === "paused") {
		state.phase = "paused";
		return true;
	}
	if (batchId && isOperatorPauseActive(projectRoot, batchId)) {
		state.phase = "paused";
		return true;
	}
	return false;
}

/**
 * Persist engine state while honoring an operator pause already on disk or in the journal.
 *
 * The pause merge (a disk read) and the save run inside one `withBatchStateLock`
 * hold (SP-791 / #301): previously the merge ran before the lock, so an operator
 * pause landing between the merge and the write was clobbered by the engine's
 * whole-file snapshot. The lock is re-entrant per process, so the nested
 * `saveSpineBatchState` acquisition composes instead of self-deadlocking.
 *
 * @param {string} projectRoot
 * @param {object} state
 * @param {{ bypassWriteGuard?: boolean }} [options]
 */
export function saveEngineBatchState(projectRoot, state, options = {}) {
	return withBatchStateLock(projectRoot, () => {
		mergeEngineStateWithDiskPause(projectRoot, state);
		return saveSpineBatchState(projectRoot, state, options);
	});
}

/**
 * Re-assert phase: paused on disk when the operator paused but a running engine overwrote it.
 *
 * The read-modify-write runs through `updateSpineBatchState` so the phase check
 * and the write are one atomic section (SP-791 / #301). Returns true when the
 * disk ends up paused — already paused (nothing to re-assert) or re-asserted by
 * this call — and false when there is no usable state, no batchId, no active
 * pause, or the write was refused.
 *
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function enforceOperatorPauseOnDisk(projectRoot) {
	let enforced = false;
	const result = updateSpineBatchState(
		projectRoot,
		(draft, { diskState }) => {
			const batchId = String(diskState.batchId ?? "");
			if (!batchId) return false;
			if (diskState.phase === "paused") {
				// Operator pause is already on disk — nothing to re-assert.
				enforced = true;
				return false;
			}
			if (!isOperatorPauseActive(projectRoot, batchId)) return false;
			draft.phase = "paused";
			enforced = true;
			return true;
		},
		{ bypassWriteGuard: true },
	);
	return result.ok === true && enforced;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @returns {{ stop: boolean }}
 */
export function adoptPauseIfRequested({ projectRoot, state, batchId }) {
	const paused = mergeEngineStateWithDiskPause(projectRoot, state);
	if (!paused) return { stop: false };
	saveEngineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "engine.pause_observed", {
		enginePid: process.pid,
	});
	return { stop: true };
}

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
	let sawPauseOnDisk = false;
	let sawRunningAfterPauseOnDisk = false;
	while (Date.now() < deadline) {
		const currentPhase = String(loadSpineBatchState(projectRoot).raw?.phase ?? "");
		if (currentPhase === "paused") {
			sawPauseOnDisk = true;
		} else if (sawPauseOnDisk && currentPhase === "running") {
			sawRunningAfterPauseOnDisk = true;
		}
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			break;
		}
		await sleepFn(Math.min(pollIntervalMs, remaining));
	}
	const finalPhase = String(loadSpineBatchState(projectRoot).raw?.phase ?? "");
	return finalPhase === "paused" && !sawRunningAfterPauseOnDisk;
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

	// Initial pause write as an atomic read-modify-write (SP-791 / #301): the
	// phase is re-checked under the lock so a state change that landed after the
	// pre-load (operator re-pause, engine completing the batch) is respected
	// instead of being overwritten by this potentially stale snapshot.
	const pauseWrite = updateSpineBatchState(
		projectRoot,
		(draft, { diskState }) => {
			const diskPhase = String(diskState.phase ?? "");
			if (diskPhase !== "running" && diskPhase !== "planning") return false;
			draft.phase = "paused";
			return true;
		},
		{ bypassWriteGuard: true },
	);
	const diskPhase = String(pauseWrite.state?.phase ?? phase ?? "unknown");
	if (!pauseWrite.ok || (!pauseWrite.changed && diskPhase !== "paused")) {
		// State changed (or vanished/corrupted) between the pre-load and the
		// locked write — report the observed phase rather than the stale one.
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_pause",
			output: `Cannot pause batch in phase ${diskPhase}. Only running or planning batches can be paused.\n`,
			batchId,
			phase: diskPhase,
		};
	}

	if (attachedEngineAlive) {
		const confirmed = await waitForPauseConfirmation({
			projectRoot,
			confirmGraceMs,
			pollIntervalMs,
			sleepFn,
		});

		if (!confirmed) {
			// Roll back only while the disk phase is still our unconfirmed "paused";
			// a terminal phase (completed/failed/aborted/merge_blocked) or an engine
			// rewrite that landed during the grace window must never be reverted to
			// fromPhase (SP-791 / #301 — the rollback could otherwise resurrect a
			// completed batch as running).
			let observedPhase = "unknown";
			updateSpineBatchState(
				projectRoot,
				(draft, { diskState }) => {
					observedPhase = String(diskState.phase ?? "unknown");
					if (diskState.phase !== "paused") return false;
					draft.phase = fromPhase;
					return true;
				},
				{ bypassWriteGuard: true },
			);
			appendJournalEvent(projectRoot, batchId, "batch.pause_failed", {
				fromPhase,
				enginePid,
				observedPhase,
				graceMs: confirmGraceMs,
			});
			const output =
				`Pause not confirmed: batch-state phase is still "${observedPhase}" after ${confirmGraceMs}ms.\n` +
				`Attached engine (PID ${enginePid}) did not persist phase: paused — batch.paused was not recorded.\n` +
				"Stop the attached engine or wait for the current step to finish, then run spine batch pause again.\n" +
				"spine batch retry is blocked while phase is running — retry only after phase is paused.\n";
			return {
				ok: false,
				exitCode: 1,
				error: "pause_not_confirmed",
				output,
				batchId,
				phase: fromPhase,
				enginePid,
			};
		}
	}

	recordResumePhaseTransition(projectRoot, batchId, fromPhase, "paused");

	return {
		ok: true,
		exitCode: 0,
		batchId,
		phase: "paused",
		output: `Batch ${batchId} paused. No new tasks will be scheduled.\n  → spine batch resume\n`,
	};
}
