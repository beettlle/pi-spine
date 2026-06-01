/**
 * Batch reconciliation (stub — TP-009 implements real logic).
 */

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {object|null} ctx.batchState
 * @param {string|null} ctx.batchStatePath
 */
export function runReconciliationCheck(ctx) {
	return {
		diagnosis: "unknown",
		headline: "Reconciliation available after TP-009",
		suggestedCommand: "spine status --diagnose",
	};
}
