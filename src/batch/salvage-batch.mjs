// @ts-nocheck
/**
 * Operator salvage after batch abort/dismiss (FR-REL220-03 / FR-REL220-04, #158).
 * Thin re-export shim: list → salvage-batch-list.mjs (SP-591); integrate → salvage-batch-integrate.mjs (SP-605).
 */

export {
	NON_SALVAGEABLE_EXIT_REASONS,
	formatSalvageListOutput,
	isNonSalvageableExitReason,
	listSalvageableLanes,
} from "./salvage-batch-list.mjs";

export {
	confirmSalvageIntegrate,
	formatSalvageIntegrateOutput,
	integrateSalvageableLane,
} from "./salvage-batch-integrate.mjs";
