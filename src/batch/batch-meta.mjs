// @ts-nocheck
/**
 * Survival batch-meta.json artifact (SP-619 / FR-REL240-03 / #126).
 * Persist at batch start; reconstruct helpers live in batch-meta-reconstruct.mjs (SP-620).
 */

import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";

export const BATCH_META_SCHEMA_VERSION = 1;
export const BATCH_META_FILENAME = "batch-meta.json";

/** Default orchestration mode when caller does not supply one. */
export const BATCH_META_DEFAULT_MODE = "batch";

/**
 * Absolute path to `.spine/runtime/{batchId}/batch-meta.json`.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function batchMetaPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", String(batchId), BATCH_META_FILENAME);
}

/**
 * Prefer a project-relative tasksRoot for portability across machines.
 *
 * @param {string} projectRoot
 * @param {string} tasksRoot
 */
export function normalizeBatchMetaTasksRoot(projectRoot, tasksRoot) {
	const root = String(projectRoot ?? "");
	const resolved = String(tasksRoot ?? "");
	if (!resolved) return resolved;
	if (!path.isAbsolute(resolved)) {
		return resolved.split(path.sep).join("/");
	}
	const relative = path.relative(root, resolved);
	if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
		return resolved;
	}
	return relative.split(path.sep).join("/");
}

/**
 * Persist minimal wave topology for abort-survival / force-resume reconstruct.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {number} params.totalWaves
 * @param {string} [params.mode]
 * @param {string} params.tasksRoot
 * @param {string[][]} params.wavePlan Wave→task mapping (index = wave index)
 * @returns {{ path: string, meta: object }}
 */
export function saveBatchMetaRuntimeArtifact({
	projectRoot,
	batchId,
	baseBranch,
	orchBranch,
	totalWaves,
	mode = BATCH_META_DEFAULT_MODE,
	tasksRoot,
	wavePlan,
}) {
	const resolvedBatchId = String(batchId ?? "").trim();
	if (!resolvedBatchId) {
		throw new Error("saveBatchMetaRuntimeArtifact: batchId is required");
	}

	const waves = Array.isArray(wavePlan)
		? wavePlan.map((wave) => (Array.isArray(wave) ? [...wave] : []))
		: [];
	const waveCount = Number.isFinite(Number(totalWaves)) ? Number(totalWaves) : waves.length;

	const meta = {
		schemaVersion: BATCH_META_SCHEMA_VERSION,
		batchId: resolvedBatchId,
		baseBranch: String(baseBranch ?? ""),
		orchBranch: String(orchBranch ?? ""),
		totalWaves: waveCount,
		mode: String(mode ?? BATCH_META_DEFAULT_MODE),
		tasksRoot: normalizeBatchMetaTasksRoot(projectRoot, tasksRoot),
		wavePlan: waves,
		createdAt: Date.now(),
	};

	const filePath = batchMetaPath(projectRoot, resolvedBatchId);
	writeJsonAtomic(filePath, meta);
	return { path: filePath, meta };
}

/**
 * Persist batch-meta from initial batch-state (attached + detached share startBatch).
 *
 * @param {string} projectRoot
 * @param {{ batchId?: string, baseBranch?: string, orchBranch?: string, totalWaves?: number, wavePlan?: string[][] }} state
 * @param {string} tasksRoot
 */
export function persistBatchMetaFromStartState(projectRoot, state, tasksRoot) {
	return saveBatchMetaRuntimeArtifact({
		projectRoot,
		batchId: String(state?.batchId ?? ""),
		baseBranch: String(state?.baseBranch ?? ""),
		orchBranch: String(state?.orchBranch ?? ""),
		totalWaves: Number(state?.totalWaves ?? 0),
		mode: BATCH_META_DEFAULT_MODE,
		tasksRoot,
		wavePlan: Array.isArray(state?.wavePlan) ? state.wavePlan : [],
	});
}
