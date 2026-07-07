// @ts-nocheck
/**
 * Attached batch foreground runner — milestones, integrate handoff, CLI exit (SP-343, GitHub #34).
 * Post-merge limbo resume fast path (SP-348, GitHub #39).
 */

import fs from "node:fs";
import path from "node:path";
import {
	finalizeAttachedLandLoopBeforeExit,
	finalizeResumedBatchForIntegrate,
	isPostMergeLimbo,
} from "./post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { readJournalEventsCached, readJournalEvents, appendJournalEvent } from "./journal.mjs";
import { enforceOperatorPauseOnDisk } from "./pause.mjs";
import {
	loadSpineBatchState,
	readBatchEnginePid,
	saveSpineBatchState,
	updateSegmentForTask,
	recomputeTaskCounters,
	clearBatchEnginePid,
} from "./state.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveAttachedMilestonePollMs } from "../config/spine-config-schema.mjs";
import {
	journalHasContractVerified,
	journalIndicatesPausedForceResume,
} from "./orphan-detect.mjs";
import { classifyTaskDoneSemantics } from "./diagnosis-task-done.mjs";
import { resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { journalHasTaskCompleted } from "./resume-common.mjs";

export { DEFAULT_ATTACHED_MILESTONE_POLL_MS } from "../config/spine-config-schema.mjs";

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
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function startAttachedMilestoneReporter({
	projectRoot,
	write = (line) => process.stdout.write(line),
	pollIntervalMs,
}) {
	const configResult = loadSpineConfig(projectRoot);
	const resolvedPollMs =
		pollIntervalMs ??
		resolveAttachedMilestonePollMs({ config: configResult.config ?? {} });
	/** @type {Set<string>} */
	const printed = new Set();
	let batchId = null;
	let stopped = false;

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
					const key = milestoneEventKey(event);
					if (printed.has(key)) continue;
					if (!ATTACHED_LAND_LOOP_MILESTONE_TYPES.has(String(event.type ?? ""))) continue;
					printed.add(key);
					write(formatAttachedMilestoneLine(event));
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
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function resumeHandoffLockPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "resume-handoff.lock");
}

/**
 * Exclusive lock for forced resume handoff (SP-533 / #167).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {boolean} [allowRetry]
 * @returns {{ ok: true, release: () => void } | { ok: false, holderPid?: number|null, startedAt?: number }}
 */
export function tryAcquireResumeHandoffLock(projectRoot, batchId, allowRetry = true) {
	const lockPath = resumeHandoffLockPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(lockPath), { recursive: true });
	const payload = JSON.stringify({ pid: process.pid, startedAt: Date.now() });

	try {
		fs.writeFileSync(lockPath, payload, { encoding: "utf-8", flag: "wx" });
		return {
			ok: true,
			release: () => releaseResumeHandoffLock(projectRoot, batchId),
		};
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code !== "EEXIST") {
			throw err;
		}
	}

	/** @type {{ pid?: number, startedAt?: number } | null} */
	let holder = null;
	try {
		holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
	} catch {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			/* ignore stale corrupt lock cleanup */
		}
		if (allowRetry) {
			return tryAcquireResumeHandoffLock(projectRoot, batchId, false);
		}
		return { ok: false, holderPid: null };
	}

	const holderPid = Number(holder?.pid);
	if (Number.isFinite(holderPid) && holderPid > 0 && isProcessAlive(holderPid)) {
		return {
			ok: false,
			holderPid,
			startedAt: Number(holder?.startedAt) || undefined,
		};
	}

	try {
		fs.unlinkSync(lockPath);
	} catch {
		/* ignore stale lock cleanup */
	}

	try {
		fs.writeFileSync(lockPath, payload, { encoding: "utf-8", flag: "wx" });
		return {
			ok: true,
			release: () => releaseResumeHandoffLock(projectRoot, batchId),
		};
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code === "EEXIST") {
			return { ok: false, holderPid: Number.isFinite(holderPid) ? holderPid : null };
		}
		throw err;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function releaseResumeHandoffLock(projectRoot, batchId) {
	const lockPath = resumeHandoffLockPath(projectRoot, batchId);
	try {
		if (!fs.existsSync(lockPath)) return;
		const holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
		if (Number(holder?.pid) === process.pid) {
			fs.unlinkSync(lockPath);
		}
	} catch {
		/* ignore release races */
	}
}

/**
 * Reject a second attached engine when resilience.enginePid is alive (SP-434, GitHub #89).
 * Serialized forced resume handoff when another resume --force is in flight (SP-533, #167).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.force] Orphan-terminate prior engine before handoff
 * @param {"start"|"resume"} [params.operation]
 */
export function enforceAttachedEngineSingleOwner({ projectRoot, force = false, operation = "resume" }) {
	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	if (!state) {
		return { ok: true };
	}

	const batchId = String(state.batchId ?? "");
	/** @type {(() => void) | undefined} */
	let releaseResumeLock;

	if (force && operation === "resume") {
		const lock = tryAcquireResumeHandoffLock(projectRoot, batchId);
		if (!lock.ok) {
			const enginePid = readBatchEnginePid(state);
			const holderPid = lock.holderPid ?? null;
			const output =
				`Another batch resume --force is already in progress (batch ${batchId}` +
				`${holderPid ? `, holder PID ${holderPid}` : ""}).\n` +
				`Wait for the in-flight forced resume to finish before starting another.\n`;
			return {
				ok: false,
				exitCode: 1,
				error: "concurrent_resume_blocked",
				output,
				batchId,
				enginePid,
				holderPid,
			};
		}
		releaseResumeLock = lock.release;
		appendJournalEvent(projectRoot, batchId, "batch.resume_handoff_started", {
			pid: process.pid,
		});
	}

	const enginePid = readBatchEnginePid(state);
	if (enginePid == null || enginePid === process.pid || !isProcessAlive(enginePid)) {
		return releaseResumeLock ? { ok: true, releaseResumeLock } : { ok: true };
	}

	const fromPhase = String(state.phase ?? "");
	if (force) {
		const terminateResult = terminateStaleDetachedEngine({
			projectRoot,
			state,
			batchId,
			fromPhase,
			allowRunningOrphanTerminate: true,
		});
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
		return {
			ok: true,
			handoff: true,
			terminated: terminateResult.terminated,
			stalePid: terminateResult.stalePid ?? enginePid,
			releaseResumeLock,
		};
	}

	const operationLabel = operation === "start" ? "start" : "resume";
	const output =
		`Attached batch engine already running (PID ${enginePid}, batch ${batchId}).\n` +
		`Stop the existing engine or run spine batch ${operationLabel} --attached --force to orphan it first.\n`;
	return {
		ok: false,
		exitCode: 1,
		error: "attached_engine_already_running",
		output,
		batchId,
		enginePid,
	};
}

/**
 * Promote running cache tasks with lane `.DONE` and contract verify after paused force resume (SP-513 / #184).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 * @returns {{ reconciled: boolean, taskIds?: string[] }}
 */
export function reconcilePausedResumeDoneInLane({ projectRoot, state, batchId }) {
	if (!state || typeof state !== "object" || !batchId) {
		return { reconciled: false };
	}

	const journalEvents = readJournalEvents(projectRoot, batchId);
	if (!journalIndicatesPausedForceResume(journalEvents)) {
		return { reconciled: false };
	}

	const configResult = loadSpineConfig(projectRoot);
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	const lanes = state.lanes ?? [];
	/** @type {string[]} */
	const promotedTaskIds = [];
	let changed = false;

	for (const task of state.tasks ?? []) {
		const status = String(task?.status ?? "").toLowerCase();
		if (status !== "running" && status !== "pending") continue;

		const classified = classifyTaskDoneSemantics(task, {
			tasksRoot,
			projectRoot,
			batchId,
			lanes,
		});
		if (classified.doneInLane !== true) continue;
		if (!journalHasContractVerified(journalEvents, task.taskId)) continue;

		task.status = "succeeded";
		task.doneFileFound = true;
		task.exitReason = task.exitReason ?? "done";
		if (!task.endedAt) task.endedAt = Date.now();
		updateSegmentForTask(state, task.taskId, "succeeded");
		promotedTaskIds.push(task.taskId);
		changed = true;

		if (!journalHasTaskCompleted(journalEvents, task.taskId)) {
			const laneNumber = Number(task.laneNumber ?? 1);
			const lane = lanes.find((entry) => Number(entry?.laneNumber) === laneNumber);
			appendJournalEvent(projectRoot, batchId, "task.completed", {
				taskId: task.taskId,
				laneNumber,
				laneId: lane?.laneId ?? `lane-${laneNumber}`,
				resumed: true,
				skippedDoneOnDisk: true,
				reconciled: true,
			});
		}
	}

	if (!changed) {
		return { reconciled: false };
	}

	const enginePid = readBatchEnginePid(state);
	if (enginePid != null && !isProcessAlive(enginePid)) {
		clearBatchEnginePid(state);
	}

	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	return { reconciled: true, taskIds: promotedTaskIds };
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
	try {
		const result = await runEngine();
		const handoff = finalizeAttachedLandLoopBeforeExit({ projectRoot, spineBin, signal: "exit" });
		if (handoff.handled && handoff.action === "finalized_in_process" && handoff.result) {
			return handoff.result;
		}
		return result;
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
