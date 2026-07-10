// @ts-nocheck
/**
 * Attached pause/resume reconcile paths — handoff locks, single-owner enforce,
 * and paused-resume `.DONE` promotion (SP-604).
 */

import fs from "node:fs";
import path from "node:path";
import { isProcessAlive } from "../process/liveness.mjs";
import { terminateStaleDetachedEngine } from "./resume-engine.mjs";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import {
	loadSpineBatchState,
	readBatchEnginePid,
	saveSpineBatchState,
	updateSegmentForTask,
	recomputeTaskCounters,
	clearBatchEnginePid,
} from "./state.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import {
	journalHasContractVerified,
	journalIndicatesPausedForceResume,
} from "./orphan-detect.mjs";
import { classifyTaskDoneSemantics } from "./diagnosis-task-done.mjs";
import { laneDoneMarkerReadyForPromote } from "./journal-rebuild.mjs";
import { resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { journalHasTaskCompleted } from "./resume-common.mjs";

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
		if (
			!laneDoneMarkerReadyForPromote({
				projectRoot,
				batchId,
				task,
				lanes,
				classified,
			})
		) {
			continue;
		}
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
