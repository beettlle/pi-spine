// @ts-nocheck
/**
 * Post-release cleanup for terminal batch lifecycle writes (SP-796 / #302).
 *
 * abort/complete/dismiss hold the global batch-state lock only for state
 * I/O (in-lock reload, archive write, history append, terminal journal
 * event, active-state clear). Post-mortem, metrics, worker termination and
 * worktree cleanup run after the lock is released so concurrent engine
 * saves are never blocked behind them.
 *
 * A failure in this phase must never throw: the batch state was already
 * archived and journaled terminal, so an exception could only turn a
 * finished batch into a reported failure. Each failed step is reported in
 * the caller's `cleanupWarnings` and journaled as `batch.cleanup_failed`
 * `{ step, error }` instead.
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { cleanupBatchLaneWorktrees } from "./lifecycle-archive.mjs";
import { recordBatchTerminalMetric } from "./metrics.mjs";
import { writeBatchPostMortem } from "./postmortem.mjs";

/**
 * Run named cleanup steps after the batch-state lock was released. Steps run
 * in order; a failing step records a warning and journals `batch.cleanup_failed`
 * but never stops the remaining steps or throws to the caller.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Array<{ step: string, run: () => void }>} params.steps
 * @returns {string[]} `cleanupWarnings` — one `"<step>: <error>"` per failed step
 */
export function runPostReleaseCleanup({ projectRoot, batchId, steps }) {
	const warnings = [];
	for (const { step, run } of steps) {
		try {
			run();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			warnings.push(`${step}: ${message}`);
			try {
				appendJournalEvent(projectRoot, batchId, "batch.cleanup_failed", {
					step,
					error: message,
				});
			} catch {
				// Journal I/O failing while reporting a cleanup failure must not
				// mask the terminal result — the warning string still carries it.
			}
		}
	}
	return warnings;
}

/**
 * Post-release cleanup shared by dismiss and complete (SP-796 / #302):
 * post-mortem write, terminal metrics, and lane-worktree cleanup — all after
 * the in-lock section archived the state and journaled the terminal event.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.batchState the in-lock snapshot that was archived
 * @param {import("./reconcile.mjs").ReconciliationResult} [params.reconciliation]
 * @param {string} params.diagnosis
 * @param {number} params.endedAt
 * @returns {string[]} `cleanupWarnings`
 */
export function runLifecycleCleanupAfterRelease({
	projectRoot,
	batchId,
	batchState,
	reconciliation,
	diagnosis,
	endedAt,
}) {
	return runPostReleaseCleanup({
		projectRoot,
		batchId,
		steps: [
			{
				step: "post_mortem",
				run: () => {
					writeBatchPostMortem({ projectRoot, batchState, reconciliation });
				},
			},
			{
				step: "metrics",
				run: () => {
					const config = loadSpineConfig(projectRoot).config ?? {};
					recordBatchTerminalMetric({
						projectRoot,
						batchId,
						batchState: { ...batchState, endedAt },
						diagnosis,
						config,
					});
				},
			},
			{
				step: "worktrees",
				run: () => {
					const config = loadSpineConfig(projectRoot).config ?? {};
					cleanupBatchLaneWorktrees({ projectRoot, batchId, batchState, config });
				},
			},
		],
	});
}
