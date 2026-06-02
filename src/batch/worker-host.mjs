/**
 * pi-spine worker host — spawn worker in lane worktree with heartbeat polling.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAbortSignal } from "./abort.mjs";
import {
	collectProgressSignals,
	computeStallDeadline,
	progressSignalsChanged,
	recordLaneHeartbeat,
	recordStallWarning,
	resolveStallConfig,
} from "./heartbeat.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { assertReviewToolAvailable } from "./review.mjs";
import { startAgentSessionWorker } from "./agent-session-worker.mjs";
import { resolveWorkerBackend } from "../config/worker-backend.mjs";

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
}) {
	const runner = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
	};
	if (projectRoot) env.SPINE_PROJECT_ROOT = projectRoot;
	if (batchId) {
		env.SPINE_BATCH_ID = batchId;
		env.SPINE_JOURNAL_ATTACH = "1";
	}
	if (laneNumber != null) env.SPINE_LANE_NUMBER = String(laneNumber);
	if (taskId) env.SPINE_TASK_ID = taskId;
	if (laneCorrelationId) env.SPINE_LANE_CORRELATION_ID = laneCorrelationId;
	const args = useStub ? ["--stub"] : ["--pi"];

	return spawn(process.execPath, [runner, ...args], {
		cwd: worktreePath,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
}

/**
 * @param {import("node:child_process").ChildProcess | ReturnType<typeof startAgentSessionWorker>} child
 */
function collectChildOutput(child) {
	if (typeof child.wait === "function") {
		return child.wait();
	}
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
 * @param {object} [params.workerBackendDeps]
 */
function spawnWorkerHandle({
	worktreePath,
	taskFolder,
	useStub,
	timeoutMs,
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneCorrelationId,
	config,
	workerBackendDeps,
}) {
	if (!useStub && resolveWorkerBackend(config) === "agentSession") {
		return startAgentSessionWorker(
			{ worktreePath, taskFolder, config },
			workerBackendDeps ?? {},
		);
	}

	return spawnWorkerChild({
		worktreePath,
		taskFolder,
		useStub,
		timeoutMs,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
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

	const stallConfig = resolveStallConfig(config);
	const startedAt = Date.now();
	let lastProgressAt = startedAt;
	let lastHeartbeatAt = 0;
	let lastSignals = null;
	let stallWarningSent = false;

	const child = spawnWorkerHandle({
		worktreePath,
		taskFolder,
		useStub,
		timeoutMs,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneCorrelationId,
		config,
		workerBackendDeps,
	});
	onWorkerPid?.(child.pid ?? 0);
	const childDone = collectChildOutput(child);

	while (true) {
		if (fs.existsSync(donePath)) {
			break;
		}

		if (projectRoot && batchId) {
			const abortSignal = readAbortSignal(projectRoot, batchId);
			if (abortSignal) {
				const hard = Boolean(abortSignal.hard);
				child.kill(hard ? "SIGKILL" : "SIGTERM");
				const { output } = await childDone;
				return {
					ok: false,
					exitCode: hard ? 137 : 130,
					mode: workerMode,
					output,
					classification: "aborted",
					doneFound: fs.existsSync(donePath),
				};
			}
		}

		const now = Date.now();
		const signals = collectProgressSignals({
			worktreePath,
			taskFolder,
			laneBranch,
			fileScopePaths,
			journalContext:
				projectRoot && batchId
					? { projectRoot, batchId, laneNumber, taskId }
					: undefined,
		});
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
				correlationId: laneCorrelationId,
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
					correlationId: laneCorrelationId,
				});
				stallWarningSent = true;
			}
			child.kill("SIGTERM");
			const { output } = await childDone;
			return {
				ok: false,
				exitCode: 124,
				mode: workerMode,
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
		mode: workerMode,
		output,
		classification: doneFound ? "succeeded" : "failed",
		doneFound,
	};
}
