// @ts-check
/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import { readAbortSignal } from "./abort.mjs";
import {
	activitySignalsChanged,
	checkpointSignalsChanged,
	collectProgressSignals,
	computeStallDeadline,
	recordCheckpointWarning,
	recordLaneHeartbeat,
	recordLaneProgressSnapshot,
	recordStallWarning,
	resolveHeartbeatKind,
	shouldEmitCheckpointWarning,
	shouldEmitProgressSnapshot,
	buildProgressSnapshotPayload,
	progressSnapshotPayloadChanged,
} from "./heartbeat.mjs";
import {
	resolveStallConfigForTask,
	resolveWorkerPiTimeoutMs,
	parseTaskSizeFromFolder,
} from "./task-stall-budget.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { assertReviewToolAvailable } from "./review.mjs";
import { finalizeWorkerOutput, createWorkerLiveLogWriter } from "./worker-output.mjs";
import { nextStallAnchorAt } from "./engine-lanes/watch.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";
import { commandExists } from "../util/command-exists.mjs";
import {
	buildWorkerChildEnv,
	collectChildOutput,
	markChildPastPreflight,
	resolveWorkerLaunchScript,
	resolveWorkerPhase,
	spawnWorkerHandle,
	terminateHungWorkerChild,
	CHILD_DONE_TIMEOUT_MS,
} from "./worker-spawn.mjs";

export { buildWorkerChildEnv } from "./worker-spawn.mjs";

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Force-terminate lane worker processes tracked in batch state.
 *
 * @param {unknown[]} lanes
 * @param {{ hard?: boolean }} [options]
 * @returns {Array<{ laneNumber: number, workerPid: number, signal: NodeJS.Signals }>}
 */
export function terminateLaneWorkers(lanes, { hard = true } = {}) {
	const signal = hard ? "SIGKILL" : "SIGTERM";
	/** @type {Array<{ laneNumber: number, workerPid: number, signal: NodeJS.Signals }>} */
	const terminated = [];
	for (const lane of lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane).workerPid);
		if (!Number.isFinite(workerPid) || workerPid <= 0) continue;
		const laneNumber = Number(
			/** @type {{ laneNumber?: number }} */ (lane).laneNumber ?? 1,
		);
		try {
			process.kill(workerPid, signal);
			terminated.push({ laneNumber, workerPid, signal });
		} catch {
			// process may already be gone
		}
	}
	return terminated;
}

/** @typedef {import("./worker-spawn.mjs").WorkerPhase} WorkerPhase */

/** @typedef {import("./worker-spawn.mjs").WorkerChildHandle} WorkerChildHandle */

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} params
 * @param {string} params.rawOutput
 * @param {string} params.classification
 * @param {number} params.exitCode
 * @param {string} params.mode
 * @param {boolean} params.doneFound
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {object} [params.config]
 * @param {number} [params.stallDeadline]
 * @param {object} [params.signals]
 */
function buildWorkerFailureResult({
	rawOutput,
	classification,
	exitCode,
	mode,
	doneFound,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	config,
	stallDeadline,
	signals,
}) {
	const finalized = finalizeWorkerOutput({
		rawOutput,
		classification,
		ok: false,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		correlationId: laneCorrelationId,
		exitCode,
		stallDeadline,
		signals,
		config,
	});
	return {
		ok: false,
		exitCode,
		mode,
		output: finalized.output,
		workerOutputLogPath: finalized.logPath,
		workerOutputLogRef: finalized.logRef,
		classification,
		doneFound,
	};
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneBranch]
 * @param {string} [params.laneCorrelationId]
 * @param {object} [params.config]
 * @param {(timestamp: number) => void} [params.onHeartbeat]
 * @param {(pid: number) => void} [params.onWorkerPid]
 * @param {string[]} [params.fileScopePaths]
 * @param {number} [params.timeoutMs]
 * @param {object} [params.workerBackendDeps] Test-only injectables for agentSession backend
 */
export async function runWorker({
	worktreePath,
	taskFolder,
	projectRoot,
	batchId,
	laneNumber = 1,
	taskId,
	laneBranch,
	laneCorrelationId,
	config = {},
	onHeartbeat,
	onWorkerPid,
	fileScopePaths = [],
	timeoutMs: _timeoutMs = DEFAULT_TIMEOUT_MS,
	workerBackendDeps = {},
}) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		return { ok: true, exitCode: 0, mode: "already-done" };
	}

	const useStub =
		process.env.SPINE_WORKER_STUB === "1" ||
		process.env.SPINE_WORKER_STUB === "true" ||
		(!commandExists("pi") && resolveWorkerBackend(config) !== "agentSession");

	const workerBackend = useStub ? "subprocess" : resolveWorkerBackend(config);
	const workerMode = useStub ? "stub" : workerBackend === "agentSession" ? "agentSession" : "pi";
	const useLaunchScript = Boolean(
		projectRoot ? resolveWorkerLaunchScript(projectRoot, config) : null,
	);

	const reviewCheck = assertReviewToolAvailable({ taskFolder });
	if (!reviewCheck.ok) {
		if (projectRoot && batchId) {
			appendJournalEvent(projectRoot, batchId, "review.failed", {
				taskId,
				laneNumber,
				correlationId: laneCorrelationId,
				reviewLevel: reviewCheck.reviewLevel,
				error: reviewCheck.error,
				spawnFailed: true,
				phase: "preflight",
			});
		}
		return {
			ok: false,
			exitCode: 1,
			mode: workerMode,
			output: reviewCheck.error ?? "review tool unavailable",
			classification: "review_failed",
			doneFound: false,
		};
	}

	const taskSize = parseTaskSizeFromFolder(taskFolder);
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const contract = fs.existsSync(promptPath)
		? parseContract(fs.readFileSync(promptPath, "utf-8"))
		: { stallTimeoutMinutes: null, extendGraceOnFileScope: null };
	const stallConfig = resolveStallConfigForTask({ config, taskSize, contract });
	const piTimeoutMs = resolveWorkerPiTimeoutMs({ config, taskSize, contract });
	const startedAt = Date.now();
	let stallAnchorAt = startedAt;
	let lastCheckpointAt = startedAt;
	let lastHeartbeatAt = 0;
	let lastProgressSnapshotAt = 0;
	let lastSnapshotPayload = null;
	let lastSignals = null;
	let activitySinceCheckpoint = false;
	let checkpointWarningSent = false;
	let stallWarningSent = false;
	let postDoneStartedAt = null;
	let postDoneTerminated = false;

	const child = spawnWorkerHandle({
		worktreePath,
		taskFolder,
		useStub,
		timeoutMs: piTimeoutMs,
		piTimeoutMs,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		fileScopePaths,
		config,
		workerBackendDeps,
	});
	const workerChild = /** @type {WorkerChildHandle} */ (child);
	let childPastPreflight = !useLaunchScript;
	/** @type {WorkerPhase} */
	let workerPhase = resolveWorkerPhase({ childPastPreflight, useStub, workerBackend });
	markChildPastPreflight(workerChild, () => {
		childPastPreflight = true;
	});
	onWorkerPid?.(workerChild.pid ?? 0);
	const liveLogWriter = createWorkerLiveLogWriter({
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		config,
	});
	const childDone = collectChildOutput(workerChild, liveLogWriter);

	while (true) {
		const doneOnDisk = fs.existsSync(donePath);
		const now = Date.now();

		if (doneOnDisk && postDoneStartedAt === null) {
			postDoneStartedAt = now;
		}

		if (projectRoot && batchId) {
			const abortSignal = readAbortSignal(projectRoot, batchId);
			if (abortSignal) {
				const hard = Boolean(abortSignal.hard);
				workerChild.kill(hard ? "SIGKILL" : "SIGTERM");
				const { output } = await childDone;
				return buildWorkerFailureResult({
					rawOutput: output,
					classification: "aborted",
					exitCode: hard ? 137 : 130,
					mode: workerMode,
					doneFound: fs.existsSync(donePath),
					projectRoot,
					batchId,
					laneNumber,
					taskId,
					laneCorrelationId,
					config,
				});
			}
		}

		if (doneOnDisk) {
			if (workerChild.exitCode !== null) {
				break;
			}
			const graceElapsed = now - (postDoneStartedAt ?? now);
			if (graceElapsed >= stallConfig.postDoneGraceMs) {
				if (projectRoot && batchId) {
					appendJournalEvent(projectRoot, batchId, "worker.post_done_terminated", {
						laneNumber,
						taskId,
						correlationId: laneCorrelationId,
						graceElapsedMs: graceElapsed,
						postDoneGraceMs: stallConfig.postDoneGraceMs,
						childPid: workerChild.pid ?? null,
					});
				}
				postDoneTerminated = true;
				await terminateHungWorkerChild(workerChild, childDone);
				break;
			}
			await sleep(Math.min(stallConfig.pollIntervalMs, 5_000));
			continue;
		}

		const signals = collectProgressSignals(
			/** @type {Parameters<typeof collectProgressSignals>[0]} */ ({
				worktreePath,
				taskFolder,
				laneBranch,
				fileScopePaths,
				journalContext:
					projectRoot && batchId
						? { projectRoot, batchId, laneNumber, taskId }
						: undefined,
			}),
		);
		const nextWorkerPhase = resolveWorkerPhase({ childPastPreflight, useStub, workerBackend });
		if (nextWorkerPhase !== "launching" && workerPhase === "launching") {
			stallAnchorAt = now;
			lastCheckpointAt = now;
			activitySinceCheckpoint = false;
			checkpointWarningSent = false;
			lastSignals = null;
			lastSnapshotPayload = null;
		}
		workerPhase = nextWorkerPhase;

		const checkpointChanged =
			workerPhase !== "launching" && checkpointSignalsChanged(lastSignals, signals);
		const activityChanged =
			workerPhase !== "launching" && activitySignalsChanged(lastSignals, signals);

		if (checkpointChanged) {
			lastCheckpointAt = now;
			activitySinceCheckpoint = false;
			checkpointWarningSent = false;
		} else if (activityChanged) {
			activitySinceCheckpoint = true;
			if (stallConfig.extendGraceOnFileScope) {
				lastCheckpointAt = now;
			}
		}

		if (
			projectRoot &&
			batchId &&
			!checkpointWarningSent &&
			shouldEmitCheckpointWarning({
				now,
				lastCheckpointAt,
				signals,
				stallConfig,
				activitySinceCheckpoint,
				workerPhase,
			})
		) {
			recordCheckpointWarning({
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				signals,
				lastCheckpointAt,
				correlationId: laneCorrelationId,
			});
			checkpointWarningSent = true;
		}

		lastSignals = signals;

		if (
			projectRoot &&
			batchId &&
			shouldEmitProgressSnapshot({
				now,
				lastEmittedAt: lastProgressSnapshotAt,
				intervalMs: stallConfig.progressSnapshotIntervalMs,
			})
		) {
			const snapshotPayload = buildProgressSnapshotPayload(signals, workerPhase);
			if (progressSnapshotPayloadChanged(lastSnapshotPayload, snapshotPayload)) {
				recordLaneProgressSnapshot({
					projectRoot,
					batchId,
					laneNumber,
					taskId,
					signals,
					correlationId: laneCorrelationId,
					workerPhase,
				});
				lastSnapshotPayload = snapshotPayload;
			}
			lastProgressSnapshotAt = now;
		}

		if (
			projectRoot &&
			batchId &&
			now - lastHeartbeatAt >= stallConfig.heartbeatIntervalMs
		) {
			const heartbeatKind = resolveHeartbeatKind(
				/** @type {Parameters<typeof resolveHeartbeatKind>[0]} */ ({
					workerPhase,
					checkpointChanged,
					activityChanged,
				}),
			);
			recordLaneHeartbeat(
				/** @type {Parameters<typeof recordLaneHeartbeat>[0]} */ ({
					projectRoot,
					batchId,
					laneNumber,
					taskId,
					signals,
					correlationId: laneCorrelationId,
					workerPhase,
					heartbeatKind,
				}),
			);
			stallAnchorAt = nextStallAnchorAt({
				stallAnchorAt,
				now,
				workerPhase,
				heartbeatKind,
			});
			onHeartbeat?.(now);
			lastHeartbeatAt = now;
		}

		const stallDeadline = computeStallDeadline({
			startedAt,
			lastProgressAt: lastCheckpointAt,
			lastAliveAt: stallAnchorAt,
			stallConfig,
		});

		if (now >= stallDeadline) {
			if (!stallWarningSent && projectRoot && batchId) {
				recordStallWarning({
					projectRoot,
					batchId,
					laneNumber,
					taskId,
					signals,
					stallDeadline,
					correlationId: laneCorrelationId,
				});
				stallWarningSent = true;
			}
			const { output } = await terminateHungWorkerChild(workerChild, childDone);
			return buildWorkerFailureResult({
				rawOutput: output,
				classification: "stall_timeout",
				exitCode: 124,
				mode: workerMode,
				doneFound: fs.existsSync(donePath),
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneCorrelationId,
				config,
				stallDeadline,
				signals,
			});
		}

		if (workerChild.exitCode !== null) {
			break;
		}

		await sleep(Math.min(stallConfig.pollIntervalMs, 5_000));
	}

	const childResult = await Promise.race([childDone, sleep(CHILD_DONE_TIMEOUT_MS).then(() => null)]);
	let exitCode, output;
	if (childResult) {
		({ exitCode, output } = childResult);
	} else {
		// close event didn't fire — sub-processes likely hold stdio pipes open.
		const fallback = await terminateHungWorkerChild(workerChild, childDone);
		({ exitCode, output } = fallback);
	}
	const doneFound = fs.existsSync(donePath);
	if (postDoneTerminated && !doneFound) {
		return buildWorkerFailureResult({
			rawOutput: output,
			classification: "failed",
			exitCode,
			mode: workerMode,
			doneFound: false,
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneCorrelationId,
			config,
		});
	}
	const ok = doneFound && (exitCode === 0 || postDoneTerminated);
	let classification = ok ? "succeeded" : "failed";
	if (!ok && useLaunchScript && !childPastPreflight) {
		classification = "launch_failed";
		return buildWorkerFailureResult({
			rawOutput: output,
			classification,
			exitCode,
			mode: workerMode,
			doneFound,
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneCorrelationId,
			config,
		});
	}

	const finalized = finalizeWorkerOutput({
		rawOutput: output,
		classification,
		ok,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		correlationId: laneCorrelationId,
		exitCode,
		config,
	});

	return {
		ok,
		exitCode,
		mode: workerMode,
		output: finalized.output,
		workerOutputLogPath: finalized.logPath,
		workerOutputLogRef: finalized.logRef,
		classification,
		doneFound,
	};
}
