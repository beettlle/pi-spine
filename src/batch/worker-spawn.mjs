// @ts-check
/**
 * pi-spine worker spawn — child process setup, env, and output streaming (SP-581).
 */

import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startAgentSessionWorker } from "./agent-session-worker.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";
import { resolvePiSpineRoot } from "../config/pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "../config/worker-launch-script.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

export const POST_DONE_KILL_BACKOFF_MS = 5_000;
export const CHILD_DONE_TIMEOUT_MS = 15_000;

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
export function resolveWorkerLaunchScript(projectRoot, config = {}) {
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
		SPINE_IS_WORKER: "1",
		PI_SPINE_ROOT: resolvePiSpineRoot(config, projectRoot ?? process.cwd()),
	};
	if (projectRoot) env.SPINE_PROJECT_ROOT = projectRoot;
	if (worktreePath) env.SPINE_RULES_PROJECT_ROOT = worktreePath;
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
export function spawnWorkerChild({
	worktreePath,
	taskFolder,
	useStub,
	timeoutMs: _timeoutMs,
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
 * @param {WorkerChildHandle} child
 * @param {() => void} onPreflightComplete
 */
export function markChildPastPreflight(child, onPreflightComplete) {
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
export function resolveWorkerPhase({
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
export async function terminateHungWorkerChild(child, childDone) {
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
 * @param {{ append: (rawChunk: string) => void } | null} [liveLogWriter]
 */
export function collectChildOutput(child, liveLogWriter) {
	if ("wait" in child && typeof child.wait === "function") {
		return child.wait();
	}
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (/** @type {Buffer | string} */ chunk) => {
			const text = chunk.toString();
			stdout += text;
			liveLogWriter?.append(text);
		});
		child.stderr?.on("data", (/** @type {Buffer | string} */ chunk) => {
			const text = chunk.toString();
			stderr += text;
			liveLogWriter?.append(text);
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
export function spawnWorkerHandle({
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

