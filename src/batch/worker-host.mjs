/**
 * pi-spine worker host — spawn worker in lane worktree.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * @param {string} cmd
 */
function commandExists(cmd) {
	try {
		spawnSync("which", [cmd], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder absolute path to task folder in worktree
 * @param {number} [params.timeoutMs]
 */
export function runWorker({ worktreePath, taskFolder, timeoutMs = DEFAULT_TIMEOUT_MS }) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		return { ok: true, exitCode: 0, mode: "already-done" };
	}

	const useStub =
		process.env.SPINE_WORKER_STUB === "1" ||
		process.env.SPINE_WORKER_STUB === "true" ||
		!commandExists("pi");

	const runner = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
	};

	let result;
	if (useStub) {
		result = spawnSync(process.execPath, [runner, "--stub"], {
			cwd: worktreePath,
			env,
			encoding: "utf-8",
			timeout: timeoutMs,
		});
	} else {
		result = spawnSync(process.execPath, [runner, "--pi"], {
			cwd: worktreePath,
			env,
			encoding: "utf-8",
			timeout: timeoutMs,
		});
	}

	const exitCode = result.status ?? 1;
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	const doneFound = fs.existsSync(donePath);

	if (result.error?.code === "ETIMEDOUT") {
		return {
			ok: false,
			exitCode: 124,
			mode: useStub ? "stub" : "pi",
			output,
			classification: "stall_timeout",
			doneFound,
		};
	}

	return {
		ok: doneFound && exitCode === 0,
		exitCode,
		mode: useStub ? "stub" : "pi",
		output,
		classification: doneFound ? "succeeded" : "failed",
		doneFound,
	};
}
