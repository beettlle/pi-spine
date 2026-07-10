// @ts-nocheck
/**
 * Detached batch engine spawn — default for `spine batch start` and `spine batch resume`.
 */

import {
	buildAttachedBatchResumeArgv,
	buildAttachedBatchStartArgv,
	spawnDetachedBatchEngine,
} from "./detached-spawn.mjs";

export {
	buildAttachedBatchResumeArgv,
	buildAttachedBatchStartArgv,
	DETACHED_ENGINE_LOG_REL,
	detachedEngineLogPath,
	spawnDetachedBatchEngine,
} from "./detached-spawn.mjs";
export {
	collectDetachedFailureDiagnostics,
	formatDetachedBatchStartOutput,
	formatDetachedEngineOutput,
	readCurrentBatchLogTail,
} from "./detached-diagnostics.mjs";
import {
	attachDetachedFailureDiagnostics,
	formatDetachedEngineOutput,
} from "./detached-diagnostics.mjs";
import { maybeSpawnSupervisorOnDetachedStart } from "./supervisor-spawn.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { runBatchPreflight } from "../config/spine-preflight-lib.mjs";
import { loadGateRecord } from "./gate.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { validateResumeBatch } from "./resume.mjs";
import { assessRunningPhaseResumeEligibility } from "./resume-multi-validate.mjs";
import { prepareOrphanResumeHandoff } from "./resume-engine.mjs";
import { enforceAttachedEngineSingleOwner, finalizeResumePostMergeLimbo } from "./attached-runner.mjs";
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
function persistDetachedEnginePid(projectRoot, enginePid) {
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
 * @param {string} params.spineBin
 * @param {string} params.scope
 * @param {boolean} [params.skipPreflight]
 * @param {boolean} [params.forceSuperseded]
 * @param {number|null} [params.waveFilter]
 * @param {boolean} [params.waitTerminal]
 * @param {boolean} [params.json]
 */
export async function startBatchDetached({
	projectRoot,
	spineBin,
	scope,
	skipPreflight = false,
	forceSuperseded = false,
	waveFilter = null,
	waitTerminal = false,
	json = false,
}) {
	const preflight = runDetachedStartPreflight({ projectRoot, skipPreflight });
	if (!preflight.ok) {
		const payload = {
			ok: false,
			detached: true,
			operation: "start",
			error: preflight.error,
			output: preflight.output,
		};
		return {
			ok: false,
			exitCode: preflight.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const before = loadSpineBatchState(projectRoot);
	const previousBatchId = before.raw?.batchId ?? null;
	const engineLock = enforceAttachedEngineSingleOwner({ projectRoot, force: false, operation: "start" });
	if (!engineLock.ok) {
		const payload = {
			ok: false,
			detached: true,
			operation: "start",
			batchId: engineLock.batchId,
			error: engineLock.error,
			output: engineLock.output,
			enginePid: engineLock.enginePid,
			suggestedCommand: "spine batch resume --attached --force",
		};
		return {
			ok: false,
			exitCode: engineLock.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}
	const argv = buildAttachedBatchStartArgv({
		scope,
		skipPreflight: true,
		forceSuperseded,
		waveFilter,
	});
	const { enginePid, logPath } = spawnDetachedBatchEngine({ projectRoot, spineBin, argv });
	persistDetachedEnginePid(projectRoot, enginePid);
	const wait = await waitForDetachedBatchStart({ projectRoot, previousBatchId, waitTerminal });

	if (!wait.ok) {
		/** @type {Record<string, unknown>} */
		const payload = {
			ok: false,
			detached: true,
			operation: "start",
			scope,
			enginePid,
			logPath,
			error: wait.error,
			batchId: wait.batchId ?? null,
			lastError: wait.lastError ?? null,
			output:
				wait.error === "timeout_waiting_for_batch"
					? "Engine may still be running or orphaned — run `spine status --diagnose`."
					: `Batch engine exited before running (phase=${wait.phase ?? "unknown"}).`,
			suggestedCommand: "spine status --diagnose",
		};
		attachDetachedFailureDiagnostics(payload, {
			projectRoot,
			batchId: wait.batchId ?? null,
			logPath,
		});
		return {
			ok: false,
			exitCode: 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const configResult = loadSpineConfig(projectRoot);
	const supervisorSpawn = maybeSpawnSupervisorOnDetachedStart({
		projectRoot,
		batchId: wait.batchId,
		config: configResult.config ?? {},
	});

	const payload = {
		ok: true,
		detached: true,
		operation: "start",
		status: wait.status ?? "engine_started",
		batchId: wait.batchId,
		phase: wait.phase,
		scope,
		enginePid,
		logPath,
		suggestedCommand: "spine status --diagnose",
		supervisorSpawned: supervisorSpawn.spawned === true,
		supervisorPid: supervisorSpawn.supervisorPid ?? null,
	};
	return {
		ok: true,
		exitCode: 0,
		output: formatDetachedEngineOutput(payload, json),
		result: payload,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.spineBin
 * @param {boolean} [params.force]
 * @param {boolean} [params.waitTerminal]
 * @param {boolean} [params.json]
 */
export async function resumeBatchDetached({
	projectRoot,
	spineBin,
	force = false,
	waitTerminal = false,
	json = false,
}) {
	const engineLock = enforceAttachedEngineSingleOwner({ projectRoot, force, operation: "resume" });
	if (!engineLock.ok) {
		const payload = {
			ok: false,
			detached: true,
			operation: "resume",
			batchId: engineLock.batchId,
			error: engineLock.error,
			output: engineLock.output,
			enginePid: engineLock.enginePid,
			suggestedCommand:
				engineLock.error === "concurrent_resume_blocked"
					? "spine status --diagnose"
					: "spine batch resume --attached --force",
		};
		return {
			ok: false,
			exitCode: engineLock.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}
	const releaseResumeLock = engineLock.releaseResumeLock;

	const resumeCheck = validateResumeBatch({ projectRoot, force });
	if (!resumeCheck.ok) {
		releaseResumeLock?.();
		const payload = {
			ok: false,
			detached: true,
			operation: "resume",
			error: resumeCheck.error,
			output: resumeCheck.output,
			batchId: resumeCheck.batchId,
			taskId: resumeCheck.taskId,
		};
		return {
			ok: false,
			exitCode: resumeCheck.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const { batchId, updatedAt, taskId } = resumeCheck;

	if (resumeCheck.postMergeLimbo) {
		const loaded = loadSpineBatchState(projectRoot);
		const state = loaded.raw;
		const finalizeResult = finalizeResumePostMergeLimbo({
			projectRoot,
			state,
			batchId,
			orchBranch: state.orchBranch,
			fromPhase: String(state.phase ?? "running"),
			resumeForced: force,
		});
		releaseResumeLock?.();
		if (!finalizeResult?.ok) {
			const payload = {
				ok: false,
				detached: true,
				operation: "resume",
				batchId,
				taskId,
				error: "post_merge_limbo_finalize_failed",
				output: finalizeResult?.output ?? "Failed to finalize post-merge limbo.\n",
			};
			return {
				ok: false,
				exitCode: 1,
				output: formatDetachedEngineOutput(payload, json),
				result: payload,
			};
		}

		const payload = {
			ok: true,
			detached: true,
			operation: "resume",
			status: "resume_completed",
			batchId,
			taskId,
			phase: "completed",
			output: finalizeResult.output,
		};
		return {
			ok: true,
			exitCode: 0,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	prepareDetachedResumeEngineHandoff(projectRoot);
	const argv = buildAttachedBatchResumeArgv({ force });
	const { enginePid, logPath } = spawnDetachedBatchEngine({ projectRoot, spineBin, argv });
	releaseResumeLock?.();
	const waitTimeoutMs = resolveDetachedWaitTimeoutMs(waitTerminal);
	const wait = await waitForDetachedBatchResume({
		projectRoot,
		batchId,
		updatedAtBefore: updatedAt,
		taskId,
		waitTerminal,
		timeoutMs: waitTimeoutMs,
	});

	if (!wait.ok) {
		/** @type {Record<string, unknown>} */
		const payload = {
			ok: false,
			detached: true,
			operation: "resume",
			batchId,
			taskId,
			enginePid,
			logPath,
			error: wait.error,
			lastError: wait.lastError ?? null,
			output:
				wait.error === "timeout_waiting_for_resume"
					? "Engine may still be running or orphaned — run `spine status --diagnose`."
					: `Batch resume failed (phase=${wait.phase ?? "unknown"}).`,
			suggestedCommand: "spine status --diagnose",
		};
		attachDetachedFailureDiagnostics(payload, { projectRoot, batchId, taskId, logPath });
		return {
			ok: false,
			exitCode: 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const payload = {
		ok: true,
		detached: true,
		operation: "resume",
		status: wait.status ?? "engine_started",
		batchId: wait.batchId,
		taskId,
		phase: wait.phase,
		enginePid,
		logPath,
		suggestedCommand: "spine status --diagnose",
	};
	return {
		ok: true,
		exitCode: 0,
		output: formatDetachedEngineOutput(payload, json),
		result: payload,
	};
}
