// @ts-nocheck
/**
 * Resolve lane branch HEAD at task.started for scoped contract verify (issue #62, SP-415).
 */

import { execFileSync } from "node:child_process";

const PAYLOAD_COMMIT_KEYS = ["taskStartCommit", "startCommit", "commitSha", "headCommit", "laneBranchHead"];

/**
 * @param {object} event
 * @returns {string|null}
 */
function readEventCommitSha(event) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	for (const key of PAYLOAD_COMMIT_KEYS) {
		const value = payload[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function readEventLaneId(event) {
	if (typeof event.laneId === "string" && event.laneId) {
		return event.laneId;
	}
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (typeof payload.laneId === "string" && payload.laneId) {
		return payload.laneId;
	}
	if (payload.laneNumber != null) {
		return `lane-${payload.laneNumber}`;
	}
	return null;
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function readEventTaskId(event) {
	if (typeof event.taskId === "string" && event.taskId) {
		return event.taskId;
	}
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	if (typeof payload.taskId === "string" && payload.taskId) {
		return payload.taskId;
	}
	return null;
}

/**
 * @param {object} event
 * @returns {string|null}
 */
function readEventTimestampIso(event) {
	if (!event || typeof event !== "object") {
		return null;
	}
	const ts = event.timestamp;
	if (typeof ts === "string" && ts.trim()) {
		return ts.trim();
	}
	if (typeof ts === "number" && Number.isFinite(ts)) {
		return new Date(ts).toISOString();
	}
	return null;
}

/**
 * @param {string|null|undefined} eventLaneId
 * @param {string|null|undefined} requestedLaneId
 */
function lanesMatch(eventLaneId, requestedLaneId) {
	if (!requestedLaneId) {
		return true;
	}
	return eventLaneId === requestedLaneId;
}

/**
 * @param {object} event
 * @param {string|null|undefined} batchId
 */
function batchMatches(event, batchId) {
	if (!batchId) {
		return true;
	}
	return String(event.batchId ?? "") === batchId;
}

/**
 * @param {object[]} journal
 * @param {string|null|undefined} laneId
 * @param {number} beforeIndex
 * @param {string|null|undefined} [excludeTaskId] Skip lane.committed for this task (SP-478 / issue #105).
 * @returns {string|null}
 */
function resolvePriorLaneCommit(journal, laneId, beforeIndex, excludeTaskId) {
	for (let index = beforeIndex - 1; index >= 0; index -= 1) {
		const event = journal[index];
		if (String(event?.type ?? "") !== "lane.committed") {
			continue;
		}
		if (!lanesMatch(readEventLaneId(event), laneId)) {
			continue;
		}
		if (excludeTaskId && readEventTaskId(event) === excludeTaskId) {
			continue;
		}
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const sha = payload.commitSha ?? payload.mergeCommit;
		if (typeof sha === "string" && sha.trim()) {
			return sha.trim();
		}
	}
	return null;
}

/**
 * @param {string} worktreePath
 * @param {string} timestampIso
 * @returns {string|null}
 */
function resolveHeadAtTimestamp(worktreePath, timestampIso) {
	try {
		const output = execFileSync("git", ["rev-list", "-1", `--before=${timestampIso}`, "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		}).trim();
		return output || null;
	} catch {
		return null;
	}
}

/**
 * First task.started for a task — stable baseline across retry/resume (SP-478 / issue #105).
 *
 * @param {object[]} journal
 * @param {string} taskId
 * @param {string|null|undefined} laneId
 * @param {string|null|undefined} batchId
 * @returns {{ event: object, index: number } | null}
 */
function findFirstTaskStarted(journal, taskId, laneId, batchId) {
	for (let index = 0; index < journal.length; index += 1) {
		const event = journal[index];
		if (String(event?.type ?? "") !== "task.started") {
			continue;
		}
		if (readEventTaskId(event) !== taskId) {
			continue;
		}
		if (!lanesMatch(readEventLaneId(event), laneId)) {
			continue;
		}
		if (!batchMatches(event, batchId)) {
			continue;
		}
		return { event, index };
	}
	return null;
}

/**
 * Resolve parent commit SHA at task.started for per-task scoped contract verify.
 * Returns null when unavailable so callers fall back to main...HEAD diff.
 *
 * @param {{ journal: object[], taskId: string, laneId?: string|null, batchId?: string|null, worktreePath?: string|null }} options
 * @returns {string|null}
 */
export function resolveTaskStartCommit({ journal, taskId, laneId, batchId, worktreePath }) {
	if (!Array.isArray(journal) || !taskId) {
		return null;
	}

	const started = findFirstTaskStarted(journal, taskId, laneId, batchId);
	if (!started) {
		return null;
	}

	const payloadCommit = readEventCommitSha(started.event);
	if (payloadCommit) {
		return payloadCommit;
	}

	const eventLaneId = readEventLaneId(started.event);
	const priorLaneCommit = resolvePriorLaneCommit(journal, eventLaneId, started.index, taskId);
	if (priorLaneCommit) {
		return priorLaneCommit;
	}

	if (typeof worktreePath === "string" && worktreePath.trim()) {
		const timestampIso = readEventTimestampIso(started.event);
		if (timestampIso) {
			return resolveHeadAtTimestamp(worktreePath.trim(), timestampIso);
		}
	}

	return null;
}
