/**
 * Taskplane / pi-spine mutual exclusion (PRD §22.1).
 * Inspects `.spine/batch-state.json` and `.pi/batch-state.json` independently.
 */

import fs from "node:fs";
import path from "node:path";
import { ACTIVE_PHASES } from "../batch/state.mjs";
import { parseBatchState, runReconciliationCheck } from "../batch/reconcile.mjs";

export const SPINE_BATCH_STATE_REL = path.join(".spine", "batch-state.json");
export const TASKPLANE_BATCH_STATE_REL = path.join(".pi", "batch-state.json");

/** @typedef {"spine"|"taskplane"} OrchestratorSource */

/** @typedef {object} OrchestratorBatchSnapshot
 * @property {OrchestratorSource} source
 * @property {string} path
 * @property {string|null} batchId
 * @property {string|null} phase
 * @property {string|null} diagnosis
 * @property {boolean} blocking
 */

/** @typedef {object} CoexistenceAssessment
 * @property {boolean} ok
 * @property {"none"|"taskplane_active"|"spine_active"|"dual_active"} kind
 * @property {string} message
 * @property {string|null} suggestedCommand
 * @property {string[]} alternatives
 * @property {OrchestratorBatchSnapshot|null} spine
 * @property {OrchestratorBatchSnapshot|null} taskplane
 */

const NON_BLOCKING_DIAGNOSES = new Set(["completed"]);

const TASKPLANE_ACTIVE_PHASES = new Set([
	"planning",
	"running",
	"paused",
	"executing",
	"merging",
	"stopped",
]);

/**
 * @param {string} projectRoot
 */
export function resolveOrchestratorBatchPaths(projectRoot) {
	return {
		spine: path.join(projectRoot, SPINE_BATCH_STATE_REL),
		taskplane: path.join(projectRoot, TASKPLANE_BATCH_STATE_REL),
	};
}

/**
 * @param {string} batchStatePath
 * @param {Record<string, unknown>|null} [raw]
 * @returns {OrchestratorSource|null}
 */
export function classifyBatchStateSource(batchStatePath, raw = null) {
	const normalized = batchStatePath.replace(/\\/g, "/");
	if (normalized.includes("/.spine/")) return "spine";
	if (normalized.includes("/.pi/")) return "taskplane";
	if (raw) return inferBatchStateSourceFromRaw(raw);
	return null;
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {OrchestratorSource|null}
 */
export function inferBatchStateSourceFromRaw(raw) {
	if (raw.schemaVersion === 1 && (raw.wavePlan != null || raw.resilience != null)) {
		return "spine";
	}

	const phase = String(raw.phase ?? raw.status ?? "").toLowerCase();
	if (phase === "executing") return "taskplane";
	if (raw.operator != null) return "taskplane";
	if (raw.schemaVersion === 1) return "spine";

	return null;
}

/**
 * @param {string} filePath
 */
function loadBatchStateAtPath(filePath) {
	if (!fs.existsSync(filePath)) {
		return { path: null, raw: null, parseError: null, source: null };
	}

	try {
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return {
			path: filePath,
			raw,
			parseError: null,
			source: classifyBatchStateSource(filePath, raw),
		};
	} catch (err) {
		return {
			path: filePath,
			raw: null,
			parseError: err instanceof Error ? err.message : String(err),
			source: classifyBatchStateSource(filePath, null),
		};
	}
}

/**
 * @param {object} loaded
 * @param {string} projectRoot
 * @param {typeof runReconciliationCheck} runReconciliation
 */
function isBlockingBatchState(loaded, projectRoot, runReconciliation) {
	if (!loaded.path || loaded.parseError || !loaded.raw) return false;

	const reconciliation = runReconciliation({
		projectRoot,
		batchState: loaded.raw,
		batchStatePath: loaded.path,
	});

	if (reconciliation.diagnosis && NON_BLOCKING_DIAGNOSES.has(reconciliation.diagnosis)) {
		return false;
	}

	if (reconciliation.diagnosis) return true;

	const phase = String(loaded.raw.phase ?? loaded.raw.status ?? "").toLowerCase();
	const source = loaded.source ?? classifyBatchStateSource(loaded.path, loaded.raw);

	if (source === "spine") {
		return ACTIVE_PHASES.has(phase) || loaded.raw.endedAt == null;
	}

	if (source === "taskplane") {
		return TASKPLANE_ACTIVE_PHASES.has(phase) && loaded.raw.endedAt == null;
	}

	return loaded.raw.endedAt == null;
}

/**
 * @param {object} loaded
 * @param {string} projectRoot
 * @param {boolean} blocking
 * @param {typeof runReconciliationCheck} runReconciliation
 * @returns {OrchestratorBatchSnapshot|null}
 */
function toSnapshot(loaded, projectRoot, blocking, runReconciliation) {
	if (!loaded.path || !loaded.raw || loaded.parseError) return null;

	const reconciliation = runReconciliation({
		projectRoot,
		batchState: loaded.raw,
		batchStatePath: loaded.path,
	});
	const parsed = parseBatchState(loaded.raw, loaded.path);

	return {
		source:
			loaded.source ??
			parsed?.source ??
			classifyBatchStateSource(loaded.path, loaded.raw) ??
			"taskplane",
		path: loaded.path,
		batchId: String(loaded.raw.batchId ?? loaded.raw.id ?? "").trim() || null,
		phase: String(loaded.raw.phase ?? loaded.raw.status ?? null),
		diagnosis: reconciliation.diagnosis ?? null,
		blocking,
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {typeof runReconciliationCheck} [ctx.runReconciliation]
 * @returns {CoexistenceAssessment}
 */
export function assessOrchestratorCoexistence(ctx) {
	const { projectRoot } = ctx;
	const runReconciliation = ctx.runReconciliation ?? runReconciliationCheck;
	const paths = resolveOrchestratorBatchPaths(projectRoot);

	const spineLoaded = loadBatchStateAtPath(paths.spine);
	const taskplaneLoaded = loadBatchStateAtPath(paths.taskplane);

	const spineBlocking = isBlockingBatchState(spineLoaded, projectRoot, runReconciliation);
	const taskplaneBlocking = isBlockingBatchState(taskplaneLoaded, projectRoot, runReconciliation);

	const spineSnapshot = spineBlocking
		? toSnapshot(spineLoaded, projectRoot, true, runReconciliation)
		: null;
	const taskplaneSnapshot = taskplaneBlocking
		? toSnapshot(taskplaneLoaded, projectRoot, true, runReconciliation)
		: null;

	if (spineBlocking && taskplaneBlocking) {
		const spineId = spineSnapshot?.batchId ?? "unknown";
		const taskplaneId = taskplaneSnapshot?.batchId ?? "unknown";
		return {
			ok: false,
			kind: "dual_active",
			message: `Taskplane batch ${taskplaneId} and pi-spine batch ${spineId} are both active — run only one orchestrator (PRD §22.1)`,
			suggestedCommand: "spine batch dismiss",
			alternatives: [
				"spine batch dismiss",
				"Run spine batch dismiss again if .pi/batch-state.json remains",
				"Abort Taskplane via /orch abort in a Pi session",
			],
			spine: spineSnapshot,
			taskplane: taskplaneSnapshot,
		};
	}

	if (taskplaneBlocking) {
		const taskplaneId = taskplaneSnapshot?.batchId ?? "unknown";
		const phase = taskplaneSnapshot?.phase ?? "unknown";
		return {
			ok: false,
			kind: "taskplane_active",
			message: `Taskplane batch ${taskplaneId} is active (phase: ${phase}) in .pi/batch-state.json — dismiss before starting a pi-spine batch`,
			suggestedCommand: "spine batch dismiss",
			alternatives: ["spine status --diagnose", "/orch abort"],
			spine: null,
			taskplane: taskplaneSnapshot,
		};
	}

	if (spineBlocking) {
		return {
			ok: true,
			kind: "spine_active",
			message: "pi-spine batch active (no Taskplane conflict)",
			suggestedCommand: null,
			alternatives: [],
			spine: spineSnapshot,
			taskplane: null,
		};
	}

	return {
		ok: true,
		kind: "none",
		message: "no concurrent Taskplane and pi-spine batch state",
		suggestedCommand: null,
		alternatives: [],
		spine: null,
		taskplane: null,
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {typeof runReconciliationCheck} [ctx.runReconciliation]
 */
export function buildCoexistencePreflightCheck(ctx) {
	const assessment = assessOrchestratorCoexistence(ctx);

	if (assessment.ok) {
		return {
			id: "orchestrator-coexistence",
			ok: true,
			message: assessment.message,
		};
	}

	return {
		id: "orchestrator-coexistence",
		ok: false,
		message: assessment.message,
		details: {
			kind: assessment.kind,
			spine: assessment.spine,
			taskplane: assessment.taskplane,
		},
		suggestedCommand: assessment.suggestedCommand,
		alternatives: assessment.alternatives,
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {typeof runReconciliationCheck} [ctx.runReconciliation]
 */
export function buildCoexistenceDoctorCheck(ctx) {
	const assessment = assessOrchestratorCoexistence(ctx);

	if (assessment.kind === "none" || assessment.kind === "spine_active") {
		return {
			label: "Taskplane / pi-spine mutual exclusion",
			ok: true,
			detail:
				assessment.kind === "spine_active"
					? "pi-spine batch only (.spine/batch-state.json)"
					: "no blocking batch in .pi and .spine",
		};
	}

	return {
		label: "Taskplane / pi-spine mutual exclusion",
		ok: false,
		detail: assessment.message,
		suggestedCommand: assessment.suggestedCommand,
		alternatives: assessment.alternatives,
	};
}
