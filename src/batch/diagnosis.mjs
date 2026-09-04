// @ts-nocheck
/**
 * FR-BATCH-13 diagnosis taxonomy and operator messaging (§18.3).
 */
import {
	buildWorkerDoneMissingHeadline,
	buildWorkerDoneMissingSuggestedCommand,
} from "./diagnosis-worker-done-missing.mjs";
import {
	buildFailedPhasePendingOnlyHeadline,
	buildFailedPhasePendingOnlySuggestedCommand,
	isFailedPhasePendingOnlyLimbo,
} from "./diagnosis-retry-limbo.mjs";
import { buildAlternatives } from "./diagnosis-alternatives.mjs";
export { buildAlternatives } from "./diagnosis-alternatives.mjs";
import {
	buildMergeFailureHeadline,
	buildGitignoredMergeRepairCommand,
	shouldPreferPrimaryOverGitignoredHeadline,
} from "./diagnosis-merge-failure.mjs";
export {
	buildMergeFailureHeadline,
	buildGitignoredMergeRepairCommand,
	inferMergeGitignoredFailure,
	shouldPreferPrimaryOverGitignoredHeadline,
	summarizeMergeFailures,
} from "./diagnosis-merge-failure.mjs";
import { buildRunningTailHeadline, isPostIntegrateEngineLimbo, buildPostIntegrateEngineLimboHeadline } from "./diagnosis-tail-state.mjs";
export {
	buildPostIntegrateEngineLimboHeadline,
	buildRunningTailHeadline,
	isEngineStillRunning,
	isPostIntegrateEngineLimbo,
	isRunningWithoutActiveWorkers,
} from "./diagnosis-tail-state.mjs";
export { buildReviewHonorHeadlineSuffix, findLatestReviewHonorSignal } from "./review.mjs";
import {
	buildStubFailureHeadline,
	buildStubFailureSuggestedCommand,
	STUB_EXIT_REASONS,
} from "./diagnosis-stub.mjs";
/** @typedef {import("./reconcile.mjs").ReconciliationResult} ReconciliationResult */
export {
	classifyTaskDoneSemantics,
	resolveTaskFolderPath,
	resolveTaskLaneWorktreePath,
	TASK_DONE_FLAG_FIELD_NAMES,
} from "./diagnosis-task-done.mjs";
import {
	buildPrimaryFailureHeadline,
	buildPrimaryFailureSuggestedCommand,
} from "./diagnosis-primary-failure.mjs";
import {
	buildEngineOrphanParentExitHeadline,
	buildEngineOrphanParentExitSuggestedCommand,
} from "./diagnosis-parent-exit.mjs";
export {
	inferEngineOrphanCause,
	journalHasEngineCrash,
	journalIndicatesParentExit,
} from "./diagnosis-parent-exit.mjs";
import { buildReviewHonorHeadlineSuffix } from "./review.mjs";
export { inferLaunchFailureFromWorkerOutputTail, inferLaunchFailureKind } from "./diagnosis-launch-failure.mjs";
import { isGateReadyHeadlineContext } from "./diagnosis-gate-ready.mjs";
export { isGateReadyHeadlineContext };
import { sanitizeRetrySuggestedCommand } from "./diagnosis-retry-command.mjs";
export { sanitizeRetrySuggestedCommand };
import {
	buildPendingLaneLandHeadline,
	buildPendingLaneLandSuggestedCommand,
} from "./diagnosis-pending-lane.mjs";
export {
	buildPendingLaneLandHeadline,
	buildPendingLaneLandSuggestedCommand,
	findPendingLaneLandTasks,
	shouldDiagnosePendingLaneLand,
} from "./diagnosis-pending-lane.mjs";

export const DIAGNOSIS_TAXONOMY = [
	"running",
	"paused",
	"needs_retry",
	"state_drift",
	"worker_orphaned",
	"worker_done_missing",
	"engine_orphaned",
	"needs_merge",
	"needs_integrate",
	"needs_replan",
	"completed",
	"completed_manual",
	"limbo_stale",
	"human_base_diverged",
	"integrate_isolated_ok",
	"pending_lane_land",
	"engine_still_running",
	"failed",
	"aborted",
];

const NO_PAUSE_DIAGNOSES = new Set([
	"limbo_stale",
	"completed_manual",
	"needs_integrate",
	"engine_orphaned",
	"integrate_isolated_ok",
	"engine_still_running",
]);
const REVIEW_SPAWN_FAILURE_EXIT_REASONS = new Set([
	"code_review_spawn_failed",
	"code_review_timeout",
	"final_review_spawn_failed",
	"final_review_timeout",
]);

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

/**
 * @param {string} diagnosis
 * @param {object} ctx
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.phase]
 * @param {number} [ctx.failedTasks]
 * @param {string|null} [ctx.failedTaskId]
 * @param {boolean} [ctx.gitMerged]
 * @param {number} [ctx.pendingTaskCount]
 * @param {number} [ctx.salvageChangedFileCount]
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.launchFailureKind]
 * @param {boolean} [ctx.mergeGitignoredFailure]
 * @param {boolean} [ctx.mergeFailed]
 * @param {number|null} [ctx.failedWaveIndex]
 * @param {number|null} [ctx.failedLane]
 * @param {string|null} [ctx.lastError]
 * @param {number} [ctx.succeededTasks]
 * @param {number} [ctx.totalTasks]
 * @param {object[]} [ctx.pendingLaneLandTasks]
 * @param {string|null|undefined} [ctx.baseBranch]
 */
export function buildHeadline(diagnosis, ctx = {}) {
	const batchLabel = ctx.batchId ? `Batch ${ctx.batchId}` : "Batch";
	const preferPrimaryOverGitignored = shouldPreferPrimaryOverGitignoredHeadline(diagnosis, ctx);

	// Historical merge/gitignored signals stay in diagnose signals — not the primary headline (#195 / #205).
	if (ctx.mergeGitignoredFailure && !preferPrimaryOverGitignored) {
		return `${batchLabel} merge blocked by gitignored paths on a lane branch — drop cached ignored files, then resume`;
	}

	if (
		ctx.mergeFailed &&
		!preferPrimaryOverGitignored &&
		(diagnosis === "failed" || diagnosis === "needs_retry")
	) {
		return buildMergeFailureHeadline(batchLabel, ctx);
	}

	switch (diagnosis) {
		case "engine_still_running": {
			const enginePid = ctx.enginePid;
			const pidSuffix =
				enginePid != null && Number.isFinite(Number(enginePid))
					? ` (PID ${enginePid})`
					: "";
			if (ctx.gitMerged === true) {
				return `${batchLabel} resume engine still running after integrate${pidSuffix} — wait, abort, or batch complete after exit`;
			}
			return `${batchLabel} engine still running${pidSuffix} — complete refused`;
		}
		case "limbo_stale":
			return `${batchLabel} finished but state is stale — dismiss to clear`;
		case "completed_manual":
			return `${batchLabel} work is on main but batch record is still active`;
		case "needs_retry":
			if (STUB_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				return buildStubFailureHeadline(batchLabel, ctx);
			}
			const primaryHeadline = buildPrimaryFailureHeadline(batchLabel, ctx);
			if (primaryHeadline) return primaryHeadline;
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return `${batchLabel} failed at worker launch — fix PI_SPINE_ROOT/devcontainer, then retry`;
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return `${batchLabel} failed at worker launch — repair lane worktree git, then retry`;
			}
			if (REVIEW_SPAWN_FAILURE_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				const isFinal = ctx.exitReason.startsWith("final_review");
				const isTimeout = ctx.exitReason.endsWith("_timeout");
				const reviewKind = isFinal ? "final review" : "code review";
				
				if (isTimeout) {
					return ctx.failedTaskId
						? `${batchLabel} ${reviewKind} timed out for task ${ctx.failedTaskId} — retry or increase SPINE_REVIEW_TIMEOUT_MS`
						: `${batchLabel} reviewer spawn timed out — retry`;
				}
				
				return ctx.failedTaskId
					? `${batchLabel} ${reviewKind} spawn failed for task ${ctx.failedTaskId} — retry`
					: `${batchLabel} reviewer spawn failed — retry`;
			}
			if (ctx.salvageChangedFileCount > 0 && ctx.failedTaskId) {
				return `${batchLabel} failed (${ctx.failedTaskId}): ${ctx.salvageChangedFileCount} uncommitted file(s) in scope`;
			}
			if (isFailedPhasePendingOnlyLimbo(ctx)) {
				return buildFailedPhasePendingOnlyHeadline(batchLabel, ctx);
			}
			return ctx.failedTaskId
				? `${batchLabel} worker died while task ${ctx.failedTaskId} was running — retry or abort`
				: `${batchLabel} has failed tasks — retry before resume`;
		case "state_drift":
			return ctx.failedTaskId
				? `${batchLabel} batch-state drift for task ${ctx.failedTaskId} — journal disagrees with cache`
				: `${batchLabel} batch-state drift — journal disagrees with cache`;
		case "worker_orphaned":
			if (ctx.planReviewNestedSpawnBlocked) {
				return ctx.failedTaskId
					? `${batchLabel} plan review nested_spawn_blocked (stale PATH spine or pre-SP-278) — retry task ${ctx.failedTaskId}`
					: `${batchLabel} plan review nested_spawn_blocked — retry after npm link or use node bin/spine.mjs`;
			}
			if (ctx.engineDead) {
				return ctx.failedTaskId
					? `${batchLabel} engine and worker died while task ${ctx.failedTaskId} was running — resume attached with --force`
					: `${batchLabel} engine and worker died while running — resume attached with --force`;
			}
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return `${batchLabel} lane worker orphaned during launch — fix PI_SPINE_ROOT/devcontainer, then retry`;
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return `${batchLabel} lane worker orphaned during launch — repair lane worktree git, then retry`;
			}
			if (ctx.ghostRunningCluster) {
				return ctx.failedTaskId
					? `${batchLabel} lane worker orphaned with multiple ghost running tasks (task ${ctx.failedTaskId}) — abort or retry`
					: `${batchLabel} lane worker orphaned with multiple ghost running tasks — abort or retry`;
			}
			return ctx.failedTaskId
				? `${batchLabel} lane worker orphaned while task ${ctx.failedTaskId} was running — retry or abort`
				: `${batchLabel} lane worker orphaned — retry or abort`;
		case "worker_done_missing":
			return buildWorkerDoneMissingHeadline(batchLabel, ctx);
		case "engine_orphaned": {
			const parentExitHeadline = buildEngineOrphanParentExitHeadline(batchLabel, ctx);
			if (parentExitHeadline) return parentExitHeadline;
			return ctx.failedTaskId
				? `${batchLabel} engine died mid-run (task ${ctx.failedTaskId} still running) — retry or abort`
				: `${batchLabel} batch engine died while running — retry or abort`;
		}
		case "needs_merge":
			if (ctx.mergeGitignoredFailure) {
				return `${batchLabel} merge blocked by gitignored paths committed on a lane branch`;
			}
			return `${batchLabel} tasks done — lane merges pending`;
		case "needs_integrate":
			if (ctx.postMergeLimbo && ctx.phase === "running") {
				if (ctx.integrateGateOpen) {
					return `${batchLabel} gate opened — approve to continue land loop`;
				}
				if (ctx.stalePathSpine) {
					return `${batchLabel} merged but gate not opened — use node bin/spine.mjs batch resume --attached (PATH spine may be stale)`;
				}
				return `${batchLabel} merged but gate not opened — resume to complete land loop`;
			}
			return `${batchLabel} ready to integrate orch branch to main`;
		case "needs_replan":
			return ctx.failedTaskId
				? `Task ${ctx.failedTaskId} needs replan — edit PROMPT.md before retry`
				: `${batchLabel} has tasks needing replan — edit PROMPT.md before retry`;
		case "running": {
			if (isPostIntegrateEngineLimbo(ctx)) {
				return buildPostIntegrateEngineLimboHeadline(batchLabel, ctx);
			}
			const reviewHonorSuffix = buildReviewHonorHeadlineSuffix(ctx.reviewHonorSignal);
			if (reviewHonorSuffix && ctx.reviewHonorSignal?.taskId) {
				return `${batchLabel} task ${ctx.reviewHonorSignal.taskId}: ${reviewHonorSuffix}`;
			}
			const tailHeadline = buildRunningTailHeadline(batchLabel, ctx);
			if (tailHeadline) {
				return tailHeadline;
			}
			return `${batchLabel} is running`;
		}
		case "paused": {
			const pending = ctx.pendingTaskCount ?? 0;
			if (pending > 1) {
				return `${batchLabel} is paused with ${pending} tasks pending — use spine batch resume (multi-task)`;
			}
			return `${batchLabel} is paused`;
		}
		case "failed":
			return `${batchLabel} failed (${ctx.failedTasks ?? 0} failed task(s))`;
		case "aborted":
			return `${batchLabel} was aborted`;
		case "completed":
			return `${batchLabel} completed successfully`;
		case "human_base_diverged": {
			const overlapCount = Array.isArray(ctx.overlapPaths) ? ctx.overlapPaths.length : 0;
			return overlapCount > 0
				? `${batchLabel} — human commits on base overlap orch land (${overlapCount} path(s))`
				: `${batchLabel} — human commits on base overlap orch land`;
		}
		case "integrate_isolated_ok":
			return `${batchLabel} — isolated integrate landed; sync human checkout with base`;
		case "pending_lane_land":
			return buildPendingLaneLandHeadline(batchLabel, ctx);
		default:
			return `${batchLabel} requires attention (phase: ${ctx.phase ?? "unknown"})`;
	}
}

/**
 * SBAR Background (#278 / SP-745) — short decision-relevant facts that explain
 * the state the assessment was derived from. Facts are additive; consumers that
 * ignore unknown fields keep working.
 *
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {string[]}
 */
export function buildBackground(diagnosis, ctx = {}) {
	const facts = [];
	if (ctx.batchId) {
		facts.push(`Batch: ${ctx.batchId}`);
	}
	if (ctx.phase || ctx.macroPhase) {
		facts.push(`Phase: ${ctx.phase ?? "unknown"}${ctx.macroPhase ? ` (macro: ${ctx.macroPhase})` : ""}`);
	}
	if (ctx.totalTasks != null) {
		const progressBits = [`${ctx.succeededTasks ?? 0}/${ctx.totalTasks} tasks succeeded`];
		if (ctx.failedTasks) progressBits.push(`${ctx.failedTasks} failed`);
		if (ctx.pendingTaskCount) progressBits.push(`${ctx.pendingTaskCount} pending`);
		facts.push(`Progress: ${progressBits.join(", ")}`);
	}
	if (ctx.failedTaskId) {
		facts.push(
			`Failed task: ${ctx.failedTaskId}${ctx.exitReason ? ` (exit: ${ctx.exitReason})` : ""}`,
		);
	}
	if (ctx.launchFailureKind) {
		facts.push(`Launch failure kind: ${ctx.launchFailureKind}`);
	}
	if (ctx.engineStillRunning === true && ctx.enginePid != null) {
		facts.push(`Engine PID ${ctx.enginePid} is still running`);
	}
	if (ctx.staleEnginePid === true && ctx.enginePid != null) {
		facts.push(`Engine PID ${ctx.enginePid} is stale (process not alive)`);
	}
	if (ctx.engineOrphanCause) {
		facts.push(`Engine orphan cause: ${ctx.engineOrphanCause}`);
	}
	if (ctx.mergeFailed) {
		facts.push(
			`Lane merge failed${ctx.failedWaveIndex != null ? ` (wave index ${ctx.failedWaveIndex})` : ""}`,
		);
	}
	if (ctx.gitMerged === true) {
		facts.push(`Orch branch already merged to ${ctx.baseBranch ?? "base"}`);
	}
	if (ctx.integrateGateOpen === true) {
		facts.push("Integrate gate is open");
	}
	if (ctx.salvageRetryCommand) {
		facts.push(`Tried: ${ctx.salvageRetryCommand}`);
	}
	if (Array.isArray(ctx.journalHints)) {
		for (const hint of ctx.journalHints) {
			if (typeof hint === "string") {
				facts.push(`Journal: ${hint}`);
			} else if (hint && typeof hint === "object" && (hint.summary || hint.type)) {
				facts.push(`Journal: ${hint.type ?? "event"}${hint.summary ? ` — ${hint.summary}` : ""}`);
			}
		}
	}
	return facts;
}

/**
 * SBAR Assessment rationale (#278 / SP-745) — why this diagnosis enum was
 * selected from reconcile signals, not just its label.
 *
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {string}
 */
export function buildAssessmentReason(diagnosis, ctx = {}) {
	switch (diagnosis) {
		case "engine_still_running":
			return `Engine PID ${ctx.enginePid ?? "?"} is alive, so completion was refused to avoid clobbering an active run`;
		case "limbo_stale":
			return "Batch ended but state is stale and no engine or worker is active — only a dismiss can clear it";
		case "completed_manual":
			return "Work is already on the base branch while the batch record is still active — operator completed it manually";
		case "needs_retry":
			if (ctx.failedTaskId && ctx.exitReason) {
				return `Task ${ctx.failedTaskId} exited "${ctx.exitReason}" without completing its contract, and tasks remain to run`;
			}
			if (ctx.failedTaskId) {
				return `Worker for task ${ctx.failedTaskId} died before writing .DONE, and tasks remain to run`;
			}
			return "Failed phase left only pending tasks with no live workers — retry limbo resolves as a retry";
		case "state_drift":
			return ctx.failedTaskId
				? `Journal history for task ${ctx.failedTaskId} disagrees with the batch-state cache — no single source of truth`
				: "Journal history disagrees with the batch-state cache — no single source of truth";
		case "worker_orphaned":
			if (ctx.engineDead) {
				return `Engine and lane worker both died while task ${ctx.failedTaskId ?? "?"} was still running`;
			}
			if (ctx.ghostRunningCluster) {
				return `Lane worker died but multiple tasks are still marked running (ghost running cluster)${ctx.failedTaskId ? `, e.g. ${ctx.failedTaskId}` : ""}`;
			}
			return `Lane worker stopped while task ${ctx.failedTaskId ?? "?"} was still marked running — heartbeats ended without a terminal journal event`;
		case "worker_done_missing":
			return `Task ${ctx.failedTaskId ?? "?"} reported progress in the journal but no .DONE file was found in the lane or batch tasks root`;
		case "engine_orphaned":
			if (ctx.engineOrphanCause) {
				return `Engine process is gone (${ctx.engineOrphanCause}) while tasks were still running`;
			}
			return `Engine process died mid-run${ctx.failedTaskId ? ` with task ${ctx.failedTaskId} still running` : ""} — journal has no engine shutdown event`;
		case "needs_merge":
			return "All assigned tasks finished in their lanes, but lane merges into the orch branch are still pending";
		case "needs_integrate":
			if (ctx.integrateGateOpen) {
				return "Land loop is paused at the integrate gate with the gate open — approval continues the land";
			}
			return `Tasks are terminal-success and merged to the orch branch, which is not yet integrated into ${ctx.baseBranch ?? "base"}`;
		case "needs_replan":
			return ctx.failedTaskId
				? `Task ${ctx.failedTaskId} failed in a way that requires a contract (PROMPT.md) change, not just a retry`
				: "Failed tasks require a contract (PROMPT.md) change, not just a retry";
		case "running":
			return "Engine and workers are alive with no failure, drift, or orphan signals observed";
		case "paused":
			return `Batch was paused by an operator or gate with ${ctx.pendingTaskCount ?? 0} task(s) pending — resume continues from journal state`;
		case "failed":
			return `Batch recorded failure in phase ${ctx.phase ?? "unknown"} (${ctx.failedTasks ?? 0} failed task(s)) with no recoverable retry path`;
		case "aborted":
			return "Batch was aborted by an operator; state remains for audit";
		case "completed":
			return `All tasks succeeded and the orch branch landed on ${ctx.baseBranch ?? "base"}`;
		case "human_base_diverged": {
			const overlapCount = Array.isArray(ctx.overlapPaths) ? ctx.overlapPaths.length : 0;
			return `Human commits on ${ctx.baseBranch ?? "base"} overlap orch land${overlapCount > 0 ? ` (${overlapCount} path(s))` : ""} — reconciliation needs a human sync decision`;
		}
		case "integrate_isolated_ok":
			return "Isolated integrate landed cleanly; the human checkout only needs a sync with base";
		case "pending_lane_land":
			return "Done-in-lane work is sitting in lane worktrees waiting to be landed";
		default:
			return `Reconcile signals selected "${diagnosis}" for phase ${ctx.phase ?? "unknown"}`;
	}
}

/**
 * @param {string} diagnosis
 */
export function shouldNeverSuggestPause(diagnosis) {
	return NO_PAUSE_DIAGNOSES.has(diagnosis);
}

/**
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {string}
 */
export function resolveEffectiveDiagnosis(diagnosis, ctx = {}) {
	if (diagnosis === "running" && isPostIntegrateEngineLimbo(ctx)) {
		return "engine_still_running";
	}
	return diagnosis;
}

/**
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {Pick<ReconciliationResult, "diagnosis" | "headline" | "suggestedCommand" | "alternatives"> & { background: string[], assessmentReason: string }}
 */
export function buildDiagnosisOutput(diagnosis, ctx = {}) {
	const effectiveDiagnosis = resolveEffectiveDiagnosis(diagnosis, ctx);
	return {
		diagnosis: effectiveDiagnosis,
		headline: buildHeadline(effectiveDiagnosis, ctx),
		suggestedCommand: buildSuggestedCommand(effectiveDiagnosis, ctx),
		alternatives: buildAlternatives(effectiveDiagnosis, ctx),
		// Additive SBAR fields (#278 / SP-745) — appended after legacy keys so
		// consumers reading positional or partial fields are unaffected.
		background: buildBackground(effectiveDiagnosis, ctx),
		assessmentReason: buildAssessmentReason(effectiveDiagnosis, ctx),
	};
}
