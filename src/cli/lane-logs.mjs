/**
 * Resolve and tail lane worker logs (issue #50, SP-366).
 */

import fs from "node:fs";
import path from "node:path";
import {
	classifyTasks,
	loadBatchStateFile,
	parseBatchState,
} from "../batch/reconcile.mjs";
import {
	workerLiveLogPath,
	workerOutputLogPath,
} from "../batch/worker-output.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import { resolveFollowBatchId } from "./journal-follow.mjs";

const LIVE_LOG_PREFIX = "worker-live-";
const OUTPUT_LOG_PREFIX = "worker-output-";
const LOG_SUFFIX = ".log";

/**
 * @param {string|undefined|null} value
 */
export function parseLaneNumber(value) {
	const laneNumber = Number(value);
	if (!Number.isFinite(laneNumber) || laneNumber < 1) return null;
	return laneNumber;
}

/**
 * @param {string[]} args
 */
export function parseLaneLogsArgs(args) {
	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] ?? null : null;
	const laneIdx = args.indexOf("--lane");
	const laneNumber = laneIdx >= 0 ? parseLaneNumber(args[laneIdx + 1]) : null;
	const taskIdx = args.indexOf("--task");
	const taskId = taskIdx >= 0 ? args[taskIdx + 1] ?? null : null;
	const follow = args.includes("--follow");
	return { batchId, laneNumber, taskId, follow };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 */
export function laneRuntimeDir(projectRoot, batchId, laneNumber) {
	return path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
	);
}

/**
 * @param {string} filename
 * @param {string} prefix
 */
export function extractTaskIdFromLogFilename(filename, prefix) {
	if (!filename.startsWith(prefix) || !filename.endsWith(LOG_SUFFIX)) return null;
	const taskId = filename.slice(prefix.length, filename.length - LOG_SUFFIX.length);
	return taskId.length > 0 ? taskId : null;
}

/**
 * @param {string} laneDir
 * @param {typeof fs} fileSystem
 */
export function findMostRecentLogTaskId(laneDir, fileSystem = fs) {
	if (!fileSystem.existsSync(laneDir)) return null;

	/** @type {{ taskId: string, mtimeMs: number } | null} */
	let latest = null;

	for (const entry of fileSystem.readdirSync(laneDir)) {
		if (!entry.endsWith(LOG_SUFFIX)) continue;
		const taskId =
			extractTaskIdFromLogFilename(entry, LIVE_LOG_PREFIX) ??
			extractTaskIdFromLogFilename(entry, OUTPUT_LOG_PREFIX);
		if (!taskId) continue;

		const stat = fileSystem.statSync(path.join(laneDir, entry));
		if (!latest || stat.mtimeMs > latest.mtimeMs) {
			latest = { taskId, mtimeMs: stat.mtimeMs };
		}
	}

	return latest?.taskId ?? null;
}

/**
 * @param {string} projectRoot
 * @param {number} laneNumber
 */
export function resolveRunningTaskIdForLane(projectRoot, laneNumber) {
	const loaded = loadBatchStateFile(projectRoot, null);
	const batch = loaded.raw ? parseBatchState(loaded.raw, loaded.path ?? "") : null;
	if (!batch) return null;

	const tasksRoot = resolveTasksRootPath(projectRoot);
	const classifiedTasks = classifyTasks(batch, tasksRoot);
	const running = classifiedTasks.filter(
		(task) =>
			Number(task.laneNumber) === laneNumber && task.classification === "running",
	);
	if (running.length === 1) return running[0].taskId;
	if (running.length > 1) {
		return running[running.length - 1].taskId;
	}
	return null;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.laneNumber
 * @param {string|null|undefined} params.taskId
 * @param {typeof fs} [params.fileSystem]
 */
export function resolveLaneLogTaskId(
	{ projectRoot, batchId, laneNumber, taskId },
	fileSystem = fs,
) {
	if (taskId) return taskId;

	const runningTaskId = resolveRunningTaskIdForLane(projectRoot, laneNumber);
	if (runningTaskId) return runningTaskId;

	return findMostRecentLogTaskId(laneRuntimeDir(projectRoot, batchId, laneNumber), fileSystem);
}

/**
 * Prefer live log when present, else terminal worker-output log.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.laneNumber
 * @param {string} params.taskId
 * @param {typeof fs} [params.fileSystem]
 */
export function resolveLaneLogPath(
	{ projectRoot, batchId, laneNumber, taskId },
	fileSystem = fs,
) {
	const livePath = workerLiveLogPath(projectRoot, batchId, laneNumber, taskId);
	if (fileSystem.existsSync(livePath)) {
		return { logPath: livePath, kind: "live" };
	}

	const outputPath = workerOutputLogPath(projectRoot, batchId, laneNumber, taskId);
	if (fileSystem.existsSync(outputPath)) {
		return { logPath: outputPath, kind: "output" };
	}

	return { logPath: livePath, kind: "missing" };
}

/**
 * @param {string} filePath
 * @param {{ onChunk: (chunk: string) => void }} options
 * @param {typeof fs} fileSystem
 * @returns {number}
 */
export function readLaneLogSnapshot(filePath, options, fileSystem = fs) {
	const content = fileSystem.readFileSync(filePath, "utf-8");
	if (content) options.onChunk(content);
	const stat = fileSystem.statSync(filePath);
	return stat.size;
}

const defaultDeps = {
	fs,
	stdout: process.stdout,
	onSignal: (signal, handler) => process.on(signal, handler),
	offSignal: (signal, handler) => process.off(signal, handler),
};

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 * @param {boolean} [options.follow]
 * @param {typeof defaultDeps} [options.deps]
 */
export async function runLaneLogs(options) {
	const { projectRoot, args = [], follow: followOverride, deps = defaultDeps } = options;
	const { batchId: argBatchId, laneNumber, taskId: argTaskId, follow: argFollow } =
		parseLaneLogsArgs(args);
	const follow = followOverride ?? argFollow;

	if (laneNumber == null) {
		return {
			exitCode: 1,
			output: "Lane number is required (pass --lane N)\n",
		};
	}

	let batchId = null;
	try {
		batchId = resolveFollowBatchId(projectRoot, argBatchId);
	} catch (error) {
		return {
			exitCode: 1,
			output: `${error instanceof Error ? error.message : String(error)}\n`,
		};
	}
	if (!batchId) {
		return {
			exitCode: 1,
			output: "No active batch for lane logs (pass --batch {id} or start a batch)\n",
		};
	}

	const taskId = resolveLaneLogTaskId(
		{ projectRoot, batchId, laneNumber, taskId: argTaskId },
		deps.fs,
	);
	if (!taskId) {
		return {
			exitCode: 1,
			output: `No worker log found for lane ${laneNumber} (pass --task {id})\n`,
		};
	}

	const resolved = resolveLaneLogPath(
		{ projectRoot, batchId, laneNumber, taskId },
		deps.fs,
	);
	if (resolved.kind === "missing") {
		return {
			exitCode: 1,
			output: `Worker log not found for lane ${laneNumber} task ${taskId}: ${resolved.logPath}\n`,
		};
	}

	/** @type {string[]} */
	const chunks = [];
	const onChunk = (chunk) => {
		chunks.push(chunk);
		deps.stdout.write(chunk);
	};

	let offset = readLaneLogSnapshot(resolved.logPath, { onChunk }, deps.fs);

	if (!follow) {
		return { exitCode: 0, output: chunks.join("") };
	}

	return new Promise((resolve) => {
		/** @type {import("node:fs").FSWatcher|null} */
		let watcher = null;

		const cleanup = (exitCode = 0) => {
			if (watcher) watcher.close();
			resolve({ exitCode, output: chunks.join("") });
		};

		const onChange = () => {
			try {
				const filePath = resolved.logPath;
				if (!deps.fs.existsSync(filePath)) return;

				const stat = deps.fs.statSync(filePath);
				if (stat.size < offset) {
					offset = 0;
				}
				if (stat.size <= offset) return;

				const toRead = stat.size - offset;
				const fd = deps.fs.openSync(filePath, "r");
				try {
					const buffer = Buffer.alloc(toRead);
					deps.fs.readSync(fd, buffer, 0, toRead, offset);
					offset = stat.size;
					onChunk(buffer.toString("utf-8"));
				} finally {
					deps.fs.closeSync(fd);
				}
			} catch {
				// Transient read races while the worker appends are expected during follow.
			}
		};

		watcher = deps.fs.watch(resolved.logPath, onChange);
		const onSigInt = () => cleanup(0);
		const onSigTerm = () => cleanup(0);
		deps.onSignal("SIGINT", onSigInt);
		deps.onSignal("SIGTERM", onSigTerm);
	});
}
