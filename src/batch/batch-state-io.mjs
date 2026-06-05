/**
 * Batch state file resolution, load, and parse (leaf module — no reconcile/state imports).
 */

import fs from "node:fs";
import path from "node:path";
import { parseSpineBatchState } from "./readers/spine-state.mjs";
import { parseTaskplaneBatchState } from "./readers/taskplane-state.mjs";

/**
 * @param {string} projectRoot
 */
export function resolveBatchStatePath(projectRoot) {
	const spinePath = path.join(projectRoot, ".spine", "batch-state.json");
	if (fs.existsSync(spinePath)) return spinePath;

	const piPath = path.join(projectRoot, ".pi", "batch-state.json");
	if (fs.existsSync(piPath)) return piPath;

	return null;
}

/**
 * @param {string} projectRoot
 * @param {string|null} [batchStatePath]
 */
export function loadBatchStateFile(projectRoot, batchStatePath = null) {
	const resolved = batchStatePath ?? resolveBatchStatePath(projectRoot);
	if (!resolved) return { path: null, raw: null, parseError: null };

	try {
		const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
		return { path: resolved, raw, parseError: null };
	} catch (err) {
		return {
			path: resolved,
			raw: null,
			parseError: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * @param {unknown} raw
 * @param {string} batchStatePath
 */
export function parseBatchState(raw, batchStatePath) {
	if (!raw) return null;
	if (batchStatePath.includes(`${path.sep}.pi${path.sep}`)) {
		return parseTaskplaneBatchState(raw);
	}
	return parseSpineBatchState(raw) ?? parseTaskplaneBatchState(raw);
}
