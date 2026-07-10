// @ts-check
/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import {
	resolveStallConfigForTask,
	resolveWorkerPiTimeoutMs,
	parseTaskSizeFromFolder,
} from "./task-stall-budget.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { assertReviewToolAvailable } from "./review.mjs";
import { finalizeWorkerOutput, createWorkerLiveLogWriter } from "./worker-output.mjs";
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
import {
	createWorkerPollState,
	pollWorkerUntilSettled,
} from "./worker-heartbeat.mjs";

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
	const initialWorkerPhase = resolveWorkerPhase({ childPastPreflight, useStub, workerBackend });
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

	const pollState = createWorkerPollState(startedAt, initialWorkerPhase);
	const pollOutcome = await pollWorkerUntilSettled({
		donePath,
		workerChild,
		childDone,
		stallConfig,
		startedAt,
		pollState,
		worktreePath,
		taskFolder,
		laneBranch,
		fileScopePaths,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		useStub,
		workerBackend,
		childPastPreflight,
		onHeartbeat,
		workerMode,
		buildFailureResult: (
			/** @type {Pick<Parameters<typeof buildWorkerFailureResult>[0], "rawOutput" | "classification" | "exitCode" | "mode" | "doneFound" | "stallDeadline" | "signals">} */ partial,
		) =>
			buildWorkerFailureResult({
				...partial,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneCorrelationId,
				config,
			}),
	});

	if (pollOutcome.kind === "failure") {
		return pollOutcome.result;
	}

	const postDoneTerminated = pollOutcome.postDoneTerminated;

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
