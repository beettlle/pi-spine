/**
 * Primary task failure headlines and commands (SP-421 / GitHub #74).
 */

export const PRIMARY_TASK_FAILURE_EXIT_REASONS = new Set([
	"DirtyWorktree",
	"GitignoredDirtyWorktree",
	"lane_commit_failed",
	"review_exhausted",
	"contract_failed",
	"needs_replan",
	"prompt_parse_failed",
]);

const LANE_COMMIT_EXIT_REASONS = new Set(["DirtyWorktree", "lane_commit_failed"]);

/** Suggested `contract.testTimeoutMs` after a timeout: double the 10-minute default. */
const CONTRACT_TIMEOUT_SUGGESTED_MS = 20 * 60 * 1000;

/** Suggested `contract.reviewTimeoutMs` after a review timeout: double the 20-minute default (SP-845). */
const CONTRACT_REVIEW_TIMEOUT_SUGGESTED_MS = 40 * 60 * 1000;

/**
 * True when the latest contract verification for `taskId` failed because its
 * testCommand timed out (#369), so diagnosis can name the timeout instead of
 * pointing at PROMPT.md scope.
 *
 * SP-845: a `reviewCommand` timeout is distinguished from a test timeout —
 * returns `"review"` for review timeouts (truthy, so `contractTimedOut`
 * consumers keep working while builders can name `contract.reviewTimeoutMs`).
 *
 * @param {Array<{ type?: string, payload?: Record<string, any> }>} journalEvents
 * @param {string|null|undefined} taskId
 * @returns {boolean | "review"}
 */
export function isContractTimeoutFailure(journalEvents, taskId) {
	if (!taskId || !Array.isArray(journalEvents)) return false;
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event?.type !== "contract.verified" && event?.type !== "contract.failed") continue;
		if (event.payload?.taskId !== taskId) continue;
		const checks = Array.isArray(event.payload?.checks) ? event.payload.checks : [];
		if (
			checks.some(
				(check) => check?.field === "reviewCommand" && check.ok === false && /timed out after/.test(String(check.message ?? "")),
			)
		) {
			return "review";
		}
		return checks.some(
			(check) => check?.field === "testCommand" && check.ok === false && /timed out after/.test(String(check.message ?? "")),
		);
	}
	return false;
}

/**
 * @param {string|null|undefined} exitReason
 */
export function isPrimaryTaskFailureExitReason(exitReason) {
	return PRIMARY_TASK_FAILURE_EXIT_REASONS.has(exitReason ?? "");
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.failedTaskId]
 * @param {boolean} [ctx.mergeGitignoredFailure]
 * @param {boolean | "review"} [ctx.contractTimedOut] SP-845: "review" marks a reviewCommand timeout.
 */
export function buildPrimaryFailureHeadline(batchLabel, ctx = {}) {
	if (LANE_COMMIT_EXIT_REASONS.has(ctx.exitReason ?? "")) {
		if (ctx.exitReason === "GitignoredDirtyWorktree" || ctx.mergeGitignoredFailure) {
			return ctx.failedTaskId
				? `${batchLabel} task ${ctx.failedTaskId} left gitignored dirty files on the lane branch`
				: `${batchLabel} lane commit refused gitignored-only dirty files`;
		}
		if (ctx.exitReason === "DirtyWorktree") {
			return ctx.failedTaskId
				? `${batchLabel} task ${ctx.failedTaskId} left dirty lane worktree after completion — clean coverage artifacts, then retry`
				: `${batchLabel} lane worktree dirty after completion — clean coverage artifacts, then retry`;
		}
		return ctx.failedTaskId
			? `${batchLabel} task ${ctx.failedTaskId} completed but lane commit failed`
			: `${batchLabel} completed but lane commit failed`;
	}
	if (ctx.exitReason === "review_exhausted") {
		return ctx.failedTaskId
			? `${batchLabel} task ${ctx.failedTaskId} exhausted final review attempts — fix scope or implementation, then retry`
			: `${batchLabel} review attempts exhausted — fix scope or implementation, then retry`;
	}
	if (ctx.exitReason === "contract_failed" && ctx.contractTimedOut) {
		const isReviewTimeout = ctx.contractTimedOut === "review";
		const field = isReviewTimeout ? "reviewCommand" : "testCommand";
		const key = isReviewTimeout ? "contract.reviewTimeoutMs" : "contract.testTimeoutMs";
		const subject = ctx.failedTaskId ? `task ${ctx.failedTaskId} contract ${field}` : `contract ${field}`;
		return `${batchLabel} ${subject} timed out — raise ${key} or speed up the command, then retry`;
	}
	if (ctx.exitReason === "contract_failed") {
		return ctx.failedTaskId
			? `${batchLabel} task ${ctx.failedTaskId} failed contract verification — fix PROMPT.md scope, then retry`
			: `${batchLabel} contract verification failed — fix PROMPT.md scope, then retry`;
	}
	return null;
}

// Keep the hint readable; the gitignored merge repair command uses the same cap (#288).
const DIRTY_WORKTREE_PATH_HINT_LIMIT = 5;

/**
 * DirtyWorktree remediation hint built from the actual dirty set (#288).
 * Prefers concrete dirty paths from the failure payload / lane dirty-check;
 * falls back to a generic status inspection plus retry when paths are unknown.
 * Never hardcodes coverage paths — they appear only when present in the dirty set.
 *
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 * @param {string[]|null} [ctx.dirtyPaths]
 * @param {string|null} [ctx.laneWorktree]
 * @returns {string}
 */
export function buildDirtyWorktreeSuggestedCommand(ctx = {}) {
	const dirtyPaths = (Array.isArray(ctx.dirtyPaths) ? ctx.dirtyPaths : []).filter(
		(entry) => typeof entry === "string" && entry.trim().length > 0,
	);
	const retryHint = ctx.failedTaskId
		? `spine batch retry ${ctx.failedTaskId}`
		: "spine batch retry";
	if (dirtyPaths.length > 0) {
		const pathHint = dirtyPaths.slice(0, DIRTY_WORKTREE_PATH_HINT_LIMIT).join(" ");
		return `git checkout -- ${pathHint} && ${retryHint}`;
	}
	const worktreeHint =
		typeof ctx.laneWorktree === "string" && ctx.laneWorktree.trim().length > 0
			? ctx.laneWorktree
			: "<laneWorktree>";
	return `git -C ${worktreeHint} status --porcelain && ${retryHint}`;
}

/**
 * @param {object} ctx
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.failedTaskId]
 * @param {string} [ctx.tasksRoot]
 * @param {boolean | "review"} [ctx.contractTimedOut] SP-845: "review" marks a reviewCommand timeout.
 */
export function buildPrimaryFailureSuggestedCommand(ctx = {}) {
	if (LANE_COMMIT_EXIT_REASONS.has(ctx.exitReason ?? "")) {
		if (ctx.exitReason === "DirtyWorktree") {
			return buildDirtyWorktreeSuggestedCommand(ctx);
		}
		return ctx.failedTaskId
			? `spine batch retry ${ctx.failedTaskId}`
			: "spine status --diagnose";
	}
	if (ctx.exitReason === "review_exhausted") {
		return ctx.failedTaskId
			? `spine batch retry ${ctx.failedTaskId}`
			: "spine status --diagnose";
	}
	if (ctx.exitReason === "contract_failed" && ctx.contractTimedOut) {
		const retry = ctx.failedTaskId ? `spine batch retry ${ctx.failedTaskId}` : "spine batch resume";
		const suggested =
			ctx.contractTimedOut === "review"
				? CONTRACT_REVIEW_TIMEOUT_SUGGESTED_MS
				: CONTRACT_TIMEOUT_SUGGESTED_MS;
		const key = ctx.contractTimedOut === "review" ? "contract.reviewTimeoutMs" : "contract.testTimeoutMs";
		return `spine settings set ${key} ${suggested} && ${retry}`;
	}
	if (ctx.exitReason === "contract_failed") {
		const tasksRoot = ctx.tasksRoot ?? "spine-tasks";
		return ctx.failedTaskId
			? `edit ${tasksRoot}/${ctx.failedTaskId}/PROMPT.md then spine batch retry ${ctx.failedTaskId}`
			: "spine status --diagnose";
	}
	return null;
}
