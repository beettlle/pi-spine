/**
 * SP-422 — Doctor validates canonical pi model ids (GitHub #76).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	isDisplayLabel,
	displayLabelToCanonical,
	isCanonicalModelId,
	normalizeModelId,
	validateModelIdFormat,
} from "../../src/config/model-id.mjs";
import { buildAgentModelIdsDoctorCheck } from "../../src/doctor/agent-models.mjs";
import { runSettingsSetOperation } from "../../src/cli/settings-set.mjs";

// --- model-id.mjs unit tests ---

test("isDisplayLabel matches pi TUI display labels", () => {
	assert.equal(isDisplayLabel("gemini-3.1-pro-preview [google]"), true);
	assert.equal(isDisplayLabel("claude-4-sonnet [anthropic]"), true);
	assert.equal(isDisplayLabel("gpt-4o [openai]"), true);
	assert.equal(isDisplayLabel("auto [cursor]"), true);
});

test("isDisplayLabel rejects canonical ids and invalid strings", () => {
	assert.equal(isDisplayLabel("google/gemini-3.1-pro-preview"), false);
	assert.equal(isDisplayLabel("cursor/auto"), false);
	assert.equal(isDisplayLabel("inherit"), false);
	assert.equal(isDisplayLabel(""), false);
	assert.equal(isDisplayLabel(42), false);
	assert.equal(isDisplayLabel(null), false);
});

test("displayLabelToCanonical converts to provider/model", () => {
	assert.equal(displayLabelToCanonical("gemini-3.1-pro-preview [google]"), "google/gemini-3.1-pro-preview");
	assert.equal(displayLabelToCanonical("claude-4-sonnet [anthropic]"), "anthropic/claude-4-sonnet");
	assert.equal(displayLabelToCanonical("auto [cursor]"), "cursor/auto");
});

test("displayLabelToCanonical returns null for non-labels", () => {
	assert.equal(displayLabelToCanonical("google/gemini-3.1-pro-preview"), null);
	assert.equal(displayLabelToCanonical("inherit"), null);
	assert.equal(displayLabelToCanonical(""), null);
	assert.equal(displayLabelToCanonical(null), null);
});

test("isCanonicalModelId validates provider/model format", () => {
	assert.equal(isCanonicalModelId("google/gemini-3.1-pro-preview"), true);
	assert.equal(isCanonicalModelId("cursor/auto"), true);
	assert.equal(isCanonicalModelId("anthropic/claude-4-sonnet"), true);
	assert.equal(isCanonicalModelId("openai/gpt-4o"), true);
});

test("isCanonicalModelId rejects non-canonical strings", () => {
	assert.equal(isCanonicalModelId("gemini-3.1-pro-preview [google]"), false);
	assert.equal(isCanonicalModelId("inherit"), false);
	assert.equal(isCanonicalModelId(""), false);
	assert.equal(isCanonicalModelId("just-a-model"), false);
	assert.equal(isCanonicalModelId(42), false);
});

test("normalizeModelId passes canonical ids through", () => {
	const result = normalizeModelId("google/gemini-3.1-pro-preview");
	assert.equal(result.ok, true);
	assert.equal(result.value, "google/gemini-3.1-pro-preview");
});

test("normalizeModelId converts display labels to canonical", () => {
	const result = normalizeModelId("gemini-3.1-pro-preview [google]");
	assert.equal(result.ok, true);
	assert.equal(result.value, "google/gemini-3.1-pro-preview");
});

test("normalizeModelId passes special values through", () => {
	assert.deepStrictEqual(normalizeModelId("inherit"), { ok: true, value: "inherit" });
	assert.deepStrictEqual(normalizeModelId(""), { ok: true, value: "" });
});

test("normalizeModelId rejects unrecognized formats", () => {
	const result = normalizeModelId("just-a-model-name");
	assert.equal(result.ok, false);
	assert.match(result.error, /Invalid model id/);
	assert.match(result.error, /provider\/model/);
});

test("normalizeModelId rejects non-string input", () => {
	const result = normalizeModelId(42);
	assert.equal(result.ok, false);
	assert.match(result.error, /must be a string/);
});

test("validateModelIdFormat accepts canonical ids", () => {
	assert.deepStrictEqual(validateModelIdFormat("google/gemini-3.1-pro-preview"), { ok: true });
	assert.deepStrictEqual(validateModelIdFormat("cursor/auto"), { ok: true });
});

test("validateModelIdFormat accepts special values and non-strings", () => {
	assert.deepStrictEqual(validateModelIdFormat("inherit"), { ok: true });
	assert.deepStrictEqual(validateModelIdFormat(""), { ok: true });
	assert.deepStrictEqual(validateModelIdFormat(null), { ok: true });
	assert.deepStrictEqual(validateModelIdFormat(undefined), { ok: true });
});

test("validateModelIdFormat flags display labels with canonical hint", () => {
	const result = validateModelIdFormat("gemini-3.1-pro-preview [google]");
	assert.equal(result.ok, false);
	assert.match(result.error, /display label/);
	assert.equal(result.canonical, "google/gemini-3.1-pro-preview");
});

test("validateModelIdFormat flags unrecognized formats", () => {
	const result = validateModelIdFormat("just-a-model-name");
	assert.equal(result.ok, false);
	assert.match(result.error, /invalid model id/);
	assert.equal(result.canonical, undefined);
});

// --- agent-models.mjs doctor check tests ---

test("buildAgentModelIdsDoctorCheck passes when all pins are canonical", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto" },
				reviewer: {
					model: "google/gemini-3.1-pro-preview",
					plan: { model: "google/gemini-flash-latest" },
					code: { model: "inherit" },
					final: { model: "" },
				},
			},
		},
	});
	assert.equal(check.ok, true);
	assert.match(check.detail, /provider\/model/);
});

test("buildAgentModelIdsDoctorCheck fails when display label is in config", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto" },
				reviewer: { model: "gemini-3.1-pro-preview [google]" },
			},
		},
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /display label/);
	assert.match(check.detail, /agents\.reviewer\.model/);
	assert.ok(check.suggestedCommand);
	assert.match(check.suggestedCommand, /google\/gemini-3\.1-pro-preview/);
});

test("buildAgentModelIdsDoctorCheck fails on invalid format", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				worker: { model: "bad-model-no-provider" },
			},
		},
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /invalid model id/);
});

test("buildAgentModelIdsDoctorCheck passes when no models configured", () => {
	const check = buildAgentModelIdsDoctorCheck({ config: {} });
	assert.equal(check.ok, true);
});

test("buildAgentModelIdsDoctorCheck skips inherit and empty values", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				worker: { model: "inherit" },
				reviewer: { model: "" },
			},
		},
	});
	assert.equal(check.ok, true);
});

test("buildAgentModelIdsDoctorCheck validates model ids inside named profiles", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				worker: { model: "cursor/auto" },
				profiles: {
					default: { worker: { model: "bad-model-no-provider" } },
				},
			},
		},
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /agents\.profiles\.default\.worker\.model/);
	assert.match(check.detail, /invalid model id/);
});

test("buildAgentModelIdsDoctorCheck reports the canonical fix path for a profile display label", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				profiles: {
					hard: { reviewer: { plan: { model: "gemini-3.1-pro-preview [google]" } } },
				},
			},
		},
	});
	assert.equal(check.ok, false);
	assert.match(check.detail, /agents\.profiles\.hard\.reviewer\.plan\.model/);
	assert.ok(check.suggestedCommand);
	assert.match(
		check.suggestedCommand,
		/spine settings set agents\.profiles\.hard\.reviewer\.plan\.model google\/gemini-3\.1-pro-preview/,
	);
});

test("buildAgentModelIdsDoctorCheck passes when all profiles use canonical ids", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				profiles: {
					default: { worker: { model: "cursor/auto" } },
					hard: { reviewer: { model: "google/gemini-3.1-pro-preview" } },
				},
			},
		},
	});
	assert.equal(check.ok, true);
});

test("buildAgentModelIdsDoctorCheck skips non-object profile entries", () => {
	const check = buildAgentModelIdsDoctorCheck({
		config: {
			agents: {
				profiles: { broken: "not-an-object" },
			},
		},
	});
	assert.equal(check.ok, true);
});

// --- settings-set.mjs integration tests ---

/** Valid base config for settings-set tests (validateSpineConfig requires full schema). */
function baseConfig(overrides = {}) {
	return {
		configVersion: 1,
		project: { name: "test", description: "" },
		paths: { tasksRoot: "spine-tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: { worker: { model: "inherit", thinking: "high" }, reviewer: { model: "inherit", thinking: "medium" } },
		lanes: { maxParallel: 2 },
		gates: { requireBeforeIntegrate: true },
		...overrides,
	};
}

test("settings set normalizes display label to canonical id", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.reviewer.model",
		rawValue: "gemini-3.1-pro-preview [google]",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "google/gemini-3.1-pro-preview");
});

test("settings set passes canonical id through unchanged", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.reviewer.model",
		rawValue: "google/gemini-3.1-pro-preview",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "google/gemini-3.1-pro-preview");
});

test("settings set rejects invalid model id format", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.reviewer.model",
		rawValue: "bad-model-no-provider",
	});
	assert.equal(result.exitCode, 1);
	assert.match(result.error, /Invalid model id/);
});

test("settings set allows inherit for model fields", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.worker.model",
		rawValue: "inherit",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "inherit");
});

test("settings set rejects invalid model id in JSON mode", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.reviewer.model",
		rawValue: "bad-model-no-provider",
		json: true,
	});
	assert.equal(result.exitCode, 1);
	const parsed = JSON.parse(result.output);
	assert.match(parsed.error, /Invalid model id/);
});

test("settings set normalizes worker model display label", () => {
	const result = runSettingsSetOperation(baseConfig(), {
		path: "agents.worker.model",
		rawValue: "auto [cursor]",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "cursor/auto");
});

test("settings set normalizes per-type reviewer model display label", () => {
	const config = baseConfig({
		agents: {
			worker: { model: "cursor/auto", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium", plan: {} },
		},
	});
	const result = runSettingsSetOperation(config, {
		path: "agents.reviewer.plan.model",
		rawValue: "gemini-flash-latest [google]",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "google/gemini-flash-latest");
});
