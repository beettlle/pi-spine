/**
 * Sequence wait/land helpers: batch terminal poll and wave land loop (SP-600).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import {
	DEFAULT_SEQUENCE_MAX_WAIT_MS,
	DEFAULT_SEQUENCE_POLL_MS,
	DEFAULT_SEQUENCE_STALL_MS,
} from "../config/spine-config-schema.mjs";
import { isEngineProcessAlive, isProcessAlive } from "../process/liveness.mjs";
import { approveIntegrateGate, loadGateRecord, maybeAutoApproveIntegrateGate } from "./gate.mjs";
import { integrateOrchToBase } from "./integrate.mjs";
import { completeBatch } from "./lifecycle.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { readBatchEnginePid, readBatchEngineStartedAt } from "./state-guards.mjs";
import { loadSpineBatchState } from "./state.mjs";

const WAVE_BATCH_SETTLED_DIAGNOSES = new Set([
	"completed",
	"completed_manual",
	"needs_integrate",
	"limbo_stale",
]);
const WAVE_BATCH_FAILURE_DIAGNOSES = new Set(["failed", "aborted"]);
const WAVE_BATCH_WAITING_DIAGNOSES = new Set([
	"running",
	"paused",
	"needs_retry",
	"worker_orphaned",
	"engine_orphaned",
	"state_drift",
	"needs_merge",
	"needs_replan",
]);

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isSequenceBatchSettled(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_SETTLED_DIAGNOSES.has(diagnosis));
}

export function isSequenceBatchFailure(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_FAILURE_DIAGNOSES.has(diagnosis));
}

export function isSequenceBatchWaiting(diagnosis) {
	return Boolean(diagnosis && WAVE_BATCH_WAITING_DIAGNOSES.has(diagnosis));
}

export async function waitForSequenceBatchTerminal({
	projectRoot,
	pollIntervalMs = DEFAULT_SEQUENCE_POLL_MS,
	timeoutMs = 120_000,
	maxWaitMs = DEFAULT_SEQUENCE_MAX_WAIT_MS,
	stallMs = DEFAULT_SEQUENCE_STALL_MS,
	enginePid = null,
	reconcileFn = reconcileBatch,
}) {
	const startedAt = Date.now();
	const deadline = startedAt + timeoutMs;
	const hardCap = startedAt + maxWaitMs;
	let lastProgressAt = startedAt;
	let useLightReconcile = false;
	while (Date.now() < deadline || isEngineStillRunning(enginePid, projectRoot)) {
		if (Date.now() >= hardCap) {
			const reconciliation = reconcileFn({ projectRoot });
			return {
				ok: false,
				error: "sequence_wait_timeout",
				diagnosis: reconciliation.diagnosis ?? null,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
				suggestedCommand: "spine status --diagnose",
			};
		}
		const reconciliation = reconcileFn({ projectRoot, light: useLightReconcile });
		useLightReconcile = true;
		const diagnosis = reconciliation.diagnosis;
		if (isSequenceBatchFailure(diagnosis)) {
			return {
				ok: false,
				halted: true,
				diagnosis,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
			};
		}
		if (isSequenceBatchSettled(diagnosis)) {
			return {
				ok: true,
				diagnosis,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
			};
		}
		const progressAt = newestProgressSignalMs(reconciliation);
		if (progressAt != null && progressAt > lastProgressAt) {
			lastProgressAt = progressAt;
		}
		if (Date.now() - lastProgressAt >= stallMs) {
			return {
				ok: false,
				error: "engine_stalled",
				diagnosis,
				reconciliation,
				batchId: reconciliation.batchId ?? null,
				suggestedCommand: "spine status --diagnose",
			};
		}
		await sleep(pollIntervalMs);
	}
	const reconciliation = reconcileFn({ projectRoot });
	return {
		ok: false,
		error: "timeout_waiting_for_batch",
		diagnosis: reconciliation.diagnosis ?? null,
		reconciliation,
		batchId: reconciliation.batchId ?? null,
	};
}

/**
 * Newest progress signal exposed by a reconciliation, in epoch ms: batch-state
 * `updatedAt` or the latest journal event timestamp (lane heartbeats are
 * journal `lane.heartbeat` events, so they are covered by the journal tail).
 * Returns null when no signal is available (SP-802 / #307).
 *
 * @param {object} reconciliation
 * @returns {number|null}
 */
function newestProgressSignalMs(reconciliation) {
	const signals = reconciliation?.signals ?? {};
	/** @type {number|null} */
	let newest = null;
	const updatedAt = Number(signals.raw?.updatedAt);
	if (Number.isFinite(updatedAt) && updatedAt > 0) {
		newest = updatedAt;
	}
	const events = Array.isArray(signals.journalEvents) ? signals.journalEvents : [];
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const ts = Date.parse(String(events[index]?.timestamp ?? ""));
		if (Number.isFinite(ts) && ts > 0) {
			if (newest == null || ts > newest) newest = ts;
			break;
		}
	}
	return newest;
}

/**
 * Returns true when the batch engine is verifiably still running, so the wait
 * extends past `timeoutMs` while work is in progress. PID-reuse-safe (SP-802 /
 * #307, #259): the explicit `enginePid` is paired with the state's recorded
 * `engineStartedAt` when the PIDs match; the state fallback uses the recorded
 * PID + start time from `resilience`; otherwise it degrades to PID-only
 * liveness.
 *
 * @param {number|null} enginePid
 * @param {string} projectRoot
 */
function isEngineStillRunning(enginePid, projectRoot) {
	const { raw } = loadSpineBatchState(projectRoot);
	const statePid = readBatchEnginePid(raw);
	const stateStartedAt = readBatchEngineStartedAt(raw);
	const pid = Number(enginePid);
	if (Number.isFinite(pid) && pid > 0) {
		if (statePid != null && statePid === pid) {
			return isEngineProcessAlive(pid, stateStartedAt);
		}
		if (isProcessAlive(pid)) return true;
	}
	if (statePid != null) {
		return isEngineProcessAlive(statePid, stateStartedAt);
	}
	return false;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null} params.batchId
 * @param {boolean} [params.autoApproveGate]
 */
export function runSequenceWaveLandLoop({ projectRoot, batchId, autoApproveGate = false }) {
	const reconciliation = reconcileBatch({ projectRoot });
	const diagnosis = reconciliation.diagnosis;
	const activeBatchId =
		batchId ?? reconciliation.batchId ?? loadSpineBatchState(projectRoot).raw?.batchId ?? null;

	if (!isSequenceBatchSettled(diagnosis)) {
		return {
			ok: false,
			step: "land_loop",
			error: "batch_not_settled",
			diagnosis,
			batchId: activeBatchId,
			headline: `Cannot land wave — batch diagnosis is ${diagnosis ?? "unknown"}`,
		};
	}

	const config = loadSpineConfig(projectRoot).config ?? {};
	const gateRequired = config.gates?.requireBeforeIntegrate !== false;
	const gate = activeBatchId ? loadGateRecord(projectRoot, activeBatchId) : null;

	if (gateRequired && gate?.status === "pending") {
		const postureAuto = maybeAutoApproveIntegrateGate({
			projectRoot,
			batchId: activeBatchId,
			config,
		});
		if (postureAuto.approved) {
			// Posture opt-in allowed auto-approve; continue to integrate.
		} else if (!autoApproveGate) {
			return {
				ok: false,
				step: "gate_approve",
				error: "gate_approval_required",
				diagnosis,
				batchId: activeBatchId,
				headline: "Integrate gate requires approval — pass autoApproveGate or approve manually",
				suggestedCommand: "spine gate approve",
				postureEvaluation: postureAuto.evaluation ?? null,
			};
		} else {
			// Blunt --auto-approve-gate path (still gated by validateSequenceAutoApproveGate upstream).
			const approve = approveIntegrateGate({
				projectRoot,
				batchId: activeBatchId,
				decidedBy: "auto",
			});
			if (!approve.ok) {
				return { ok: false, step: "gate_approve", diagnosis, batchId: activeBatchId, ...approve };
			}
		}
	}

	const integrate = integrateOrchToBase({ projectRoot, batchId: activeBatchId });
	if (!integrate.ok) {
		return { ok: false, step: "integrate", diagnosis, batchId: activeBatchId, ...integrate };
	}

	const complete = completeBatch({ projectRoot, batchId: activeBatchId });
	if (!complete.ok) {
		return { ok: false, step: "complete", diagnosis, batchId: activeBatchId, ...complete };
	}

	return {
		ok: true,
		diagnosis,
		batchId: activeBatchId,
		headline: `Wave batch ${activeBatchId} landed on main`,
	};
}

/**
 * @param {object} ctx
 */
