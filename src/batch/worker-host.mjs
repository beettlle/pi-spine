/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
	collectProgressSignals,
	computeStallDeadline,
	progressSignalsChanged,
	recordLaneHeartbeat,
	recordStallWarning,
	resolveStallConfig,
} from "./heartbeat.mjs";

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
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} params
 */
function spawnWorkerChild({ worktreePath, taskFolder, useStub, timeoutMs }) {
	const runner = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
	};
	const args = useStub ? ["--stub"] : ["--pi"];

	return spawn(process.execPath, [runner, ...args], {
		cwd: worktreePath,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
}

/**
 * @param {import("node:child_process").ChildProcess} child
 */
function collectChildOutput(child) {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("close", (code) => {
			resolve({ exitCode: code ?? 1, output: `${stdout}${stderr}` });
		});
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
 * @param {object} [params.config]
 * @param {(timestamp: number) => void} [params.onHeartbeat]
 * @param {number} [params.timeoutMs]
 */
export async function runWorker({
	worktreePath,
	taskFolder,
	projectRoot,
	batchId,
	laneNumber = 1,
	taskId,
	laneBranch,
	config = {},
	onHeartbeat,
	timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		return { ok: true, exitCode: 0, mode: "already-done" };
	}

	const useStub =
		process.env.SPINE_WORKER_STUB === "1" ||
		process.env.SPINE_WORKER_STUB === "true" ||
		!commandExists("pi");

	const stallConfig = resolveStallConfig(config);
	const startedAt = Date.now();
	let lastProgressAt = startedAt;
	let lastHeartbeatAt = 0;
	let lastSignals = null;
	let stallWarningSent = false;

	const child = spawnWorkerChild({ worktreePath, taskFolder, useStub, timeoutMs });
	const childDone = collectChildOutput(child);

	while (true) {
		if (fs.existsSync(donePath)) {
			break;
		}

		const now = Date.now();
		const signals = collectProgressSignals({ worktreePath, taskFolder, laneBranch });
		if (progressSignalsChanged(lastSignals, signals)) {
			lastProgressAt = now;
			lastSignals = signals;
		}

		if (
			projectRoot &&
			batchId &&
			now - lastHeartbeatAt >= stallConfig.heartbeatIntervalMs
		) {
			recordLaneHeartbeat({
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				signals,
			});
			onHeartbeat?.(now);
			lastHeartbeatAt = now;
		}

		const stallDeadline = computeStallDeadline({
			startedAt,
			lastProgressAt,
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
				});
				stallWarningSent = true;
			}
			child.kill("SIGTERM");
			const { output } = await childDone;
			return {
				ok: false,
				exitCode: 124,
				mode: useStub ? "stub" : "pi",
				output,
				classification: "stall_timeout",
				doneFound: fs.existsSync(donePath),
			};
		}

		if (child.exitCode !== null) {
			break;
		}

		await sleep(Math.min(stallConfig.pollIntervalMs, 5_000));
	}

	const { exitCode, output } = await childDone;
	const doneFound = fs.existsSync(donePath);

	return {
		ok: doneFound && exitCode === 0,
		exitCode,
		mode: useStub ? "stub" : "pi",
		output,
		classification: doneFound ? "succeeded" : "failed",
		doneFound,
	};
}
