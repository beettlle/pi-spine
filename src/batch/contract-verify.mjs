// @ts-nocheck
/**
 * Machine contract verification in lane worktree (handoff §4.5, SP-154/SP-155).
 * Re-export shim — parse in contract-parse.mjs, exec in contract-exec.mjs (SP-585/SP-603).
 */

export {
	resolvePromptRelPath,
	isFileScopePatternPrelanded,
	hasSpineTaskDeliveryChanges,
} from "./contract-prelanded.mjs";

export {
	hasReleaseCriticalContract,
	isExitVerificationTask,
	isLegacyStubDoneFile,
	isLegacyStubDoneMarker,
	isStubWorkerMode,
	listChangedFiles,
	listEffectiveChangedFiles,
	matchesContractPattern,
	shouldEnforceStubContractAtLaneCommit,
	shouldRunContractVerify,
	shouldRunContractVerifyForWorker,
	verifyStubFileScopeMustChange,
} from "./contract-parse.mjs";

export {
	CONTRACT_TEST_COMMAND_MAX_BUFFER,
	CONTRACT_TEST_DEFAULT_RETRIES,
	CONTRACT_TEST_RETRY_DELAY_MS,
	CONTRACT_TEST_WORKER_ENV_KEYS,
	buildContractTestEnv,
	isRefusedNpmTestDashDashCommand,
	prepareContractVerifyEnvironment,
	runContractTestCommand,
	verifyContract,
	writeContractFailureLog,
} from "./contract-exec.mjs";
