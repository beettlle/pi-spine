/**
 * Attached batch foreground runner — milestones, integrate handoff, CLI exit (SP-343, GitHub #34).
 * Post-merge limbo resume fast path (SP-348, GitHub #39).
 */

import { finalizeResumedBatchForIntegrate, isPostMergeLimbo } from "./post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { readJournalEvents } from "./journal.mjs";
import { loadSpineBatchState, saveSpineBatchState } from "./state.mjs";

/** Journal types surfaced on attached stdout during the land loop. */
export const ATTACHED_LAND_LOOP_MILESTONE_TYPES = new Set([
	"batch.started",
	"task.started",
	"task.completed",
	"task.failed",
	"batch.merge_started",
	"batch.merge_completed",
	"batch.merge_blocked",
	"gate.opened",
	"batch.land_loop_finalized",
	"batch.completed",
]);

const ATTACHED_MILESTONE_POLL_MS = 200;

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} event
 */
function milestoneEventKey(event) {
	if (typeof event.eventId === "string" && event.eventId) {
		return event.eventId;
	}
	const taskId = typeof event.taskId === "string" ? event.taskId : "";
	const timestamp = typeof event.timestamp === "string" ? event.timestamp : String(event.timestamp ?? "");
	return `${event.type ?? "unknown"}:${timestamp}:${taskId}`;
}

/**
 * @param {object} event
 * @returns {string}
 */
export function formatAttachedMilestoneLine(event) {
	const type = String(event.type ?? "unknown");
	const taskId = typeof event.taskId === "string" && event.taskId ? ` ${event.taskId}` : "";
	const payload =
		event.payload && typeof event.payload === "object" ? /** @type {Record<string, unknown>} */ (event.payload) : {};
	const waveIndex = payload.waveIndex;
	const waveSuffix =
		typeof waveIndex === "number" &&
		(type === "batch.merge_started" || type === "batch.merge_completed" || type === "batch.merge_blocked")
			? ` wave=${waveIndex}`
			: "";
	return `[spine] ${type}${taskId}${waveSuffix}\n`;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {(line: string) => void} [params.write]
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function startAttachedMilestoneReporter({ projectRoot, write = (line) => process.stdout.write(line) }) {
	/** @type {Set<string>} */
	const printed = new Set();
	let batchId = null;
	let stopped = false;

	const loop = async () => {
		while (!stopped) {
			if (!batchId) {
				const loaded = loadSpineBatchState(projectRoot);
				batchId = loaded.raw?.batchId ? String(loaded.raw.batchId) : null;
			}
			if (batchId) {
				const events = readJournalEvents(projectRoot, batchId);
				for (const event of events) {
					const key = milestoneEventKey(event);
					if (printed.has(key)) continue;
					if (!ATTACHED_LAND_LOOP_MILESTONE_TYPES.has(String(event.type ?? ""))) continue;
					printed.add(key);
					write(formatAttachedMilestoneLine(event));
				}
			}
			await sleep(ATTACHED_MILESTONE_POLL_MS);
		}
	};

	const loopPromise = loop();

	return {
		stop: async () => {
			stopped = true;
			await loopPromise;
			if (batchId) {
				const events = readJournalEvents(projectRoot, batchId);
				for (const event of events) {
					const key = milestoneEventKey(event);
					if (printed.has(key)) continue;
					if (!ATTACHED_LAND_LOOP_MILESTONE_TYPES.has(String(event.type ?? ""))) continue;
					printed.add(key);
					write(formatAttachedMilestoneLine(event));
				}
			}
		},
	};
}

/**
 * Run an attached foreground engine while streaming land-loop journal milestones to stdout.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {() => Promise<object>} params.runEngine
 * @param {(line: string) => void} [params.write]
 */
export async function runAttachedBatchEngine({ projectRoot, runEngine, write }) {
	const reporter = await startAttachedMilestoneReporter({ projectRoot, write });
	try {
		return await runEngine();
	} finally {
		await reporter.stop();
	}
}

/**
 * @param {object} result
 * @param {import("./reconcile.mjs").ReconciliationResult} reconciliation
 */
function resolveAttachedBatchExitCode(result, reconciliation) {
	if (reconciliation.phase === "merge_blocked") {
		return result.exitCode ?? 1;
	}
	return result.exitCode ?? (result.ok ? 0 : 1);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {"start"|"resume"} params.operation
 * @param {object} params.result
 * @param {boolean} [params.json]
 */
export function formatAttachedBatchCliResult({ projectRoot, operation, result, json = false }) {
	const reconciliation = reconcileBatch({ projectRoot });
	const mergeBlocked = reconciliation.phase === "merge_blocked";

	if (json) {
		return {
			exitCode: resolveAttachedBatchExitCode(result, reconciliation),
			output: `${JSON.stringify({ ...result, reconciliation }, null, 2)}\n`,
		};
	}

	const operationLabel = operation === "resume" ? "resumed" : "started";
	const headline = result.ok
		? `Batch ${operationLabel}`
		: mergeBlocked && reconciliation.headline
			? reconciliation.headline
			: operation === "resume"
				? "Batch resume failed"
				: "Batch start failed";

	/** @type {string[]} */
	const lines = ["", headline, ""];

	if (result.output) {
		lines.push(result.output.trimEnd());
	} else if (result.error && !mergeBlocked) {
		lines.push(String(result.error));
	}

	if (reconciliation.headline && reconciliation.headline !== headline) {
		lines.push("", reconciliation.headline);
	}
	if (reconciliation.suggestedCommand) {
		lines.push("", `  → ${reconciliation.suggestedCommand}`);
	}
	if (reconciliation.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of reconciliation.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	if (result.batchId) {
		lines.push("", `  Batch: ${result.batchId}`);
	}
	if (result.taskId) {
		lines.push(`  Task: ${result.taskId}`);
	}

	lines.push("");
	return {
		exitCode: resolveAttachedBatchExitCode(result, reconciliation),
		output: lines.join("\n"),
	};
}

/**
 * Write attached CLI output and exit so the foreground process does not linger after batch.completed.
 *
 * @param {{ exitCode?: number, output?: string }} cli
 * @param {object} [options]
 * @param {boolean} [options.deferExit]
 */
export function finishAttachedBatchCli(cli, { deferExit = false } = {}) {
	const exitCode = cli.exitCode ?? 1;
	if (cli.output) {
		process.stdout.write(cli.output);
	}
	if (deferExit) {
		return;
	}
	process.exit(exitCode);
}

/**
 * Finalize post-merge limbo during resume without re-running workers.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @param {string} params.orchBranch
 * @param {string} [params.fromPhase]
 * @param {boolean} [params.resumeForced]
 * @returns {ReturnType<typeof finalizeResumedBatchForIntegrate>|null}
 */
export function finalizeResumePostMergeLimbo({
	projectRoot,
	state,
	batchId,
	orchBranch,
	fromPhase = "running",
	resumeForced = false,
}) {
	if (String(state.phase ?? "") === "completed") {
		return null;
	}
	if (!detectPostMergeLimboForResume({ projectRoot, state }) && !isPostMergeLimbo(state)) {
		return null;
	}

	terminateStaleDetachedEngine({
		projectRoot,
		state,
		batchId,
		fromPhase,
	});
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

	return finalizeResumedBatchForIntegrate({
		projectRoot,
		state,
		batchId,
		orchBranch,
		resumeForced,
	});
}
