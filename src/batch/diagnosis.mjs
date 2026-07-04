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
} from "./diagnosis-merge-failure.mjs";
export { buildMergeFailureHeadline, summarizeMergeFailures } from "./diagnosis-merge-failure.mjs";
import { buildRunningTailHeadline } from "./diagnosis-tail-state.mjs";
export { buildRunningTailHeadline, isRunningWithoutActiveWorkers } from "./diagnosis-tail-state.mjs";
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
export { inferLaunchFailureFromWorkerOutputTail, inferLaunchFailureKind } from "./diagnosis-launch-failure.mjs";

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
	"failed",
	"aborted",
];

const NO_PAUSE_DIAGNOSES = new Set(["limbo_stale", "completed_manual", "needs_integrate", "engine_orphaned"]);
const GITIGNORED_MERGE_FAILURE_CLASSES = new Set(["merge_failed_gitignored", "GitignoredDirtyWorktree"]);
const REVIEW_SPAWN_FAILURE_EXIT_REASONS = new Set([
	"code_review_spawn_failed",
	"code_review_timeout",
	"final_review_spawn_failed",
	"final_review_timeout",
]);

/**
 * @param {object} [ctx]
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.failureClass]
 * @param {string|null} [ctx.lastError]
 * @param {object[]} [ctx.journalEvents]
 * @returns {boolean}
 */
export function inferMergeGitignoredFailure(ctx = {}) {
	const { exitReason, failureClass, lastError, journalEvents } = ctx;
	if (GITIGNORED_MERGE_FAILURE_CLASSES.has(exitReason ?? "")) return true;
	if (GITIGNORED_MERGE_FAILURE_CLASSES.has(failureClass ?? "")) return true;

	const haystackParts = [exitReason, failureClass, lastError];
	if (Array.isArray(journalEvents)) {
		for (const event of journalEvents) {
			if (event.type !== "batch.merge_failed" && event.type !== "task.failed") continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			haystackParts.push(
				payload.failureClass,
				payload.classification,
				payload.error,
				payload.output,
			);
		}
	}
	const haystack = haystackParts.filter(Boolean).join("\n").toLowerCase();
	return (
		haystack.includes("gitignored dirty files only") ||
		haystack.includes("merge_failed_gitignored") ||
		haystack.includes("gitignoreddirtyworktree") ||
		(haystack.includes("git add") && haystack.includes("ignored"))
	);
}

/**
 * @param {string|null|undefined} taskBranch
 * @param {string[]|null|undefined} gitignoredPaths
 */
export function buildGitignoredMergeRepairCommand(taskBranch, gitignoredPaths) {
	const branchHint = taskBranch ? `git checkout ${taskBranch}` : "git checkout <task-branch>";
	const pathHint =
		Array.isArray(gitignoredPaths) && gitignoredPaths.length > 0
			? `git rm -r --cached -- ${gitignoredPaths.slice(0, 5).join(" ")}`
			: "git rm -r --cached -- <gitignored-paths>";
	return `${branchHint} && ${pathHint} && spine batch resume --force`;
}

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
 */
export function buildSuggestedCommand(diagnosis, ctx = {}) {
	if (ctx.mergeGitignoredFailure) {
		return buildGitignoredMergeRepairCommand(ctx.taskBranch, ctx.gitignoredPaths);
	}
	if (ctx.mergeFailed && (diagnosis === "failed" || diagnosis === "needs_retry")) {
		return "spine batch resume --force";
	}
	if (ctx.phase === "merge_blocked") {
		return "spine batch resume --force";
	}

	switch (diagnosis) {
		case "limbo_stale":
		case "completed_manual":
			return "spine batch dismiss";
		case "state_drift":
			return "spine batch retry --force";
		case "needs_retry":
			if (STUB_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				return buildStubFailureSuggestedCommand(ctx);
			}
			{
				const primaryCommand = buildPrimaryFailureSuggestedCommand(ctx);
				if (primaryCommand) return primaryCommand;
			}
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return "spine doctor";
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return "spine doctor";
			}
			if (ctx.salvageRetryCommand) return ctx.salvageRetryCommand;
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
			if (ctx.salvageRetryCommand) return ctx.salvageRetryCommand;
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine batch abort";
		case "worker_done_missing":
			return buildWorkerDoneMissingSuggestedCommand(ctx);
		case "engine_orphaned":
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine batch resume --attached";
		case "needs_merge":
			return "/spine-resume --force";
		case "needs_integrate":
			if (ctx.postMergeLimbo && ctx.phase === "running") {
				if (ctx.integrateGateOpen) {
					return "spine gate approve";
				}
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
 */
export function buildHeadline(diagnosis, ctx = {}) {
	const batchLabel = ctx.batchId ? `Batch ${ctx.batchId}` : "Batch";

	if (ctx.mergeGitignoredFailure) {
		return `${batchLabel} merge blocked by gitignored paths on a lane branch — drop cached ignored files, then resume`;
	}

	if (ctx.mergeFailed && (diagnosis === "failed" || diagnosis === "needs_retry")) {
		return buildMergeFailureHeadline(batchLabel, ctx);
	}

	switch (diagnosis) {
		case "limbo_stale":
			return `${batchLabel} finished but state is stale — dismiss to clear`;
		case "completed_manual":
			return `${batchLabel} work is on main but batch record is still active`;
		case "needs_retry":
			if (STUB_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				return buildStubFailureHeadline(batchLabel, ctx);
			}
			{
				const primaryHeadline = buildPrimaryFailureHeadline(batchLabel, ctx);
				if (primaryHeadline) return primaryHeadline;
			}
			if (ctx.launchFailureKind === "pi_spine_root" || ctx.launchFailureKind === "launch_failed") {
				return `${batchLabel} failed at worker launch — fix PI_SPINE_ROOT/devcontainer, then retry`;
			}
			if (ctx.launchFailureKind === "worktree_unhealthy") {
				return `${batchLabel} failed at worker launch — repair lane worktree git, then retry`;
			}
			if (REVIEW_SPAWN_FAILURE_EXIT_REASONS.has(ctx.exitReason ?? "")) {
				const reviewKind =
					ctx.exitReason === "final_review_spawn_failed" ||
					ctx.exitReason === "final_review_timeout"
						? "final review"
						: "code review";
				return ctx.failedTaskId
					? `${batchLabel} ${reviewKind} timed out for task ${ctx.failedTaskId} — retry or increase SPINE_REVIEW_TIMEOUT_MS`
					: `${batchLabel} reviewer spawn timed out — retry`;
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
		case "engine_orphaned":
			return ctx.failedTaskId
				? `${batchLabel} engine died mid-run (task ${ctx.failedTaskId} still running) — retry or abort`
				: `${batchLabel} batch engine died while running — retry or abort`;
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
		default:
			return `${batchLabel} requires attention (phase: ${ctx.phase ?? "unknown"})`;
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
 * @returns {Pick<ReconciliationResult, "diagnosis" | "headline" | "suggestedCommand" | "alternatives">}
 */
export function buildDiagnosisOutput(diagnosis, ctx = {}) {
	return {
		diagnosis,
		headline: buildHeadline(diagnosis, ctx),
		suggestedCommand: buildSuggestedCommand(diagnosis, ctx),
		alternatives: buildAlternatives(diagnosis, ctx),
	};
}
