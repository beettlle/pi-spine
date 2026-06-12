/**
 * Detached engine lifecycle helpers for batch resume (SP-203).
 */

import { isProcessAlive } from "../process/liveness.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { clearBatchEnginePid, readBatchEnginePid } from "./state.mjs";

/**
 * SIGTERM a stale detached engine before the resume engine takes over.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {string} params.fromPhase
 * @param {object} [params.git]
 */
export function terminateStaleDetachedEngine({
	projectRoot,
	state,
	batchId,
	fromPhase,
	git = {},
}) {
	const stalePid = readBatchEnginePid(state);
	if (!stalePid || stalePid === process.pid) {
		return { terminated: false, reason: "no_stale_pid" };
	}

	if (!isProcessAlive(stalePid)) {
		clearBatchEnginePid(state);
		return { terminated: false, reason: "already_dead", stalePid };
	}

	const eligiblePhase =
		fromPhase === "paused" ||
		fromPhase === "failed" ||
		(fromPhase === "running" && isPostMergeLimbo(state, git));
	if (!eligiblePhase) {
		return { terminated: false, reason: "phase_not_eligible", stalePid };
	}

	try {
		process.kill(stalePid, "SIGTERM");
	} catch {
		/* process may have exited between liveness check and kill */
	}

	if (isProcessAlive(stalePid)) {
		try {
			process.kill(stalePid, "SIGKILL");
		} catch {
			/* ignore */
		}
	}

	appendJournalEvent(projectRoot, batchId, "engine.orphan_terminated", {
		stalePid,
		fromPhase,
		signal: "SIGTERM",
	});
	clearBatchEnginePid(state);
	return { terminated: true, stalePid };
}
