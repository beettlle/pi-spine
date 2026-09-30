/**
 * Async shell runner for contract commands (SP-799 / #305).
 *
 * runContractTestCommand originally ran its shell synchronously, which
 * blocked the engine's event loop for the entire command; one slow contract
 * check froze every concurrent lane. This module exposes the same shell
 * semantics ($SHELL resolution, -c flag, capped capture) as a Promise-based
 * primitive that never blocks and never leaks: on timeout the detached process
 * group is terminated through terminateProcessTree so backgrounded
 * grandchildren cannot outlive the run.
 */

import { spawn } from "node:child_process";
import { terminateProcessTree } from "../process/terminate-tree.mjs";

/** Grace period between SIGTERM and SIGKILL once a command times out. */
const TIMEOUT_GRACE_MS = 2000;

/**
 * Failsafe settle window after SIGKILL. SIGKILL cannot be ignored, but a
 * grandchild outside the walked tree could still hold the stdio pipes open;
 * settling regardless keeps the awaiter from hanging on process-tree escapees.
 */
const TIMEOUT_KILL_FAILSAFE_MS = 2000;

/** Default wall-clock timeout; matches runContractTestCommand's 10-minute cap. */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** Default per-stream capture cap (10MB), matching contract-exec's sync default (#86). */
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/** Exit code reported when the shell itself cannot be spawned (ENOENT convention). */
const SPAWN_ERROR_EXIT_CODE = 127;

/**
 * Resolve the contract shell exactly like runContractTestCommand: $SHELL, else
 * cmd.exe on Windows and /bin/sh elsewhere, with the matching command flag.
 * Lives here (not in contract-exec.mjs) so the sync and async runners share one
 * implementation instead of drifting. Returns a [shell, args] pair ready to
 * spread into spawn().
 *
 * @param {string} command
 * @param {string} [shellOverride]
 * @returns {[string, string[]]}
 */
export function resolveContractShellInvocation(command, shellOverride) {
	const shell = shellOverride || process.env.SHELL || (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
	const shellFlag = process.platform === "win32" ? "/c" : "-c";
	return [shell, [shellFlag, command]];
}

/**
 * @typedef {Object} ShellCommandResult
 * @property {number | null} exitCode Process exit code; null on timeout or signal-only death.
 * @property {NodeJS.Signals | null} signal Terminating signal when the process was killed.
 * @property {string} stdout Captured stdout (at most maxBuffer bytes, utf-8).
 * @property {string} stderr Captured stderr (at most maxBuffer bytes, utf-8); carries the spawn error message.
 * @property {boolean} timedOut True when the command exceeded timeoutMs and was tree-killed.
 * @property {boolean} truncated True when either stream exceeded maxBuffer and bytes were discarded.
 * @property {number} durationMs Wall-clock duration from spawn to settle.
 */

/**
 * Capture a piped stream up to maxBuffer bytes. Past the cap the pipe keeps
 * draining (the data listener stays attached) but further bytes are discarded,
 * so the child never blocks on a full pipe while `truncated` is reported.
 *
 * @param {import("node:stream").Readable} stream
 * @param {number} maxBuffer
 * @returns {{ text: () => string, isTruncated: () => boolean }}
 */
function createCappedCapture(stream, maxBuffer) {
	/** @type {Buffer[]} */
	const chunks = [];
	let total = 0;
	let truncated = false;
	stream.on("data", (/** @type {Buffer} */ chunk) => {
		if (total >= maxBuffer) {
			truncated = true;
			return;
		}
		const remaining = maxBuffer - total;
		if (chunk.length > remaining) {
			truncated = true;
			chunks.push(chunk.subarray(0, remaining));
			total = maxBuffer;
			return;
		}
		chunks.push(chunk);
		total += chunk.length;
	});
	return {
		text: () => Buffer.concat(chunks).toString("utf-8"),
		isTruncated: () => truncated,
	};
}

/**
 * Build the result for a spawn that failed before any process existed.
 *
 * @param {unknown} error
 * @param {number} startedAt
 * @returns {ShellCommandResult}
 */
function makeSpawnErrorResult(error, startedAt) {
	const message = error instanceof Error ? error.message : String(error);
	return {
		exitCode: SPAWN_ERROR_EXIT_CODE,
		signal: null,
		stdout: "",
		stderr: message,
		timedOut: false,
		truncated: false,
		durationMs: Date.now() - startedAt,
	};
}

/**
 * Run a shell command asynchronously in `cwd`.
 *
 * Never rejects: spawn failures (e.g. ENOENT shell) resolve with exitCode 127
 * and the error message in stderr. On timeout the process tree gets SIGTERM,
 * then SIGKILL after a 2s grace period, and the result carries
 * `timedOut: true` / `exitCode: null`.
 *
 * @param {string} cwd
 * @param {string} command
 * @param {{ env?: NodeJS.ProcessEnv, timeoutMs?: number, maxBuffer?: number, shell?: string }} [options]
 * @returns {Promise<ShellCommandResult>}
 */
export function runShellCommandAsync(cwd, command, options = {}) {
	const {
		env = process.env,
		timeoutMs = DEFAULT_TIMEOUT_MS,
		maxBuffer = DEFAULT_MAX_BUFFER,
		shell: shellOverride,
	} = options;
	const startedAt = Date.now();

	return new Promise((resolve) => {
		/** @type {import("node:child_process").ChildProcess} */
		let child;
		try {
			child = spawn(...resolveContractShellInvocation(String(command ?? ""), shellOverride), {
				cwd,
				env,
				// Detached on POSIX makes the child a process-group leader so the
				// negative-pid group kill in terminateProcessTree reaches every
				// descendant, not just the shell.
				detached: process.platform !== "win32",
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (error) {
			// spawn() throws synchronously for invalid arguments; treat like a spawn failure.
			resolve(makeSpawnErrorResult(error, startedAt));
			return;
		}

		const stdoutCapture = child.stdout
			? createCappedCapture(child.stdout, maxBuffer)
			: { text: () => "", isTruncated: () => false };
		const stderrCapture = child.stderr
			? createCappedCapture(child.stderr, maxBuffer)
			: { text: () => "", isTruncated: () => false };

		let settled = false;
		let timedOut = false;
		/** @type {NodeJS.Timeout | null} */
		let timeoutHandle = null;
		/** @type {NodeJS.Timeout | null} */
		let graceHandle = null;
		/** @type {NodeJS.Timeout | null} */
		let failsafeHandle = null;

		const clearTimers = () => {
			for (const handle of [timeoutHandle, graceHandle, failsafeHandle]) {
				if (handle) clearTimeout(handle);
			}
		};

		/**
		 * @param {Partial<ShellCommandResult>} overrides
		 */
		const finish = (overrides = {}) => {
			if (settled) return;
			settled = true;
			clearTimers();
			resolve({
				exitCode: null,
				signal: null,
				stdout: stdoutCapture.text(),
				stderr: stderrCapture.text(),
				timedOut,
				truncated: stdoutCapture.isTruncated() || stderrCapture.isTruncated(),
				durationMs: Date.now() - startedAt,
				...overrides,
			});
		};

		child.on("error", (/** @type {Error} */ error) => {
			if (settled) return;
			finish({
				exitCode: SPAWN_ERROR_EXIT_CODE,
				stderr: `${stderrCapture.text()}\n${error.message}`.trim(),
			});
		});

		// 'close' (not 'exit') waits for the stdio pipes to drain, so captured
		// output is complete before the promise settles.
		child.on("close", (/** @type {number | null} */ code, /** @type {NodeJS.Signals | null} */ signal) => {
			finish({ exitCode: code, signal });
		});

		if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
			timeoutHandle = setTimeout(() => {
				timedOut = true;
				terminateProcessTree(child.pid, { signal: "SIGTERM" });
				graceHandle = setTimeout(() => {
					terminateProcessTree(child.pid, { signal: "SIGKILL" });
					failsafeHandle = setTimeout(() => finish(), TIMEOUT_KILL_FAILSAFE_MS);
				}, TIMEOUT_GRACE_MS);
			}, timeoutMs);
		}
	});
}
