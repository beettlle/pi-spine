/**
 * Planner wave sequence runner (GitHub #54 Tier 2 SP-C).
 * Public facade — plan in sequence-plan.mjs, run in sequence-run.mjs (SP-582/SP-600).
 */

export { resolveWaveTaskIds } from "../planner/wave-scope.mjs";

export {
	SEQUENCE_RELEASE_PROFILE,
	buildReleaseSequenceDryRunHeader,
	buildSequenceDryRunPlan,
	buildSequencePlan,
	buildSequenceWaveCommands,
	isReleaseSequenceScope,
	resolveSequenceProfile,
	resolveSequenceWaves,
	validateReleaseSequenceWaveCaps,
} from "./sequence-plan.mjs";

export {
	isSequenceBatchFailure,
	isSequenceBatchSettled,
	isSequenceBatchWaiting,
	runSequence,
	runSequenceWaveLandLoop,
	waitForSequenceBatchTerminal,
} from "./sequence-run.mjs";
