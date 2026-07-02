/**
 * Dashboard view model (PRD §16.1) — pure functions for browser + tests.
 */

import { isRunningWithoutActiveWorkers } from "../batch/diagnosis-tail-state.mjs";
import {
	computeThroughputTasksPerHour,
	emptyLaneThroughputStats,
	formatElapsedMs,
	formatThroughputRate,
} from "./lane-throughput.mjs";

const BADGE_FINALIZING = "badge-finalizing";

const DIAGNOSIS_BADGE_CLASS = {
	running: "badge-running",
	paused: "badge-paused",
	needs_retry: "badge-action",
	needs_merge: "badge-action",
	needs_integrate: "badge-integrate",
	completed: "badge-success",
	completed_manual: "badge-warn",
	limbo_stale: "badge-warn",
	failed: "badge-error",
	aborted: "badge-error",
};

const PRIMARY_ACTION_LABEL = {
	limbo_stale: "Dismiss",
	aborted: "Dismiss",
	completed_manual: "Complete",
	needs_integrate: "Integrate",
	needs_retry: "Retry",
	failed: "Retry",
	needs_merge: "Resume",
	paused: "Resume",
	running: "Status",
	completed: "Preflight",
};

/**
 * @param {string|null|undefined} diagnosis
 */
export function diagnosisBadgeClass(diagnosis) {
	if (!diagnosis) return "badge-idle";
	return DIAGNOSIS_BADGE_CLASS[diagnosis] ?? "badge-action";
}

/**
 * @param {string|null|undefined} diagnosis
 */
export function primaryActionLabel(diagnosis) {
	if (!diagnosis) return null;
	return PRIMARY_ACTION_LABEL[diagnosis] ?? "Diagnose";
}

/**
 * @param {object} snapshot
 */
export function isIdleSnapshot(snapshot) {
	return snapshot?.diagnosis == null && snapshot?.batchId == null;
}

/**
 * @param {string} command
 */
export function alternativeActionLabel(command) {
	const cmd = String(command ?? "").trim();
	if (!cmd) return "Action";
	if (/dismiss/i.test(cmd)) return "Dismiss";
	if (/complete/i.test(cmd)) return "Complete";
	if (/integrate/i.test(cmd)) return "Integrate";
	if (/retry/i.test(cmd)) return "Retry";
	if (/resume/i.test(cmd)) return "Resume";
	if (/pause/i.test(cmd)) return "Pause";
	if (/abort/i.test(cmd)) return "Abort";
	if (/preflight/i.test(cmd)) return "Preflight";
	if (/plan/i.test(cmd)) return "Plan";
	if (/skip/i.test(cmd)) return "Skip";
	if (/gate/i.test(cmd)) return "Gate";
	if (/status|diagnose/i.test(cmd)) return "Status";
	return cmd.replace(/^\//, "").split(/\s+/)[0] || "Action";
}

/**
 * Copyable CLI chips for the diagnosis banner (§16.1). No HTTP mutations.
 *
 * @param {object} snapshot
 * @returns {{ label: string, command: string, primary: boolean }[]}
 */
export function buildActionChips(snapshot) {
	const chips = [];
	const diagnosis = snapshot?.diagnosis ?? null;
	const suggested = snapshot?.suggestedCommand ?? "";
	const primaryLabel = primaryActionLabel(diagnosis);

	if (suggested) {
		chips.push({
			label: primaryLabel ?? (diagnosis ? "Diagnose" : "Preflight"),
			command: suggested,
			primary: true,
		});
	}

	for (const alt of snapshot?.alternatives ?? []) {
		if (!alt || alt === suggested) continue;
		chips.push({
			label: alternativeActionLabel(alt),
			command: alt,
			primary: false,
		});
	}

	return chips;
}

/**
 * @param {object} snapshot
 * @returns {boolean}
 */
function snapshotHasRunningLaneTasks(snapshot) {
	for (const lane of snapshot?.lanes ?? []) {
		if (lane?.runningTaskId) return true;
		if (Array.isArray(lane?.queuedTaskIds) && lane.queuedTaskIds.length > 0) return true;
	}
	return false;
}

/**
 * @param {object} snapshot
 */
function buildBannerTailContext(snapshot) {
	const signals = snapshot?.reconciliation?.signals ?? {};
	const batch = snapshot?.batch ?? {};
	return {
		phase: snapshot?.phase ?? batch.phase ?? signals.phase ?? null,
		hasRunningTasks:
			signals.hasRunningTasks === true || snapshotHasRunningLaneTasks(snapshot),
		hasPendingTasks: signals.hasPendingTasks === true,
		pendingTaskCount:
			snapshot?.reconciliation?.pendingTasks ??
			signals.pendingTasks ??
			signals.pendingTaskCount ??
			0,
		succeededTasks: batch.succeededTasks ?? snapshot?.reconciliation?.succeededTasks ?? 0,
		failedTasks: batch.failedTasks ?? snapshot?.reconciliation?.failedTasks ?? 0,
		totalTasks: batch.totalTasks ?? snapshot?.reconciliation?.totalTasks ?? 0,
		macroPhase:
			snapshot?.macroPhase ?? batch.macroPhase ?? snapshot?.reconciliation?.macroPhase ?? null,
		postMergeLimbo: signals.postMergeLimbo === true,
		integrateGateOpen: signals.integrateGateOpen === true,
		stalePathSpine: signals.stalePathSpine === true,
		gitMerged: signals.git?.orchMergedToBase,
		allTasksTerminalSuccess: signals.allTasksTerminalSuccess === true,
	};
}

/**
 * @param {object} snapshot
 * @param {string|null|undefined} diagnosis
 */
function resolveBannerBadge(snapshot, diagnosis) {
	const baseClass = diagnosisBadgeClass(diagnosis);
	const baseLabel = diagnosis ? String(diagnosis).replace(/_/g, " ") : "";

	if (diagnosis !== "running") {
		return { badgeClass: baseClass, badgeLabel: baseLabel, subline: null, tailState: false };
	}

	const tailCtx = buildBannerTailContext(snapshot);
	if (tailCtx.hasRunningTasks || tailCtx.hasPendingTasks) {
		return { badgeClass: "badge-running", badgeLabel: "running", subline: null, tailState: false };
	}

	if (!isRunningWithoutActiveWorkers(tailCtx)) {
		return { badgeClass: baseClass, badgeLabel: baseLabel, subline: null, tailState: false };
	}

	const phaseLabel =
		snapshot?.macroPhaseLabel ??
		snapshot?.batch?.macroPhaseLabel ??
		snapshot?.reconciliation?.macroPhaseLabel ??
		null;

	return {
		badgeClass: BADGE_FINALIZING,
		badgeLabel: phaseLabel ?? "finalizing",
		subline: phaseLabel,
		tailState: true,
	};
}

/**
 * @param {object} snapshot
 */
export function buildBannerModel(snapshot) {
	const diagnosis = snapshot?.diagnosis ?? null;
	const badge = resolveBannerBadge(snapshot, diagnosis);
	return {
		headline: snapshot?.headline ?? "",
		suggestedCommand: snapshot?.suggestedCommand ?? "",
		alternatives: snapshot?.alternatives ?? [],
		diagnosis,
		badgeClass: badge.badgeClass,
		badgeLabel: badge.badgeLabel,
		subline: badge.subline,
		tailState: badge.tailState,
		primaryAction: primaryActionLabel(diagnosis),
		actionChips: buildActionChips(snapshot),
		idle: isIdleSnapshot(snapshot),
	};
}

/**
 * @param {object|null|undefined} batch
 */
export function buildBatchSummaryModel(batch) {
	if (!batch) return null;
	return {
		batchId: batch.batchId,
		phase: batch.phase,
		macroPhase: batch.macroPhase ?? null,
		macroPhaseLabel: batch.macroPhaseLabel ?? null,
		baseBranch: batch.baseBranch,
		orchBranch: batch.orchBranch,
		startedAt: batch.startedAt,
		endedAt: batch.endedAt,
		taskCounts: {
			succeeded: batch.succeededTasks ?? 0,
			failed: batch.failedTasks ?? 0,
			total: batch.totalTasks ?? 0,
		},
	};
}

/**
 * @param {object} snapshot
 */
export function buildWaveModel(snapshot) {
	const waves = snapshot?.waves ?? { currentWaveIndex: 0, totalWaves: 0, waves: [] };
	return {
		currentWaveIndex: waves.currentWaveIndex ?? 0,
		totalWaves: waves.totalWaves ?? 0,
		macroPhaseLabel: snapshot?.macroPhaseLabel ?? snapshot?.batch?.macroPhaseLabel ?? null,
		waves: (waves.waves ?? []).map((wave) => ({
			index: wave.index,
			taskIds: wave.taskIds ?? [],
			status: wave.status,
		})),
	};
}

/**
 * @param {object} lane
 */
export function formatLaneHeartbeatDisplay(lane) {
	if (lane?.workerPhase === "launching") return "launching";
	if (lane?.heartbeatAgeSeconds == null) return "—";
	return `${lane.heartbeatAgeSeconds}s`;
}

/**
 * @param {object} lane
 */
export function buildLaneThroughputModel(lane) {
	const throughput = lane?.throughput ?? emptyLaneThroughputStats();
	return {
		activeElapsedMs: throughput.activeElapsedMs,
		completedCount: throughput.completedCount,
		failedCount: throughput.failedCount,
		throughputTasksPerHour: throughput.throughputTasksPerHour,
		elapsedDisplay: formatElapsedMs(throughput.activeElapsedMs),
		doneDisplay: throughput.completedCount > 0 ? String(throughput.completedCount) : "—",
		rateDisplay:
			throughput.throughputTasksPerHour == null
				? "—"
				: `${formatThroughputRate(throughput.throughputTasksPerHour)} tasks/hr`,
	};
}

/**
 * @param {object|null|undefined} summary
 */
export function buildLaneThroughputSummaryModel(summary) {
	const throughput = summary ?? emptyLaneThroughputStats();
	return {
		elapsedDisplay: formatElapsedMs(throughput.activeElapsedMs),
		doneDisplay: throughput.completedCount > 0 ? String(throughput.completedCount) : "—",
		rateDisplay:
			throughput.throughputTasksPerHour == null
				? "—"
				: `${formatThroughputRate(throughput.throughputTasksPerHour)} tasks/hr`,
	};
}

/**
 * @param {object} lane
 */
export function buildLaneDetailModel(lane) {
	return {
		recentEvents: (lane?.recentEvents ?? []).map((entry) => ({
			eventId: entry.eventId,
			type: entry.type,
			timestamp: entry.timestamp,
			summary: entry.summary,
		})),
		logTail: lane?.logTail ?? [],
		workerLogRef: lane?.workerLogRef ?? null,
	};
}

/**
 * Resolve running vs queued task projection for the lane table.
 * Prefers SP-379 snapshot fields; falls back to deprecated activeTaskIds.
 *
 * @param {object} lane
 */
export function resolveLaneQueueProjection(lane) {
	const runningTaskId = lane?.runningTaskId ?? null;
	const queuedTaskIds = lane?.queuedTaskIds ?? null;

	if (runningTaskId != null || (queuedTaskIds != null && queuedTaskIds.length > 0)) {
		return {
			runningTaskId: runningTaskId ?? null,
			queuedTaskIds: queuedTaskIds ?? [],
		};
	}

	const activeTaskIds = lane?.activeTaskIds ?? [];
	if (activeTaskIds.length === 0) {
		return { runningTaskId: null, queuedTaskIds: [] };
	}

	// Degraded fallback until snapshot exposes explicit queue fields (SP-379).
	if (lane?.status === "running" && activeTaskIds.length >= 1) {
		return {
			runningTaskId: activeTaskIds[0] ?? null,
			queuedTaskIds: activeTaskIds.slice(1),
		};
	}

	return { runningTaskId: null, queuedTaskIds: [...activeTaskIds] };
}

/**
 * @param {object} snapshot
 */
export function buildLaneTableModel(snapshot) {
	return (snapshot?.lanes ?? []).map((lane) => {
		const queue = resolveLaneQueueProjection(lane);
		return {
			laneId: lane.laneId,
			laneNumber: lane.laneNumber,
			status: lane.status,
			activeTaskIds: lane.activeTaskIds ?? [],
			runningTaskId: queue.runningTaskId,
			queuedTaskIds: queue.queuedTaskIds,
			queuedCount: queue.queuedTaskIds.length,
			taskIds: lane.taskIds ?? [],
			heartbeatAgeSeconds: lane.heartbeatAgeSeconds,
			heartbeatKind: lane.heartbeatKind ?? null,
			workerPhase: lane.workerPhase ?? null,
			heartbeatDisplay: lane.heartbeatDisplay ?? formatLaneHeartbeatDisplay(lane),
			activityPhase: lane.activityPhase ?? "idle",
			activityPhaseLabel: lane.activityPhaseLabel ?? "—",
			worktree: lane.worktree,
			laneAlert: lane.laneAlert ?? null,
			throughput: buildLaneThroughputModel(lane),
			detail: buildLaneDetailModel(lane),
		};
	});
}

/**
 * @param {object} snapshot
 */
export function buildLaneTableSummaryModel(snapshot) {
	const lanes = snapshot?.lanes ?? [];
	if (lanes.length < 2) return null;

	if (snapshot?.laneThroughputSummary) {
		return buildLaneThroughputSummaryModel(snapshot.laneThroughputSummary);
	}

	let activeElapsedMs = 0;
	let completedCount = 0;
	let failedCount = 0;
	for (const lane of lanes) {
		const throughput = lane.throughput ?? emptyLaneThroughputStats();
		activeElapsedMs += throughput.activeElapsedMs;
		completedCount += throughput.completedCount;
		failedCount += throughput.failedCount;
	}

	return buildLaneThroughputSummaryModel({
		activeElapsedMs,
		completedCount,
		failedCount,
		throughputTasksPerHour: computeThroughputTasksPerHour(completedCount, activeElapsedMs),
	});
}

/**
 * @param {object|null|undefined} gate
 */
export function buildGateModel(gate) {
	if (!gate) return null;
	return {
		gateId: gate.gateId,
		kind: gate.kind,
		status: gate.status,
		summary: gate.summary,
		openedAt: gate.openedAt,
	};
}

/**
 * Gate affordance for the default dashboard view (FR-SHIP-07).
 *
 * @param {object} snapshot
 */
export function buildGateAffordanceModel(snapshot) {
	const defaultView = snapshot?.defaultView;
	if (defaultView?.gate?.visible) {
		return defaultView.gate;
	}

	const gate = snapshot?.gate;
	if (gate) {
		return {
			visible: true,
			gateId: gate.gateId,
			kind: gate.kind,
			status: gate.status,
			summary: gate.summary,
			openedAt: gate.openedAt,
			pending: gate.status === "pending",
		};
	}

	if (snapshot?.diagnosis === "needs_integrate") {
		return {
			visible: true,
			gateId: null,
			kind: "integrate",
			status: "missing",
			summary: "Integrate gate not opened yet — wait for engine or run spine batch resume",
			openedAt: null,
			pending: true,
		};
	}

	return null;
}

/**
 * @param {object} snapshot
 */
export function shouldShowGateAffordance(snapshot) {
	return buildGateAffordanceModel(snapshot) != null;
}

/**
 * @param {object} snapshot
 * @param {{ laneFilter?: string|null }} [options]
 */
export function buildJournalModel(snapshot, { laneFilter = null } = {}) {
	let entries = snapshot?.journalTail ?? [];
	if (laneFilter) {
		entries = entries.filter((entry) => entry.laneId === laneFilter);
	}
	return entries.map((entry) => ({
		eventId: entry.eventId,
		type: entry.type,
		timestamp: entry.timestamp,
		laneId: entry.laneId ?? null,
		summary: entry.summary,
	}));
}

/**
 * Lane ids for the optional journal panel filter.
 *
 * @param {object} snapshot
 */
export function buildJournalLaneFilterOptions(snapshot) {
	return (snapshot?.lanes ?? []).map((lane) => ({
		laneId: lane.laneId,
		label: lane.laneId ?? `lane-${lane.laneNumber}`,
	}));
}

/**
 * @param {object} snapshot
 * @param {{ journalLaneFilter?: string|null }} [options]
 */
export function buildDashboardViewModel(snapshot, { journalLaneFilter = null } = {}) {
	return {
		generatedAt: snapshot?.generatedAt ?? null,
		idle: isIdleSnapshot(snapshot),
		banner: buildBannerModel(snapshot),
		batch: buildBatchSummaryModel(snapshot?.batch),
		waves: buildWaveModel(snapshot),
		lanes: buildLaneTableModel(snapshot),
		laneTableSummary: buildLaneTableSummaryModel(snapshot),
		gate: buildGateModel(snapshot?.gate),
		gateAffordance: buildGateAffordanceModel(snapshot),
		showGateAffordance: shouldShowGateAffordance(snapshot),
		journal: buildJournalModel(snapshot, { laneFilter: journalLaneFilter }),
		journalLaneFilterOptions: buildJournalLaneFilterOptions(snapshot),
	};
}

/**
 * Banner must not use running/green styling when diagnosis is needs_integrate
 * even if batch.phase is completed (AC-7.3 / TP-025).
 *
 * @param {object} snapshot
 */
export function bannerUsesDiagnosisNotPhase(snapshot) {
	const diagnosis = snapshot?.diagnosis;
	const phase = snapshot?.batch?.phase;
	if (diagnosis === "needs_integrate" && phase === "completed") {
		return diagnosisBadgeClass(diagnosis) === "badge-integrate";
	}
	if (diagnosis === "running") {
		const badge = resolveBannerBadge(snapshot, diagnosis);
		if (badge.tailState) {
			return badge.badgeClass === BADGE_FINALIZING;
		}
		return badge.badgeClass === "badge-running";
	}
	return diagnosisBadgeClass(diagnosis) !== "badge-running" || diagnosis === "running";
}
