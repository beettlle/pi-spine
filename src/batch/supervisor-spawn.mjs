/**
 * FR-SHIP-11 Tier 1 — opt-in supervisor monitor spawn on detached batch start.
 * Detached node child polls reconcileBatch and journals supervisor.* events.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { reconcileBatch } from "./reconcile.mjs";
import { buildDiagnosisOutput } from "./diagnosis.mjs";
import { TERMINAL_BATCH_PHASES } from "./state.mjs";

const __filename = fileURLToPath(import.meta.url);

/** Default reconcile poll interval when config omits pollIntervalMs. */
export const DEFAULT_SUPERVISOR_POLL_INTERVAL_MS = 30_000;

/** Diagnoses that warrant a supervisor.nudge journal event on transition. */
export const SUPERVISOR_NUDGE_DIAGNOSES = new Set([
	"needs_retry",
	"engine_orphaned",
	"worker_orphaned",
	"state_drift",
	"needs_integrate",
	"needs_merge",
	"limbo_stale",
	"completed_manual",
	"failed",
	"aborted",
	"worker_done_missing",
	"human_base_diverged",
]);

/**
 * @param {object} [config]
 */
export function isSupervisorSpawnEnabled(config = {}) {
	return config.agents?.supervisor?.enabled === true;
}

/**
 * @param {object} [config]
 */
export function resolveSupervisorPollIntervalMs(config = {}) {
	const raw = Number(config.agents?.supervisor?.pollIntervalMs);
	if (Number.isFinite(raw) && raw >= 1_000) {
		return raw;
	}
	return DEFAULT_SUPERVISOR_POLL_INTERVAL_MS;
}

/**
 * @param {object} [config]
 * @returns {string}
 */
export function resolveSupervisorModel(config = {}) {
	const model = config.agents?.supervisor?.model;
	if (typeof model === "string" && model.length > 0) {
		return model;
	}
	return "inherit";
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function supervisorStatePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "supervisor.json");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function readSupervisorState(projectRoot, batchId) {
	const filePath = supervisorStatePath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} state
 */
export function writeSupervisorState(projectRoot, batchId, state) {
	const filePath = supervisorStatePath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function clearSupervisorState(projectRoot, batchId) {
	const filePath = supervisorStatePath(projectRoot, batchId);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

/**
 * @param {number} ms
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} reconciliation
 */
export function isSupervisorMonitorTerminal(reconciliation) {
	if (!reconciliation?.batchId) return true;
	const phase = String(reconciliation.phase ?? "");
	if (TERMINAL_BATCH_PHASES.has(phase)) return true;
	const diagnosis = String(reconciliation.diagnosis ?? "");
	if (diagnosis === "completed" || diagnosis === "completed_manual") return true;
	return false;
}

/**
 * @param {object} reconciliation
 */
function countTasksByStatus(reconciliation) {
	const tasks = reconciliation.signals?.tasks;
	if (!Array.isArray(tasks)) {
		return { runningTaskCount: 0, pendingTaskCount: 0 };
	}
	let runningTaskCount = 0;
	let pendingTaskCount = 0;
	for (const task of tasks) {
		const status = String(task?.status ?? "");
		if (status === "running") runningTaskCount += 1;
		if (status === "pending") pendingTaskCount += 1;
	}
	return { runningTaskCount, pendingTaskCount };
}

/**
 * @param {object} reconciliation
 */
export function buildSupervisorObservationPayload(reconciliation) {
	const { runningTaskCount, pendingTaskCount } = countTasksByStatus(reconciliation);
	return {
		diagnosis: reconciliation.diagnosis ?? null,
		macroPhase: reconciliation.macroPhase ?? null,
		macroPhaseLabel: reconciliation.macroPhaseLabel ?? null,
		phase: reconciliation.phase ?? null,
		runningTaskCount,
		pendingTaskCount,
		suggestedCommand: reconciliation.suggestedCommand ?? null,
	};
}

/**
 * @param {string|null|undefined} diagnosis
 * @param {object} [ctx]
 */
export function buildSupervisorNudgePayload(diagnosis, ctx = {}) {
	const output = buildDiagnosisOutput(diagnosis ?? "running", ctx);
	return {
		diagnosis: diagnosis ?? null,
		headline: output.headline ?? null,
		suggestedCommand: output.suggestedCommand ?? null,
	};
}

/**
 * @param {string|null|undefined} diagnosis
 */
export function shouldEmitSupervisorNudge(diagnosis) {
	return Boolean(diagnosis && SUPERVISOR_NUDGE_DIAGNOSES.has(diagnosis));
}

/**
 * Detached poll loop — runs in child process when SPINE_SUPERVISOR_MONITOR=1.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} [params.config]
 * @param {number|null} [params.supervisorPid]
 */
export async function runSupervisorMonitorLoop({
	projectRoot,
	batchId,
	config = {},
	supervisorPid = null,
}) {
	const pollIntervalMs = resolveSupervisorPollIntervalMs(config);
	const model = resolveSupervisorModel(config);
	const pid = supervisorPid ?? process.pid;

	appendJournalEvent(projectRoot, batchId, "supervisor.started", {
		batchId,
		model,
		pid,
		pollIntervalMs,
	});

	/** @type {string|null} */
	let lastNudgeDiagnosis = null;

	while (true) {
		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		if (!reconciliation.batchId || reconciliation.batchId !== batchId) {
			appendJournalEvent(projectRoot, batchId, "supervisor.stopped", {
				reason: "batch_state_cleared",
				pid,
			});
			clearSupervisorState(projectRoot, batchId);
			return;
		}

		appendJournalEvent(
			projectRoot,
			batchId,
			"supervisor.observation",
			buildSupervisorObservationPayload(reconciliation),
		);

		const diagnosis = reconciliation.diagnosis ?? null;
		if (
			shouldEmitSupervisorNudge(diagnosis) &&
			diagnosis !== lastNudgeDiagnosis
		) {
			lastNudgeDiagnosis = diagnosis;
			appendJournalEvent(
				projectRoot,
				batchId,
				"supervisor.nudge",
				buildSupervisorNudgePayload(diagnosis, {
					batchId,
					phase: reconciliation.phase,
					failedTaskId: reconciliation.signals?.failedTaskId ?? null,
				}),
			);
		}

		if (isSupervisorMonitorTerminal(reconciliation)) {
			appendJournalEvent(projectRoot, batchId, "supervisor.stopped", {
				reason: "batch_terminal",
				diagnosis,
				phase: reconciliation.phase ?? null,
				pid,
			});
			clearSupervisorState(projectRoot, batchId);
			return;
		}

		await sleep(pollIntervalMs);
	}
}

/**
 * @param {number} pid
 */
function killProcess(pid) {
	try {
		process.kill(pid, "SIGTERM");
	} catch {
		return;
	}
	setTimeout(() => {
		try {
			process.kill(pid, 0);
			process.kill(pid, "SIGKILL");
		} catch {
			// already exited
		}
	}, 1_000).unref?.();
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} [params.reason]
 */
export function killSupervisor({ projectRoot, batchId, reason = "killed" }) {
	const state = readSupervisorState(projectRoot, batchId);
	if (!state) return { killed: false, reason: "no_supervisor_state" };

	const pid = Number(state.pid);
	if (Number.isFinite(pid) && pid > 0) {
		killProcess(pid);
	}

	appendJournalEvent(projectRoot, batchId, "supervisor.stopped", {
		reason,
		pid: Number.isFinite(pid) ? pid : null,
	});
	clearSupervisorState(projectRoot, batchId);
	return { killed: true, pid: Number.isFinite(pid) ? pid : null };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} [reason]
 */
export function terminateSupervisorIfRunning(projectRoot, batchId, reason = "batch_lifecycle") {
	return killSupervisor({ projectRoot, batchId, reason });
}

/**
 * Spawn detached supervisor monitor when opt-in config is enabled.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} [params.config]
 */
export function spawnDetachedSupervisor({ projectRoot, batchId, config = {} }) {
	if (!isSupervisorSpawnEnabled(config)) {
		return { spawned: false };
	}

	const model = resolveSupervisorModel(config);
	const pollIntervalMs = resolveSupervisorPollIntervalMs(config);

	const child = spawn(process.execPath, [__filename], {
		cwd: projectRoot,
		detached: true,
		stdio: "ignore",
		env: {
			...process.env,
			SPINE_SUPERVISOR_MONITOR: "1",
			SPINE_PROJECT_ROOT: projectRoot,
			SPINE_BATCH_ID: batchId,
		},
	});
	child.unref();

	const supervisorPid = child.pid ?? null;
	if (supervisorPid) {
		writeSupervisorState(projectRoot, batchId, {
			pid: supervisorPid,
			model,
			pollIntervalMs,
			startedAt: Date.now(),
		});
	}

	return { spawned: true, supervisorPid, model, pollIntervalMs };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} [params.config]
 */
export function maybeSpawnSupervisorOnDetachedStart({ projectRoot, batchId, config }) {
	if (!batchId) return { spawned: false };
	const resolvedConfig = config ?? loadSpineConfig(projectRoot).config ?? {};
	return spawnDetachedSupervisor({ projectRoot, batchId, config: resolvedConfig });
}

if (process.env.SPINE_SUPERVISOR_MONITOR === "1") {
	const projectRoot = process.env.SPINE_PROJECT_ROOT ?? process.cwd();
	const batchId = process.env.SPINE_BATCH_ID ?? "";
	const config = loadSpineConfig(projectRoot).config ?? {};
	runSupervisorMonitorLoop({ projectRoot, batchId, config, supervisorPid: process.pid })
		.then(() => process.exit(0))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
