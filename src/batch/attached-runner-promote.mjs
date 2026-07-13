// @ts-nocheck
/**
 * Attached batch promote/exit paths — milestones, land-loop CLI, post-merge limbo (SP-586).
 * Pause/resume reconcile lives in attached-runner-reconcile.mjs (SP-604).
 */

import {
	ensureLandLoopFinalizedAfterGateOrIntegrate,
	finalizeAttachedLandLoopBeforeExit,
	finalizeResumedBatchForIntegrate,
	isPostMergeLimbo,
} from "./post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { readJournalEvents, readJournalEventsCached } from "./journal.mjs";
import { enforceOperatorPauseOnDisk } from "./pause.mjs";
import { loadSpineBatchState, saveSpineBatchState } from "./state.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveAttachedMilestonePollMs } from "../config/spine-config-schema.mjs";
import { startParentSessionMonitor } from "./parent-session-monitor.mjs";
import {
	enforceAttachedEngineSingleOwner,
	reconcilePausedResumeDoneInLane,
} from "./attached-runner-reconcile.mjs";

export { DEFAULT_ATTACHED_MILESTONE_POLL_MS } from "../config/spine-config-schema.mjs";

/** Journal types that mean the land loop is done and a stuck resume engine should exit (#198). */
const HOST_LAND_LOOP_EXIT_TYPES = new Set([
	"integrate.completed",
	"gate.approved",
]);

/** Journal types that mean gate/integrate artifacts exist and finalize should run. */
const LAND_LOOP_ENSURE_TYPES = new Set([
	"gate.opened",
	"gate.approved",
	"integrate.completed",
	"batch.land_loop_finalized",
]);

/**
 * When host opens/approves the gate or integrates while this engine is mid-evidence,
 * finalize land-loop artifacts and exit so we are not a zombie PID (#198 / SP-636).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.event
 * @param {(code?: number) => void} [params.exitProcess]
 */
export function maybeFinalizeAttachedEngineAfterHostLandLoop({
	projectRoot,
	event,
	exitProcess = (code) => process.exit(code),
}) {
	const type = String(event?.type ?? "");
	if (!LAND_LOOP_ENSURE_TYPES.has(type)) {
		return { handled: false, reason: "not_land_loop_event" };
	}

	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw?.batchId) {
		return { handled: false, reason: "no_active_batch" };
	}

	const state = loaded.raw;
	const batchId = String(state.batchId);
	const resumed = readJournalEvents(projectRoot, batchId).some(
		(entry) => entry.type === "batch.resumed",
	);
	const ensured = ensureLandLoopFinalizedAfterGateOrIntegrate({
		projectRoot,
		state,
		batchId,
		resumed,
		resumeForced: Boolean(state.resilience?.resumeForced),
		source: "attached_milestone_host_land_loop",
	});

	if (!ensured) {
		return { handled: false, reason: "ensure_not_applicable" };
	}

	if (HOST_LAND_LOOP_EXIT_TYPES.has(type) || ensured.shouldExit) {
		exitProcess(0);
		return { handled: true, action: "exited_after_host_land_loop", batchId, result: ensured };
	}

	return {
		handled: true,
		action: ensured.changed ? "finalized_after_gate_opened" : "already_finalized",
		batchId,
		result: ensured,
	};
}

/** @type {boolean} */
let attachedExitHandlersInstalled = false;

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
	"gate.evidence_collecting",
	"gate.evidence_completed",
	"gate.evidence_failed",
	"batch.land_loop_finalized",
	"batch.completed",
]);

/**
 * Install journal-aware SIGTERM/SIGINT handlers before attached engine exit (SP-378).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} [params.spineBin]
 */
export function installAttachedExitFinalizeHandlers({ projectRoot, spineBin }) {
	if (attachedExitHandlersInstalled) return;
	attachedExitHandlersInstalled = true;

	const onShutdown = (signal) => {
		const handoff = finalizeAttachedLandLoopBeforeExit({ projectRoot, spineBin, signal });
		if (handoff.handled) {
			process.exit(0);
		}
	};

	process.once("SIGTERM", () => onShutdown("SIGTERM"));
	process.once("SIGINT", () => onShutdown("SIGINT"));
}

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
 * @param {number} [params.pollIntervalMs]
 * @param {(code?: number) => void} [params.exitProcess]
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function startAttachedMilestoneReporter({
	projectRoot,
	write = (line) => process.stdout.write(line),
	pollIntervalMs,
	exitProcess = (code) => process.exit(code),
}) {
	const configResult = loadSpineConfig(projectRoot);
	const resolvedPollMs =
		pollIntervalMs ??
		resolveAttachedMilestonePollMs({ config: configResult.config ?? {} });
	/** @type {Set<string>} */
	const printed = new Set();
	let batchId = null;
	let stopped = false;

	const emitAndMaybeFinalize = (event) => {
		const key = milestoneEventKey(event);
		if (printed.has(key)) return;
		const type = String(event.type ?? "");
		const isMilestone = ATTACHED_LAND_LOOP_MILESTONE_TYPES.has(type);
		const isLandLoopEnsure = LAND_LOOP_ENSURE_TYPES.has(type);
		if (!isMilestone && !isLandLoopEnsure) return;
		printed.add(key);
		if (isMilestone) {
			write(formatAttachedMilestoneLine(event));
		}
		if (isLandLoopEnsure) {
			maybeFinalizeAttachedEngineAfterHostLandLoop({
				projectRoot,
				event,
				exitProcess,
			});
		}
	};

	const loop = async () => {
		while (!stopped) {
			enforceOperatorPauseOnDisk(projectRoot);
			if (!batchId) {
				const loaded = loadSpineBatchState(projectRoot);
				batchId = loaded.raw?.batchId ? String(loaded.raw.batchId) : null;
			}
			if (batchId) {
				const events = readJournalEventsCached(projectRoot, batchId);
				for (const event of events) {
					emitAndMaybeFinalize(event);
				}
			}
			await sleep(resolvedPollMs);
		}
	};

	const loopPromise = loop();

	return {
		stop: async () => {
			stopped = true;
			await loopPromise;
			if (batchId) {
				const events = readJournalEventsCached(projectRoot, batchId);
				for (const event of events) {
					emitAndMaybeFinalize(event);
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
 * @param {boolean} [params.force]
 * @param {"start"|"resume"} [params.operation]
 */
export async function runAttachedBatchEngine({
	projectRoot,
	runEngine,
	write,
	spineBin,
	_force = false,
	operation = "resume",
}) {
	if (operation === "start") {
		const lock = enforceAttachedEngineSingleOwner({ projectRoot, force: false, operation: "start" });
		if (!lock.ok) {
			return {
				ok: false,
				exitCode: lock.exitCode ?? 1,
				error: lock.error,
				output: lock.output,
				batchId: lock.batchId,
			};
		}
	}

	installAttachedExitFinalizeHandlers({ projectRoot, spineBin });
	const reporter = await startAttachedMilestoneReporter({ projectRoot, write });
	/** @type {{ stop: () => Promise<void> }} */
	let parentMonitor = { stop: async () => {} };
	if (process.env.SPINE_ALLOW_ATTACHED_HARNESS !== "1") {
		parentMonitor = await startParentSessionMonitor({
			projectRoot,
			onParentDied: () => {
				process.exit(1);
			},
		});
	}
	try {
		const result = await runEngine();
		const handoff = finalizeAttachedLandLoopBeforeExit({ projectRoot, spineBin, signal: "exit" });
		if (handoff.handled && handoff.action === "finalized_in_process" && handoff.result) {
			return handoff.result;
		}
		return result;
	} finally {
		await parentMonitor.stop();
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
	const loaded = loadSpineBatchState(projectRoot);
	if (loaded.raw?.batchId) {
		reconcilePausedResumeDoneInLane({
			projectRoot,
			state: loaded.raw,
			batchId: String(loaded.raw.batchId),
		});
	}
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
export function finishAttachedBatchCli(cli, { deferExit = false, projectRoot, spineBin } = {}) {
	const exitCode = cli.exitCode ?? 1;
	if (cli.output) {
		process.stdout.write(cli.output);
	}
	if (deferExit) {
		return;
	}
	if (projectRoot) {
		finalizeAttachedLandLoopBeforeExit({ projectRoot, spineBin, signal: "cli_exit" });
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
