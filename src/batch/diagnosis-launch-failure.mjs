// @ts-nocheck
/**
 * Worker launch failure inference for diagnosis headlines (SP-105, SP-421).
 */
import { isPrimaryTaskFailureExitReason } from "./diagnosis-primary-failure.mjs";

/**
 * @param {string} haystack
 * @param {object} [hints]
 * @param {boolean} [hints.launchingPhase]
 * @returns {string|null}
 */
function classifyLaunchFailureHaystack(haystack, hints = {}) {
	const normalized = haystack.toLowerCase();

	if (
		normalized.includes("dirtyworktree") ||
		normalized.includes("gitignoreddirtyworktree") ||
		normalized.includes("lane_commit_failed")
	) {
		return null;
	}

	if (hints.launchingPhase) {
		if (normalized.includes("pi_spine_root") || normalized.includes("config_pi_spine_root")) {
			return "pi_spine_root";
		}
		return "launch_failed";
	}

	if (normalized.includes("pi_spine_root") || normalized.includes("config_pi_spine_root")) {
		return "pi_spine_root";
	}

	if (
		normalized.includes("not a git repository") ||
		normalized.includes("worktree") ||
		normalized.includes("worktreeunhealthy")
	) {
		return "worktree_unhealthy";
	}

	return null;
}

/**
 * @param {object|null} failedEvent
 * @param {string|null} exitReason
 * @returns {string|null}
 */
function classifyLaunchFailureFromEvent(failedEvent, exitReason) {
	const payload = failedEvent?.payload && typeof failedEvent.payload === "object" ? failedEvent.payload : {};
	const haystack = [
		exitReason,
		payload.classification,
		payload.output,
		payload.exitReason,
	].filter(Boolean).join("\n");

	return classifyLaunchFailureHaystack(haystack, {
		launchingPhase:
			payload.workerPhase === "launching" || payload.classification === "launch_failed",
	});
}

/**
 * @param {string|null|undefined} outputText
 * @returns {string|null}
 */
export function inferLaunchFailureFromWorkerOutputTail(outputText) {
	if (!outputText || !String(outputText).trim()) return null;
	return classifyLaunchFailureHaystack(String(outputText));
}

/**
 * @param {object} ctx
 * @param {string|null} [ctx.exitReason]
 * @param {object[]} [ctx.journalEvents]
 * @param {string|null} [ctx.failedTaskId]
 * @returns {string|null}
 */
export function inferLaunchFailureKind(ctx = {}) {
	const { exitReason, journalEvents, failedTaskId } = ctx;
	if (isPrimaryTaskFailureExitReason(exitReason)) {
		return null;
	}
	if (exitReason === "launch_failed" || exitReason === "worker_launch_failed") {
		return "launch_failed";
	}

	const kinds = [];
	if (Array.isArray(journalEvents)) {
		const taskFailedEvents = journalEvents.filter((event) => event.type === "task.failed");
		const prioritized = failedTaskId
			? [
					...taskFailedEvents.filter(
						(event) => (event.taskId ?? event.payload?.taskId) === failedTaskId,
					),
					...taskFailedEvents.filter(
						(event) => (event.taskId ?? event.payload?.taskId) !== failedTaskId,
					),
				]
			: taskFailedEvents;

		for (const failedEvent of prioritized) {
			const kind = classifyLaunchFailureFromEvent(failedEvent, exitReason);
			if (kind) kinds.push(kind);
		}
	}

	if (kinds.includes("pi_spine_root")) return "pi_spine_root";
	if (kinds.includes("launch_failed")) return "launch_failed";
	if (kinds.includes("worktree_unhealthy")) return "worktree_unhealthy";
	return null;
}
