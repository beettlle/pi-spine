// @ts-check
/**
 * pi-spine worker spawn — child process setup, env, and output streaming (SP-581).
 */

import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startAgentSessionWorker } from "./agent-session-worker.mjs";
import { DEFAULT_MAX_BYTES } from "./worker-output.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";
import { resolvePiSpineRoot } from "../config/pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "../config/worker-launch-script.mjs";
import { terminateProcessTree } from "../process/terminate-tree.mjs";

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
 * @param {Record<string, string>} [params.extraEnv] Extra child env (matrix row identity, #229)
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
	extraEnv,
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
	// Optional caller-supplied additions (matrix row identity, #229). Assigned
	// last so explicit extras win, and omitted entirely for existing callers so
	// the env stays byte-identical to the pre-#229 behavior.
	if (extraEnv && typeof extraEnv === "object") {
		Object.assign(env, extraEnv);
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
 * @param {Record<string, string>} [params.extraEnv] Extra child env (matrix row identity, #229)
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
	extraEnv,
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
		extraEnv,
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
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {string} params.command
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {number} [params.laneNumber]
 * @param {string} [params.taskId]
 * @param {string} [params.laneCorrelationId]
 * @param {string[]} [params.fileScopePaths]
 * @param {object} [params.config]
 */
export function spawnExecutionOnlyHandle({
	worktreePath,
	taskFolder,
	command,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	fileScopePaths = [],
	config = {},
}) {
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
	});
	
	// Run the command, then create the .DONE marker. The path is passed as a
	// positional parameter (`$1`) instead of being interpolated into the script
	// string, so a task folder containing `"`, `$(`, or a backtick is never
	// evaluated as shell code (SP-787 / #306). The third element is `$0`.
	const donePath = path.join(taskFolder, ".DONE");

	return spawn("/bin/sh", ["-c", `${command} && touch "$1"`, "sh", donePath], {
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
 * SIGTERM then SIGKILL the worker process tree when a child stays alive
 * after post-.DONE grace (reaps nested `pi` grandchildren — SP-609 / #194).
 *
 * @param {WorkerChildHandle} child
 * @param {Promise<{ exitCode: number; output: string }>} childDone
 */
export async function terminateHungWorkerChild(child, childDone) {
	const pid = child.pid ?? 0;
	if (pid > 0) {
		terminateProcessTree(pid, { signal: "SIGTERM" });
	} else if (typeof child.kill === "function") {
		child.kill("SIGTERM");
	}
	const raced = await Promise.race([childDone, sleep(POST_DONE_KILL_BACKOFF_MS)]);
	if (raced && typeof raced === "object" && "exitCode" in raced) {
		return raced;
	}
	if (child.exitCode === null) {
		if (pid > 0) {
			terminateProcessTree(pid, { signal: "SIGKILL" });
		} else if (typeof child.kill === "function") {
			child.kill("SIGKILL");
		}
	}
	return childDone;
}

/**
 * Append `text` to a bounded tail buffer, keeping only the last `maxBytes`.
 *
 * @param {Buffer} tail
 * @param {string} text
 * @param {number} maxBytes
 * @returns {Buffer}
 */
function appendToBoundedTail(tail, text, maxBytes) {
	const chunk = Buffer.from(text, "utf-8");
	if (maxBytes <= 0) return Buffer.alloc(0);
	const combined = tail.byteLength === 0 ? chunk : Buffer.concat([tail, chunk]);
	return combined.byteLength > maxBytes
		? combined.subarray(combined.byteLength - maxBytes)
		: combined;
}

/**
 * Collect child stdout/stderr into a bounded tail (SP-787 / #306) and settle
 * on either `close` or a spawn `error`, whichever comes first. A child that
 * never spawned (EACCES/ENOENT, missing execPath) emits `error` and then a
 * synthetic `close`, so the error path resolves once with `spawnError: true`
 * and the conventional exit code 127; the close handler is guarded so the
 * later close cannot override the spawn failure. Without the `error` listener
 * the engine itself would crash on the unhandled event and lose every lane.
 *
 * @param {WorkerChildHandle} child
 * @param {{ append: (rawChunk: string) => void } | null} [liveLogWriter]
 * @param {number} [maxBytes] Byte cap for the collected output tail; defaults
 *   to the worker output cap. Memory stays bounded regardless of child runtime.
 * @returns {Promise<{ exitCode: number; output: string; spawnError?: boolean }>}
 */
export function collectChildOutput(child, liveLogWriter, maxBytes) {
	if ("wait" in child && typeof child.wait === "function") {
		return child.wait();
	}
	const cap = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES;
	return new Promise((resolve) => {
		let stdoutTail = Buffer.alloc(0);
		let stderrTail = Buffer.alloc(0);
		/** @type {string|null} */
		let spawnErrorMessage = null;
		let settled = false;

		// stdout-then-stderr order as before; the combined string keeps the last
		// `cap` bytes overall.
		const combinedOutput = () => {
			const combined = Buffer.concat([stdoutTail, stderrTail]);
			const bounded =
				combined.byteLength > cap
					? combined.subarray(combined.byteLength - cap)
					: combined;
			return bounded.toString("utf-8");
		};
		const settle = (
			/** @type {() => { exitCode: number; output: string; spawnError?: boolean }} */ build,
		) => {
			if (settled) return;
			settled = true;
			resolve(build());
		};
		const spawnFailureResult = () => ({
			exitCode: 127,
			output: `${combinedOutput()}${spawnErrorMessage ?? ""}`,
			spawnError: true,
		});

		child.stdout?.on("data", (/** @type {Buffer | string} */ chunk) => {
			const text = chunk.toString();
			stdoutTail = appendToBoundedTail(stdoutTail, text, cap);
			liveLogWriter?.append(text);
		});
		child.stderr?.on("data", (/** @type {Buffer | string} */ chunk) => {
			const text = chunk.toString();
			stderrTail = appendToBoundedTail(stderrTail, text, cap);
			liveLogWriter?.append(text);
		});
		child.on?.("error", (/** @type {unknown} */ err) => {
			spawnErrorMessage = String(err);
			// A child that failed to spawn has no real exit status. Flag the handle
			// as settled so poll loops keyed on `exitCode` stop polling — older
			// runtimes leave `exitCode` null on failed spawns (Node ≥22 sets a
			// negative errno instead). The property is a plain writable own field.
			if (child.exitCode === null || child.exitCode < 0) {
				try {
					child.exitCode = 127;
				} catch {
					// Read-only test double; the resolved promise still settles the host.
				}
			}
			settle(spawnFailureResult);
		});
		child.on?.("close", (/** @type {number | null} */ code) => {
			if (spawnErrorMessage !== null) {
				settle(spawnFailureResult);
				return;
			}
			settle(() => ({ exitCode: code ?? 1, output: combinedOutput() }));
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
 * @param {Record<string, string>} [params.extraEnv] Extra child env (matrix row identity, #229)
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
	extraEnv,
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
		extraEnv,
	});
}

