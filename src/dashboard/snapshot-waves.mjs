/**
 * Wave progress and tail activity builders for dashboard snapshot (extracted from snapshot.mjs, SP-507).
 */

import { summarizeJournalEvent } from "../batch/journal.mjs";
import { isRunningWithoutActiveWorkers } from "./running-tail-state.mjs";

/**
 * @param {string[]} taskIds
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} classifiedTasks
 */
function waveTasksAllTerminalSuccess(taskIds, classifiedTasks) {
	if (!taskIds.length) return false;
	const byId = new Map((classifiedTasks ?? []).map((task) => [String(task.taskId), task]));
	return taskIds.every((taskId) => byId.get(String(taskId))?.classification === "terminal-success");
}

/** Diagnoses where terminal-success on disk must not imply wave completed (GitHub #186). */
const DRIFT_BLOCKING_DIAGNOSES = new Set(["state_drift", "engine_orphaned", "needs_retry"]);

/**
 * @param {string|null|undefined} diagnosis
 * @param {string|null|undefined} endedAt
 */
function blocksOptimisticWaveCompletion(diagnosis, endedAt) {
	if (!diagnosis || !DRIFT_BLOCKING_DIAGNOSES.has(diagnosis)) return false;
	if (endedAt != null) return false;
	return true;
}

/**
 * @param {number} index
 * @param {number} currentWaveIndex
 * @param {string[]} taskIds
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} [classifiedTasks]
 * @param {{ diagnosis?: string|null, endedAt?: string|null }} [options]
 */
function resolveWaveStatus(index, currentWaveIndex, taskIds, classifiedTasks, options = {}) {
	const { diagnosis = null, endedAt = null } = options;
	const blocked = blocksOptimisticWaveCompletion(diagnosis, endedAt);

	if (!blocked && classifiedTasks?.length && waveTasksAllTerminalSuccess(taskIds, classifiedTasks)) {
		return "completed";
	}
	if (!blocked && index < currentWaveIndex) return "completed";
	if (index === currentWaveIndex) return "active";
	return "pending";
}

/**
 * @param {import("../batch/reconcile.mjs").NormalizedBatchState | Record<string, unknown> | null} batchState
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} [classifiedTasks]
 * @param {{ diagnosis?: string|null, endedAt?: string|null }} [options]
 */
export function buildWaveProgress(batchState, classifiedTasks, options = {}) {
	const raw =
		batchState && typeof batchState === "object" && "raw" in batchState
			? /** @type {Record<string, unknown>} */ (batchState.raw)
			: /** @type {Record<string, unknown>} */ (batchState ?? {});

	const wavePlan = Array.isArray(raw.wavePlan) ? raw.wavePlan : [];
	const currentWaveIndex = Number(raw.currentWaveIndex ?? 0);
	const totalWaves = Number(raw.totalWaves ?? wavePlan.length);
	const diagnosis = options.diagnosis ?? null;
	const endedAt =
		options.endedAt ??
		(batchState && typeof batchState === "object" && "endedAt" in batchState
			? /** @type {{ endedAt?: string|null }} */ (batchState).endedAt ?? null
			: null);

	return {
		currentWaveIndex,
		totalWaves,
		waves: wavePlan.map((entry, index) => {
			const taskIds = Array.isArray(entry) ? entry.map(String) : [];
			return {
				index,
				taskIds,
				status: resolveWaveStatus(index, currentWaveIndex, taskIds, classifiedTasks, {
					diagnosis,
					endedAt,
				}),
			};
		}),
	};
}

/**
 * @param {object} event
 */
export function formatJournalTailEntry(event) {
	return {
		eventId: event.eventId,
		type: event.type,
		timestamp: event.timestamp,
		laneId: event.laneId ?? null,
		taskId: event.taskId ?? null,
		summary: summarizeJournalEvent(event),
	};
}

const TERMINAL_DIAGNOSES = new Set([
	"completed",
	"completed_manual",
	"limbo_stale",
	"failed",
	"aborted",
]);

/** @type {Record<string, string>} */
const TAIL_JOURNAL_ACTIVITY_LABELS = {
	"batch.merge_started": "Merging lane branches…",
	"batch.merge_completed": "Merge completed — finalizing batch…",
	"batch.merge_blocked": "Merge blocked — retry or resume",
	"gate.opened": "Integrate gate opened — awaiting approval",
	"gate.evidence_collecting": "Collecting gate evidence…",
	"engine.attached_post_merge_handoff": "Finalizing land loop…",
	"integrate.started": "Integrating to main…",
};

/** @type {Record<string, string>} */
const TAIL_MACRO_ACTIVITY_LABELS = {
	merging: "Merging lane branches…",
	gating: "Opening integrate gate…",
	integrating: "Integrating to main…",
	reviewing: "Running reviews — no workers scheduled",
	planning: "Planning — no workers scheduled",
};

/**
 * @param {object[]} [lanes]
 * @returns {boolean}
 */
export function lanesHaveActiveTasks(lanes) {
	for (const lane of lanes ?? []) {
		if (lane.runningTaskId) return true;
		if (Array.isArray(lane.queuedTaskIds) && lane.queuedTaskIds.length > 0) return true;
	}
	return false;
}

/**
 * @param {object} params
 * @param {string|null|undefined} params.diagnosis
 * @param {object|null|undefined} params.batch
 * @returns {boolean}
 */
function isBatchNonTerminal({ diagnosis, batch }) {
	if (!diagnosis) return false;
	if (TERMINAL_DIAGNOSES.has(diagnosis)) return false;
	if (batch?.endedAt) return false;
	return true;
}

/**
 * @param {object[]} [journalEvents]
 * @returns {string|null}
 */
export function resolveTailActivityFromJournal(journalEvents) {
	const events = journalEvents ?? [];
	for (let i = events.length - 1; i >= 0; i -= 1) {
		const label = TAIL_JOURNAL_ACTIVITY_LABELS[events[i].type];
		if (label) return label;
	}
	return null;
}

/**
 * Lane-agnostic activity subline when Running/Queued are empty but batch is still open (GitHub #68 Tier 3).
 *
 * @param {object} params
 * @param {object|null|undefined} params.reconciliation
 * @param {object|null|undefined} params.batch
 * @param {object[]} [params.lanes]
 * @param {import("../batch/macro-phase.mjs").MacroPhase|null|undefined} [params.macroPhase]
 * @param {string|null|undefined} [params.macroPhaseLabel]
 * @param {object[]} [params.journalEvents]
 * @returns {string|null}
 */
export function resolveTailActivityLabel({
	reconciliation,
	batch,
	lanes = [],
	macroPhase = null,
	macroPhaseLabel: phaseLabel = null,
	journalEvents = [],
}) {
	if (lanesHaveActiveTasks(lanes)) return null;

	const diagnosis = reconciliation?.diagnosis ?? null;
	if (!isBatchNonTerminal({ diagnosis, batch })) return null;

	const signals = reconciliation?.signals ?? {};
	const tailCtx = {
		phase: batch?.phase ?? reconciliation?.phase ?? signals.phase ?? null,
		hasRunningTasks: signals.hasRunningTasks === true,
		hasPendingTasks: signals.hasPendingTasks === true,
		pendingTaskCount:
			reconciliation?.pendingTasks ?? signals.pendingTasks ?? signals.pendingTaskCount ?? 0,
		succeededTasks: batch?.succeededTasks ?? reconciliation?.succeededTasks ?? 0,
		failedTasks: batch?.failedTasks ?? reconciliation?.failedTasks ?? 0,
		totalTasks: batch?.totalTasks ?? reconciliation?.totalTasks ?? 0,
		macroPhase,
		postMergeLimbo: signals.postMergeLimbo === true,
		integrateGateOpen: signals.integrateGateOpen === true,
		allTasksTerminalSuccess: signals.allTasksTerminalSuccess === true,
	};

	const inRunningTail = isRunningWithoutActiveWorkers(tailCtx);
	const inActionableTail =
		diagnosis === "needs_merge" || diagnosis === "needs_integrate" || diagnosis === "running";
	if (!inRunningTail && !inActionableTail) return null;

	const fromJournal = resolveTailActivityFromJournal(journalEvents);
	if (fromJournal) return fromJournal;

	if (macroPhase && TAIL_MACRO_ACTIVITY_LABELS[macroPhase]) {
		return TAIL_MACRO_ACTIVITY_LABELS[macroPhase];
	}

	if (phaseLabel) return phaseLabel;

	return null;
}

/**
 * @param {import("../batch/reconcile.mjs").NormalizedBatchState | null} batch
 */
export function summarizeBatch(batch, reconciliation = null) {
	if (!batch) return null;

	return {
		batchId: batch.batchId,
		phase: batch.phase,
		diagnosis: reconciliation?.diagnosis ?? null,
		baseBranch: batch.baseBranch,
		orchBranch: batch.orchBranch,
		startedAt: batch.startedAt,
		endedAt: batch.endedAt,
		failedTasks: batch.failedTasks,
		succeededTasks: batch.succeededTasks,
		totalTasks: batch.totalTasks,
		currentWaveIndex:
			batch.raw && typeof batch.raw === "object"
				? /** @type {{ currentWaveIndex?: number }} */ (batch.raw).currentWaveIndex ?? 0
				: 0,
		totalWaves:
			batch.raw && typeof batch.raw === "object"
				? /** @type {{ totalWaves?: number }} */ (batch.raw).totalWaves ??
					(Array.isArray(/** @type {{ wavePlan?: unknown[] }} */ (batch.raw).wavePlan)
						? /** @type {{ wavePlan: unknown[] }} */ (batch.raw).wavePlan.length
						: 0)
				: 0,
	};
}

/**
 * Default dashboard view (FR-SHIP-07): reconciliation headline/commands plus gate affordance
 * without requiring CLI `--diagnose`.
 *
 * @param {object} reconciliation
 * @param {object|null} gate
 */
export function buildDefaultViewStatus(reconciliation, gate) {
	const diagnosis = reconciliation?.diagnosis ?? null;
	const gateApplicable = diagnosis === "needs_integrate" || gate != null;

	let gateAffordance = null;
	if (gate) {
		gateAffordance = {
			visible: true,
			gateId: gate.gateId,
			kind: gate.kind,
			status: gate.status,
			summary: gate.summary,
			openedAt: gate.openedAt,
			pending: gate.status === "pending",
		};
	} else if (diagnosis === "needs_integrate") {
		gateAffordance = {
			visible: true,
			gateId: null,
			kind: "integrate",
			status: "missing",
			summary: "Integrate gate not opened yet — wait for engine or run spine batch resume",
			openedAt: null,
			pending: true,
		};
	}

	return {
		diagnosis,
		headline: reconciliation?.headline ?? "",
		suggestedCommand: reconciliation?.suggestedCommand ?? "",
		alternatives: reconciliation?.alternatives ?? [],
		gateApplicable,
		gate: gateAffordance,
	};
}
