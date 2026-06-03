/**
 * Detached batch engine spawn — default for `spine batch start` and `spine batch resume`.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { runBatchPreflight } from "../../bin/spine-preflight.mjs";
import { validateResumeBatch } from "./resume.mjs";
import { ACTIVE_PHASES, loadSpineBatchState, recordBatchEnginePid, saveSpineBatchState } from "./state.mjs";

export const DETACHED_ENGINE_LOG_REL = path.join(".spine", "runtime", "detached-engine.log");

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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
 */
export async function waitForDetachedBatchStart({
	projectRoot,
	previousBatchId = null,
	timeoutMs = 30_000,
}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		const batchId = raw?.batchId ?? null;
		if (batchId && batchId !== previousBatchId) {
			if (ACTIVE_PHASES.has(raw.phase)) {
				return { ok: true, batchId, phase: raw.phase };
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
		}
		await sleep(200);
	}
	return { ok: false, error: "timeout_waiting_for_batch" };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.updatedAtBefore
 * @param {number} [params.timeoutMs]
 */
export async function waitForDetachedBatchResume({
	projectRoot,
	batchId,
	updatedAtBefore,
	timeoutMs = 30_000,
}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const { raw } = loadSpineBatchState(projectRoot);
		if (raw?.batchId !== batchId) {
			await sleep(200);
			continue;
		}

		const updatedAt = Number(raw.updatedAt ?? 0);
		if (raw.phase === "running" && updatedAt > updatedAtBefore) {
			return { ok: true, batchId, phase: raw.phase };
		}
		if (raw.phase === "completed" && updatedAt > updatedAtBefore) {
			return { ok: true, batchId, phase: raw.phase, fastComplete: true };
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
		await sleep(200);
	}
	return { ok: false, error: "timeout_waiting_for_resume", batchId };
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
		if (result.logPath) {
			lines.push("", `  Log: ${result.logPath}`);
		}
		lines.push("", "  Run with --attached for foreground errors.", "");
		return lines.join("\n");
	}

	const lines = [
		"",
		`Batch engine ${operationLabel === "resume" ? "resuming" : "starting"} in the background.`,
		"",
	];
	if (result.scope) lines.push(`  Scope: ${result.scope}`);
	if (result.batchId) lines.push(`  Batch: ${result.batchId}`);
	if (result.taskId) lines.push(`  Task: ${result.taskId}`);
	if (result.enginePid) lines.push(`  Engine PID: ${result.enginePid}`);
	if (result.logPath) lines.push(`  Log: ${result.logPath}`);
	lines.push("", "  → spine status --diagnose", "");
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
 * @param {boolean} [params.json]
 */
export async function startBatchDetached({
	projectRoot,
	spineBin,
	scope,
	skipPreflight = false,
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
	const wait = await waitForDetachedBatchStart({ projectRoot, previousBatchId });

	if (!wait.ok) {
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
					? "Timed out waiting for batch-state.json. Check the detached engine log."
					: `Batch engine exited before running (phase=${wait.phase ?? "unknown"}).`,
		};
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
 * @param {boolean} [params.json]
 */
export async function resumeBatchDetached({ projectRoot, spineBin, force = false, json = false }) {
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
	const wait = await waitForDetachedBatchResume({ projectRoot, batchId, updatedAtBefore: updatedAt });

	if (!wait.ok) {
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
					? "Timed out waiting for batch resume. Check the detached engine log."
					: `Batch resume failed (phase=${wait.phase ?? "unknown"}).`,
		};
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
