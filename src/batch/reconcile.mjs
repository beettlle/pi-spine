// @ts-nocheck
/**
 * Batch reconciliation (FR-BATCH-12, §17.5).
 * Re-export shim — classify / diagnosis / batch / orphan / light-cache (SP-578/596/606).
 */

/**
 * @typedef {object} ReconciliationResult
 * @property {string|null} diagnosis
 * @property {string} headline
 * @property {string} suggestedCommand
 * @property {string[]} [alternatives]
 * @property {string|null} [batchId]
 * @property {string|null} [batchStatePath]
 * @property {string|null} [phase]
 * @property {import("./macro-phase.mjs").MacroPhase} [macroPhase]
 * @property {string} [macroPhaseLabel]
 * @property {object} [signals]
 * @property {number} [pendingTasks]
 * @property {number} [currentWaveIndex]
 * @property {number} [waveCount]
 */

export { loadBatchStateFile, parseBatchState, resolveBatchStatePath } from "./batch-state-io.mjs";
export {
	alignTaskClassificationWithStatus,
	classifyTasks,
	inspectGitState,
	inspectHumanBaseSync,
	listGitChangedPaths,
	listHumanOnlyPaths,
	resolveTasksRoot,
	syncPersistedClassifications,
} from "./reconcile-classify.mjs";
export { deriveDiagnosis } from "./reconcile-diagnosis.mjs";
export { clearLightReconcileCache } from "./reconcile-light-cache.mjs";
export { reconcileBatch } from "./reconcile-batch.mjs";
export {
	reconcileOrphanRunningState,
	runReconciliationCheck,
} from "./reconcile-orphan.mjs";
