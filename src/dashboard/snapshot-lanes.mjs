/**
 * Lane row builders for dashboard snapshot (extracted from snapshot.mjs, SP-506).
 */

import fs from "node:fs";
import path from "node:path";
import { readJournalTail, summarizeJournalEvent } from "../batch/journal.mjs";
import {
	deriveLanesThroughput,
	emptyLaneThroughputStats,
} from "./lane-throughput.mjs";
import {
	workerLiveLogPath,
	workerLiveLogRef,
	workerOutputLogPath,
	workerOutputLogRef,
} from "../batch/worker-output.mjs";

const LANE_RECENT_EVENTS_LIMIT = 5;
const LANE_LOG_TAIL_LINES = 10;
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

export function truncateWorktreePath(worktreePath) {
	if (!worktreePath) return null;
	const parts = String(worktreePath).split(/[/\\]/).filter(Boolean);
	if (parts.length <= 3) return parts.join("/");
	return parts.slice(-3).join("/");
}

export function heartbeatAgeSeconds(lastHeartbeatAt, now = Date.now()) {
	if (lastHeartbeatAt == null) return null;
	const ts =
		typeof lastHeartbeatAt === "number"
			? lastHeartbeatAt
			: new Date(lastHeartbeatAt).getTime();
	if (Number.isNaN(ts)) return null;
	return Math.max(0, Math.floor((now - ts) / 1000));
}

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

export function computeActiveTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds }) {
	const runningTaskId = computeRunningTaskIdForLane({ lane, classifiedTasks, currentWaveTaskIds });
	const queuedTaskIds = computeQueuedTaskIdsForLane({ lane, classifiedTasks, currentWaveTaskIds });
	if (runningTaskId) return [runningTaskId, ...queuedTaskIds];
	return [...queuedTaskIds];
}

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

export function laneEventMatches(laneNumber, event) {
	const laneId = `lane-${laneNumber}`;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (payload.laneNumber != null && payload.laneNumber !== laneNumber) return false;
	if (event.laneId && event.laneId !== laneId) return false;
	return true;
}

function journalEventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) return event.taskId;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	return typeof payload.taskId === "string" ? payload.taskId : null;
}

function isReviewClosedForTaskStep(journalEvents, taskId, stepNumber) {
	return journalEvents.some((event) => {
		if (journalEventTaskId(event) !== taskId) return false;
		if (event.type !== "review.completed" && event.type !== "review.failed") return false;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		return payload.stepNumber === stepNumber;
	});
}

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

export function formatLaneHeartbeatDisplay({ workerPhase, heartbeatAgeSeconds }) {
	if (workerPhase === "launching") return "launching";
	if (heartbeatAgeSeconds == null) return "—";
	return `${heartbeatAgeSeconds}s`;
}

function formatJournalTailEntry(event) {
	return {
		eventId: event.eventId,
		type: event.type,
		timestamp: event.timestamp,
		laneId: event.laneId ?? null,
		taskId: event.taskId ?? null,
		summary: summarizeJournalEvent(event),
	};
}

function journalEventScopedToLane(laneNumber, event) {
	const laneId = `lane-${laneNumber}`;
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (event.laneId) return event.laneId === laneId;
	if (payload.laneNumber != null) return payload.laneNumber === laneNumber;
	return false;
}

export function buildLaneRecentEvents(laneNumber, journalEvents, limit = LANE_RECENT_EVENTS_LIMIT) {
	const matching = (journalEvents ?? []).filter(
		(event) => journalEventScopedToLane(laneNumber, event) && laneEventMatches(laneNumber, event),
	);
	return readJournalTail(matching, limit).map(formatJournalTailEntry);
}

export function readLogFileTailLines(filePath, lineCount = LANE_LOG_TAIL_LINES) {
	if (!filePath || !fs.existsSync(filePath)) return [];
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return [];
	return lines.slice(-lineCount);
}

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
