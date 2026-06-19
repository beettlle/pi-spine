/**
 * Dashboard snapshot builder (PRD §16, NFR-OBS-04).
 */

import {
	classifyTasks,
	loadBatchStateFile,
	parseBatchState,
	reconcileBatch,
} from "../batch/reconcile.mjs";
import { loadGateRecord, formatGateSummary } from "../batch/gate.mjs";
import {
	readJournalEvents,
	readJournalTail,
	summarizeJournalEvent,
} from "../batch/journal.mjs";
import { resolveStallConfig } from "../batch/heartbeat.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";

/**
 * @param {string|null|undefined} worktreePath
 */
export function truncateWorktreePath(worktreePath) {
	if (!worktreePath) return null;
	const parts = String(worktreePath).split(/[/\\]/).filter(Boolean);
	if (parts.length <= 3) return parts.join("/");
	return parts.slice(-3).join("/");
}

/**
 * @param {number|string|null|undefined} lastHeartbeatAt
 * @param {number} [now]
 */
export function heartbeatAgeSeconds(lastHeartbeatAt, now = Date.now()) {
	if (lastHeartbeatAt == null) return null;
	const ts =
		typeof lastHeartbeatAt === "number"
			? lastHeartbeatAt
			: new Date(lastHeartbeatAt).getTime();
	if (Number.isNaN(ts)) return null;
	return Math.max(0, Math.floor((now - ts) / 1000));
}

/**
 * @param {object} params
 * @param {object} params.lane
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {ReturnType<typeof resolveStallConfig>} params.stallConfig
 * @param {number} [params.now]
 */
export function classifyLaneStatus({ lane, classifiedTasks, stallConfig, now = Date.now() }) {
	const taskIds = lane.taskIds ?? [];
	const tasks = classifiedTasks.filter((task) => taskIds.includes(task.taskId));

	if (taskIds.length === 0) {
		return "completed";
	}

	const allDone =
		tasks.length > 0 && tasks.every((task) => task.classification === "terminal-success");
	if (allDone) return "completed";

	const hasActive = tasks.some(
		(task) => task.classification === "running" || task.classification === "pending",
	);
	if (!hasActive) return "completed";

	let referenceMs = null;
	if (lane.lastHeartbeatAt != null) {
		referenceMs =
			typeof lane.lastHeartbeatAt === "number"
				? lane.lastHeartbeatAt
				: new Date(lane.lastHeartbeatAt).getTime();
	}

	if (referenceMs == null || Number.isNaN(referenceMs)) {
		const startedAts = tasks
			.map((task) => task.startedAt)
			.filter((value) => value != null)
			.map((value) =>
				typeof value === "number" ? value : new Date(/** @type {string} */ (value)).getTime(),
			)
			.filter((value) => !Number.isNaN(value));
		referenceMs = startedAts.length ? Math.max(...startedAts) : now;
	}

	if (now - referenceMs > stallConfig.stallTimeoutMs) {
		return "stale";
	}

	return "running";
}

/**
 * Tasks running or pending in the current wave on this physical lane (tick-active subset).
 *
 * @param {object} params
 * @param {object} params.lane
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {string[]} [params.currentWaveTaskIds]
 */
export function computeActiveTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds }) {
	if (!currentWaveTaskIds?.length) return [];
	const waveSet = new Set(currentWaveTaskIds.map(String));
	return classifiedTasks
		.filter((task) => task.laneNumber === lane.laneNumber)
		.filter((task) => waveSet.has(task.taskId))
		.filter(
			(task) =>
				task.classification === "running" ||
				task.classification === "pending" ||
				task.status === "running" ||
				task.status === "pending",
		)
		.map((task) => task.taskId);
}

/**
 * @param {object} params
 * @param {object[]} params.lanes
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {ReturnType<typeof resolveStallConfig>} params.stallConfig
 * @param {string[]} [params.currentWaveTaskIds]
 * @param {number} [params.now]
 */
const LANE_ALERT_RECENT_MS = 30 * 60 * 1000;

/** @type {Record<string, string>} */
const REVIEW_TYPE_TO_ACTIVITY_PHASE = {
	plan: "plan_review",
	code: "code_review",
	final: "final_review",
};

/** @type {Record<string, string>} */
const ACTIVITY_PHASE_LABELS = {
	idle: "—",
	queued: "queued",
	launching: "launching",
	worker: "worker",
	verifying: "verifying",
	plan_review: "plan review",
	code_review: "code review",
	final_review: "final review",
	rework: "rework",
	failed: "failed",
};

/**
 * @param {number} laneNumber
 * @param {object} event
 */
export function laneEventMatches(laneNumber, event) {
	const laneId = `lane-${laneNumber}`;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (payload.laneNumber != null && payload.laneNumber !== laneNumber) return false;
	if (event.laneId && event.laneId !== laneId) return false;
	return true;
}

/**
 * @param {object} event
 */
function journalEventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) return event.taskId;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	return typeof payload.taskId === "string" ? payload.taskId : null;
}

/**
 * @param {object[]} journalEvents
 * @param {string} taskId
 * @param {unknown} stepNumber
 */
function isReviewClosedForTaskStep(journalEvents, taskId, stepNumber) {
	return journalEvents.some((event) => {
		if (journalEventTaskId(event) !== taskId) return false;
		if (event.type !== "review.completed" && event.type !== "review.failed") return false;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		return payload.stepNumber === stepNumber;
	});
}

/**
 * @param {object[]} journalEvents
 * @param {string} taskId
 */
function taskFailedWithoutRestart(journalEvents, taskId) {
	let lastFailedIdx = -1;
	let lastStartedIdx = -1;
	for (let i = 0; i < journalEvents.length; i += 1) {
		const event = journalEvents[i];
		if (journalEventTaskId(event) !== taskId) continue;
		if (event.type === "task.failed") lastFailedIdx = i;
		if (event.type === "task.started") lastStartedIdx = i;
	}
	return lastFailedIdx >= 0 && lastFailedIdx > lastStartedIdx;
}

/**
 * @param {number} laneNumber
 * @param {string} taskId
 * @param {object[]} journalEvents
 */
function taskHasReworkMarker(laneNumber, taskId, journalEvents) {
	for (let i = journalEvents.length - 1; i >= 0; i -= 1) {
		const event = journalEvents[i];
		if (event.type !== "lane.completed") continue;
		if (!laneEventMatches(laneNumber, event)) continue;
		if (journalEventTaskId(event) !== taskId) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const phase = payload.phase;
		if (phase === "code_rework" || phase === "final_rework") return true;
	}
	return false;
}

/**
 * @param {object} params
 * @param {number} params.laneNumber
 * @param {string[]} params.activeTaskIds
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {object[]} params.journalEvents
 */
export function resolveLaneActivityPhase({
	laneNumber,
	activeTaskIds = [],
	classifiedTasks = [],
	journalEvents = [],
}) {
	const activeIds = new Set((activeTaskIds ?? []).map(String));
	if (activeIds.size === 0) {
		return { activityPhase: "idle", activityPhaseLabel: ACTIVITY_PHASE_LABELS.idle };
	}

	const events = journalEvents ?? [];

	for (let i = events.length - 1; i >= 0; i -= 1) {
		const event = events[i];
		if (event.type !== "review.started") continue;
		if (!laneEventMatches(laneNumber, event)) continue;
		const taskId = journalEventTaskId(event);
		if (!taskId || !activeIds.has(String(taskId))) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const reviewType = payload.reviewType;
		const stepNumber = payload.stepNumber;
		if (typeof reviewType !== "string") continue;
		if (isReviewClosedForTaskStep(events, taskId, stepNumber)) continue;
		const activityPhase = REVIEW_TYPE_TO_ACTIVITY_PHASE[reviewType];
		if (!activityPhase) continue;
		return {
			activityPhase,
			activityPhaseLabel: ACTIVITY_PHASE_LABELS[activityPhase],
		};
	}

	for (const taskId of activeIds) {
		if (taskFailedWithoutRestart(events, String(taskId))) {
			return { activityPhase: "failed", activityPhaseLabel: ACTIVITY_PHASE_LABELS.failed };
		}
	}

	for (const taskId of activeIds) {
		if (taskHasReworkMarker(laneNumber, String(taskId), events)) {
			return { activityPhase: "rework", activityPhaseLabel: ACTIVITY_PHASE_LABELS.rework };
		}
	}

	const heartbeatMeta = resolveLaneHeartbeatMeta(laneNumber, events);
	if (heartbeatMeta.workerPhase === "launching") {
		return { activityPhase: "launching", activityPhaseLabel: ACTIVITY_PHASE_LABELS.launching };
	}
	if (heartbeatMeta.workerPhase === "pi") {
		return { activityPhase: "worker", activityPhaseLabel: ACTIVITY_PHASE_LABELS.worker };
	}
	if (heartbeatMeta.workerPhase === "verify") {
		return { activityPhase: "verifying", activityPhaseLabel: ACTIVITY_PHASE_LABELS.verifying };
	}

	const activeTasks = (classifiedTasks ?? []).filter((task) => activeIds.has(String(task.taskId)));
	if (activeTasks.some((task) => task.classification === "pending")) {
		return { activityPhase: "queued", activityPhaseLabel: ACTIVITY_PHASE_LABELS.queued };
	}

	return { activityPhase: "worker", activityPhaseLabel: ACTIVITY_PHASE_LABELS.worker };
}

/**
 * @param {number} laneNumber
 * @param {ReturnType<typeof formatJournalTailEntry>[]} journalTail
 * @param {number} now
 */
export function resolveLaneAlert(laneNumber, journalTail, now = Date.now()) {
	const laneId = `lane-${laneNumber}`;
	for (let i = journalTail.length - 1; i >= 0; i -= 1) {
		const entry = journalTail[i];
		if (entry.laneId && entry.laneId !== laneId) continue;
		const ts = Date.parse(entry.timestamp);
		if (Number.isNaN(ts) || now - ts > LANE_ALERT_RECENT_MS) continue;
		if (entry.type === "lane.stall_killed") return "stall-killed";
		if (entry.type === "lane.checkpoint_warning") return "checkpoint-warning";
	}
	return null;
}

/**
 * @param {number} laneNumber
 * @param {object[]} journalEvents
 */
export function resolveLaneHeartbeatMeta(laneNumber, journalEvents) {
	for (let i = journalEvents.length - 1; i >= 0; i -= 1) {
		const event = journalEvents[i];
		if (event.type !== "lane.heartbeat") continue;
		if (!laneEventMatches(laneNumber, event)) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		return {
			heartbeatKind:
				typeof payload.heartbeatKind === "string" ? payload.heartbeatKind : null,
			workerPhase: typeof payload.workerPhase === "string" ? payload.workerPhase : null,
		};
	}
	return { heartbeatKind: null, workerPhase: null };
}

/**
 * @param {object} params
 * @param {string|null|undefined} params.workerPhase
 * @param {number|null|undefined} params.heartbeatAgeSeconds
 */
export function formatLaneHeartbeatDisplay({ workerPhase, heartbeatAgeSeconds }) {
	if (workerPhase === "launching") return "launching";
	if (heartbeatAgeSeconds == null) return "—";
	return `${heartbeatAgeSeconds}s`;
}

/**
 * @param {object} params
 * @param {object[]} params.lanes
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {ReturnType<typeof resolveStallConfig>} params.stallConfig
 * @param {string[]} [params.currentWaveTaskIds]
 * @param {number} [params.now]
 * @param {object[]} [params.journalEvents]
 */
export function buildLaneRows({
	lanes,
	classifiedTasks,
	stallConfig,
	currentWaveTaskIds = [],
	journalTail = [],
	journalEvents = [],
	now = Date.now(),
}) {
	return (lanes ?? []).map((lane) => {
		const heartbeatMeta = resolveLaneHeartbeatMeta(lane.laneNumber, journalEvents);
		const heartbeatAgeSecondsValue = heartbeatAgeSeconds(lane.lastHeartbeatAt, now);
		const activeTaskIds = computeActiveTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds });
		const activity = resolveLaneActivityPhase({
			laneNumber: lane.laneNumber,
			activeTaskIds,
			classifiedTasks,
			journalEvents,
		});
		return {
			laneId: lane.laneId ?? `lane-${lane.laneNumber}`,
			laneNumber: lane.laneNumber,
			status: classifyLaneStatus({ lane, classifiedTasks, stallConfig, now }),
			activeTaskIds,
			activityPhase: activity.activityPhase,
			activityPhaseLabel: activity.activityPhaseLabel,
			taskIds: lane.taskIds ?? [],
			heartbeatAgeSeconds: heartbeatAgeSecondsValue,
			heartbeatKind: heartbeatMeta.heartbeatKind,
			workerPhase: heartbeatMeta.workerPhase,
			heartbeatDisplay: formatLaneHeartbeatDisplay({
				workerPhase: heartbeatMeta.workerPhase,
				heartbeatAgeSeconds: heartbeatAgeSecondsValue,
			}),
			worktree: truncateWorktreePath(lane.worktreePath),
			laneAlert: resolveLaneAlert(lane.laneNumber, journalTail, now),
		};
	});
}

/**
 * @param {import("../batch/reconcile.mjs").NormalizedBatchState | Record<string, unknown> | null} batchState
 */
export function buildWaveProgress(batchState) {
	const raw =
		batchState && typeof batchState === "object" && "raw" in batchState
			? /** @type {Record<string, unknown>} */ (batchState.raw)
			: /** @type {Record<string, unknown>} */ (batchState ?? {});

	const wavePlan = Array.isArray(raw.wavePlan) ? raw.wavePlan : [];
	const currentWaveIndex = Number(raw.currentWaveIndex ?? 0);
	const totalWaves = Number(raw.totalWaves ?? wavePlan.length);

	return {
		currentWaveIndex,
		totalWaves,
		waves: wavePlan.map((entry, index) => ({
			index,
			taskIds: Array.isArray(entry) ? entry.map(String) : [],
			status:
				index < currentWaveIndex ? "completed" : index === currentWaveIndex ? "active" : "pending",
		})),
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

/**
 * @param {import("../batch/reconcile.mjs").NormalizedBatchState | null} batch
 */
function summarizeBatch(batch) {
	if (!batch) return null;

	return {
		batchId: batch.batchId,
		phase: batch.phase,
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

/**
 * @param {string} projectRoot
 */
export function buildDashboardSnapshot(projectRoot) {
	const configResult = loadSpineConfig(projectRoot);
	const stallConfig = resolveStallConfig(configResult.config ?? {});
	const reconciliation = reconcileBatch({ projectRoot, verbose: true });

	let batch = null;
	if (reconciliation.batchStatePath) {
		const loaded = loadBatchStateFile(projectRoot, reconciliation.batchStatePath);
		if (loaded.raw) {
			batch = parseBatchState(loaded.raw, loaded.path ?? reconciliation.batchStatePath);
		}
	}

	const classifiedTasks =
		reconciliation.signals?.tasks ??
		(batch ? classifyTasks(batch, null) : []);

	let gate = null;
	if (reconciliation.batchId) {
		const record = loadGateRecord(projectRoot, reconciliation.batchId);
		if (record) {
			gate = {
				gateId: record.gateId,
				batchId: record.batchId,
				kind: record.kind,
				status: record.status,
				openedAt: record.openedAt,
				summary: formatGateSummary(record),
				evidenceRefs: record.evidenceRefs ?? [],
			};
		}
	}

	let journalTail = [];
	let journalEvents = [];
	if (reconciliation.batchId) {
		journalEvents = readJournalEvents(projectRoot, reconciliation.batchId);
		journalTail = readJournalTail(journalEvents, 20).map(formatJournalTailEntry);
	}

	const now = Date.now();
	const rawBatch =
		batch?.raw && typeof batch.raw === "object"
			? /** @type {Record<string, unknown>} */ (batch.raw)
			: {};
	const currentWaveIndex = Number(rawBatch.currentWaveIndex ?? 0);
	const wavePlan = Array.isArray(rawBatch.wavePlan) ? rawBatch.wavePlan : [];
	const currentWaveTaskIds = Array.isArray(wavePlan[currentWaveIndex])
		? wavePlan[currentWaveIndex].map(String)
		: [];

	const lanes = buildLaneRows({
		lanes: batch?.lanes ?? [],
		classifiedTasks,
		stallConfig,
		currentWaveTaskIds,
		journalTail,
		journalEvents,
		now,
	});
	const waves = buildWaveProgress(batch);
	const defaultView = buildDefaultViewStatus(reconciliation, gate);

	return {
		generatedAt: new Date(now).toISOString(),
		defaultView,
		diagnosis: reconciliation.diagnosis,
		headline: reconciliation.headline,
		suggestedCommand: reconciliation.suggestedCommand,
		alternatives: reconciliation.alternatives ?? [],
		batchId: reconciliation.batchId,
		phase: reconciliation.phase,
		batchStatePath: reconciliation.batchStatePath,
		reconciliation,
		batch: summarizeBatch(batch),
		lanes,
		gate,
		journalTail,
		waves,
	};
}
