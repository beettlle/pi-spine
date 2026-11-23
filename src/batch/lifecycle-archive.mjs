// @ts-nocheck
/**
 * Batch lifecycle archive and worktree cleanup helpers (FR-BATCH-15/16).
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import {
	clearActiveBatchStateIfMatches,
	loadBatchStateFile,
	readBatchStateId,
} from "./batch-state-io.mjs";
import { removeLaneWorktrees, maxLaneNumberFromBatchState } from "./worktree.mjs";
import { isEngineProcessAlive } from "../process/liveness.mjs";
import { readBatchEnginePid, readBatchEngineStartedAt } from "./state-guards.mjs";

/**
 * Phases a resume/pause/engine writer can leave behind between a terminal
 * write's pre-lock read and its lock section (SP-792 / #301). When the state
 * re-read inside the lock holds one of these, the batch is active again and
 * the pre-lock dismiss/complete decision no longer holds — fail closed.
 * `executing` is excluded because it is a limbo phase that legitimately
 * allows dismiss (limbo_stale).
 */
const ACTIVE_RESUME_PHASES = new Set(["planning", "running", "paused", "merging"]);

/**
 * True when the batch is in an active resume phase and the recorded engine
 * PID is alive — i.e. a detached engine is still finalizing its land loop
 * (#371). Liveness is injectable so callers and tests can stub the probe
 * (same shape as `isLiveEngineMidTask`).
 *
 * @param {unknown} raw raw batch state (e.g. the in-lock re-read)
 * @param {object} [deps]
 * @param {(raw: object) => boolean} [deps.isEngineAlive] injectable engine liveness probe
 * @returns {boolean}
 */
export function isLiveEngineInActivePhase(raw, deps = {}) {
	if (!raw || typeof raw !== "object") return false;
	const phase = String(/** @type {{ phase?: string }} */ (raw).phase ?? "");
	if (!ACTIVE_RESUME_PHASES.has(phase)) return false;
	const isEngineAlive =
		deps.isEngineAlive ??
		((state) => isEngineProcessAlive(readBatchEnginePid(state), readBatchEngineStartedAt(state)));
	return Boolean(isEngineAlive(raw));
}

/**
 * Journal signals that prove the batch is inside the land-loop finalize window
 * (#379): the operator approved the integrate gate (`gate.approved`) or the
 * orch branch already merged (`integrate.completed`). Past either point all
 * tasks succeeded and merged, so an active-looking phase is finalize
 * bookkeeping — resume can only take the post-merge limbo fast path — and not
 * a batch that went active again for real work.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {boolean}
 */
export function journalHasIntegrateProgressSignals(projectRoot, batchId) {
	if (!batchId) return false;
	try {
		return readJournalEvents(projectRoot, batchId).some((event) => {
			const type = String(
				/** @type {{ type?: string }} */
				(event)?.type ?? "",
			);
			return type === "gate.approved" || type === "integrate.completed";
		});
	} catch {
		// Fail closed: an unreadable journal cannot prove finalize is in
		// flight, so the caller keeps the generic mid-write refusal.
		return false;
	}
}

/**
 * Re-read the active batch state inside the terminal lock section
 * (SP-792 / #301) so archive, history, and clear act on the freshest on-disk
 * snapshot instead of the pre-lock read, which goes stale when a concurrent
 * engine save lands between the read and the lock.
 *
 * Fail-closed contract: returns a ready-to-return non-ok `refusal` when the
 * state file vanished, no longer parses, now describes a different batch, or
 * — with `requireTerminalPhase` — the batch became active again mid-write.
 * Abort passes `requireTerminalPhase: false` because aborting a running
 * batch is its normal use case.
 * Exception (#371, #379): when the active phase is the engine finishing its
 * land-loop finalize — a live engine PID, or the finalize window itself (no
 * recorded PID with `gate.approved`/`integrate.completed` already journaled,
 * since finalize clears the PID before writing the terminal phase, #198) —
 * the refusal is a soft `pending` wait with a wait command, not a hard
 * failure that implies corruption.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null} params.batchStatePath path used by the pre-lock read
 * @param {string} params.batchId batch id the reloaded state must still match
 * @param {"abort"|"dismiss"|"complete"} params.action action name for the refusal headline
 * @param {boolean} [params.requireTerminalPhase] re-validate the terminal-phase precondition on the in-lock state
 * @param {boolean} [params.force] `dismiss --force` skips the phase re-validation
 * @param {string|null} [params.diagnosis] pre-lock diagnosis echoed on refusal
 * @param {object} [params.deps]
 * @param {(raw: object) => boolean} [params.deps.isEngineAlive] injectable engine liveness probe (#371)
 * @param {(raw: object) => boolean} [params.deps.isFinalizeInFlight] injectable extra finalize-window probe (#379); OR-ed with `journalHasIntegrateProgressSignals` — a `false` return defers to the journal fallback
 * @returns {{ state: { path: string, raw: object }|null, refusal: object|null }}
 */
export function reloadStateForTerminalWrite({
	projectRoot,
	batchStatePath,
	batchId,
	action,
	requireTerminalPhase = false,
	force = false,
	diagnosis = null,
	deps = {},
}) {
	const refuse = () => ({
		ok: false,
		exitCode: 1,
		error: "batch_state_changed_during_terminal_write",
		headline: `Batch state changed during ${action} — re-run spine status --diagnose`,
		suggestedCommand: "spine status --diagnose",
		diagnosis: diagnosis ?? null,
		batchId,
	});

	const reloaded = loadBatchStateFile(projectRoot, batchStatePath);
	if (!reloaded.path || !reloaded.raw || reloaded.parseError) {
		return { state: null, refusal: refuse() };
	}

	const reloadedBatchId = readBatchStateId(reloaded.raw);
	if (!reloadedBatchId || reloadedBatchId !== batchId) {
		return { state: null, refusal: refuse() };
	}

	if (requireTerminalPhase && !force) {
		const phase = String(/** @type {{ phase?: string }} */ (reloaded.raw).phase ?? "");
		if (ACTIVE_RESUME_PHASES.has(phase)) {
			// #371 / #379: the engine is finishing its land loop, not crashing —
			// report a pending wait instead of the generic mid-write failure.
			const landLoopPending = () => ({
				state: null,
				refusal: {
					ok: false,
					exitCode: 1,
					pending: true,
					error: "engine_finishing_land_loop",
					headline: "Engine is finishing the land loop — wait for it to complete",
					suggestedCommand: "spine wait --until completed --timeout 10m",
					diagnosis: diagnosis ?? null,
					batchId,
				},
			});
			// #371: a live engine turned the batch active again between the pre-lock
			// read and this reload — it is finishing its land loop, not crashing.
			if (isLiveEngineInActivePhase(reloaded.raw, deps)) {
				return landLoopPending();
			}
			// #379: the finalize path clears the engine PID before writing the
			// terminal phase (#198), so an active phase with no recorded PID is
			// normal mid-finalize once the gate is approved / integrate completed.
			// A recorded-but-dead PID stays a hard refusal: an engine died while the
			// phase was active and the state needs diagnosis, not a blind wait.
			const enginePidRecorded = readBatchEnginePid(reloaded.raw) != null;
			// `||`, not `??`: a probe returning `false` ("not in flight") must
			// still defer to the journal fallback instead of short-circuiting the
			// whole expression to `false` and masking journaled approval signals.
			const finalizeInFlight =
				deps.isFinalizeInFlight?.(reloaded.raw) ||
				journalHasIntegrateProgressSignals(projectRoot, batchId);
			if (!enginePidRecorded && finalizeInFlight) {
				return landLoopPending();
			}
			return { state: null, refusal: refuse() };
		}
	}

	return { state: { path: reloaded.path, raw: reloaded.raw }, refusal: null };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function archiveBatchStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "archive", "batch-state.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {unknown} raw
 */
export function archiveBatchState(projectRoot, batchId, raw) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");

	const fd = fs.openSync(archivePath, "r");
	try {
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}

	return archivePath;
}

/**
 * Clear the completed batch-state pointer under the global batch-state lock
 * (SP-722 / #264; SP-786 / #303). Delegates to `clearActiveBatchStateIfMatches`,
 * which quarantines corrupt state instead of deleting it and refuses to touch
 * Taskplane-owned `.pi/` state files.
 *
 * @param {string} projectRoot
 * @param {string|null} batchStatePath
 * @param {string} batchId
 */
export function clearCompletedBatchState(projectRoot, batchStatePath, batchId) {
	clearActiveBatchStateIfMatches(batchStatePath, batchId, projectRoot);
}

/**
 * True when reconcile signals show live lane activity (running/pending tasks,
 * or a lane whose status is running/active) — dismiss treats this as a live
 * batch and requires --force.
 *
 * @param {object} signals
 * @returns {boolean}
 */
export function hasLiveLanes(signals) {
	if (!signals) return false;
	if (signals.hasRunningTasks || signals.hasPendingTasks) return true;
	const lanes = signals.lanes;
	return (
		Array.isArray(lanes) &&
		lanes.some((lane) => {
			const status = String(lane?.status ?? "").toLowerCase();
			return status === "running" || status === "active";
		})
	);
}

/**
 * @param {object|null|undefined} config
 */
function shouldCleanupWorktreesOnComplete(config) {
	if (config?.lanes?.cleanupWorktreesOnComplete === false) return false;
	return true;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {unknown} params.batchState
 * @param {object} params.config
 */
export function cleanupBatchLaneWorktrees({ projectRoot, batchId, batchState, config }) {
	if (!shouldCleanupWorktreesOnComplete(config)) return;
	const laneCount = maxLaneNumberFromBatchState(batchState);
	removeLaneWorktrees(projectRoot, batchId, laneCount);
	appendJournalEvent(projectRoot, batchId, "batch.worktrees_cleaned", {
		batchId,
		laneCount,
	});
}
