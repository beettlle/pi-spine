/**
 * Alternative operator commands per diagnosis (extracted for module size budget).
 */
import { buildWorkerDoneMissingAlternatives } from "./diagnosis-worker-done-missing.mjs";

/**
 * @param {string} diagnosis
 * @param {object} [ctx]
 * @param {string|null} [ctx.failedTaskId]
 */
export function buildAlternatives(diagnosis, ctx = {}) {
	const common = ["spine status --diagnose"];

	switch (diagnosis) {
		case "limbo_stale":
			return ["spine batch complete --detect-manual-merge", ...common];
		case "completed_manual":
			return ["spine batch complete --detect-manual-merge", "spine batch dismiss", ...common];
		case "needs_retry":
			return ["spine batch abort", "/spine-skip-task", "/spine-resume --force", ...common];
		case "worker_orphaned":
			return ["spine batch abort", "spine batch resume --force", ...common];
		case "worker_done_missing":
			return buildWorkerDoneMissingAlternatives(ctx, common);
		case "engine_orphaned":
			return ctx.failedTaskId
				? [`spine batch retry ${ctx.failedTaskId}`, "spine batch abort", ...common]
				: ["spine batch abort", "spine batch resume --force", ...common];
		case "needs_merge":
			return ["/spine-status --diagnose", ...common];
		case "needs_integrate":
			return ["/spine-integrate", "/spine-gate", ...common];
		case "needs_replan":
			return ctx.failedTaskId
				? [`spine batch skip ${ctx.failedTaskId}`, "spine handoff", ...common]
				: ["spine handoff", ...common];
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
