/**
 * Review-infrastructure exit reasons and failure-exit-reason resolution shared
 * by `reconcile-diagnosis.mjs` and `diagnosis-pending-lane.mjs` (SP-821/#334).
 * Leaf module — importing it from anywhere in `src/batch/` keeps the import
 * graph acyclic (checked by tests/arch/import-cycles.test.mjs).
 */

/**
 * Exit reasons where reviewer *infrastructure* failed: the reviewer failed to
 * spawn, timed out, or hit a provider error, so no verdict was produced. The
 * implementation itself is not the failure (#291 / SP-718). Covers all three
 * engine review types; the provider-error variants were added by SP-820.
 *
 * @type {ReadonlySet<string>}
 */
export const REVIEW_INFRASTRUCTURE_EXIT_REASONS = new Set([
	"plan_review_spawn_failed",
	"plan_review_timeout",
	"plan_review_provider_error",
	"code_review_spawn_failed",
	"code_review_timeout",
	"code_review_provider_error",
	"final_review_spawn_failed",
	"final_review_timeout",
	"final_review_provider_error",
]);

/**
 * @param {string|null|undefined} exitReason
 * @returns {boolean}
 */
export function isReviewInfraExitReason(exitReason) {
	return REVIEW_INFRASTRUCTURE_EXIT_REASONS.has(String(exitReason ?? ""));
}

/**
 * Review type ("plan" | "code" | "final") for a review-infra exit reason.
 *
 * @param {string|null|undefined} exitReason
 * @returns {string|null}
 */
export function resolveReviewInfraType(exitReason) {
	const match = String(exitReason ?? "").match(/^(plan|code|final)_review_(?:spawn_failed|timeout|provider_error)$/);
	return match ? (match[1] ?? null) : null;
}

/**
 * @param {string|null|undefined} exitReason
 * @returns {boolean}
 */
export function isReviewInfraProviderError(exitReason) {
	return String(exitReason ?? "").endsWith("_provider_error");
}

/**
 * @param {unknown} rawTasks
 * @param {string|null} failedTaskId
 * @returns {string|null}
 */
export function resolveFailedExitReason(rawTasks, failedTaskId) {
	if (!failedTaskId || !Array.isArray(rawTasks)) return null;
	const match = rawTasks.find((/** @type {any} */ entry) => {
		if (!entry || typeof entry !== "object") return false;
		return String(entry.taskId ?? entry.id ?? "") === failedTaskId;
	});
	if (!match || typeof match !== "object") return null;
	const exitReason = /** @type {{ exitReason?: unknown }} */ (match).exitReason;
	return typeof exitReason === "string" && exitReason ? exitReason : null;
}

/**
 * @param {string|null} failedTaskId
 * @param {Record<string, any>} signals
 * @returns {string|null}
 */
export function resolvePrimaryFailureExitReason(failedTaskId, signals) {
	const fromTask = resolveFailedExitReason(signals.raw?.tasks, failedTaskId);
	if (fromTask) return fromTask;
	if (!failedTaskId) return null;
	if (Array.isArray(signals.segments)) {
		const segment = signals.segments.find((/** @type {any} */ entry) => entry?.taskId === failedTaskId);
		const classification = segment?.classification;
		if (
			typeof classification === "string" &&
			classification &&
			classification !== "terminal-failure"
		) {
			return classification;
		}
	}
	if (Array.isArray(signals.journalEvents)) {
		for (let index = signals.journalEvents.length - 1; index >= 0; index -= 1) {
			const event = signals.journalEvents[index];
			if (event.type !== "task.failed") continue;
			const eventTaskId = event.taskId ?? event.payload?.taskId;
			if (eventTaskId !== failedTaskId) continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			const reason = payload.exitReason ?? payload.classification;
			if (typeof reason === "string" && reason) return reason;
		}
	}
	return null;
}

/**
 * Exit reason for a classified task entry: the entry's own `exitReason` when
 * present, else the primary failure resolution (raw state → segments →
 * journal `task.failed`). Parsed batch-state tasks drop `exitReason`
 * (normalizeTasks), so the fallback keeps journal-only timelines working.
 *
 * @param {Record<string, any>|null|undefined} task
 * @param {Record<string, any>} signals
 * @returns {string|null}
 */
export function resolveTaskPrimaryFailureExitReason(task, signals) {
	const fromTask = task?.exitReason;
	if (typeof fromTask === "string" && fromTask) return fromTask;
	return resolvePrimaryFailureExitReason(String(task?.taskId ?? ""), signals);
}

/**
 * Headline for a needs_retry diagnosis caused by a review-infrastructure exit
 * reason: the reviewer produced no verdict, so the review should re-run —
 * not salvage-integrate unreviewed code (SP-821/#334, reversing SP-762).
 * Provider-error variants point at `spine doctor` for launch diagnosis.
 *
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.failedTaskId]
 * @returns {string|null} null when `ctx.exitReason` is not a review-infra reason
 */
export function buildReviewInfraHeadline(batchLabel, ctx = {}) {
	const exitReason = ctx.exitReason ?? "";
	if (!isReviewInfraExitReason(exitReason)) return null;
	const reviewType = resolveReviewInfraType(exitReason) ?? "review";
	const providerError = isReviewInfraProviderError(exitReason);
	const problem = providerError
		? `${reviewType} review hit a provider error`
		: `${reviewType} review produced no verdict`;
	const taskSuffix = ctx.failedTaskId ? ` for task ${ctx.failedTaskId}` : "";
	const doctorSuffix = providerError ? " — run spine doctor" : "";
	return `${batchLabel} ${problem}${taskSuffix} (lane work is done) — re-run the review${doctorSuffix}`;
}
