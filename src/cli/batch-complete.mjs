/**
 * `spine batch complete` handler — archive-first lifecycle with SP-441 handoff guards.
 */

import { completeBatch } from "../batch/lifecycle.mjs";

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {boolean} [ctx.detectManualMerge]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function runBatchComplete(ctx) {
	return completeBatch(ctx);
}
