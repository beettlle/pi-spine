/**
 * Reviewer pi spawn assembly and child process (FR-REV spawn contract).
 * SP-259 strangler extract from review.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { commandExists as pathCommandExists } from "../util/command-exists.mjs";
import { parseTaskSizeFromFolder, resolveReviewSpawnTimeoutMs } from "./task-stall-budget.mjs";

/** Exit code from reviewer spawn when `timeout` elapses (SP-221/SP-249/SP-279). */
export const REVIEW_SPAWN_TIMEOUT_EXIT_CODE = 124;

/** Journal `review.failed` payload reason when reviewer spawn exceeds budget. */
export const REVIEW_TIMEOUT_REASON = "review_timeout";

/** Default reviewer `pi` spawn timeout (90m); override with `SPINE_REVIEW_TIMEOUT_MS`. */
export const DEFAULT_REVIEW_SPAWN_TIMEOUT_MS = 90 * 60 * 1000;

/** Grace period after SIGTERM before SIGKILL on hung reviewer children. */
const REVIEW_SPAWN_KILL_GRACE_MS = 5_000;

/** Set by {@link buildWorkerChildEnv} when the batch engine launches a pi worker child. */
export function isActiveWorkerSession() {
	const marker = process.env.SPINE_WORKER_RUNNER;
	return typeof marker === "string" && marker.length > 0;
}

/**
 * True when this process is a live pi worker child that must not spawn nested reviewers.
 * Requires {@link isActiveWorkerSession} plus `SPINE_TASK_FOLDER` from
 * {@link buildWorkerChildEnv} so engine processes that only inherited `SPINE_WORKER_RUNNER`
 * can still spawn engine-owned reviewers (SP-285 / issue #8).
 */
export function shouldBlockNestedReviewerSpawn() {
	if (!isActiveWorkerSession()) return false;
	const taskFolder = process.env.SPINE_TASK_FOLDER;
	return typeof taskFolder === "string" && taskFolder.length > 0;
}

/**
 * Reviewer `pi` child env: inherit parent env but strip the worker session marker so
 * reviewer subprocesses are not treated as nested worker sessions.
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {string} params.worktreePath
 * @returns {NodeJS.ProcessEnv}
 */
export function buildReviewerChildEnv({ taskFolder, worktreePath }) {
	/** @type {NodeJS.ProcessEnv} */
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
	};
	delete env.SPINE_WORKER_RUNNER;
	return env;
}

export const NESTED_REVIEW_SPAWN_BLOCKED =
	"Nested reviewer spawn blocked inside pi worker session. Skip in-worker plan/code review — the batch engine runs reviews after worker success (SP-195).";

export const NESTED_REVIEW_SPAWN_REASON = "nested_spawn_blocked";

/**
 * @param {string} cmd
 */
function reviewerPiCommandExists(cmd) {
	if (process.env.SPINE_REVIEW_TEST_NO_PI === "1") return false;
	return pathCommandExists(cmd);
}

/**
 * @param {object} params
 */
export function buildReviewerPiArgs({
	worktreePath,
	taskFolder,
	reviewPrompt,
	systemPrompt,
	config = {},
}) {
	const reviewerAgentPath = path.join(worktreePath, ".spine", "agents", "reviewer.md");
	const reviewerModel = config?.agents?.reviewer?.model;
	const reviewerThinking = config?.agents?.reviewer?.thinking;

	const piArgs = ["-p", "--no-session"];
	if (reviewerAgentPath && fs.existsSync(reviewerAgentPath)) {
		piArgs.push("--append-system-prompt", reviewerAgentPath);
	}
	if (systemPrompt) {
		piArgs.push("--append-system-prompt", systemPrompt);
	}
	if (reviewerModel && reviewerModel !== "inherit") {
		piArgs.push("--model", reviewerModel);
	}
	if (reviewerThinking && reviewerThinking !== "off") {
		piArgs.push("--thinking", reviewerThinking);
	}
	piArgs.push(reviewPrompt);

	return piArgs;
}

/**
 * @param {object} params
 */
export async function spawnReviewerPi({
	worktreePath,
	taskFolder,
	reviewPrompt,
	systemPrompt,
	config = {},
	timeoutMs,
}) {
	if (!reviewerPiCommandExists("pi")) {
		return {
			spawnFailed: true,
			exitCode: 127,
			error: "pi not available for reviewer spawn",
		};
	}

	const piArgs = buildReviewerPiArgs({
		worktreePath,
		taskFolder,
		reviewPrompt,
		systemPrompt,
		config,
	});

	const taskSize = parseTaskSizeFromFolder(taskFolder);
	const spawnTimeoutMs =
		timeoutMs ??
		resolveReviewSpawnTimeoutMs({
			config,
			taskSize,
		});

	return new Promise((resolve) => {
		const child = spawn("pi", piArgs, {
			cwd: worktreePath || path.dirname(taskFolder),
			env: buildReviewerChildEnv({ taskFolder, worktreePath }),
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		let timedOut = false;
		let settled = false;

		/** @param {object} result */
		const finish = (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			resolve(result);
		};

		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (!child.killed) {
					child.kill("SIGKILL");
				}
			}, REVIEW_SPAWN_KILL_GRACE_MS);
		}, spawnTimeoutMs);
		let killTimer = /** @type {NodeJS.Timeout|undefined} */ (undefined);

		child.on("error", (error) => {
			finish({
				spawnFailed: true,
				exitCode: 1,
				error: error.message,
			});
		});

		child.on("close", (code) => {
			if (timedOut) {
				finish({
					spawnFailed: true,
					exitCode: REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
					error: "reviewer spawn timed out",
					reason: REVIEW_TIMEOUT_REASON,
				});
				return;
			}
			if (code !== 0) {
				finish({
					spawnFailed: true,
					exitCode: code ?? 1,
					error: stderr.trim() || `reviewer exited with code ${code ?? 1}`,
				});
				return;
			}
			finish({ spawnFailed: false, exitCode: 0, error: "" });
		});
	});
}
