// @ts-nocheck
/**
 * Detached batch wait/poll helpers — state polling after spawn (SP-598).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { runBatchPreflight } from "../config/spine-preflight-lib.mjs";
import { loadGateRecord } from "./gate.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { assessRunningPhaseResumeEligibility } from "./resume-multi-validate.mjs";
import { prepareOrphanResumeHandoff } from "./resume-engine.mjs";
import {
	ACTIVE_PHASES,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	TERMINAL_BATCH_PHASES,
} from "./state.mjs";

/** Diagnoses that benefit from blocking until resume engine reaches terminal phase. */
const RESUME_WAIT_TERMINAL_DIAGNOSES = new Set([
	"engine_orphaned",
	"worker_orphaned",
	"state_drift",
	"needs_integrate",
]);

/**
 * Default detached resume to --wait-terminal after orphan/drift diagnoses.
 *
 * @param {string} projectRoot
 * @param {boolean} explicitWaitTerminal
 * @param {boolean} noWaitTerminal
 */
export function resolveDefaultResumeWaitTerminal(
	projectRoot,
	explicitWaitTerminal,
	noWaitTerminal = false,
) {
	if (explicitWaitTerminal) return true;
	if (noWaitTerminal) return false;
	const reconciliation = reconcileBatch({ projectRoot });
	const diagnosis = reconciliation.diagnosis;
	if (diagnosis && RESUME_WAIT_TERMINAL_DIAGNOSES.has(diagnosis)) {
		return true;
	}
	return false;
}

/** @type {ReadonlySet<string>} */
const TERMINAL_TASK_STATUSES = new Set(["succeeded", "failed", "skipped", "aborted"]);

/** Default wait when --wait-terminal blocks on orphan/drift resume (real workers exceed 30s). */
const DETACHED_WAIT_TERMINAL_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/**
 * @param {boolean} waitTerminal
 * @param {number} [explicitTimeoutMs]
 */
export function resolveDetachedWaitTimeoutMs(waitTerminal, explicitTimeoutMs) {
	if (Number.isFinite(explicitTimeoutMs) && explicitTimeoutMs > 0) {
		return explicitTimeoutMs;
	}
	return waitTerminal ? DETACHED_WAIT_TERMINAL_TIMEOUT_MS : 30_000;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object|null|undefined} raw
 * @param {string|null|undefined} taskId
 */
function resumedTaskReachedTerminal(raw, taskId) {
	if (!taskId || !raw || !Array.isArray(raw.tasks)) return false;
	const task = raw.tasks.find((entry) => entry?.taskId === taskId);
	return Boolean(task && TERMINAL_TASK_STATUSES.has(String(task.status ?? "")));
}

/**
 * @param {string} projectRoot
 * @param {object|null|undefined} raw
 */
function detachedResumeRequiresIntegrateGate(projectRoot, raw) {
	if (!raw?.batchId || String(raw.phase ?? "") !== "completed") {
		return false;
	}
	if (!raw.orchBranch) {
		return false;
	}
	const config = loadSpineConfig(projectRoot).config ?? {};
	return config.gates?.requireBeforeIntegrate === true;
}

/**
 * @param {string} projectRoot
 * @param {object|null|undefined} raw
 */
function detachedResumeIntegrateGateReady(projectRoot, raw) {
	if (!detachedResumeRequiresIntegrateGate(projectRoot, raw)) {
		return true;
	}
	return Boolean(loadGateRecord(projectRoot, String(raw.batchId)));
}

/**
 * @param {object|null|undefined} raw
 * @param {string|null|undefined} taskId
 * @param {number} updatedAtBefore
 */
function evaluateDetachedResumeWait(raw, taskId, updatedAtBefore) {
	if (!raw?.batchId) return null;
	const updatedAt = Number(raw.updatedAt ?? 0);
	if (updatedAt <= updatedAtBefore) return null;

	if (TERMINAL_BATCH_PHASES.has(String(raw.phase ?? ""))) {
		return {
			ok: true,
			status: "resume_completed",
			batchId: raw.batchId,
			phase: raw.phase,
		};
	}

	if (resumedTaskReachedTerminal(raw, taskId)) {
		return {
			ok: true,
			status: "resume_completed",
			batchId: raw.batchId,
			phase: raw.phase,
		};
	}

	return null;
}

/**
 * @param {string} projectRoot
 * @param {number|null} enginePid
 */
export function persistDetachedEnginePid(projectRoot, enginePid) {
	const pid = Number(enginePid);
	if (!Number.isFinite(pid) || pid <= 0) return;
	const { raw } = loadSpineBatchState(projectRoot);
	if (!raw) return;
	recordBatchEnginePid(raw, pid);
	saveSpineBatchState(projectRoot, raw);
}

/**
 * Kill a stale detached engine and persist cleared PID before spawning resume engine (SP-254).
 * Resume child records its own PID after terminateStaleDetachedEngine runs in-process.
 * Running-phase orphan resume (SP-296) clears a dead engine PID without requiring pause first.
 *
 * @param {string} projectRoot
 */
export function prepareDetachedResumeEngineHandoff(projectRoot) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, reason: "no_active_batch" };
	}

	const state = loaded.raw;
	const batchId = String(state.batchId ?? "");
	const fromPhase = String(state.phase ?? "");
	const orphanEligibility =
		fromPhase === "running"
			? assessRunningPhaseResumeEligibility({ projectRoot, state })
			: { engineConfirmedDead: false, allowOrphanResume: false };
	const handoff = prepareOrphanResumeHandoff({
		projectRoot,
		state,
		batchId,
		fromPhase,
		orphanResume: orphanEligibility.allowOrphanResume,
		engineConfirmedDead: orphanEligibility.engineConfirmedDead,
	});
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

	return {
		ok: true,
		batchId,
		fromPhase,
		terminateResult: handoff.terminateResult,
		orphanResume: orphanEligibility.allowOrphanResume,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.skipPreflight]
 */
export function runDetachedStartPreflight({ projectRoot, skipPreflight = false }) {
	if (skipPreflight) {
		return { ok: true };
	}
	const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
	if (!preflight.ok) {
		return {
			ok: false,
			exitCode: preflight.exitCode ?? 1,
			error: "preflight_failed",
			output: preflight.output,
		};
	}
	return { ok: true };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | null} [params.previousBatchId]
 * @param {number} [params.timeoutMs]
 * @param {boolean} [params.waitTerminal]
 */
export async function waitForDetachedBatchStart({
	projectRoot,
	previousBatchId = null,
	timeoutMs = 30_000,
	waitTerminal = false,
}) {
	const deadline = Date.now() + timeoutMs;
	/** @type {string|null} */
	let startedBatchId = null;

	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		const batchId = raw?.batchId ?? null;
		if (batchId && batchId !== previousBatchId) {
			if (raw.phase === "failed" || raw.phase === "aborted") {
				return {
					ok: false,
					error: "batch_engine_failed",
					batchId,
					phase: raw.phase,
					lastError: raw.lastError ?? null,
				};
			}

			if (TERMINAL_BATCH_PHASES.has(String(raw.phase ?? "")) || raw.phase === "paused") {
				return {
					ok: true,
					status: "start_completed",
					batchId,
					phase: raw.phase,
				};
			}

			if (ACTIVE_PHASES.has(raw.phase)) {
				startedBatchId = batchId;
				if (!waitTerminal) {
					return {
						ok: true,
						status: "engine_started",
						batchId,
						phase: raw.phase,
					};
				}
			}
		}
		await sleep(200);
	}

	if (startedBatchId) {
		return {
			ok: false,
			error: "timeout_waiting_for_batch",
			batchId: startedBatchId,
			status: "engine_started",
		};
	}

	return { ok: false, error: "timeout_waiting_for_batch" };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.updatedAtBefore
 * @param {string|null|undefined} [params.taskId]
 * @param {number} [params.timeoutMs]
 * @param {boolean} [params.waitTerminal]
 */
export async function waitForDetachedBatchResume({
	projectRoot,
	batchId,
	updatedAtBefore,
	taskId = null,
	timeoutMs = 30_000,
	waitTerminal = false,
}) {
	const deadline = Date.now() + timeoutMs;
	/** @type {boolean} */
	let engineStarted = false;

	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		if (raw?.batchId !== batchId) {
			await sleep(200);
			continue;
		}

		if (raw.phase === "failed" || raw.phase === "aborted") {
			return {
				ok: false,
				error: "batch_engine_failed",
				batchId,
				phase: raw.phase,
				lastError: raw.lastError ?? null,
			};
		}

		const updatedAt = Number(raw.updatedAt ?? 0);
		if (raw.phase === "running" && updatedAt > updatedAtBefore) {
			engineStarted = true;
			if (!waitTerminal) {
				return {
					ok: true,
					status: "engine_started",
					batchId,
					phase: raw.phase,
				};
			}
		}

		const completed = evaluateDetachedResumeWait(raw, taskId, updatedAtBefore);
		if (completed && detachedResumeIntegrateGateReady(projectRoot, raw)) {
			return completed;
		}

		await sleep(200);
	}

	return {
		ok: false,
		error: "timeout_waiting_for_resume",
		batchId,
		engineStarted,
	};
}
