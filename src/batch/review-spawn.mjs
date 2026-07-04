/**
 * Reviewer pi spawn assembly and child process (FR-REV spawn contract).
 * SP-259 strangler extract from review.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { commandExists as pathCommandExists } from "../util/command-exists.mjs";
import { parseReviewVerdict } from "./review-shared.mjs";
import {
	resolveReviewerModelPin,
	resolveReviewerThinkingPin,
} from "../config/agent-model-resolve.mjs";
import {
	parseTaskSizeFromFolder,
	resolveReviewArtifactPollIntervalMs,
	resolveReviewArtifactQuiescenceMs,
	resolveReviewSpawnTimeoutMs,
} from "./task-stall-budget.mjs";

/** Exit code from reviewer spawn when `timeout` elapses (SP-221/SP-249/SP-279). */
export const REVIEW_SPAWN_TIMEOUT_EXIT_CODE = 124;

/** Journal `review.failed` payload reason when reviewer spawn exceeds budget. */
export const REVIEW_TIMEOUT_REASON = "review_timeout";

/** Journal `review.completed` honorReason when on-disk artifact is honored early. */
export const ARTIFACT_READY_HONOR_REASON = "artifact_ready";

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
	_taskFolder,
	reviewPrompt,
	systemPrompt,
	config = {},
	reviewType = "code",
}) {
	const reviewerAgentPath = path.join(worktreePath, ".spine", "agents", "reviewer.md");
	const reviewerModel = resolveReviewerModelPin(config, reviewType);
	const reviewerThinking = resolveReviewerThinkingPin(config, reviewType);

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
 * @typedef {{ lastMtimeMs: number|null, quiescentSinceMs: number|null }} ArtifactPollState
 */

/**
 * When artifact mtime is unchanged for the quiescence window, parse a terminal verdict.
 *
 * @param {object} params
 * @param {string} [params.artifactPath]
 * @param {"plan"|"code"|"final"} [params.reviewType]
 * @param {number} params.quiescenceMs
 * @param {ArtifactPollState} params.state
 * @returns {"APPROVE"|"REVISE"|"PASS"|"REPLAN"|null}
 */
export function pollTerminalReviewVerdict({
	artifactPath,
	reviewType = "code",
	quiescenceMs,
	state,
}) {
	if (!artifactPath || !fs.existsSync(artifactPath)) {
		state.lastMtimeMs = null;
		state.quiescentSinceMs = null;
		return null;
	}

	const mtimeMs = fs.statSync(artifactPath).mtimeMs;
	if (state.lastMtimeMs !== mtimeMs) {
		state.lastMtimeMs = mtimeMs;
		state.quiescentSinceMs = Date.now();
		return null;
	}

	if (state.quiescentSinceMs === null) {
		state.quiescentSinceMs = Date.now();
		return null;
	}

	if (Date.now() - state.quiescentSinceMs < quiescenceMs) {
		return null;
	}

	const reviewContent = fs.readFileSync(artifactPath, "utf-8");
	const { verdict } = parseReviewVerdict(reviewContent, { reviewType });
	return verdict;
}

/**
 * Final-review early honor uses the same contract guard as spawn-timeout honor.
 *
 * @param {"plan"|"code"|"final"} reviewType
 * @param {{ ok?: boolean }|null} contractVerifyResult
 */
export function isEarlyArtifactHonorAllowed(reviewType, contractVerifyResult) {
	if (reviewType === "final" && contractVerifyResult && !contractVerifyResult.ok) {
		return false;
	}
	return true;
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
	artifactPath,
	reviewType = "code",
	contractVerifyResult = null,
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
		reviewType,
	});

	const taskSize = parseTaskSizeFromFolder(taskFolder);
	const spawnTimeoutMs =
		timeoutMs ??
		resolveReviewSpawnTimeoutMs({
			config,
			taskSize,
		});
	const pollIntervalMs = resolveReviewArtifactPollIntervalMs({ config });
	const quiescenceMs = resolveReviewArtifactQuiescenceMs({ config });
	/** @type {ArtifactPollState} */
	const artifactPollState = { lastMtimeMs: null, quiescentSinceMs: null };

	return new Promise((resolve) => {
		const child = spawn("pi", piArgs, {
			cwd: worktreePath || path.dirname(taskFolder),
			env: buildReviewerChildEnv({ taskFolder, worktreePath }),
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		let timedOut = false;
		let settled = false;
		let killTimer = /** @type {NodeJS.Timeout|undefined} */ (undefined);

		/** @param {object} result */
		const finish = (result) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearInterval(pollTimer);
			clearTimeout(killTimer);
			resolve(result);
		};

		const terminateHungChild = () => {
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (!child.killed) {
					child.kill("SIGKILL");
				}
			}, REVIEW_SPAWN_KILL_GRACE_MS);
		};

		const checkArtifact = () => {
			if (settled || !artifactPath) return;
			if (!isEarlyArtifactHonorAllowed(reviewType, contractVerifyResult)) return;

			const verdict = pollTerminalReviewVerdict({
				artifactPath,
				reviewType,
				quiescenceMs,
				state: artifactPollState,
			});
			if (!verdict) return;

			terminateHungChild();
			finish({
				spawnFailed: false,
				exitCode: 0,
				error: "",
				honored: true,
				honorReason: ARTIFACT_READY_HONOR_REASON,
				artifactPath,
				verdict,
			});
		};

		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});

		const pollTimer = setInterval(checkArtifact, pollIntervalMs);
		checkArtifact();

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (!child.killed) {
					child.kill("SIGKILL");
				}
			}, REVIEW_SPAWN_KILL_GRACE_MS);
		}, spawnTimeoutMs);

		child.on("error", (error) => {
			finish({
				spawnFailed: true,
				exitCode: 1,
				error: error.message,
			});
		});

		child.on("close", (code) => {
			if (settled) return;
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
