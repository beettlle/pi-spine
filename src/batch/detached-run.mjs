// @ts-nocheck
/**
 * Detached batch start/resume entrypoints — orchestrates spawn + wait (SP-598).
 */

import {
	buildAttachedBatchResumeArgv,
	buildAttachedBatchStartArgv,
	spawnDetachedBatchEngine,
} from "./detached-spawn.mjs";
import {
	attachDetachedFailureDiagnostics,
	formatDetachedEngineOutput,
} from "./detached-diagnostics.mjs";
import { maybeSpawnSupervisorOnDetachedStart } from "./supervisor-spawn.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { validateResumeBatch } from "./resume.mjs";
import { enforceAttachedEngineSingleOwner, finalizeResumePostMergeLimbo } from "./attached-runner.mjs";
import { loadSpineBatchState } from "./state.mjs";
import {
	persistDetachedEnginePid,
	prepareDetachedResumeEngineHandoff,
	resolveDetachedWaitTimeoutMs,
	runDetachedStartPreflight,
	waitForDetachedBatchResume,
	waitForDetachedBatchStart,
} from "./detached-wait.mjs";

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
