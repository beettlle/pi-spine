// @ts-nocheck
/**
 * Post-merge limbo detection — merges done, tasks succeeded, phase still running (SP-204).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildAttachedBatchResumeArgv,
	spawnDetachedBatchEngine,
} from "./detached-spawn.mjs";
import { loadGateRecord, openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { recordWaveMergeResult } from "./merge/wave-merge-state.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { isPostMergeLimbo } from "./limbo-detect.mjs";
import {
	clearBatchEnginePid,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";

export { isPostMergeLimbo } from "./limbo-detect.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {boolean} */
let attachedExitFinalizeInFlight = false;

/**
 * @param {string} [spineBin]
 */
export function resolveDefaultSpineBin(spineBin) {
	if (spineBin && path.isAbsolute(spineBin)) return spineBin;
	if (spineBin) return path.resolve(spineBin);
	return path.join(PACKAGE_ROOT, "bin", "spine.mjs");
}

/**
 * Sync missing mergeResults rows from journal merge_completed events (SP-378, GitHub #59).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 */
export function hydrateMergeResultsFromJournal({ projectRoot, state, batchId }) {
	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) {
		return false;
	}

	const events = readJournalEvents(projectRoot, batchId);
	const mergeCompleted = events.filter((event) => event.type === "batch.merge_completed");
	if (mergeCompleted.length < 1) {
		return false;
	}

	let changed = false;
	for (let waveIndex = 0; waveIndex < totalWaves; waveIndex++) {
		const waveEvents = mergeCompleted.filter(
			(event) => Number(event.payload?.waveIndex ?? -1) === waveIndex,
		);
		if (waveEvents.length < 1) {
			continue;
		}

		const existing = (state.mergeResults ?? []).find((entry) => entry?.waveIndex === waveIndex);
		if (existing && String(existing.status ?? "") === "succeeded") {
			continue;
		}

		const lastEvent = waveEvents.at(-1);
		const mergeCommit =
			typeof lastEvent?.payload?.mergeCommit === "string" ? lastEvent.payload.mergeCommit : null;
		recordWaveMergeResult({
			state,
			waveIndex,
			status: "succeeded",
			mergeCommit,
		});
		changed = true;
	}

	return changed;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 */
function postMergeLimboGateMissing({ projectRoot, state, batchId }) {
	if (String(state.phase ?? "") === "completed") return false;
	hydrateMergeResultsFromJournal({ projectRoot, state, batchId });
	if (!detectPostMergeLimboForResume({ projectRoot, state })) return false;
	return loadGateRecord(projectRoot, batchId) == null;
}

/**
 * Finalize post-merge limbo in-process when journal/state show last wave merged (SP-378).
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
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} type
 */
function journalHasEventType(projectRoot, batchId, type) {
	if (!batchId) return false;
	return readJournalEvents(projectRoot, batchId).some((event) => event.type === type);
}

/**
 * Idempotent land-loop close after gate open or host integrate (#198 / SP-636).
 * Clears engine PID and emits `batch.land_loop_finalized` so `spine batch complete`
 * is not blocked while a resume engine is still mid-evidence or lingering.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {boolean} [params.resumed]
 * @param {boolean} [params.resumeForced]
 * @param {string} [params.source]
 * @returns {{ ok: true, changed: boolean, batchId: string, exitCode: 0, shouldExit: boolean } | null}
 */
export function ensureLandLoopFinalizedAfterGateOrIntegrate({
	projectRoot,
	state,
	batchId,
	resumed = false,
	resumeForced = false,
	source = "ensure_after_gate_or_integrate",
}) {
	if (!state || typeof state !== "object" || !batchId) {
		return null;
	}

	const gateRecord = loadGateRecord(projectRoot, batchId);
	const integrateCompleted = journalHasEventType(projectRoot, batchId, "integrate.completed");
	const gateApproved = gateRecord != null && String(gateRecord.status ?? "") === "approved";
	const phaseCompleted = String(state.phase ?? "") === "completed";

	if (!gateRecord && !integrateCompleted && !phaseCompleted) {
		return null;
	}

	let changed = false;
	const taskIds = (state.tasks ?? []).map((task) => task.taskId);

	if (!phaseCompleted) {
		state.endedAt = state.endedAt ?? Date.now();
		state.phase = "completed";
		changed = true;
	}

	if (!journalHasEventType(projectRoot, batchId, "batch.completed")) {
		appendJournalEvent(projectRoot, batchId, "batch.completed", {
			taskIds,
			mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
			resumed,
			postMergeLimbo: !resumed,
			resumeForced,
			source,
		});
		changed = true;
	}

	if (state.resilience?.enginePid != null) {
		clearBatchEnginePid(state);
		changed = true;
	}

	if (!journalHasEventType(projectRoot, batchId, "batch.land_loop_finalized")) {
		const finalizeSource = integrateCompleted
			? "host_integrate"
			: gateApproved
				? "host_gate_approved"
				: source;
		appendJournalEvent(projectRoot, batchId, "batch.land_loop_finalized", {
			resumed,
			resumeForced,
			gateId: gateRecord?.gateId ?? null,
			source: finalizeSource,
		});
		changed = true;
	}

	if (changed) {
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
	}

	return {
		ok: true,
		changed,
		batchId,
		exitCode: 0,
		shouldExit: integrateCompleted || gateApproved,
	};
}

/**
 * Open integrate gate or spawn detached resume before attached engine exit (SP-378, GitHub #59).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} [params.spineBin]
 * @param {string} [params.signal]
 */
export function finalizeAttachedLandLoopBeforeExit({
	projectRoot,
	spineBin,
	signal = "SIGTERM",
}) {
	if (attachedExitFinalizeInFlight) {
		return { handled: false, reason: "finalize_in_flight" };
	}
	attachedExitFinalizeInFlight = true;

	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		attachedExitFinalizeInFlight = false;
		return { handled: false, reason: "no_active_batch" };
	}

	const state = loaded.raw;
	const batchId = String(state.batchId ?? "");
	const orchBranch = String(state.orchBranch ?? "");
	const gateExists = loadGateRecord(projectRoot, batchId) != null;
	const integrateCompleted = journalHasEventType(projectRoot, batchId, "integrate.completed");

	if (String(state.phase ?? "") === "completed" || gateExists || integrateCompleted) {
		const ensured = ensureLandLoopFinalizedAfterGateOrIntegrate({
			projectRoot,
			state,
			batchId,
			resumed: true,
			source: integrateCompleted ? "host_integrate" : "attached_exit_after_gate",
		});
		attachedExitFinalizeInFlight = false;
		return {
			handled: true,
			action: ensured?.changed ? "finalized_after_gate_or_integrate" : "already_finalized",
			batchId,
			result: ensured,
		};
	}

	hydrateMergeResultsFromJournal({ projectRoot, state, batchId });
	if (!detectPostMergeLimboForResume({ projectRoot, state })) {
		attachedExitFinalizeInFlight = false;
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
		attachedExitFinalizeInFlight = false;
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

	attachedExitFinalizeInFlight = false;
	return {
		handled: true,
		action: "detached_resume_spawned",
		batchId,
		enginePid,
		logPath,
	};
}

/**
 * @param {object|null|undefined} state
 * @param {number} waveIndex
 */
export function isLastWaveIndex(state, waveIndex) {
	if (!state || typeof state !== "object") return false;
	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) return false;
	return waveIndex >= totalWaves - 1;
}

/**
 * Finalize immediately after the last wave merge so post-merge limbo never opens
 * (SP-280, SP-281 — attached engine + resume orphan race).
 *
 * @param {object} params
 * @param {boolean} [params.resumed]
 * @param {boolean} [params.resumeForced]
 * @returns {ReturnType<typeof finalizeBatchForIntegrate>|null}
 */
export function maybeFinalizeAfterWaveMerge({
	projectRoot,
	state,
	batchId,
	orchBranch,
	waveIndex,
	resumed = false,
	resumeForced = false,
}) {
	if (String(state.phase ?? "") === "completed") {
		return null;
	}
	hydrateMergeResultsFromJournal({ projectRoot, state, batchId: String(state.batchId ?? "") });
	if (!isLastWaveIndex(state, waveIndex)) {
		return null;
	}
	if (!detectPostMergeLimboForResume({ projectRoot, state })) {
		return null;
	}
	return tryFinalizePostMergeLimbo({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumed,
		resumeForced,
	});
}

/**
 * Whether resume should take the post-merge limbo fast path (no worker re-run).
 *
 * @param {object|null|undefined} state
 */
export function shouldResumePostMergeLimbo(state) {
	if (!state || typeof state !== "object") return false;
	if (String(state.phase ?? "") === "completed") return false;
	return isPostMergeLimbo(state);
}

/**
 * Idempotent finalize when batch is in post-merge limbo (SP-280, SP-316).
 *
 * @param {object} params
 */
export function tryFinalizePostMergeLimbo({
	projectRoot,
	state,
	batchId,
	orchBranch,
	resumed = false,
	resumeForced = false,
}) {
	if (String(state.phase ?? "") === "completed") {
		return null;
	}
	hydrateMergeResultsFromJournal({ projectRoot, state, batchId: String(state.batchId ?? "") });
	if (!detectPostMergeLimboForResume({ projectRoot, state })) {
		return null;
	}
	return finalizeBatchForIntegrate({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumed,
		resumeForced,
	});
}

/**
 * Open integrate gate and mark batch completed (idempotent gate open).
 * Shared by engine completion and resume post-merge limbo fast path (SP-204, SP-280).
 *
 * Clear engine PID before gate open so extended evidence (often `npm test`) cannot
 * leave a live PID blocking `batch complete` while the gate record already exists (#198).
 * Journal order keeps `gate.opened` before `batch.completed`.
 *
 * @param {object} params
 */
export function finalizeBatchForIntegrate({
	projectRoot,
	state,
	batchId,
	orchBranch,
	resumed = false,
	resumeForced = false,
}) {
	const taskIds = (state.tasks ?? []).map((task) => task.taskId);
	const summaryTask =
		taskIds.length === 1 ? taskIds[0] : `${taskIds.length} tasks (${taskIds.join(", ")})`;
	const alreadyCompleted = String(state.phase ?? "") === "completed";
	const landLoopSource = resumed ? "resume_fast_path" : "engine_land_loop";

	if (!alreadyCompleted) {
		state.endedAt = Date.now();
	}

	// Persist PID clear before evidence collection can hang (#198 / SP-636).
	clearBatchEnginePid(state);
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

	const gateResult = openIntegrateGateAfterBatchComplete({
		projectRoot,
		batchId,
		batchState: { ...state, phase: "completed" },
	});

	// Idempotent close: reporter may have already finalized while evidence was still running.
	if (!alreadyCompleted && String(state.phase ?? "") !== "completed") {
		state.phase = "completed";
	}
	ensureLandLoopFinalizedAfterGateOrIntegrate({
		projectRoot,
		state,
		batchId,
		resumed,
		resumeForced,
		source: landLoopSource,
	});

	const completionLabel = resumed ? "resumed and completed" : "completed";
	const nextSteps = resumed
		? "  → spine gate approve\n  → spine integrate\n  → spine batch complete\n"
		: "  → spine gate status\n  → spine gate approve\n  → spine integrate\n  → spine batch complete\n";

	return {
		ok: true,
		exitCode: 0,
		batchId,
		taskIds,
		taskId: taskIds.length === 1 ? taskIds[0] : undefined,
		orchBranch,
		mergeCommit: state.mergeResults?.at(-1)?.mergeCommit,
		gateResult,
		output:
			`Batch ${batchId} ${completionLabel}: ${summaryTask} succeeded; merged to ${orchBranch}.\n` +
			nextSteps,
	};
}

/**
 * @param {object} params
 */
export function finalizeResumedBatchForIntegrate(params) {
	return finalizeBatchForIntegrate({ ...params, resumed: true });
}
