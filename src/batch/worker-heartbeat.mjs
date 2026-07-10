// @ts-check
/**
 * pi-spine worker heartbeat — polling, stall detection, and progress heartbeats (SP-599).
 */

import fs from "node:fs";
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
	resolveStallConfig,
	shouldEmitCheckpointWarning,
	shouldEmitProgressSnapshot,
	buildProgressSnapshotPayload,
	progressSnapshotPayloadChanged,
} from "./heartbeat.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { nextStallAnchorAt } from "./engine-lanes/watch.mjs";
import {
	resolveWorkerPhase,
	terminateHungWorkerChild,
} from "./worker-spawn.mjs";

/** @typedef {import("./worker-spawn.mjs").WorkerPhase} WorkerPhase */
/** @typedef {import("./worker-spawn.mjs").WorkerChildHandle} WorkerChildHandle */
/** @typedef {ReturnType<typeof resolveStallConfig>} StallConfig */

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @typedef {object} WorkerPollState
 * @property {number} stallAnchorAt
 * @property {number} lastCheckpointAt
 * @property {number} lastHeartbeatAt
 * @property {number} lastProgressSnapshotAt
 * @property {object | null} lastSnapshotPayload
 * @property {object | null} lastSignals
 * @property {boolean} activitySinceCheckpoint
 * @property {boolean} checkpointWarningSent
 * @property {boolean} stallWarningSent
 * @property {number | null} postDoneStartedAt
 * @property {boolean} postDoneTerminated
 * @property {WorkerPhase} workerPhase
 */

/**
 * @param {number} startedAt
 * @param {WorkerPhase} workerPhase
 * @returns {WorkerPollState}
 */
export function createWorkerPollState(startedAt, workerPhase) {
	return {
		stallAnchorAt: startedAt,
		lastCheckpointAt: startedAt,
		lastHeartbeatAt: 0,
		lastProgressSnapshotAt: 0,
		lastSnapshotPayload: null,
		lastSignals: null,
		activitySinceCheckpoint: false,
		checkpointWarningSent: false,
		stallWarningSent: false,
		postDoneStartedAt: null,
		postDoneTerminated: false,
		workerPhase,
	};
}

/**
 * Poll worker child until .DONE + exit, stall timeout, or abort.
 *
 * @param {object} params
 * @param {string} params.donePath
 * @param {WorkerChildHandle} params.workerChild
 * @param {Promise<{ exitCode: number; output: string }>} params.childDone
 * @param {StallConfig} params.stallConfig
 * @param {number} params.startedAt
 * @param {WorkerPollState} params.pollState
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {string} [params.laneBranch]
 * @param {string[]} [params.fileScopePaths]
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {boolean} params.useStub
 * @param {string} params.workerBackend
 * @param {boolean} params.childPastPreflight
 * @param {(timestamp: number) => void} [params.onHeartbeat]
 * @param {(failure: {
 *   rawOutput: string;
 *   classification: string;
 *   exitCode: number;
 *   mode: string;
 *   doneFound: boolean;
 *   stallDeadline?: number;
 *   signals?: object;
 * }) => object} params.buildFailureResult
 * @param {string} params.workerMode
 * @returns {Promise<
 *   | { kind: "settled"; postDoneTerminated: boolean }
 *   | { kind: "failure"; result: object }
 * >}
 */
export async function pollWorkerUntilSettled({
	donePath,
	workerChild,
	childDone,
	stallConfig,
	startedAt,
	pollState,
	worktreePath,
	taskFolder,
	laneBranch,
	fileScopePaths = [],
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	useStub,
	workerBackend,
	childPastPreflight,
	onHeartbeat,
	buildFailureResult,
	workerMode,
}) {
	let {
		stallAnchorAt,
		lastCheckpointAt,
		lastHeartbeatAt,
		lastProgressSnapshotAt,
		lastSnapshotPayload,
		lastSignals,
		activitySinceCheckpoint,
		checkpointWarningSent,
		stallWarningSent,
		postDoneStartedAt,
		postDoneTerminated,
		workerPhase,
	} = pollState;

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
				return {
					kind: "failure",
					result: buildFailureResult({
						rawOutput: output,
						classification: "aborted",
						exitCode: hard ? 137 : 130,
						mode: workerMode,
						doneFound: fs.existsSync(donePath),
					}),
				};
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
			return {
				kind: "failure",
				result: buildFailureResult({
					rawOutput: output,
					classification: "stall_timeout",
					exitCode: 124,
					mode: workerMode,
					doneFound: fs.existsSync(donePath),
					stallDeadline,
					signals,
				}),
			};
		}

		if (workerChild.exitCode !== null) {
			break;
		}

		await sleep(Math.min(stallConfig.pollIntervalMs, 5_000));
	}

	return { kind: "settled", postDoneTerminated };
}
