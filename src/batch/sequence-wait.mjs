/**
 * Sequence wait/land helpers: batch terminal poll and wave land loop (SP-600).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { DEFAULT_SEQUENCE_POLL_MS } from "../config/spine-config-schema.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import { approveIntegrateGate, loadGateRecord } from "./gate.mjs";
import { integrateOrchToBase } from "./integrate.mjs";
import { completeBatch } from "./lifecycle.mjs";
import { reconcileBatch } from "./reconcile.mjs";
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
	enginePid = null,
	reconcileFn = reconcileBatch,
}) {
	const deadline = Date.now() + timeoutMs;
	let useLightReconcile = false;
	while (Date.now() < deadline || isEngineStillRunning(enginePid, projectRoot)) {
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
 * Returns true when a detached engine PID is alive or the batch phase is active,
 * preventing sequence timeout while work is still in progress.
 */
function isEngineStillRunning(enginePid, projectRoot) {
	if (enginePid && isProcessAlive(enginePid)) return true;
	const { raw } = loadSpineBatchState(projectRoot);
	const pid = raw?.enginePid ?? null;
	if (pid && isProcessAlive(pid)) return true;
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
		if (!autoApproveGate) {
			return {
				ok: false,
				step: "gate_approve",
				error: "gate_approval_required",
				diagnosis,
				batchId: activeBatchId,
				headline: "Integrate gate requires approval — pass autoApproveGate or approve manually",
				suggestedCommand: "spine gate approve",
			};
		}
		const approve = approveIntegrateGate({ projectRoot, batchId: activeBatchId });
		if (!approve.ok) {
			return { ok: false, step: "gate_approve", diagnosis, batchId: activeBatchId, ...approve };
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
