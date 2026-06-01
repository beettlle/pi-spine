/**
 * pi-spine batch-state.json read/write (schema v1, PRD §10.1).
 */

import fs from "node:fs";
import path from "node:path";
import { loadBatchStateFile } from "./reconcile.mjs";

export const SPINE_BATCH_STATE_REL = path.join(".spine", "batch-state.json");

/** @type {ReadonlySet<string>} */
export const ACTIVE_PHASES = new Set(["planning", "running", "paused"]);

/**
 * @returns {string} batchId `{YYYYMMDD}T{HHmmss}` UTC
 */
export function generateBatchId(now = new Date()) {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	const h = String(now.getUTCHours()).padStart(2, "0");
	const min = String(now.getUTCMinutes()).padStart(2, "0");
	const s = String(now.getUTCSeconds()).padStart(2, "0");
	return `${y}${m}${d}T${h}${min}${s}`;
}

/**
 * @param {string} projectRoot
 */
export function spineBatchStatePath(projectRoot) {
	return path.join(projectRoot, SPINE_BATCH_STATE_REL);
}

/**
 * @param {string} projectRoot
 */
export function loadSpineBatchState(projectRoot) {
	const filePath = spineBatchStatePath(projectRoot);
	if (!fs.existsSync(filePath)) {
		return { path: null, raw: null, parseError: null };
	}
	try {
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return { path: filePath, raw, parseError: null };
	} catch (err) {
		return {
			path: filePath,
			raw: null,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * @param {string} projectRoot
 * @param {object} state
 */
export function saveSpineBatchState(projectRoot, state) {
	const filePath = spineBatchStatePath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const next = { ...state, updatedAt: Date.now() };
	fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
	return next;
}

/**
 * @param {string} projectRoot
 */
export function assertNoActiveBatch(projectRoot) {
	const spine = loadSpineBatchState(projectRoot);
	if (spine.path && spine.raw) {
		const phase = String(spine.raw.phase ?? "");
		if (ACTIVE_PHASES.has(phase)) {
			throw new Error(
				`Active pi-spine batch ${spine.raw.batchId} (phase=${phase}). Run spine batch dismiss or complete first.`,
			);
		}
	}

	const any = loadBatchStateFile(projectRoot);
	if (any.path && any.raw) {
		const phase = String(any.raw.phase ?? "");
		const active =
			ACTIVE_PHASES.has(phase) || phase === "executing" || phase === "merging" || phase === "stopped";
		if (active && !any.raw.endedAt) {
			throw new Error(
				`Active batch ${any.raw.batchId} at ${any.path} (phase=${phase}). Dismiss or abort before spine batch start.`,
			);
		}
	}
}

/**
 * @param {object} params
 */
export function createInitialBatchState({
	batchId,
	baseBranch,
	orchBranch,
	wavePlan,
	tasks,
	lanes,
}) {
	const now = Date.now();
	return {
		schemaVersion: 1,
		phase: "planning",
		batchId,
		baseBranch,
		orchBranch,
		startedAt: now,
		updatedAt: now,
		endedAt: null,
		currentWaveIndex: 0,
		totalWaves: wavePlan.length,
		wavePlan,
		lanes,
		tasks,
		mergeResults: [],
		totalTasks: tasks.length,
		succeededTasks: 0,
		failedTasks: 0,
		skippedTasks: 0,
		blockedTasks: 0,
		blockedTaskIds: [],
		lastError: null,
		resilience: {
			resumeForced: false,
			retryCountByScope: {},
			lastFailureClass: null,
			repairHistory: [],
		},
	};
}
