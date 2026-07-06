// @ts-nocheck
/**
 * contract.mode config validation (SP-142, handoff §3.1).
 */

/** @type {readonly string[]} */
export const CONTRACT_MODES = Object.freeze(["required", "optional", "legacy"]);

/**
 * @param {unknown} config
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validateContractConfig(config) {
	if (config?.contract == null) {
		return null;
	}

	const contract = config.contract;
	if (typeof contract !== "object" || contract === null || Array.isArray(contract)) {
		return {
			code: "CONFIG_CONTRACT_INVALID",
			message: "contract must be an object when set",
			suggestedCommand: "spine init --force",
		};
	}

	if (contract.mode != null) {
		if (typeof contract.mode !== "string" || !CONTRACT_MODES.includes(contract.mode)) {
			return {
				code: "CONFIG_CONTRACT_MODE_INVALID",
				message: `contract.mode must be one of: ${CONTRACT_MODES.join(", ")}`,
				suggestedCommand: "spine settings set contract.mode required",
			};
		}
	}

	if (contract.testRetries != null) {
		if (typeof contract.testRetries !== "number" || !Number.isInteger(contract.testRetries) || contract.testRetries < 0) {
			return {
				code: "CONFIG_CONTRACT_TEST_RETRIES_INVALID",
				message: "contract.testRetries must be a non-negative integer when set",
				suggestedCommand: "spine settings set contract.testRetries 1",
			};
		}
	}

	if (contract.legacyTaskIdPrefixes != null) {
		if (!Array.isArray(contract.legacyTaskIdPrefixes)) {
			return {
				code: "CONFIG_CONTRACT_LEGACY_INVALID",
				message: "contract.legacyTaskIdPrefixes must be an array of strings when set",
				suggestedCommand: "spine settings set contract.legacyTaskIdPrefixes '[\"TP-\"]'",
			};
		}
		for (const entry of contract.legacyTaskIdPrefixes) {
			if (typeof entry !== "string" || !entry.trim()) {
				return {
					code: "CONFIG_CONTRACT_LEGACY_INVALID",
					message: "contract.legacyTaskIdPrefixes entries must be non-empty strings",
					suggestedCommand: "spine settings set contract.legacyTaskIdPrefixes '[\"TP-\"]'",
				};
			}
		}
	}

	return null;
}
