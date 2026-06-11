import assert from "node:assert/strict";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { validateContractConfig, CONTRACT_MODES } from "../../src/config/contract.mjs";
import { CONTRACT_DEFAULTS } from "../../src/config/defaults.mjs";
import { applyConfigDefaults } from "../../src/config/merge-defaults.mjs";

const BASE_CONFIG = {
	configVersion: 1,
	project: { name: "test", description: "" },
	paths: { tasksRoot: "spine-tasks" },
	baseBranch: "main",
	testing: { build: "npm test", test: "npm test", testWithCoverage: "" },
	agents: {
		worker: { model: "inherit", thinking: "high" },
		reviewer: { model: "inherit", thinking: "medium" },
		supervisor: { model: "inherit", thinking: "off" },
	},
	lanes: { maxParallel: 1 },
	gates: { requireBeforeIntegrate: true, collectBuildEvidence: true, collectTestEvidence: true },
};

test("CONTRACT_DEFAULTS match handoff §3.1", () => {
	assert.deepEqual(CONTRACT_DEFAULTS, { mode: "required", legacyTaskIdPrefixes: ["TP-"] });
});

test("applyConfigDefaults merges contract section", () => {
	const config = structuredClone(BASE_CONFIG);
	applyConfigDefaults(config);
	assert.equal(config.contract.mode, "required");
	assert.deepEqual(config.contract.legacyTaskIdPrefixes, ["TP-"]);
});

test("validateContractConfig rejects invalid mode", () => {
	const error = validateContractConfig({
		contract: { mode: "invalid", legacyTaskIdPrefixes: ["TP-"] },
	});
	assert.equal(error?.code, "CONFIG_CONTRACT_MODE_INVALID");
	assert.ok(CONTRACT_MODES.includes("required"));
});

test("validateContractConfig rejects non-array legacyTaskIdPrefixes", () => {
	const error = validateContractConfig({
		contract: { mode: "legacy", legacyTaskIdPrefixes: "TP-" },
	});
	assert.equal(error?.code, "CONFIG_CONTRACT_LEGACY_INVALID");
});

test("validateSpineConfig accepts valid contract block", () => {
	const config = {
		...BASE_CONFIG,
		contract: { mode: "optional", legacyTaskIdPrefixes: ["TP-", "LEG-"] },
	};
	assert.equal(validateSpineConfig(config), null);
});

test("validateSpineConfig rejects invalid contract.mode via validateSpineConfig", () => {
	const config = {
		...BASE_CONFIG,
		contract: { mode: "strict", legacyTaskIdPrefixes: ["TP-"] },
	};
	const error = validateSpineConfig(config);
	assert.equal(error?.code, "CONFIG_CONTRACT_MODE_INVALID");
});
