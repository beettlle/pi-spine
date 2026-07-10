// @ts-nocheck
/**
 * Structural batch-state derivation from journal events (FR-REL-01/02, FR-SHIP-10).
 * Drift reconcile lives in journal-rebuild.mjs until SP-602.
 */

import { readJournalEvents, STRUCTURAL_JOURNAL_EVENT_TYPES } from "./journal.mjs";
import {
	clearTaskFailureMetadata,
	createInitialBatchState,
	recomputeTaskCounters,
	updateSegmentForTask,
} from "./state.mjs";

/** @type {ReadonlySet<string>} */
export const TASK_LIFECYCLE_EVENT_TYPES = new Set([
	"task.started",
	"task.completed",
	"task.failed",
	"task.skipped",
	"task.skipped_done_on_disk",
	"task.retry_requested",
	"task.prompt_parse_failed",
]);

/** @type {ReadonlySet<string>} */
export const BATCH_PHASE_EVENT_TYPES = new Set([
	"batch.started",
	"batch.resumed",
	"batch.paused",
	"batch.completed",
	"batch.failed",
	"batch.aborted",
	"batch.dismissed",
]);

export function readJournalTimeline(events) {
	return events.filter(
		(event) =>
			TASK_LIFECYCLE_EVENT_TYPES.has(String(event?.type ?? "")) ||
			BATCH_PHASE_EVENT_TYPES.has(String(event?.type ?? "")),
	);
}

export function readJournalTimelineFromDisk(projectRoot, batchId) {
	return readJournalTimeline(readJournalEvents(projectRoot, batchId));
}

function payloadOf(event) {
	return event.payload && typeof event.payload === "object" ? event.payload : {};
}

function tsOf(event) {
	return Date.parse(String(event.timestamp ?? "")) || Date.now();
}

function taskIdsOf(value) {
	if (typeof value === "string") return value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
	if (!Array.isArray(value)) return [];
	return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function taskStub(map, taskId, hints = {}) {
	const row = map.get(taskId) ?? { taskId };
	if (hints.laneNumber != null) row.laneNumber = Number(hints.laneNumber) || row.laneNumber || 1;
	if (typeof hints.taskFolder === "string" && hints.taskFolder) row.taskFolder = hints.taskFolder;
	map.set(taskId, row);
	return row;
}

function laneStub(map, laneNumber, hints = {}) {
	const row = map.get(laneNumber) ?? { laneNumber, laneId: hints.laneId ?? `lane-${laneNumber}`, taskIds: [] };
	row.laneId = hints.laneId ?? row.laneId;
	if (typeof hints.worktreePath === "string") row.worktreePath = hints.worktreePath;
	if (typeof hints.taskBranch === "string") row.branch = hints.taskBranch;
	if (!Array.isArray(row.taskIds)) row.taskIds = [];
	map.set(laneNumber, row);
	return row;
}

function finalizeTasks(tasksById, seedTasks) {
	const seedById = new Map((seedTasks ?? []).filter((t) => t?.taskId).map((t) => [String(t.taskId), t]));
	return [...new Set([...tasksById.keys(), ...seedById.keys()])].map((taskId) => {
		const derived = tasksById.get(taskId) ?? { taskId };
		const seed = seedById.get(taskId);
		return {
			taskId,
			laneNumber: Number(derived.laneNumber ?? seed?.laneNumber ?? 1) || 1,
			status: "pending",
			taskFolder: derived.taskFolder ?? seed?.taskFolder ?? null,
			sessionName: seed?.sessionName,
			startedAt: null,
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		};
	});
}

function finalizeLanes(lanesByNumber, seedLanes, tasks) {
	const seedByNumber = new Map((seedLanes ?? []).filter((l) => l?.laneNumber != null).map((l) => [Number(l.laneNumber), l]));
	const laneNumbers = new Set([...lanesByNumber.keys(), ...seedByNumber.keys()]);
	for (const task of tasks) if (task?.laneNumber != null) laneNumbers.add(Number(task.laneNumber));
	if (laneNumbers.size === 0) laneNumbers.add(1);
	return [...laneNumbers].sort((a, b) => a - b).map((laneNumber) => {
		const derived = lanesByNumber.get(laneNumber) ?? { laneNumber, laneId: `lane-${laneNumber}` };
		const seed = seedByNumber.get(laneNumber);
		const taskIds = [...new Set([
			...(derived.taskIds ?? []),
			...(seed?.taskIds ?? []),
			...tasks.filter((t) => Number(t.laneNumber) === laneNumber).map((t) => t.taskId),
		])];
		return {
			laneNumber,
			laneId: derived.laneId ?? seed?.laneId ?? `lane-${laneNumber}`,
			laneSessionId: seed?.laneSessionId,
			worktreePath: derived.worktreePath ?? seed?.worktreePath ?? null,
			branch: derived.branch ?? seed?.branch ?? null,
			taskIds,
			lastHeartbeatAt: seed?.lastHeartbeatAt ?? null,
			status: seed?.status ?? "pending",
		};
	});
}

/** Derive structural batch-state fields from journal; cache seed fills gaps only (FR-SHIP-10). */
export function deriveStructuralBatchStateFromJournal(events, seedState = null) {
	const lanesByNumber = new Map();
	const tasksById = new Map();
	const wavePlanRows = [];
	const mergeResults = [];
	let batchId = String(seedState?.batchId ?? "").trim();
	let baseBranch = null;
	let orchBranch = null;
	let startedAt = null;

	for (const event of events) {
		const type = String(event?.type ?? "");
		if (!STRUCTURAL_JOURNAL_EVENT_TYPES.has(type)) continue;
		if (!batchId && typeof event.batchId === "string") batchId = event.batchId;
		const payload = payloadOf(event);
		const timestamp = tsOf(event);
		const taskId = typeof event.taskId === "string" ? event.taskId : typeof payload.taskId === "string" ? payload.taskId : null;

		if (type === "batch.started" || type === "batch.resumed") {
			if (startedAt == null) startedAt = timestamp;
			if (typeof payload.baseBranch === "string" && payload.baseBranch) baseBranch = payload.baseBranch;
			if (typeof payload.orchBranch === "string" && payload.orchBranch) orchBranch = payload.orchBranch;
			if (Array.isArray(payload.wavePlan)) {
				for (const wave of payload.wavePlan) if (Array.isArray(wave)) wavePlanRows.push([...wave]);
			}
			for (const scopedTaskId of taskIdsOf(payload.scope ?? payload.taskIds)) taskStub(tasksById, scopedTaskId, payload);
		}

		if (type === "lane.provisioned") {
			const laneNumber = Number(payload.laneNumber);
			if (Number.isFinite(laneNumber)) laneStub(lanesByNumber, laneNumber, payload);
		}

		if (type === "lane.tasks_serialized") {
			const laneNumber = Number(payload.laneNumber);
			const waveIndex = Number(payload.waveIndex ?? wavePlanRows.length);
			const serializedTaskIds = taskIdsOf(payload.taskIds);
			if (serializedTaskIds.length > 0) {
				while (wavePlanRows.length <= waveIndex) wavePlanRows.push([]);
				wavePlanRows[waveIndex] = [...new Set([...wavePlanRows[waveIndex], ...serializedTaskIds])];
			}
			if (Number.isFinite(laneNumber)) {
				const lane = laneStub(lanesByNumber, laneNumber, payload);
				for (const id of serializedTaskIds) {
					if (!lane.taskIds.includes(id)) lane.taskIds.push(id);
					taskStub(tasksById, id, { laneNumber, laneId: lane.laneId });
				}
			}
		}

		if (type === "task.started" && taskId) {
			const laneNumber = Number(payload.laneNumber ?? event.laneNumber);
			taskStub(tasksById, taskId, { laneNumber, laneId: payload.laneId ?? event.laneId });
			if (Number.isFinite(laneNumber)) {
				const lane = laneStub(lanesByNumber, laneNumber, { laneId: payload.laneId ?? event.laneId });
				if (!lane.taskIds.includes(taskId)) lane.taskIds.push(taskId);
			}
		}

		if (type === "task.skipped_done_on_disk" && taskId) taskStub(tasksById, taskId, payload);

		if (type === "batch.merge_started") {
			if (typeof payload.baseBranch === "string" && payload.baseBranch) baseBranch = payload.baseBranch;
			if (typeof payload.orchBranch === "string" && payload.orchBranch) orchBranch = payload.orchBranch;
		}

		if (type === "batch.merge_completed" || type === "lane.committed") {
			const mergeCommit = payload.mergeCommit ?? payload.commitSha;
			if (mergeCommit) {
				mergeResults.push({ mergeCommit, taskId: taskId ?? payload.taskId ?? null, laneNumber: payload.laneNumber ?? null });
			}
		}
	}

	const resolvedBatchId = batchId || String(seedState?.batchId ?? "").trim();
	const tasks = finalizeTasks(tasksById, seedState?.tasks);
	let wavePlan = wavePlanRows.filter((wave) => wave.length > 0);
	if (wavePlan.length === 0 && Array.isArray(seedState?.wavePlan) && seedState.wavePlan.length > 0) {
		wavePlan = seedState.wavePlan;
	} else if (wavePlan.length === 0 && tasks.length > 0) {
		wavePlan = [tasks.map((task) => task.taskId)];
	} else if (wavePlan.length === 0) {
		wavePlan = [[]];
	}

	const structural = createInitialBatchState({
		batchId: resolvedBatchId,
		baseBranch: baseBranch ?? seedState?.baseBranch ?? "main",
		orchBranch: orchBranch ?? seedState?.orchBranch ?? (resolvedBatchId ? `orch/spine-${resolvedBatchId}` : "main"),
		wavePlan,
		tasks,
		lanes: finalizeLanes(lanesByNumber, seedState?.lanes, tasks),
	});

	structural.startedAt = startedAt ?? seedState?.startedAt ?? Date.now();
	structural.mergeResults = mergeResults.length > 0 ? mergeResults : Array.isArray(seedState?.mergeResults) ? seedState.mergeResults : [];
	structural.currentWaveIndex = Number(seedState?.currentWaveIndex ?? 0) || 0;
	structural.blockedTasks = Number(seedState?.blockedTasks ?? 0) || 0;
	structural.blockedTaskIds = Array.isArray(seedState?.blockedTaskIds) ? [...seedState.blockedTaskIds] : [];
	structural.resilience = seedState?.resilience && typeof seedState.resilience === "object" ? structuredClone(seedState.resilience) : structural.resilience;
	structural.lastError = seedState?.lastError ?? null;
	return structural;
}

function mergeSeedOnlyFields(rebuilt, seedState) {
	if (!seedState || typeof seedState !== "object") return;
	rebuilt.currentWaveIndex = Number(seedState.currentWaveIndex ?? rebuilt.currentWaveIndex ?? 0) || 0;
	rebuilt.blockedTasks = Number(seedState.blockedTasks ?? rebuilt.blockedTasks ?? 0) || 0;
	rebuilt.blockedTaskIds = Array.isArray(seedState.blockedTaskIds) ? [...seedState.blockedTaskIds] : rebuilt.blockedTaskIds;
	if (seedState.resilience && typeof seedState.resilience === "object") rebuilt.resilience = structuredClone(seedState.resilience);
	if (rebuilt.mergeResults.length === 0 && Array.isArray(seedState.mergeResults)) rebuilt.mergeResults = structuredClone(seedState.mergeResults);

	const seedTasks = new Map((seedState.tasks ?? []).filter((t) => t?.taskId).map((t) => [String(t.taskId), t]));
	for (const task of rebuilt.tasks ?? []) {
		const seedTask = seedTasks.get(String(task.taskId));
		if (!seedTask) continue;
		if (!task.taskFolder && seedTask.taskFolder) task.taskFolder = seedTask.taskFolder;
		if (!task.sessionName && seedTask.sessionName) task.sessionName = seedTask.sessionName;
	}

	const seedLanes = new Map((seedState.lanes ?? []).filter((l) => l?.laneNumber != null).map((l) => [Number(l.laneNumber), l]));
	for (const lane of rebuilt.lanes ?? []) {
		const seedLane = seedLanes.get(Number(lane.laneNumber));
		if (!seedLane) continue;
		if (!lane.worktreePath && seedLane.worktreePath) lane.worktreePath = seedLane.worktreePath;
		if (!lane.branch && seedLane.branch) lane.branch = seedLane.branch;
		if (!lane.laneSessionId && seedLane.laneSessionId) lane.laneSessionId = seedLane.laneSessionId;
	}
	if (!rebuilt.segments?.length && Array.isArray(seedState.segments) && seedState.segments.length > 0) {
		rebuilt.segments = structuredClone(seedState.segments);
	}
}

function applyJournalEvent(state, event) {
	const type = String(event?.type ?? "");
	const taskId = typeof event.taskId === "string" ? event.taskId : null;
	const payload = payloadOf(event);
	const timestamp = tsOf(event);
	if (!taskId && !BATCH_PHASE_EVENT_TYPES.has(type)) return;
	const task = taskId ? (state.tasks ?? []).find((entry) => entry?.taskId === taskId) : null;

	switch (type) {
		case "batch.started":
		case "batch.resumed":
			state.phase = "running";
			if (state.startedAt == null) state.startedAt = Number(payload.startedAt) || timestamp;
			break;
		case "task.started":
			if (!task) return;
			task.status = "running";
			task.startedAt = Number(payload.startedAt) || timestamp;
			task.endedAt = null;
			clearTaskFailureMetadata(task);
			updateSegmentForTask(state, taskId, "running");
			break;
		case "task.completed":
			if (!task) return;
			task.status = "succeeded";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = payload.doneFileFound !== false;
			task.exitReason = String(payload.exitReason ?? "done");
			if ("classification" in task) delete task.classification;
			updateSegmentForTask(state, taskId, "succeeded");
			break;
		case "task.failed":
		case "task.prompt_parse_failed":
			if (!task) return;
			task.status = "failed";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = false;
			task.exitReason = String(payload.exitReason ?? payload.reason ?? type);
			if (payload.classification) task.classification = String(payload.classification);
			updateSegmentForTask(state, taskId, "failed");
			break;
		case "task.skipped":
		case "task.skipped_done_on_disk":
			if (!task) return;
			task.status = "skipped";
			task.endedAt = Number(payload.endedAt) || timestamp;
			task.doneFileFound = type === "task.skipped_done_on_disk";
			task.exitReason = String(payload.exitReason ?? "skipped");
			updateSegmentForTask(state, taskId, "skipped");
			break;
		case "task.retry_requested":
			if (!task) return;
			clearTaskFailureMetadata(task);
			task.status = "pending";
			task.startedAt = null;
			task.endedAt = null;
			task.doneFileFound = false;
			updateSegmentForTask(state, taskId, "pending");
			break;
		case "batch.paused":
			state.phase = "paused";
			break;
		case "batch.completed":
			state.phase = "completed";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		case "batch.failed":
			state.phase = "failed";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		case "batch.aborted":
		case "batch.dismissed":
			state.phase = "aborted";
			state.endedAt = Number(payload.endedAt) || timestamp;
			break;
		default:
			break;
	}
}

/** Apply journal timeline to journal-derived structural state; cache seed fills non-journal fields only. */
export function rebuildBatchStateFromJournal(seedState, events) {
	const timeline = readJournalTimeline(events);
	const rebuilt = deriveStructuralBatchStateFromJournal(events, seedState ?? null);
	mergeSeedOnlyFields(rebuilt, seedState ?? null);
	for (const event of timeline) applyJournalEvent(rebuilt, event);
	recomputeTaskCounters(rebuilt);
	return rebuilt;
}

export function rebuildBatchStateFromDisk(projectRoot, batchId, seedState) {
	return rebuildBatchStateFromJournal(seedState, readJournalEvents(projectRoot, batchId));
}
