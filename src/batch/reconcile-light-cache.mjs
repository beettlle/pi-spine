// @ts-nocheck
/** Light-reconcile git cache and phase sets (SP-606 / #192). */

export const LIMBO_PHASES = new Set(["stopped", "failed", "executing"]);
export const RUNNING_PHASES = new Set(["planning", "running", "executing", "merging"]);

/** @type {{ projectRoot: string|null, batchId: string|null, phase: string|null, git: object|null, diagnosis: string|null }} */
export let _lightReconcileCache = {
	projectRoot: null,
	batchId: null,
	phase: null,
	git: null,
	diagnosis: null,
};

/**
 * Clears light-reconcile git cache (test isolation).
 */
export function clearLightReconcileCache() {
	_lightReconcileCache = {
		projectRoot: null,
		batchId: null,
		phase: null,
		git: null,
		diagnosis: null,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} phase
 */
export function lightReconcileCacheMatches(projectRoot, batchId, phase) {
	return (
		_lightReconcileCache.projectRoot === projectRoot &&
		_lightReconcileCache.batchId === batchId &&
		_lightReconcileCache.phase === phase &&
		_lightReconcileCache.git != null
	);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} phase
 * @param {object} git
 * @param {string|null} diagnosis
 */
export function updateLightReconcileCache(projectRoot, batchId, phase, git, diagnosis) {
	_lightReconcileCache = { projectRoot, batchId, phase, git, diagnosis };
}

export const HUMAN_SYNC_OVERRIDE_DIAGNOSES = new Set([
	"completed",
	"completed_manual",
	"needs_integrate",
	"limbo_stale",
	"running",
	"paused",
]);
