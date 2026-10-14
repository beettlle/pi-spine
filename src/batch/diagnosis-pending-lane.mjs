// @ts-nocheck
/**
 * Pending lane land diagnosis — lane `.DONE` without main land (#201 / SP-645).
 */

import { isEngineProcessAlive } from "../process/liveness.mjs";
import { readBatchEnginePid, readBatchEngineStartedAt } from "./state-guards.mjs";
import {
	REVIEW_INFRASTRUCTURE_EXIT_REASONS,
	resolveTaskPrimaryFailureExitReason,
} from "./diagnosis-review-infra.mjs";

/**
 * Tasks with lane `.DONE` but not on main — lane commits never landed (#201 / SP-645).
 *
 * @param {object[]|undefined} tasks
 * @returns {object[]}
 */
export function findPendingLaneLandTasks(tasks) {
	if (!Array.isArray(tasks)) return [];
	return tasks.filter((task) => task?.doneInLane === true && task?.doneOnMain !== true);
}

/**
 * Guard for #330 / SP-815: the batch engine is alive AND the raw batch state
 * still shows live activity (phase "running" or a running task). Reconciled
 * signals can already look terminal-success mid-wave because a lane `.DONE`
 * is reconciled (`done_in_lane_terminal`) before the engine finishes code and
 * final review — so salvage guidance must be suppressed until the engine
 * exits or the state goes terminal. Both conditions must hold: a crashed
 * engine with a stale running phase still deserves salvage guidance.
 *
 * @param {object|null|undefined} raw raw batch state (`signals.raw`)
 * @param {object} [deps]
 * @param {(raw: object) => boolean} [deps.isEngineAlive] injectable engine liveness probe
 * @returns {boolean}
 */
export function isLiveEngineMidTask(raw, deps = {}) {
	if (!raw || typeof raw !== "object") return false;
	const isEngineAlive =
		deps.isEngineAlive ??
		((state) => isEngineProcessAlive(readBatchEnginePid(state), readBatchEngineStartedAt(state)));
	if (!isEngineAlive(raw)) return false;
	if (raw.phase === "running") return true;
	const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
	return tasks.some((task) => task?.status === "running");
}

/**
 * @param {object} signals
 * @param {object} [deps]
 * @param {(raw: object) => boolean} [deps.isEngineAlive] injectable engine liveness probe
 * @returns {boolean}
 */
export function shouldDiagnosePendingLaneLand(signals, deps = {}) {
	// Live engine mid-task: the lane may be about to land under the engine
	// itself — never suggest salvage while it is still running (#330 / SP-815).
	if (isLiveEngineMidTask(signals?.raw, deps)) return false;
	const pending = findPendingLaneLandTasks(signals.tasks);
	if (pending.length === 0) return false;
	// SP-821 / #334: when every pending-lane task's primary failure exit reason
	// is a review-infrastructure reason (spawn failure / timeout / provider
	// error), no verdict was ever produced. Re-run the review — never
	// salvage-integrate unreviewed code. Any other reason (or no failure at
	// all) keeps today's salvage guidance.
	if (
		pending.every((task) =>
			REVIEW_INFRASTRUCTURE_EXIT_REASONS.has(
				String(resolveTaskPrimaryFailureExitReason(task, signals) ?? ""),
			),
		)
	) {
		return false;
	}
	// Only when orch already appears merged — otherwise healthy pre-integrate
	// waves (doneInLane, awaiting integrate) must stay needs_integrate / settled.
	if (signals.git?.orchMergedToBase !== true) return false;
	if (signals.stateDrift?.drifted === true) return true;
	if (signals.allTasksTerminalSuccess !== true) return false;
	return true;
}

/**
 * @param {string|null|undefined} batchId
 * @param {object[]} pendingTasks
 * @returns {string}
 */
export function buildPendingLaneLandSuggestedCommand(batchId, pendingTasks) {
	const laneNumber = Number(pendingTasks[0]?.laneNumber);
	if (batchId && Number.isFinite(laneNumber) && laneNumber > 0) {
		return `spine batch salvage --batch ${batchId} --lane ${laneNumber} --integrate`;
	}
	if (batchId) {
		return `spine batch salvage --batch ${batchId} --dry-run`;
	}
	return "spine batch salvage --batch <batchId> --dry-run";
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null|undefined} [ctx.batchId]
 * @param {object[]} [ctx.pendingLaneLandTasks]
 * @param {string|null|undefined} [ctx.baseBranch]
 * @returns {string}
 */
export function buildPendingLaneLandHeadline(batchLabel, ctx = {}) {
	const pendingTaskIds = (ctx.pendingLaneLandTasks ?? [])
		.map((task) => String(task.taskId ?? ""))
		.filter(Boolean);
	const baseBranch = ctx.baseBranch ?? "main";
	const taskSuffix = pendingTaskIds.length > 0 ? ` (${pendingTaskIds.join(", ")})` : "";
	return `${batchLabel} has lane work not on ${baseBranch}${taskSuffix} — salvage integrate`;
}
