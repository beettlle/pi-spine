/**
 * FR-BATCH-13 diagnosis taxonomy and operator messaging (§18.3).
 */

/** @typedef {import("./reconcile.mjs").ReconciliationResult} ReconciliationResult */

export const DIAGNOSIS_TAXONOMY = [
	"running",
	"paused",
	"needs_retry",
	"engine_orphaned",
	"needs_merge",
	"needs_integrate",
	"completed",
	"completed_manual",
	"limbo_stale",
	"failed",
	"aborted",
];

const NO_PAUSE_DIAGNOSES = new Set(["limbo_stale", "completed_manual", "needs_integrate"]);

/**
 * @param {string} diagnosis
 * @param {object} [ctx]
 * @param {string|null} [ctx.failedTaskId]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.salvageRetryCommand]
 */
export function buildSuggestedCommand(diagnosis, ctx = {}) {
	switch (diagnosis) {
		case "limbo_stale":
		case "completed_manual":
			return "spine batch dismiss";
		case "needs_retry":
			if (ctx.salvageRetryCommand) return ctx.salvageRetryCommand;
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine status --diagnose";
		case "engine_orphaned":
			return ctx.failedTaskId
				? `spine batch retry ${ctx.failedTaskId}`
				: "spine batch abort";
		case "needs_merge":
			return "/spine-resume --force";
		case "needs_integrate":
			return "spine integrate";
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
 */
export function buildHeadline(diagnosis, ctx = {}) {
	const batchLabel = ctx.batchId ? `Batch ${ctx.batchId}` : "Batch";

	switch (diagnosis) {
		case "limbo_stale":
			return `${batchLabel} finished but state is stale — dismiss to clear`;
		case "completed_manual":
			return `${batchLabel} work is on main but batch record is still active`;
		case "needs_retry":
			if (ctx.salvageChangedFileCount > 0 && ctx.failedTaskId) {
				return `${batchLabel} failed (${ctx.failedTaskId}): ${ctx.salvageChangedFileCount} uncommitted file(s) in scope`;
			}
			return ctx.failedTaskId
				? `${batchLabel} worker died while task ${ctx.failedTaskId} was running — retry or abort`
				: `${batchLabel} has failed tasks — retry before resume`;
		case "engine_orphaned":
			return ctx.failedTaskId
				? `${batchLabel} engine died mid-run (task ${ctx.failedTaskId} still running) — retry or abort`
				: `${batchLabel} batch engine died while running — retry or abort`;
		case "needs_merge":
			return `${batchLabel} tasks done — lane merges pending`;
		case "needs_integrate":
			return `${batchLabel} ready to integrate orch branch to main`;
		case "running":
			return `${batchLabel} is running`;
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
export function buildAlternatives(diagnosis) {
	const common = ["spine status --diagnose"];

	switch (diagnosis) {
		case "limbo_stale":
			return ["spine batch complete --detect-manual-merge", ...common];
		case "completed_manual":
			return ["spine batch complete --detect-manual-merge", "spine batch dismiss", ...common];
		case "needs_retry":
			return ["spine batch abort", "/spine-skip-task", "/spine-resume --force", ...common];
		case "engine_orphaned":
			return ["spine batch abort", "spine batch resume --force", ...common];
		case "needs_merge":
			return ["/spine-status --diagnose", ...common];
		case "needs_integrate":
			return ["/spine-integrate", "/spine-gate", ...common];
		case "running":
			return ["/spine-pause", "/spine-abort", ...common];
		case "paused":
			return ["spine batch resume --force", "spine status --diagnose", ...common];
		case "failed":
			return ["/spine-retry-task", ...common];
		default:
			return common;
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
		alternatives: buildAlternatives(diagnosis),
	};
}
