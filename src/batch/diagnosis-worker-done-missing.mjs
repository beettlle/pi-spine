// @ts-nocheck
/**
 * Worker exited without `.DONE` diagnosis helpers (SP-313 / issue #18).
 */

/** Worker exited cleanly but never wrote `.DONE`. */
export const WORKER_DONE_MISSING_OUTPUT_MARKERS = [
	"pi exited but .DONE was not created",
	"agent session finished but .DONE was not created",
];

/**
 * @param {string|null|undefined} outputText
 * @returns {boolean}
 */
export function outputIndicatesWorkerDoneMissing(outputText) {
	if (!outputText || !String(outputText).trim()) return false;
	const normalized = String(outputText).toLowerCase();
	return WORKER_DONE_MISSING_OUTPUT_MARKERS.some((marker) =>
		normalized.includes(marker.toLowerCase()),
	);
}

/**
 * @param {object} [ctx]
 * @param {object[]} [ctx.journalEvents]
 * @param {string|null} [ctx.failedTaskId]
 * @returns {object|null}
 */
export function inferWorkerDoneMissingFailure(ctx = {}) {
	const { journalEvents, failedTaskId } = ctx;
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return null;

	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event.type !== "task.failed") continue;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		if (failedTaskId && eventTaskId && eventTaskId !== failedTaskId) continue;

		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (payload.doneFound === true) continue;

		const outputText = [payload.output, payload.error].filter(Boolean).join("\n");
		if (!outputIndicatesWorkerDoneMissing(outputText)) continue;

		const changedFileCount = Number(payload.changedFileCount);

		return {
			taskId: eventTaskId ?? failedTaskId ?? null,
			output: outputText || null,
			workerOutputLogRef:
				typeof payload.workerOutputLogRef === "string" ? payload.workerOutputLogRef : null,
			workerOutputLogPath:
				typeof payload.workerOutputLogPath === "string" ? payload.workerOutputLogPath : null,
			changedFileCount: Number.isFinite(changedFileCount) ? changedFileCount : null,
			exitCode: payload.exitCode ?? null,
			doneFound: payload.doneFound === false,
		};
	}

	return null;
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 */
export function buildWorkerDoneMissingHeadline(batchLabel, ctx = {}) {
	const taskLabel = ctx.failedTaskId ? `task ${ctx.failedTaskId}` : "worker";
	const fileHint =
		ctx.changedFileCount === 0
			? " (0 scoped files)"
			: ctx.changedFileCount != null
				? ` (${ctx.changedFileCount} scoped file(s))`
				: "";
	const logRef = ctx.workerOutputLogRef ?? ctx.workerOutputLogPath ?? null;
	const logHint = logRef ? ` — see ${logRef}` : "";
	const tail = ctx.workerOutputTail?.trim();
	const tailHint = tail
		? `: ${tail.split("\n").filter(Boolean).slice(-3).join(" | ")}`
		: ctx.workerOutputSnippet
			? `: ${ctx.workerOutputSnippet}`
			: "";
	return `${batchLabel} ${taskLabel} exited without .DONE${fileHint}${logHint}${tailHint}`;
}

/** @param {object} ctx */
export function buildWorkerDoneMissingSuggestedCommand(ctx = {}) {
	return ctx.failedTaskId ? `spine batch retry ${ctx.failedTaskId}` : "spine status --diagnose";
}

/** @param {object} ctx @param {string[]} common */
export function buildWorkerDoneMissingAlternatives(ctx = {}, common = []) {
	return ctx.failedTaskId
		? [`spine batch retry ${ctx.failedTaskId}`, "spine status --diagnose", ...common]
		: common;
}
