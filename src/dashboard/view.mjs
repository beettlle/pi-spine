/**
 * Dashboard view model (PRD §16.1) — pure functions for browser + tests.
 */

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
 * @param {object} snapshot
 */
export function buildBannerModel(snapshot) {
	const diagnosis = snapshot?.diagnosis ?? null;
	return {
		headline: snapshot?.headline ?? "",
		suggestedCommand: snapshot?.suggestedCommand ?? "",
		alternatives: snapshot?.alternatives ?? [],
		diagnosis,
		badgeClass: diagnosisBadgeClass(diagnosis),
		primaryAction: primaryActionLabel(diagnosis),
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
		waves: (waves.waves ?? []).map((wave) => ({
			index: wave.index,
			taskIds: wave.taskIds ?? [],
			status: wave.status,
		})),
	};
}

/**
 * @param {object} snapshot
 */
export function buildLaneTableModel(snapshot) {
	return (snapshot?.lanes ?? []).map((lane) => ({
		laneId: lane.laneId,
		status: lane.status,
		taskIds: lane.taskIds ?? [],
		heartbeatAgeSeconds: lane.heartbeatAgeSeconds,
		worktree: lane.worktree,
	}));
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
 * @param {object} snapshot
 */
export function buildJournalModel(snapshot) {
	return (snapshot?.journalTail ?? []).map((entry) => ({
		eventId: entry.eventId,
		type: entry.type,
		timestamp: entry.timestamp,
		summary: entry.summary,
	}));
}

/**
 * @param {object} snapshot
 */
export function buildDashboardViewModel(snapshot) {
	return {
		generatedAt: snapshot?.generatedAt ?? null,
		idle: isIdleSnapshot(snapshot),
		banner: buildBannerModel(snapshot),
		batch: buildBatchSummaryModel(snapshot?.batch),
		waves: buildWaveModel(snapshot),
		lanes: buildLaneTableModel(snapshot),
		gate: buildGateModel(snapshot?.gate),
		journal: buildJournalModel(snapshot),
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
		return diagnosisBadgeClass(diagnosis) === "badge-running";
	}
	return diagnosisBadgeClass(diagnosis) !== "badge-running" || diagnosis === "running";
}
