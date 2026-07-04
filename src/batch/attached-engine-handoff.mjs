/**
 * Attached engine post-merge SIGTERM survival (SP-316, GitHub #21).
 *
 * When parent shell/tooling sends SIGTERM after the last merge but before the land
 * loop opens the integrate gate, finalize in-process or spawn a detached resume engine.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildAttachedBatchResumeArgv,
	spawnDetachedBatchEngine,
} from "./detached-start.mjs";
import { loadGateRecord } from "./gate.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	isPostMergeLimbo,
	tryFinalizePostMergeLimbo,
} from "./post-merge-limbo.mjs";
import {
	clearBatchEnginePid,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {boolean} */
let shutdownHandlerInstalled = false;

/** @type {boolean} */
let shutdownHandoffInFlight = false;

/**
 * @param {string} [spineBin]
 */
export function resolveDefaultSpineBin(spineBin) {
	if (spineBin && path.isAbsolute(spineBin)) return spineBin;
	if (spineBin) return path.resolve(spineBin);
	return path.join(PACKAGE_ROOT, "bin", "spine.mjs");
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 */
function postMergeLimboGateMissing({ projectRoot, state, batchId }) {
	if (String(state.phase ?? "") === "completed") return false;
	if (!isPostMergeLimbo(state)) return false;
	return loadGateRecord(projectRoot, batchId) == null;
}

/**
 * Finalize post-merge limbo in-process when eligible.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {string} params.orchBranch
 */
export function finalizeAttachedPostMergeLimbo({ projectRoot, state, batchId, orchBranch }) {
	if (!postMergeLimboGateMissing({ projectRoot, state, batchId })) {
		return null;
	}
	return tryFinalizePostMergeLimbo({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumed: false,
	});
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} [params.spineBin]
 * @param {string} [params.signal]
 */
export function attemptPostMergeLandLoopHandoff({
	projectRoot,
	spineBin,
	signal = "SIGTERM",
}) {
	if (shutdownHandoffInFlight) {
		return { handled: false, reason: "handoff_in_flight" };
	}
	shutdownHandoffInFlight = true;

	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		shutdownHandoffInFlight = false;
		return { handled: false, reason: "no_active_batch" };
	}

	const state = loaded.raw;
	const batchId = String(state.batchId ?? "");
	const orchBranch = String(state.orchBranch ?? "");

	if (String(state.phase ?? "") === "completed" || loadGateRecord(projectRoot, batchId)) {
		shutdownHandoffInFlight = false;
		return { handled: true, action: "already_finalized", batchId };
	}

	if (!isPostMergeLimbo(state)) {
		shutdownHandoffInFlight = false;
		return { handled: false, reason: "not_post_merge_limbo", batchId };
	}

	const finalizeResult = finalizeAttachedPostMergeLimbo({
		projectRoot,
		state,
		batchId,
		orchBranch,
	});
	if (finalizeResult?.ok) {
		clearBatchEnginePid(state);
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
		appendJournalEvent(projectRoot, batchId, "engine.attached_post_merge_handoff", {
			signal,
			action: "finalized_in_process",
		});
		shutdownHandoffInFlight = false;
		return {
			handled: true,
			action: "finalized_in_process",
			batchId,
			result: finalizeResult,
		};
	}

	const resolvedSpineBin = resolveDefaultSpineBin(spineBin);
	const argv = buildAttachedBatchResumeArgv({ force: false });
	const { enginePid, logPath } = spawnDetachedBatchEngine({
		projectRoot,
		spineBin: resolvedSpineBin,
		argv,
	});

	const fresh = loadSpineBatchState(projectRoot);
	if (fresh.raw && enginePid) {
		recordBatchEnginePid(fresh.raw, enginePid);
		saveSpineBatchState(projectRoot, fresh.raw, { bypassWriteGuard: true });
	}

	appendJournalEvent(projectRoot, batchId, "engine.attached_post_merge_handoff", {
		signal,
		action: "detached_resume_spawned",
		enginePid,
		logPath,
	});

	shutdownHandoffInFlight = false;
	return {
		handled: true,
		action: "detached_resume_spawned",
		batchId,
		enginePid,
		logPath,
	};
}

/**
 * Install SIGTERM/SIGINT handlers for attached batch engines.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} [params.spineBin]
 */
export function installAttachedEngineShutdownHandlers({ projectRoot, spineBin }) {
	if (shutdownHandlerInstalled) return;
	shutdownHandlerInstalled = true;

	const onShutdown = (signal) => {
		const handoff = attemptPostMergeLandLoopHandoff({ projectRoot, spineBin, signal });
		if (handoff.handled) {
			process.exit(0);
		}
	};

	process.once("SIGTERM", () => onShutdown("SIGTERM"));
	process.once("SIGINT", () => onShutdown("SIGINT"));
}
