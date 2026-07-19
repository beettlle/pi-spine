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
	applyMatrixRowToContract,
} from "./contract-parse.mjs";

import { verifyContract as _verifyContract } from "./contract-exec.mjs";
import { stageUntrackedScopeFiles } from "./lane-dirty-check-git.mjs";
import { applyMatrixRowToContract } from "./contract-parse.mjs";

export {
	CONTRACT_TEST_COMMAND_MAX_BUFFER,
	CONTRACT_TEST_DEFAULT_RETRIES,
	CONTRACT_TEST_RETRY_DELAY_MS,
	CONTRACT_TEST_WORKER_ENV_KEYS,
	buildContractTestEnv,
	isRefusedNpmTestDashDashCommand,
	prepareContractVerifyEnvironment,
	runContractTestCommand,
	writeContractFailureLog,
} from "./contract-exec.mjs";

/**
 * Verify contract and auto-stage untracked scope files before verification.
 *
 * When `config.matrixRow` is supplied (a matrix sub-lane), `{matrix.<column>}`
 * placeholders in `testCommand`, `fileScopeMustChange`, and other string/list
 * contract fields are substituted with the row values before staging and
 * verification. Omit `config.matrixRow` for non-matrix tasks — the parsed
 * contract is used verbatim, preserving existing behavior.
 *
 * @param {string} worktreePath 
 * @param {object} parsedContract 
 * @param {object} [config] 
 */
export function verifyContract(worktreePath, parsedContract, config = {}) {
	const effectiveContract = config?.matrixRow
		? applyMatrixRowToContract(parsedContract, config.matrixRow)
		: parsedContract;

	const stageResult = stageUntrackedScopeFiles(worktreePath, effectiveContract.fileScopeMustChange || []);
	
	if (stageResult.error) {
		return {
			ok: false,
			checks: [
				{
					field: "fileScopeMustChange",
					ok: false,
					message: `Failed to auto-stage untracked scope files: ${stageResult.error}`,
				},
			],
		};
	}

	return _verifyContract(worktreePath, effectiveContract, config);
}
