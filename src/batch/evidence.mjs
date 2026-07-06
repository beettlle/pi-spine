/**
 * Integrate gate evidence bundle (PRD §12.2, FR-GATE).
 * Collection orchestration lives in gate.mjs; path readers in gate-evidence-read.mjs (SP-432 / #83-D).
 */

import { reconcileBatch } from "./reconcile.mjs";
import {
	buildTaskScorecard,
	evidenceCompletePath,
	evidenceDir,
	isEvidenceBundleComplete,
	resolveTestingCommands,
} from "./gate-evidence-read.mjs";
import {
	collectCoreEvidenceBundle as gateCollectCoreEvidenceBundle,
	collectExtendedEvidenceBundle as gateCollectExtendedEvidenceBundle,
	collectEvidenceBundle as gateCollectEvidenceBundle,
	finalizeEvidenceBundleComplete as gateFinalizeEvidenceBundleComplete,
} from "./gate-evidence-collect.mjs";

export {
	buildTaskScorecard,
	evidenceCompletePath,
	evidenceDir,
	isEvidenceBundleComplete,
	resolveTestingCommands,
};

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {object|null} [ctx.batchState]
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {object} [ctx.reconciliation]
 */
export function collectCoreEvidenceBundle(ctx) {
	const reconciliation =
		ctx.reconciliation ??
		reconcileBatch({ projectRoot: ctx.projectRoot, batchState: ctx.batchState ?? null, verbose: true });
	return gateCollectCoreEvidenceBundle({ ...ctx, reconciliation });
}

export const collectExtendedEvidenceBundle = gateCollectExtendedEvidenceBundle;
export const finalizeEvidenceBundleComplete = gateFinalizeEvidenceBundleComplete;
export const collectEvidenceBundle = gateCollectEvidenceBundle;
