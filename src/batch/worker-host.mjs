// @ts-check
/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAbortSignal } from "./abort.mjs";
import {
	activitySignalsChanged,
	checkpointSignalsChanged,
	collectProgressSignals,
	computeStallDeadline,
	recordCheckpointWarning,
	recordLaneHeartbeat,
	recordStallWarning,
	resolveHeartbeatKind,
	shouldEmitCheckpointWarning,
} from "./heartbeat.mjs";
import {
	resolveStallConfigForTask,
	resolveWorkerPiTimeoutMs,
	parseTaskSizeFromFolder,
} from "./task-stall-budget.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { assertReviewToolAvailable } from "./review.mjs";
import { startAgentSessionWorker } from "./agent-session-worker.mjs";
import { finalizeWorkerOutput } from "./worker-output.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";
import { commandExists } from "../util/command-exists.mjs";
import { resolvePiSpineRoot } from "../config/pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "../config/worker-launch-script.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;
const POST_DONE_KILL_BACKOFF_MS = 5_000;

/** @typedef {"launching" | "pi" | "verify" | "unknown"} WorkerPhase */

/**
 * @typedef {import("node:child_process").ChildProcess | {
 *   pid: number;
 *   exitCode: number | null;
 *   kill: (signal?: NodeJS.Signals) => boolean;
 *   wait?: () => Promise<{ exitCode: number; output: string }>;
 *   stdout?: NodeJS.ReadableStream | null;
 *   stderr?: NodeJS.ReadableStream | null;
 *   on?: import("node:events").EventEmitter["on"];
 * }} WorkerChildHandle
 */

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * @param {string} projectRoot
 * @param {object} [config]
 * @returns {string|null}
 */
function resolveWorkerLaunchScript(projectRoot, config = {}) {
	return resolveSafeWorkerLaunchScript(projectRoot, config);
}

/**
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {string} params.worktreePath
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {string[]} [params.fileScopePaths]
 * @param {object} [params.config]
 * @param {number} [params.piTimeoutMs]
 */
export function buildWorkerChildEnv({
	taskFolder,
	worktreePath,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	fileScopePaths = [],
	config = {},
	piTimeoutMs,
}) {
	const runner = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");
	/** @type {NodeJS.ProcessEnv} */
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
		SPINE_WORKER_RUNNER: runner,
		PI_SPINE_ROOT: resolvePiSpineRoot(config, projectRoot ?? process.cwd()),
	};
	if (projectRoot) env.SPINE_PROJECT_ROOT = projectRoot;
	if (batchId) {
		env.SPINE_BATCH_ID = batchId;
		env.SPINE_JOURNAL_ATTACH = "1";
		delete env.SPINE_SUPPRESS_JOURNAL_ATTACH;
	}
	if (laneNumber != null) env.SPINE_LANE_NUMBER = String(laneNumber);
	if (taskId) env.SPINE_TASK_ID = taskId;
	if (laneCorrelationId) env.SPINE_LANE_CORRELATION_ID = laneCorrelationId;
	if (Array.isArray(fileScopePaths) && fileScopePaths.length > 0) {
		env.SPINE_TASK_FILE_SCOPE = JSON.stringify(fileScopePaths);
	}
	if (process.env.SPINE_WORKER_STUB === "1") {
		env.SPINE_REVIEW_STUB = "1";
	}
	if (piTimeoutMs != null && Number.isFinite(piTimeoutMs) && piTimeoutMs > 0) {
		env.SPINE_WORKER_PI_TIMEOUT_MS = String(
			process.env.SPINE_WORKER_PI_TIMEOUT_MS ?? piTimeoutMs,
		);
	}
	return env;
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {boolean} params.useStub
 * @param {number} params.timeoutMs
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {string[]} [params.fileScopePaths]
 * @param {object} [params.config]
 * @param {number} [params.piTimeoutMs]
 */
function spawnWorkerChild({
	worktreePath,
	taskFolder,
	useStub,
	timeoutMs,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	fileScopePaths = [],
	config = {},
	piTimeoutMs,
}) {
	const runner = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");
	const env = buildWorkerChildEnv({
		taskFolder,
		worktreePath,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		fileScopePaths,
		config,
		piTimeoutMs,
	});
	const args = useStub ? ["--stub"] : ["--pi"];

	const launchScript = projectRoot ? resolveWorkerLaunchScript(projectRoot, config) : null;
	if (launchScript) {
		return spawn(launchScript, [runner, ...args], {
			cwd: worktreePath,
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
	}

	return spawn(process.execPath, [runner, ...args], {
		cwd: worktreePath,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
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
 * @param {WorkerChildHandle} child
 * @param {() => void} onPreflightComplete
 */
function markChildPastPreflight(child, onPreflightComplete) {
	if (typeof child.stdout?.on === "function") {
		child.stdout.on("data", onPreflightComplete);
	}
	if (typeof child.stderr?.on === "function") {
		child.stderr.on("data", onPreflightComplete);
	}
}

/**
 * @param {object} params
 * @param {boolean} params.childPastPreflight
 * @param {boolean} params.useStub
 * @param {string} params.workerBackend
 * @returns {WorkerPhase}
 */
function resolveWorkerPhase({
	childPastPreflight,
	useStub,
	workerBackend,
}) {
	if (!childPastPreflight) return "launching";
	if (useStub || workerBackend === "agentSession") return "pi";
	return "pi";
}

/**
 * SIGTERM then SIGKILL when a worker stays alive after post-.DONE grace.
 *
 * @param {WorkerChildHandle} child
 * @param {Promise<{ exitCode: number; output: string }>} childDone
 */
async function terminateHungWorkerChild(child, childDone) {
	child.kill("SIGTERM");
	const raced = await Promise.race([childDone, sleep(POST_DONE_KILL_BACKOFF_MS)]);
	if (raced && typeof raced === "object" && "exitCode" in raced) {
		return raced;
	}
	if (child.exitCode === null && typeof child.kill === "function") {
		child.kill("SIGKILL");
	}
	return childDone;
}

/**
 * @param {WorkerChildHandle} child
 */
function collectChildOutput(child) {
	if ("wait" in child && typeof child.wait === "function") {
		return child.wait();
	}
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (/** @type {Buffer | string} */ chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (/** @type {Buffer | string} */ chunk) => {
			stderr += chunk.toString();
		});
		child.on?.("close", (/** @type {number | null} */ code) => {
			resolve({ exitCode: code ?? 1, output: `${stdout}${stderr}` });
		});
	});
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {boolean} params.useStub
 * @param {number} params.timeoutMs
 * @param {number} [params.piTimeoutMs]
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {string[]} [params.fileScopePaths]
 * @param {object} [params.config]
 * @param {object} [params.workerBackendDeps]
 */
function spawnWorkerHandle({
	worktreePath,
	taskFolder,
	useStub,
	timeoutMs,
	piTimeoutMs,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	fileScopePaths = [],
	config,
	workerBackendDeps,
}) {
	const journal =
		projectRoot && batchId
			? {
					projectRoot,
					batchId,
					taskId,
					laneNumber,
					correlationId: laneCorrelationId,
				}
			: undefined;

	if (!useStub && resolveWorkerBackend(config) === "agentSession") {
		return startAgentSessionWorker(
			/** @type {{ worktreePath: string; taskFolder: string; config?: object; taskFileScope?: string[]; journal?: import("../config/worker-context.mjs").WorkerRulesJournalContext; projectRoot?: string }} */ ({
				worktreePath,
				taskFolder,
				config,
				taskFileScope: fileScopePaths,
				journal,
				projectRoot,
			}),
			workerBackendDeps ?? {},
		);
	}

	return spawnWorkerChild({
		worktreePath,
		taskFolder,
		useStub,
		timeoutMs,
		piTimeoutMs,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		fileScopePaths,
		config,
	});
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
	timeoutMs = DEFAULT_TIMEOUT_MS,
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
	let lastCheckpointAt = startedAt;
	let lastHeartbeatAt = 0;
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
	const childDone = collectChildOutput(workerChild);

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

		const signals = collectProgressSignals(/** @type {any} */ ({
			worktreePath,
			taskFolder,
			laneBranch,
			fileScopePaths,
			journalContext:
				projectRoot && batchId
					? { projectRoot, batchId, laneNumber, taskId }
					: undefined,
		}));
		const nextWorkerPhase = resolveWorkerPhase({ childPastPreflight, useStub, workerBackend });
		if (nextWorkerPhase !== "launching" && workerPhase === "launching") {
			lastCheckpointAt = now;
			activitySinceCheckpoint = false;
			checkpointWarningSent = false;
			lastSignals = null;
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
			now - lastHeartbeatAt >= stallConfig.heartbeatIntervalMs
		) {
			const heartbeatKind = resolveHeartbeatKind(/** @type {any} */ ({
				workerPhase,
				checkpointChanged,
				activityChanged,
			}));
			recordLaneHeartbeat(/** @type {any} */ ({
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				signals,
				correlationId: laneCorrelationId,
				workerPhase,
				heartbeatKind,
			}));
			onHeartbeat?.(now);
			lastHeartbeatAt = now;
		}

		const stallDeadline = computeStallDeadline({
			startedAt,
			lastProgressAt: lastCheckpointAt,
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
			workerChild.kill("SIGTERM");
			const { output } = await childDone;
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

	const { exitCode, output } = await childDone;
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
