/**
 * Planner wave sequence runner (GitHub #54 Tier 2 SP-C).
 * Re-export shim — plan in sequence-plan.mjs, wait/land in sequence-wait.mjs, run in sequence-run.mjs (SP-607 / #192).
 */

import { resolveWaveTaskIds } from "../planner/wave-scope.mjs";

export { resolveWaveTaskIds };

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
	runSequenceWaveLandLoop,
	waitForSequenceBatchTerminal,
} from "./sequence-wait.mjs";

export { runSequence } from "./sequence-run.mjs";
