/**
 * Dashboard snapshot builder (PRD §16, NFR-OBS-04).
 */

import fs from "node:fs";
import path from "node:path";
import { isRunningWithoutActiveWorkers } from "./running-tail-state.mjs";
import { deriveMacroPhase, macroPhaseLabel } from "../batch/macro-phase.mjs";
import {
	classifyTasks,
	loadBatchStateFile,
	parseBatchState,
	reconcileBatch,
} from "../batch/reconcile.mjs";
import { loadGateRecord, formatGateSummary } from "../batch/gate.mjs";
import {
	readJournalEventsCached,
	readJournalTail,
	summarizeJournalEvent,
} from "../batch/journal.mjs";
import { resolveStallConfig } from "../batch/heartbeat.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import {
	deriveLanesThroughput,
	deriveLaneThroughputStats,
	emptyLaneThroughputStats,
	summarizeLaneThroughput,
} from "./lane-throughput.mjs";
import {
	filterMetricsLines,
	metricsFilePath,
	readMetricsLines,
} from "../batch/metrics.mjs";
import {
	workerLiveLogPath,
	workerLiveLogRef,
	workerOutputLogPath,
	workerOutputLogRef,
} from "../batch/worker-output.mjs";

const LANE_RECENT_EVENTS_LIMIT = 5;
const LANE_LOG_TAIL_LINES = 10;

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
export function classifyLaneStatus({ lane, classifiedTasks, stallConfig, now = Date.now(), diagnosis = null }) {
	const taskIds = lane.taskIds ?? [];
	const tasks = classifiedTasks.filter((task) => taskIds.includes(task.taskId));

	if (taskIds.length === 0) {
		return "completed";
	}

	if (diagnosis === "engine_orphaned" || diagnosis === "state_drift" || diagnosis === "needs_retry") {
		const hasOpenWork = tasks.some((task) => {
			const status = String(task.status ?? "").toLowerCase();
			return status === "pending" || status === "running" || status === "failed" || task.doneInLane === true;
		});
		if (hasOpenWork) return diagnosis === "engine_orphaned" ? "stale" : "running";
	}

	const allDone =
		tasks.length > 0 &&
		tasks.every((task) => {
			const status = String(task.status ?? "").toLowerCase();
			return status === "succeeded" || status === "skipped";
		});
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
	const runningTaskId = computeRunningTaskIdForLane({ lane, classifiedTasks, currentWaveTaskIds });
	const queuedTaskIds = computeQueuedTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds });
	if (runningTaskId) return [runningTaskId, ...queuedTaskIds];
	return [...queuedTaskIds];
}

/**
 * Single running task in the current wave on this physical lane (engine: ≤1 per lane).
 *
 * @param {object} params
 * @param {object} params.lane
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {string[]} [params.currentWaveTaskIds]
 */
export function computeRunningTaskIdForLane({ lane, classifiedTasks, currentWaveTaskIds }) {
	if (!currentWaveTaskIds?.length) return null;
	const waveSet = new Set(currentWaveTaskIds.map(String));
	const running = classifiedTasks.find(
		(task) =>
			task.laneNumber === lane.laneNumber &&
			waveSet.has(task.taskId) &&
			(task.classification === "running" || task.status === "running"),
	);
	return running?.taskId ?? null;
}

/**
 * Pending tasks in the current wave on this lane, ordered by lane assignment queue.
 *
 * @param {object} params
 * @param {object} params.lane
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} params.classifiedTasks
 * @param {string[]} [params.currentWaveTaskIds]
 * @param {string[]} [params.laneTaskIds]
 */
export function computeQueuedTaskIdsForLane({
	lane,
	classifiedTasks,
	currentWaveTaskIds,
	laneTaskIds,
}) {
	if (!currentWaveTaskIds?.length) return [];
	const waveSet = new Set(currentWaveTaskIds.map(String));
	const assignmentOrder = laneTaskIds ?? lane.taskIds ?? [];

	const pendingIds = new Set(
		classifiedTasks
			.filter(
				(task) =>
					task.laneNumber === lane.laneNumber &&
					waveSet.has(task.taskId) &&
					(task.classification === "pending" || task.status === "pending"),
			)
			.map((task) => String(task.taskId)),
	);

	return assignmentOrder.filter((taskId) => pendingIds.has(String(taskId))).map(String);
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
 * @param {object[]} [params.metricsLines]
 * @param {string|null} [params.projectRoot]
 * @param {string|null} [params.batchId]
 */
export function buildLaneRows({
	lanes,
	classifiedTasks,
	stallConfig,
	currentWaveTaskIds = [],
	journalTail = [],
	journalEvents = [],
	metricsLines = [],
	projectRoot = null,
	batchId = null,
	now = Date.now(),
	diagnosis = null,
}) {
	const throughputByLane = deriveLanesThroughput({
		lanes,
		journalEvents,
		metricsLines,
		now,
	});

	return (lanes ?? []).map((lane) => {
		const heartbeatMeta = resolveLaneHeartbeatMeta(lane.laneNumber, journalEvents);
		const heartbeatAgeSecondsValue = heartbeatAgeSeconds(lane.lastHeartbeatAt, now);
		const runningTaskId = computeRunningTaskIdForLane({ lane, classifiedTasks, currentWaveTaskIds });
		const queuedTaskIds = computeQueuedTaskIdsForLane({
			lane,
			classifiedTasks,
			currentWaveTaskIds,
			laneTaskIds: lane.taskIds ?? [],
		});
		const activeTaskIds = computeActiveTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds });
		const activity = resolveLaneActivityPhase({
			laneNumber: lane.laneNumber,
			activeTaskIds,
			classifiedTasks,
			journalEvents,
		});
		const throughput =
			throughputByLane.get(lane.laneNumber) ?? emptyLaneThroughputStats();
		const recentEvents = buildLaneRecentEvents(lane.laneNumber, journalEvents);
		const logDetail =
			projectRoot && batchId
				? buildLaneLogTail(
						projectRoot,
						batchId,
						lane.laneNumber,
						activeTaskIds,
						lane.taskIds ?? [],
					)
				: { logTail: [], workerLogRef: null };
		return {
			laneId: lane.laneId ?? `lane-${lane.laneNumber}`,
			laneNumber: lane.laneNumber,
			status: classifyLaneStatus({ lane, classifiedTasks, stallConfig, now, diagnosis }),
			activeTaskIds,
			runningTaskId,
			queuedTaskIds,
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
			throughput,
			recentEvents,
			logTail: logDetail.logTail,
			workerLogRef: logDetail.workerLogRef,
		};
	});
}

/**
 * @param {string[]} taskIds
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} classifiedTasks
 */
function waveTasksAllTerminalSuccess(taskIds, classifiedTasks) {
	if (!taskIds.length) return false;
	const byId = new Map((classifiedTasks ?? []).map((task) => [String(task.taskId), task]));
	return taskIds.every((taskId) => byId.get(String(taskId))?.classification === "terminal-success");
}

/**
 * @param {number} index
 * @param {number} currentWaveIndex
 * @param {string[]} taskIds
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} [classifiedTasks]
 */
function resolveWaveStatus(index, currentWaveIndex, taskIds, classifiedTasks) {
	if (classifiedTasks?.length && waveTasksAllTerminalSuccess(taskIds, classifiedTasks)) {
		return "completed";
	}
	if (index < currentWaveIndex) return "completed";
	if (index === currentWaveIndex) return "active";
	return "pending";
}

/**
 * @param {import("../batch/reconcile.mjs").NormalizedBatchState | Record<string, unknown> | null} batchState
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} [classifiedTasks]
 */
export function buildWaveProgress(batchState, classifiedTasks) {
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
		waves: wavePlan.map((entry, index) => {
			const taskIds = Array.isArray(entry) ? entry.map(String) : [];
			return {
				index,
				taskIds,
				status: resolveWaveStatus(index, currentWaveIndex, taskIds, classifiedTasks),
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

/**
 * @param {number} laneNumber
 * @param {object} event
 */
function journalEventScopedToLane(laneNumber, event) {
	const laneId = `lane-${laneNumber}`;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (event.laneId) return event.laneId === laneId;
	if (payload.laneNumber != null) return payload.laneNumber === laneNumber;
	return false;
}

/**
 * Last N journal events scoped to a physical lane.
 *
 * @param {number} laneNumber
 * @param {object[]} journalEvents
 * @param {number} [limit]
 */
export function buildLaneRecentEvents(laneNumber, journalEvents, limit = LANE_RECENT_EVENTS_LIMIT) {
	const matching = (journalEvents ?? []).filter(
		(event) => journalEventScopedToLane(laneNumber, event) && laneEventMatches(laneNumber, event),
	);
	return readJournalTail(matching, limit).map(formatJournalTailEntry);
}

/**
 * @param {string|null|undefined} filePath
 * @param {number} [lineCount]
 * @returns {string[]}
 */
export function readLogFileTailLines(filePath, lineCount = LANE_LOG_TAIL_LINES) {
	if (!filePath || !fs.existsSync(filePath)) return [];
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return [];
	return lines.slice(-lineCount);
}

/**
 * Prefer live worker log for active tasks, then terminal output log, then newest in lane dir.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string[]} activeTaskIds
 * @param {string[]} taskIds
 * @returns {{ path: string, ref: string } | null}
 */
export function resolveLaneWorkerLog(projectRoot, batchId, laneNumber, activeTaskIds, taskIds) {
	/** @type {string[]} */
	const orderedTaskIds = [];
	const seen = new Set();
	for (const taskId of [...(activeTaskIds ?? []), ...(taskIds ?? [])]) {
		if (!taskId || seen.has(taskId)) continue;
		seen.add(taskId);
		orderedTaskIds.push(String(taskId));
	}

	for (const taskId of orderedTaskIds) {
		const livePath = workerLiveLogPath(projectRoot, batchId, laneNumber, taskId);
		if (fs.existsSync(livePath)) {
			return { path: livePath, ref: workerLiveLogRef(batchId, laneNumber, taskId) };
		}
		const outputPath = workerOutputLogPath(projectRoot, batchId, laneNumber, taskId);
		if (fs.existsSync(outputPath)) {
			return { path: outputPath, ref: workerOutputLogRef(batchId, laneNumber, taskId) };
		}
	}

	const laneDir = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
	);
	if (!fs.existsSync(laneDir)) return null;

	/** @type {{ path: string, ref: string, mtime: number } | null} */
	let newest = null;
	for (const name of fs.readdirSync(laneDir)) {
		const isLive = name.startsWith("worker-live-") && name.endsWith(".log");
		const isOutput = name.startsWith("worker-output-") && name.endsWith(".log");
		if (!isLive && !isOutput) continue;
		const candidate = path.join(laneDir, name);
		const mtime = fs.statSync(candidate).mtimeMs;
		if (!newest || mtime >= newest.mtime) {
			const taskId = name.replace(/^worker-(?:live|output)-/, "").replace(/\.log$/, "");
			newest = {
				path: candidate,
				ref: isLive
					? workerLiveLogRef(batchId, laneNumber, taskId)
					: workerOutputLogRef(batchId, laneNumber, taskId),
				mtime,
			};
		}
	}

	return newest ? { path: newest.path, ref: newest.ref } : null;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string[]} activeTaskIds
 * @param {string[]} taskIds
 */
export function buildLaneLogTail(projectRoot, batchId, laneNumber, activeTaskIds, taskIds) {
	const resolved = resolveLaneWorkerLog(projectRoot, batchId, laneNumber, activeTaskIds, taskIds);
	if (!resolved) {
		return { logTail: [], workerLogRef: null };
	}
	return {
		logTail: readLogFileTailLines(resolved.path, LANE_LOG_TAIL_LINES),
		workerLogRef: resolved.ref,
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
function summarizeBatch(batch, reconciliation = null) {
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
		journalEvents = readJournalEventsCached(projectRoot, reconciliation.batchId);
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

	const config = configResult.config ?? {};
	let metricsLines = [];
	if (reconciliation.batchId) {
		const metricsPath = metricsFilePath(projectRoot, config);
		metricsLines = filterMetricsLines(readMetricsLines(metricsPath), {
			batchId: reconciliation.batchId,
		});
	}

	const lanes = buildLaneRows({
		lanes: batch?.lanes ?? [],
		classifiedTasks,
		stallConfig,
		currentWaveTaskIds,
		journalTail,
		journalEvents,
		metricsLines,
		projectRoot,
		batchId: reconciliation.batchId,
		now,
		diagnosis: reconciliation.diagnosis,
	});
	const laneThroughputSummary = summarizeLaneThroughput(
		deriveLanesThroughput({
			lanes: batch?.lanes ?? [],
			journalEvents,
			metricsLines,
			tasks: batch?.tasks,
			now,
		}),
	);
	const waves = buildWaveProgress(batch, classifiedTasks);
	const defaultView = buildDefaultViewStatus(reconciliation, gate);

	const macroPhase = deriveMacroPhase({
		diagnosis: reconciliation.diagnosis,
		batchPhase: batch?.phase ?? reconciliation.phase,
		currentWaveIndex,
		mergeResults: Array.isArray(rawBatch.mergeResults) ? rawBatch.mergeResults : [],
		gateRecord: gate,
		postMergeLimbo: reconciliation.signals?.postMergeLimbo === true,
		journalEvents,
	});
	const resolvedMacroPhaseLabel = macroPhaseLabel(macroPhase);
	const batchSummary = summarizeBatch(batch, reconciliation);
	if (batchSummary) {
		batchSummary.macroPhase = macroPhase;
		batchSummary.macroPhaseLabel = resolvedMacroPhaseLabel;
	}

	const tailActivityLabel = resolveTailActivityLabel({
		reconciliation,
		batch: batchSummary,
		lanes,
		macroPhase,
		macroPhaseLabel: resolvedMacroPhaseLabel,
		journalEvents,
	});

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
		batch: batchSummary,
		macroPhase,
		macroPhaseLabel: resolvedMacroPhaseLabel,
		tailActivityLabel,
		lanes,
		laneThroughputSummary,
		gate,
		journalTail,
		waves,
	};
}
