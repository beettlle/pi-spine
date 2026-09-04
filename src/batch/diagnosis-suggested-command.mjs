// @ts-nocheck
/**
 * Operator suggestedCommand builders — extracted from diagnosis.mjs for phase23 LOC.
 */
import { buildWorkerDoneMissingSuggestedCommand } from "./diagnosis-worker-done-missing.mjs";
import {
	buildFailedPhasePendingOnlySuggestedCommand,
	isFailedPhasePendingOnlyLimbo,
} from "./diagnosis-retry-limbo.mjs";
import {
	buildGitignoredMergeRepairCommand,
	shouldPreferPrimaryOverGitignoredHeadline,
} from "./diagnosis-merge-failure.mjs";
import {
	buildStubFailureSuggestedCommand,
	STUB_EXIT_REASONS,
} from "./diagnosis-stub.mjs";
import { buildPrimaryFailureSuggestedCommand } from "./diagnosis-primary-failure.mjs";
import { buildEngineOrphanParentExitSuggestedCommand } from "./diagnosis-parent-exit.mjs";
import { sanitizeRetrySuggestedCommand } from "./diagnosis-retry-command.mjs";
import { buildPendingLaneLandSuggestedCommand } from "./diagnosis-pending-lane.mjs";

/**
 * @param {string} diagnosis
 * @param {object} [ctx]
 * @param {string|null} [ctx.failedTaskId]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.salvageRetryCommand]
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.launchFailureKind]
 * @param {boolean} [ctx.mergeGitignoredFailure]
 * @param {boolean} [ctx.mergeFailed]
 * @param {string|null} [ctx.taskBranch]
 * @param {string[]|null} [ctx.gitignoredPaths]
 * @param {object[]} [ctx.pendingLaneLandTasks]
 */
export function buildSuggestedCommand(diagnosis, ctx = {}) {
	const preferPrimaryOverGitignored = shouldPreferPrimaryOverGitignoredHeadline(diagnosis, ctx);
	// Prefer gate-approve / orphan primary over recovered merge/gitignored repair (#195 / #205).
	if (ctx.mergeGitignoredFailure && !preferPrimaryOverGitignored) {
		return buildGitignoredMergeRepairCommand(ctx.taskBranch, ctx.gitignoredPaths);
	}
	if (
		ctx.mergeFailed &&
		!preferPrimaryOverGitignored &&
		(diagnosis === "failed" || diagnosis === "needs_retry")
	) {
		return "spine batch resume --force";
	}
	if (ctx.phase === "merge_blocked") {
		return "spine batch resume --force";
	}

	switch (diagnosis) {
		case "engine_still_running":
			return "spine wait --until completed,failed,needs_integrate --timeout 2h";
		case "limbo_stale":
		case "completed_manual":
			return "spine batch dismiss";
		case "state_drift":
			// Agent-safe detached recovery (#196 / SP-613) — never suggest --attached.
			if (
				ctx.phase === "running" ||
				ctx.staleEnginePid === true ||
				ctx.engineDead === true ||
				ctx.allTasksTerminalSuccess === true
			) {
				return "spine batch resume --force";
			}
			if (ctx.failedTaskId) {
				const driftStatus = String(ctx.driftTaskStatus ?? "").toLowerCase();
				if (driftStatus === "running") {
					return "spine batch resume --force";
				}
				return `spine batch retry ${ctx.failedTaskId}`;
			}
			return "spine status --diagnose";
		case "needs_retry":
			if (STUB_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				return buildStubFailureSuggestedCommand(ctx);
			}
			const primaryCommand = buildPrimaryFailureSuggestedCommand(ctx);
			if (primaryCommand) return primaryCommand;
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return "spine doctor";
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return "spine doctor";
			}
			if (ctx.salvageRetryCommand) {
				return sanitizeRetrySuggestedCommand(ctx.salvageRetryCommand, ctx.failedTaskId);
			}
			if (isFailedPhasePendingOnlyLimbo(ctx)) {
				return buildFailedPhasePendingOnlySuggestedCommand(ctx);
			}
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine status --diagnose";
		case "worker_orphaned":
			if (ctx.planReviewNestedSpawnBlocked) {
				if (ctx.stalePathSpine) {
					return ctx.failedTaskId
						? `node bin/spine.mjs batch retry ${ctx.failedTaskId}`
						: "npm link && spine batch resume --attached";
				}
				if (ctx.failedTaskId) {
					return `spine batch retry ${ctx.failedTaskId}`;
				}
			}
			if (ctx.engineDead) {
				return "spine batch resume --attached --force";
			}
			if (ctx.ghostRunningCluster) return "spine batch abort";
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return "spine doctor";
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return "spine doctor";
			}
			if (ctx.salvageRetryCommand) {
				return sanitizeRetrySuggestedCommand(ctx.salvageRetryCommand, ctx.failedTaskId);
			}
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine batch abort";
		case "worker_done_missing":
			return buildWorkerDoneMissingSuggestedCommand(ctx);
		case "engine_orphaned": {
			const parentExitCommand = buildEngineOrphanParentExitSuggestedCommand(ctx);
			if (parentExitCommand) return parentExitCommand;
			// Terminal-success / doneInLane heal with dead engine — detached resume (#196 / #163).
			if (ctx.allTasksTerminalSuccess === true) {
				return "spine batch resume --force";
			}
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine batch resume --attached";
		}
		case "needs_merge":
			return "spine batch resume --force";
		case "needs_integrate":
			if (ctx.integrateGateOpen) {
				return "spine gate approve";
			}
			if (ctx.postMergeLimbo && ctx.phase === "running") {
				if (ctx.stalePathSpine) {
					return "node bin/spine.mjs batch resume --attached";
				}
				return "spine batch resume --force";
			}
			return "spine integrate";
		case "needs_replan": {
			const tasksRoot = ctx.tasksRoot ?? "spine-tasks";
			return ctx.failedTaskId
				? `edit ${tasksRoot}/${ctx.failedTaskId}/PROMPT.md then spine batch retry ${ctx.failedTaskId}`
				: "spine status --diagnose";
		}
		case "running":
			return "/spine-status --diagnose";
		case "paused":
			return "spine batch resume";
		case "failed":
			return "spine status --diagnose";
		case "aborted":
			return "spine batch dismiss";
		case "completed":
			return "spine preflight";
		case "human_base_diverged":
			return "spine sync-base";
		case "integrate_isolated_ok":
			return "spine sync-base";
		case "pending_lane_land":
			return buildPendingLaneLandSuggestedCommand(ctx.batchId, ctx.pendingLaneLandTasks ?? []);
		default:
			return "spine status --diagnose";
	}
}
