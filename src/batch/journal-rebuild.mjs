// @ts-nocheck
/**
 * Rebuild batch task/segment status from append-only journal (FR-REL-01/02, PRD §11.4).
 * Structural derivation → journal-rebuild-structural.mjs (SP-584).
 * Drift reconcile remains here until SP-602.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendJournalEvent } from "./journal.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { parseReviewVerdict } from "./review-shared.mjs";
import { journalHasTaskCompleted } from "./resume-common.mjs";
import { recordTaskSucceeded, saveSpineBatchState } from "./state.mjs";

export {
	BATCH_PHASE_EVENT_TYPES,
	deriveStructuralBatchStateFromJournal,
	readJournalTimeline,
	readJournalTimelineFromDisk,
	rebuildBatchStateFromDisk,
	rebuildBatchStateFromJournal,
	TASK_LIFECYCLE_EVENT_TYPES,
} from "./journal-rebuild-structural.mjs";

import { TASK_LIFECYCLE_EVENT_TYPES } from "./journal-rebuild-structural.mjs";

/** @typedef {{ taskId: string, field: string, cached: unknown, rebuilt: unknown }} DriftEntry */

const NON_TERMINAL_CACHE_STATUSES = new Set(["pending", "running"]);
const JOURNAL_TERMINAL_LIFECYCLE = new Set([
	"task.completed",
	"task.skipped",
	"task.skipped_done_on_disk",
	"task.failed",
	"task.prompt_parse_failed",
]);

function lastLifecycleEventForTask(events, taskId) {
	const taskEvents = events.filter(
		(event) => event?.taskId === taskId && TASK_LIFECYCLE_EVENT_TYPES.has(String(event?.type ?? "")),
	);
	return taskEvents.length > 0 ? taskEvents[taskEvents.length - 1] : null;
}

function hasJournalTerminalLifecycle(lastEvent) {
	if (!lastEvent) return false;
	return JOURNAL_TERMINAL_LIFECYCLE.has(String(lastEvent.type ?? ""));
}

/**
 * @param {object|null|undefined} classified
 */
function classifiedShowsDoneInLaneDrift(classified) {
	if (!classified || typeof classified !== "object") return false;
	if (classified.doneInLane === true) return true;
	return (
		classified.classification === "terminal-success" &&
		!["succeeded", "skipped"].includes(String(classified.status ?? "").toLowerCase())
	);
}

export function normalizeTaskFolderRel(projectRoot, taskFolder) {
	if (!taskFolder) return null;
	if (path.isAbsolute(taskFolder)) {
		return path.relative(projectRoot, taskFolder).replace(/\\/g, "/");
	}
	return String(taskFolder).replace(/\\/g, "/");
}

/**
 * True when `.DONE` is committed on the lane task branch (fail-closed / #190).
 *
 * @param {string} projectRoot
 * @param {string} taskBranch
 * @param {string} taskFolderRel
 */
export function laneDoneMarkerCommittedOnBranch(projectRoot, taskBranch, taskFolderRel) {
	const folderRel = normalizeTaskFolderRel(projectRoot, taskFolderRel);
	if (!projectRoot || !taskBranch || !folderRel) return false;
	const donePath = `${folderRel.replace(/\/+$/, "")}/.DONE`;
	try {
		execFileSync("git", ["cat-file", "-e", `${taskBranch}:${donePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {object} task
 * @param {string} batchId
 * @param {unknown[]} lanes
 * @param {string} projectRoot
 */
function laneTaskBranchForTask(task, batchId, lanes) {
	const laneNumber = Number(task.laneNumber ?? 1);
	const lane = Array.isArray(lanes)
		? lanes.find((entry) => Number(entry?.laneNumber) === laneNumber)
		: null;
	if (lane && typeof lane.branch === "string" && lane.branch) {
		return lane.branch;
	}
	return laneTaskBranch(batchId, laneNumber);
}

/**
 * Fail-closed gate: filesystem `.DONE` in lane worktree and committed on lane branch.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.task
 * @param {unknown[]} [params.lanes]
 * @param {object|null|undefined} params.classified
 */
export function laneDoneMarkerReadyForPromote({ projectRoot, batchId, task, lanes = [], classified }) {
	if (classified?.doneInLane !== true) return false;
	const taskFolder = normalizeTaskFolderRel(projectRoot, task?.taskFolder);
	if (!taskFolder) return false;
	const taskBranch = laneTaskBranchForTask(task, batchId, lanes);
	return laneDoneMarkerCommittedOnBranch(projectRoot, taskBranch, taskFolder);
}

/**
 * Detect review.started events that have no matching review.completed for the same
 * taskId + reviewType. These represent engine crashes mid-review where the artifact
 * may exist on disk but the completion was never journaled.
 *
 * @param {object[]} events
 * @returns {object[]} orphaned review.started events
 */
export function detectOrphanedReviewStarted(events) {
	/** @type {Map<string, object>} keyed by "taskId:reviewType" */
	const latestStarted = new Map();
	/** @type {Set<string>} */
	const completedKeys = new Set();

	for (const event of events) {
		const type = String(event?.type ?? "");
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const taskId = event.taskId ?? payload.taskId;
		if (!taskId) continue;
		const reviewType = payload.reviewType;
		if (!reviewType) continue;
		const key = `${taskId}:${reviewType}`;

		if (type === "review.started") {
			latestStarted.set(key, event);
		} else if (type === "review.completed") {
			completedKeys.add(key);
			latestStarted.delete(key);
		}
	}

	const orphaned = [];
	for (const [key, event] of latestStarted) {
		if (!completedKeys.has(key)) {
			orphaned.push(event);
		}
	}
	return orphaned;
}

/** @type {ReadonlySet<string>} Verdicts that indicate a successful review outcome. */
const APPROVED_VERDICTS = new Set(["APPROVE", "PASS"]);

/**
 * Reconcile orphaned review.started events by checking for on-disk artifacts with
 * valid verdicts and synthesizing the missing review.completed + task.completed events.
 * Called at resume time to self-heal after engine crashes mid-review (SP-484 / #131).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object[]} params.events - journal events
 * @returns {{ synthesized: Array<{ taskId: string, reviewType: string, verdict: string, artifactPath: string }> }}
 */
export function reconcileOrphanedReviewEvents({ projectRoot, batchId, events }) {
	const orphaned = detectOrphanedReviewStarted(events);
	/** @type {Array<{ taskId: string, reviewType: string, verdict: string, artifactPath: string }>} */
	const synthesized = [];

	for (const event of orphaned) {
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const artifactPath = typeof payload.artifactPath === "string" ? payload.artifactPath : "";
		const taskId = event.taskId ?? payload.taskId;
		if (!taskId || !artifactPath) continue;
		if (!fs.existsSync(artifactPath)) continue;

		let content;
		try {
			content = fs.readFileSync(artifactPath, "utf-8");
		} catch {
			continue;
		}

		const reviewType = payload.reviewType ?? "code";
		const { verdict, feedback } = parseReviewVerdict(content, { reviewType });
		if (!verdict || !APPROVED_VERDICTS.has(verdict)) continue;

		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: payload.laneNumber ?? null,
			correlationId: payload.correlationId ?? null,
			stepNumber: payload.stepNumber ?? null,
			reviewType,
			reviewLevel: payload.reviewLevel ?? null,
			verdict,
			feedback: feedback ?? "",
			artifactPath,
			synthesized: true,
			synthesizeReason: "orphaned_review_crash_recovery",
		});

		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: payload.laneNumber ?? null,
			correlationId: payload.correlationId ?? null,
			synthesized: true,
			synthesizeReason: "orphaned_review_crash_recovery",
			exitReason: "done",
			doneFileFound: true,
		});

		synthesized.push({ taskId, reviewType, verdict, artifactPath });
	}

	return { synthesized };
}

export function detectBatchStateDrift(cachedState, rebuiltState, events = [], classifiedTasks = null) {
	/** @type {DriftEntry[]} */
	const entries = [];
	const rebuiltById = new Map((rebuiltState?.tasks ?? []).map((task) => [String(task?.taskId), task]));
	const classifiedById = Array.isArray(classifiedTasks)
		? new Map(classifiedTasks.map((task) => [String(task?.taskId), task]))
		: null;

	for (const cached of cachedState?.tasks ?? []) {
		if (!cached?.taskId) continue;
		const taskId = String(cached.taskId);
		const rebuilt = rebuiltById.get(taskId);
		if (!rebuilt) continue;
		const classified = classifiedById?.get(taskId) ?? null;
		const cachedStatus = String(cached.status ?? "").toLowerCase();
		const lastEvent = lastLifecycleEventForTask(events, taskId);
		const lastType = lastEvent ? String(lastEvent.type ?? "") : "";

		if (
			NON_TERMINAL_CACHE_STATUSES.has(cachedStatus) &&
			classifiedShowsDoneInLaneDrift(classified) &&
			!hasJournalTerminalLifecycle(lastEvent)
		) {
			entries.push({
				taskId,
				field: "doneInLane",
				cached: cached.status,
				rebuilt: classified?.classification ?? "terminal-success",
			});
			continue;
		}

		if (!lastEvent) continue;

		if (lastType === "task.completed" && cached.status !== "succeeded") {
			entries.push({ taskId, field: "status", cached: cached.status, rebuilt: rebuilt.status });
			continue;
		}
		if (lastType === "task.retry_requested" && cached.status === "failed" && rebuilt.status === "pending") {
			entries.push({ taskId, field: "status", cached: cached.status, rebuilt: rebuilt.status });
			continue;
		}
		if (lastType === "task.started" && cached.status === "failed") continue;
		if ((lastType === "task.failed" || lastType === "task.prompt_parse_failed") && cached.status === rebuilt.status) continue;
	}

	return { drifted: entries.length > 0, entries };
}

/**
 * Journal evidence that lane work finished and review/contract passed (FR-STA-01 / #170).
 *
 * @param {object[]} events
 * @param {string} taskId
 */
export function journalShowsDoneInLaneTerminalArtifacts(events, taskId) {
	let hasApprovedReview = false;
	let hasLaneCompleted = false;
	let hasContractVerified = false;

	for (const event of events ?? []) {
		const type = String(event?.type ?? "");
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const eventTaskId = event.taskId ?? payload.taskId;
		if (eventTaskId !== taskId) continue;

		if (type === "review.completed" && APPROVED_VERDICTS.has(String(payload.verdict ?? ""))) {
			hasApprovedReview = true;
		}
		if (type === "task.verdict_recorded" && APPROVED_VERDICTS.has(String(payload.verdict ?? ""))) {
			hasApprovedReview = true;
		}
		if (type === "lane.completed") {
			hasLaneCompleted = true;
		}
		if (type === "contract.verified" && payload.ok === true) {
			hasContractVerified = true;
		}
	}

	return hasLaneCompleted && (hasApprovedReview || hasContractVerified);
}

/**
 * Promote batch-state tasks when lane on-disk truth and journal show terminal success
 * but cache still shows pending/running (idempotent; FR-STA-01 / SP-512).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {object[]} [params.classifiedTasks]
 * @param {object[]} [params.journalEvents]
 * @param {{ drifted?: boolean, entries?: Array<{ taskId: string, field: string, rebuilt?: unknown }> }} [params.drift]
 * @returns {{ reconciled: boolean, taskIds: string[] }}
 */
export function reconcileBatchStateDrift({
	projectRoot,
	state,
	classifiedTasks = [],
	journalEvents = [],
	drift = null,
}) {
	if (!state || typeof state !== "object" || !drift?.drifted || !Array.isArray(drift.entries)) {
		return { reconciled: false, taskIds: [] };
	}

	const batchId = String(state.batchId ?? "");
	if (!batchId) {
		return { reconciled: false, taskIds: [] };
	}

	const classifiedById = new Map(
		(classifiedTasks ?? []).map((task) => [String(task?.taskId ?? ""), task]),
	);
	/** @type {string[]} */
	const reconciledTaskIds = [];
	let changed = false;

	for (const entry of drift.entries) {
		const taskId = String(entry?.taskId ?? "");
		if (!taskId || taskId === "*") continue;

		const task = (state.tasks ?? []).find((row) => row?.taskId === taskId);
		if (!task) continue;

		if (entry.field === "status" && String(entry.rebuilt ?? "") === "succeeded") {
			if (String(task.status ?? "") === "succeeded") continue;
			if (!recordTaskSucceeded(state, taskId, { doneFileFound: true, exitReason: "done" })) continue;
			reconciledTaskIds.push(taskId);
			changed = true;
			continue;
		}

		if (entry.field !== "doneInLane") continue;

		const classified = classifiedById.get(taskId);
		if (!classifiedShowsDoneInLaneDrift(classified)) continue;
		if (
			!laneDoneMarkerReadyForPromote({
				projectRoot,
				batchId,
				task,
				lanes: state.lanes ?? [],
				classified,
			})
		) {
			continue;
		}
		if (journalHasTaskCompleted(journalEvents, taskId)) continue;
		if (!journalShowsDoneInLaneTerminalArtifacts(journalEvents, taskId)) continue;
		if (String(task.status ?? "") === "succeeded") continue;

		if (!recordTaskSucceeded(state, taskId, { doneFileFound: true, exitReason: "done" })) continue;

		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: task.laneNumber ?? null,
			reconciled: true,
			reconcileReason: "done_in_lane_terminal",
			skippedDoneOnDisk: true,
		});

		reconciledTaskIds.push(taskId);
		changed = true;
	}

	if (changed) {
		saveSpineBatchState(projectRoot, state);
	}

	return { reconciled: changed, taskIds: reconciledTaskIds };
}
