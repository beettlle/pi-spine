/**
 * Detached batch engine spawn — default for `spine batch start` and `spine batch resume`.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { runBatchPreflight } from "../../bin/spine-preflight.mjs";
import { validateResumeBatch } from "./resume.mjs";
import { readLastTaskFailedEvent } from "./journal.mjs";
import {
	ACTIVE_PHASES,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
	TERMINAL_BATCH_PHASES,
} from "./state.mjs";

export const DETACHED_ENGINE_LOG_REL = path.join(".spine", "runtime", "detached-engine.log");

/** @type {ReadonlySet<string>} */
const TERMINAL_TASK_STATUSES = new Set(["succeeded", "failed", "skipped", "aborted"]);

const FAILURE_LOG_TAIL_LINES = 20;

/**
 * @param {string} filePath
 * @param {number} [lineCount]
 * @returns {string|null}
 */
function readLogTailLines(filePath, lineCount = FAILURE_LOG_TAIL_LINES) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return null;
	return lines.slice(-lineCount).join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null|undefined} taskId
 * @returns {string|null}
 */
function findWorkerOutputLogPath(projectRoot, batchId, taskId) {
	const lanesDir = path.join(projectRoot, ".spine", "runtime", batchId, "lanes");
	if (!fs.existsSync(lanesDir)) return null;

	/** @type {string|null} */
	let newestPath = null;
	/** @type {number} */
	let newestMtime = 0;

	for (const laneDir of fs.readdirSync(lanesDir)) {
		if (!laneDir.startsWith("lane-")) continue;
		const lanePath = path.join(lanesDir, laneDir);
		for (const name of fs.readdirSync(lanePath)) {
			if (!name.startsWith("worker-output-") || !name.endsWith(".log")) continue;
			if (taskId && name !== `worker-output-${taskId}.log`) continue;
			const candidate = path.join(lanePath, name);
			const mtime = fs.statSync(candidate).mtimeMs;
			if (mtime >= newestMtime) {
				newestMtime = mtime;
				newestPath = candidate;
			}
		}
	}

	return newestPath;
}

/**
 * @param {object} event
 */
function summarizeTaskFailedEvent(event) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	/** @type {string[]} */
	const parts = [];
	if (event.taskId) parts.push(`task ${event.taskId}`);
	if (payload.classification) parts.push(String(payload.classification));
	if (payload.error) parts.push(String(payload.error).slice(0, 120));
	if (payload.output) parts.push(String(payload.output).slice(0, 120));
	if (payload.reason) parts.push(String(payload.reason));
	return parts.join(" — ") || JSON.stringify(payload).slice(0, 160);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null|undefined} [params.batchId]
 * @param {string|null|undefined} [params.taskId]
 * @param {string|null|undefined} [params.logPath]
 */
export function collectDetachedFailureDiagnostics({ projectRoot, batchId, taskId, logPath }) {
	/** @type {Record<string, unknown>} */
	const diagnostics = {};

	if (batchId) {
		const failedEvent = readLastTaskFailedEvent(projectRoot, batchId);
		if (failedEvent) {
			diagnostics.taskFailedEvent = failedEvent;
			diagnostics.taskFailedSummary = summarizeTaskFailedEvent(failedEvent);
		}
	}

	if (batchId) {
		const workerLogPath = findWorkerOutputLogPath(projectRoot, batchId, taskId ?? null);
		if (workerLogPath) {
			const tail = readLogTailLines(workerLogPath);
			if (tail) {
				diagnostics.workerLogPath = path.relative(projectRoot, workerLogPath);
				diagnostics.workerLogTail = tail;
			}
		}
	}

	const engineLogPath = logPath
		? path.isAbsolute(logPath)
			? logPath
			: path.join(projectRoot, logPath)
		: detachedEngineLogPath(projectRoot);
	const engineTail = readLogTailLines(engineLogPath);
	if (engineTail) {
		diagnostics.engineLogPath = path.isAbsolute(logPath ?? "")
			? logPath
			: logPath ?? DETACHED_ENGINE_LOG_REL;
			diagnostics.engineLogTail = engineTail;
	}

	return diagnostics;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string|null|undefined} [params.batchId]
 * @param {string|null|undefined} [params.taskId]
 * @param {string|null|undefined} [params.logPath]
 */
function attachDetachedFailureDiagnostics(payload, { projectRoot, batchId, taskId, logPath }) {
	const diagnostics = collectDetachedFailureDiagnostics({ projectRoot, batchId, taskId, logPath });
	if (diagnostics.taskFailedSummary) payload.taskFailedSummary = diagnostics.taskFailedSummary;
	if (diagnostics.workerLogTail) {
		payload.workerLogPath = diagnostics.workerLogPath;
		payload.workerLogTail = diagnostics.workerLogTail;
	}
	if (diagnostics.engineLogTail) {
		payload.engineLogPath = diagnostics.engineLogPath;
		payload.engineLogTail = diagnostics.engineLogTail;
	}
	return payload;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object|null|undefined} raw
 * @param {string|null|undefined} taskId
 */
function resumedTaskReachedTerminal(raw, taskId) {
	if (!taskId || !raw || !Array.isArray(raw.tasks)) return false;
	const task = raw.tasks.find((entry) => entry?.taskId === taskId);
	return Boolean(task && TERMINAL_TASK_STATUSES.has(String(task.status ?? "")));
}

/**
 * @param {object|null|undefined} raw
 * @param {string|null|undefined} taskId
 * @param {number} updatedAtBefore
 */
function evaluateDetachedResumeWait(raw, taskId, updatedAtBefore) {
	if (!raw?.batchId) return null;
	const updatedAt = Number(raw.updatedAt ?? 0);
	if (updatedAt <= updatedAtBefore) return null;

	if (TERMINAL_BATCH_PHASES.has(String(raw.phase ?? ""))) {
		return {
			ok: true,
			status: "resume_completed",
			batchId: raw.batchId,
			phase: raw.phase,
		};
	}

	if (raw.phase === "paused") {
		return {
			ok: true,
			status: "resume_completed",
			batchId: raw.batchId,
			phase: raw.phase,
			paused: true,
		};
	}

	if (resumedTaskReachedTerminal(raw, taskId)) {
		return {
			ok: true,
			status: "resume_completed",
			batchId: raw.batchId,
			phase: raw.phase,
		};
	}

	return null;
}

/**
 * @param {string} projectRoot
 */
export function detachedEngineLogPath(projectRoot) {
	return path.join(projectRoot, DETACHED_ENGINE_LOG_REL);
}

/**
 * @param {object} params
 * @param {string} params.scope
 * @param {boolean} [params.skipPreflight]
 */
export function buildAttachedBatchStartArgv({ scope, skipPreflight = false }) {
	const tokens = String(scope ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	const args = ["batch", "start", ...tokens, "--attached"];
	if (skipPreflight) args.push("--skip-preflight");
	return args;
}

/**
 * @param {object} params
 * @param {boolean} [params.force]
 */
export function buildAttachedBatchResumeArgv({ force = false }) {
	const args = ["batch", "resume", "--attached"];
	if (force) args.push("--force");
	return args;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.spineBin
 * @param {string[]} params.argv
 */
export function spawnDetachedBatchEngine({ projectRoot, spineBin, argv }) {
	const logPath = detachedEngineLogPath(projectRoot);
	fs.mkdirSync(path.dirname(logPath), { recursive: true });
	const logFd = fs.openSync(logPath, "a");
	fs.writeFileSync(
		logFd,
		`\n--- detached batch engine ${new Date().toISOString()} argv=${argv.join(" ")} ---\n`,
	);

	const child = spawn(process.execPath, [spineBin, ...argv], {
		cwd: projectRoot,
		detached: true,
		stdio: ["ignore", logFd, logFd],
		env: process.env,
	});
	child.unref();
	fs.closeSync(logFd);

	return { enginePid: child.pid ?? null, logPath: DETACHED_ENGINE_LOG_REL };
}

/**
 * @param {string} projectRoot
 * @param {number|null} enginePid
 */
function persistDetachedEnginePid(projectRoot, enginePid) {
	const pid = Number(enginePid);
	if (!Number.isFinite(pid) || pid <= 0) return;
	const { raw } = loadSpineBatchState(projectRoot);
	if (!raw) return;
	recordBatchEnginePid(raw, pid);
	saveSpineBatchState(projectRoot, raw);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | null} [params.previousBatchId]
 * @param {number} [params.timeoutMs]
 * @param {boolean} [params.waitTerminal]
 */
export async function waitForDetachedBatchStart({
	projectRoot,
	previousBatchId = null,
	timeoutMs = 30_000,
	waitTerminal = false,
}) {
	const deadline = Date.now() + timeoutMs;
	/** @type {string|null} */
	let startedBatchId = null;

	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		const batchId = raw?.batchId ?? null;
		if (batchId && batchId !== previousBatchId) {
			if (raw.phase === "failed" || raw.phase === "aborted") {
				return {
					ok: false,
					error: "batch_engine_failed",
					batchId,
					phase: raw.phase,
					lastError: raw.lastError ?? null,
				};
			}

			if (TERMINAL_BATCH_PHASES.has(String(raw.phase ?? "")) || raw.phase === "paused") {
				return {
					ok: true,
					status: "start_completed",
					batchId,
					phase: raw.phase,
				};
			}

			if (ACTIVE_PHASES.has(raw.phase)) {
				startedBatchId = batchId;
				if (!waitTerminal) {
					return {
						ok: true,
						status: "engine_started",
						batchId,
						phase: raw.phase,
					};
				}
			}
		}
		await sleep(200);
	}

	if (startedBatchId) {
		return {
			ok: false,
			error: "timeout_waiting_for_batch",
			batchId: startedBatchId,
			status: "engine_started",
		};
	}

	return { ok: false, error: "timeout_waiting_for_batch" };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.updatedAtBefore
 * @param {string|null|undefined} [params.taskId]
 * @param {number} [params.timeoutMs]
 * @param {boolean} [params.waitTerminal]
 */
export async function waitForDetachedBatchResume({
	projectRoot,
	batchId,
	updatedAtBefore,
	taskId = null,
	timeoutMs = 30_000,
	waitTerminal = false,
}) {
	const deadline = Date.now() + timeoutMs;
	/** @type {boolean} */
	let engineStarted = false;

	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		if (raw?.batchId !== batchId) {
			await sleep(200);
			continue;
		}

		if (raw.phase === "failed" || raw.phase === "aborted") {
			return {
				ok: false,
				error: "batch_engine_failed",
				batchId,
				phase: raw.phase,
				lastError: raw.lastError ?? null,
			};
		}

		const completed = evaluateDetachedResumeWait(raw, taskId, updatedAtBefore);
		if (completed) {
			return completed;
		}

		const updatedAt = Number(raw.updatedAt ?? 0);
		if (raw.phase === "running" && updatedAt > updatedAtBefore) {
			engineStarted = true;
			if (!waitTerminal) {
				return {
					ok: true,
					status: "engine_started",
					batchId,
					phase: raw.phase,
				};
			}
		}

		await sleep(200);
	}

	return {
		ok: false,
		error: "timeout_waiting_for_resume",
		batchId,
		engineStarted,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.skipPreflight]
 */
export function runDetachedStartPreflight({ projectRoot, skipPreflight = false }) {
	if (skipPreflight) {
		return { ok: true };
	}
	const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
	if (!preflight.ok) {
		return {
			ok: false,
			exitCode: preflight.exitCode ?? 1,
			error: "preflight_failed",
			output: preflight.output,
		};
	}
	return { ok: true };
}

/**
 * @param {object} result
 * @param {boolean} [json]
 */
export function formatDetachedEngineOutput(result, json = false) {
	if (json) {
		return `${JSON.stringify(result, null, 2)}\n`;
	}

	const operation = result.operation ?? "start";
	const operationLabel = operation === "resume" ? "resume" : "start";

	if (!result.ok) {
		const lines = [
			"",
			`Detached batch ${operationLabel} failed`,
			"",
			result.output ?? result.error ?? "Unknown error",
		];
		if (result.taskFailedSummary) {
			lines.push("", "  Last task.failed:", `    ${result.taskFailedSummary}`);
		}
		if (result.workerLogTail) {
			lines.push(
				"",
				`  Worker log tail${result.workerLogPath ? ` (${result.workerLogPath})` : ""}:`,
				...result.workerLogTail.split("\n").map((line) => `    ${line}`),
			);
		}
		if (result.engineLogTail) {
			lines.push(
				"",
				`  Detached engine log tail${result.engineLogPath ? ` (${result.engineLogPath})` : ""}:`,
				...result.engineLogTail.split("\n").map((line) => `    ${line}`),
			);
		}
		if (result.logPath) {
			lines.push("", `  Log: ${result.logPath}`);
		}
		if (result.suggestedCommand) {
			lines.push("", `  → ${result.suggestedCommand}`);
		}
		lines.push("", "  Run with --attached for foreground errors.", "");
		return lines.join("\n");
	}

	/** @type {string} */
	let headline;
	if (result.status === "resume_completed" || result.status === "start_completed") {
		headline =
			operationLabel === "resume"
				? "Batch resume completed."
				: "Batch start completed.";
	} else if (result.status === "engine_started") {
		headline =
			operationLabel === "resume"
				? "Batch engine resuming in the background (engine started; resume not yet confirmed)."
				: "Batch engine starting in the background (engine started; batch not yet confirmed).";
	} else {
		headline = `Batch engine ${operationLabel === "resume" ? "resuming" : "starting"} in the background.`;
	}

	const lines = ["", headline, ""];
	if (result.status) lines.push(`  Status: ${result.status}`);
	if (result.scope) lines.push(`  Scope: ${result.scope}`);
	if (result.batchId) lines.push(`  Batch: ${result.batchId}`);
	if (result.taskId) lines.push(`  Task: ${result.taskId}`);
	if (result.phase) lines.push(`  Phase: ${result.phase}`);
	if (result.enginePid) lines.push(`  Engine PID: ${result.enginePid}`);
	if (result.logPath) lines.push(`  Log: ${result.logPath}`);
	lines.push("", `  → ${result.suggestedCommand ?? "spine status --diagnose"}`, "");
	return lines.join("\n");
}

/** @deprecated use formatDetachedEngineOutput */
export function formatDetachedBatchStartOutput(result, json = false) {
	return formatDetachedEngineOutput(result, json);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.spineBin
 * @param {string} params.scope
 * @param {boolean} [params.skipPreflight]
 * @param {boolean} [params.waitTerminal]
 * @param {boolean} [params.json]
 */
export async function startBatchDetached({
	projectRoot,
	spineBin,
	scope,
	skipPreflight = false,
	waitTerminal = false,
	json = false,
}) {
	const preflight = runDetachedStartPreflight({ projectRoot, skipPreflight });
	if (!preflight.ok) {
		const payload = {
			ok: false,
			detached: true,
			operation: "start",
			error: preflight.error,
			output: preflight.output,
		};
		return {
			ok: false,
			exitCode: preflight.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const before = loadSpineBatchState(projectRoot);
	const previousBatchId = before.raw?.batchId ?? null;
	const argv = buildAttachedBatchStartArgv({ scope, skipPreflight: true });
	const { enginePid, logPath } = spawnDetachedBatchEngine({ projectRoot, spineBin, argv });
	const wait = await waitForDetachedBatchStart({ projectRoot, previousBatchId, waitTerminal });

	if (!wait.ok) {
		/** @type {Record<string, unknown>} */
		const payload = {
			ok: false,
			detached: true,
			operation: "start",
			scope,
			enginePid,
			logPath,
			error: wait.error,
			batchId: wait.batchId ?? null,
			lastError: wait.lastError ?? null,
			output:
				wait.error === "timeout_waiting_for_batch"
					? "Engine may still be running or orphaned — run `spine status --diagnose`."
					: `Batch engine exited before running (phase=${wait.phase ?? "unknown"}).`,
			suggestedCommand: "spine status --diagnose",
		};
		attachDetachedFailureDiagnostics(payload, {
			projectRoot,
			batchId: wait.batchId ?? null,
			logPath,
		});
		return {
			ok: false,
			exitCode: 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	persistDetachedEnginePid(projectRoot, enginePid);

	const payload = {
		ok: true,
		detached: true,
		operation: "start",
		status: wait.status ?? "engine_started",
		batchId: wait.batchId,
		phase: wait.phase,
		scope,
		enginePid,
		logPath,
		suggestedCommand: "spine status --diagnose",
	};
	return {
		ok: true,
		exitCode: 0,
		output: formatDetachedEngineOutput(payload, json),
		result: payload,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.spineBin
 * @param {boolean} [params.force]
 * @param {boolean} [params.waitTerminal]
 * @param {boolean} [params.json]
 */
export async function resumeBatchDetached({
	projectRoot,
	spineBin,
	force = false,
	waitTerminal = false,
	json = false,
}) {
	const resumeCheck = validateResumeBatch({ projectRoot, force });
	if (!resumeCheck.ok) {
		const payload = {
			ok: false,
			detached: true,
			operation: "resume",
			error: resumeCheck.error,
			output: resumeCheck.output,
			batchId: resumeCheck.batchId,
			taskId: resumeCheck.taskId,
		};
		return {
			ok: false,
			exitCode: resumeCheck.exitCode ?? 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const { batchId, updatedAt, taskId } = resumeCheck;
	const argv = buildAttachedBatchResumeArgv({ force });
	const { enginePid, logPath } = spawnDetachedBatchEngine({ projectRoot, spineBin, argv });
	persistDetachedEnginePid(projectRoot, enginePid);
	const wait = await waitForDetachedBatchResume({
		projectRoot,
		batchId,
		updatedAtBefore: updatedAt,
		taskId,
		waitTerminal,
	});

	if (!wait.ok) {
		/** @type {Record<string, unknown>} */
		const payload = {
			ok: false,
			detached: true,
			operation: "resume",
			batchId,
			taskId,
			enginePid,
			logPath,
			error: wait.error,
			lastError: wait.lastError ?? null,
			output:
				wait.error === "timeout_waiting_for_resume"
					? "Engine may still be running or orphaned — run `spine status --diagnose`."
					: `Batch resume failed (phase=${wait.phase ?? "unknown"}).`,
			suggestedCommand: "spine status --diagnose",
		};
		attachDetachedFailureDiagnostics(payload, { projectRoot, batchId, taskId, logPath });
		return {
			ok: false,
			exitCode: 1,
			output: formatDetachedEngineOutput(payload, json),
			result: payload,
		};
	}

	const payload = {
		ok: true,
		detached: true,
		operation: "resume",
		status: wait.status ?? "engine_started",
		batchId: wait.batchId,
		taskId,
		phase: wait.phase,
		enginePid,
		logPath,
		suggestedCommand: "spine status --diagnose",
	};
	return {
		ok: true,
		exitCode: 0,
		output: formatDetachedEngineOutput(payload, json),
		result: payload,
	};
}
