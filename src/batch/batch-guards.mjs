// @ts-check
/**
 * Nested batch-spawn guards (SP-482 / SP-588).
 * Blocks workers from starting a batch engine inside a lane worktree.
 */

import { appendJournalEvent } from "./journal.mjs";

const WORKTREE_SPINE_PATTERN = /[/\\]\.worktrees[/\\]spine-/;

/**
 * Detect whether the current process is running inside a spine worker context.
 * Returns a human-readable reason string if nested, or null if safe to proceed.
 *
 * Two guards: (1) SPINE_IS_WORKER env set by worker-host, and
 * (2) projectRoot inside a .worktrees/spine-* directory (catches cases where
 * the env was not inherited but the target is clearly a lane worktree).
 *
 * @param {string} projectRoot — the directory where the batch would run
 * @returns {string | null}
 */
export function detectNestedWorkerContext(projectRoot) {
	if (process.env.SPINE_IS_WORKER === "1") {
		return "SPINE_IS_WORKER=1 is set (running inside a worker process)";
	}
	const parentBatchId = process.env.SPINE_PARENT_BATCH_ID ?? process.env.SPINE_BATCH_ID;
	if (parentBatchId && WORKTREE_SPINE_PATTERN.test(projectRoot)) {
		return (
			`parent batch ${parentBatchId} is active and projectRoot is inside a ` +
			`.worktrees/spine-* lane directory`
		);
	}
	if (WORKTREE_SPINE_PATTERN.test(projectRoot)) {
		return "projectRoot is inside a .worktrees/spine-* lane directory";
	}
	return null;
}

/**
 * If nested, journal and return the startBatch error result; otherwise null.
 *
 * @param {string} projectRoot
 * @returns {{ ok: false, exitCode: number, error: string, output: string } | null}
 */
export function rejectNestedBatchStart(projectRoot) {
	const nestedReason = detectNestedWorkerContext(projectRoot);
	if (!nestedReason) {
		return null;
	}
	const parentBatchId = process.env.SPINE_PARENT_BATCH_ID ?? process.env.SPINE_BATCH_ID ?? "unknown";
	try {
		appendJournalEvent(projectRoot, parentBatchId, "engine.nested_spawn_blocked", {
			projectRoot,
			parentBatchId,
			reason: nestedReason,
		});
	} catch {
		// Journal may not be writable from a worker worktree; best-effort.
	}
	return {
		ok: false,
		exitCode: 1,
		error: "nested_batch_spawn_blocked",
		output:
			`Nested batch start blocked: ${nestedReason}. ` +
			`Workers must not spawn batch engines. ` +
			`Parent batch: ${parentBatchId}, projectRoot: ${projectRoot}\n`,
	};
}
