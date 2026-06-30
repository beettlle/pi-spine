/**
 * Lane worker watch helpers — stall anchor slides on worker_alive while running (SP-341 / #32).
 */

/** @typedef {"launching" | "pi" | "verify" | "unknown"} WorkerPhase */
/** @typedef {"worker_alive" | "checkpoint" | "file_scope_activity"} HeartbeatKind */

/**
 * @param {object} params
 * @param {WorkerPhase} params.workerPhase
 * @param {HeartbeatKind} params.heartbeatKind
 */
export function shouldSlideStallAnchorOnHeartbeat({ workerPhase, heartbeatKind }) {
	return workerPhase === "pi" && heartbeatKind === "worker_alive";
}

/**
 * @param {object} params
 * @param {number} params.stallAnchorAt
 * @param {number} params.now
 * @param {WorkerPhase} params.workerPhase
 * @param {HeartbeatKind} params.heartbeatKind
 */
export function nextStallAnchorAt({ stallAnchorAt, now, workerPhase, heartbeatKind }) {
	if (shouldSlideStallAnchorOnHeartbeat({ workerPhase, heartbeatKind })) {
		return now;
	}
	return stallAnchorAt;
}
