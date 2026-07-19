/**
 * SP-664 — Named agent model profiles (GitHub #216).
 *
 * Covers:
 *  - validateAgentProfilesConfig schema rules (profiles / activeProfile / escalatePolicy)
 *  - validateSpineConfig integration (active profile must reference a defined profile)
 *  - applyActiveAgentProfile load-time resolution (deep merge, base fills gaps, purity)
 *  - `spine settings set agents.activeProfile <name>` switching + cross-validation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { validateSpineConfig } from "../../bin/spine-config.mjs";
import {
	AGENT_MODEL_ACCESSORS,
	validateAgentProfilesConfig,
} from "../../src/config/spine-config-schema.mjs";
import { applyActiveAgentProfile } from "../../src/config/spine-config-load.mjs";
import { runSettingsSetOperation } from "../../src/cli/settings-set.mjs";

/** Full valid spine-config base for validateSpineConfig integration tests. */
function baseConfig(overrides = {}) {
	return {
		configVersion: 1,
		project: { name: "demo", description: "" },
		paths: { tasksRoot: "spine-tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
		},
		lanes: { maxParallel: 2 },
		gates: { requireBeforeIntegrate: true },
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// validateAgentProfilesConfig
// ---------------------------------------------------------------------------

test("validateAgentProfilesConfig returns null when agents section is absent", () => {
	assert.equal(validateAgentProfilesConfig({}), null);
	assert.equal(validateAgentProfilesConfig({ agents: undefined }), null);
});

test("validateAgentProfilesConfig returns null when no profile fields are set", () => {
	assert.equal(
		validateAgentProfilesConfig({
			agents: { worker: { model: "inherit" }, reviewer: { model: "inherit" } },
		}),
		null,
	);
});

test("validateAgentProfilesConfig accepts well-formed profiles and activeProfile", () => {
	const config = {
		agents: {
			worker: { model: "inherit" },
			reviewer: { model: "inherit" },
			profiles: {
				default: { worker: { model: "cursor/auto" } },
				hard: {
					worker: { model: "anthropic/claude-opus" },
					reviewer: {
						plan: { model: "google/gemini-3.1-pro-preview" },
						code: { model: "inherit" },
					},
				},
			},
			activeProfile: "hard",
			escalatePolicy: { enabled: true, toProfile: "hard" },
		},
	};
	assert.equal(validateAgentProfilesConfig(config), null);
});

test("validateAgentProfilesConfig allows clearing activeProfile with an empty string", () => {
	assert.equal(
		validateAgentProfilesConfig({ agents: { activeProfile: "" } }),
		null,
	);
});

test("validateAgentProfilesConfig rejects profiles that are not an object", () => {
	const result = validateAgentProfilesConfig({ agents: { profiles: [] } });
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /agents\.profiles must be an object/);
});

test("validateAgentProfilesConfig rejects a profile value that is not an object", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { default: "fast" } },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /agents\.profiles\.default must be an object/);
});

test("validateAgentProfilesConfig rejects non-string model ids inside a profile", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { hard: { worker: { model: 5 } } } },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /agents\.profiles\.hard\.worker\.model must be a string/);
});

test("validateAgentProfilesConfig rejects a non-string activeProfile", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { default: {} }, activeProfile: 42 },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /activeProfile must be a string/);
});

test("validateAgentProfilesConfig rejects activeProfile referencing an undefined profile", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { default: {} }, activeProfile: "ghost" },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /"ghost" does not match a defined agents\.profiles/);
});

test("validateAgentProfilesConfig rejects activeProfile when no profiles are defined", () => {
	const result = validateAgentProfilesConfig({ agents: { activeProfile: "hard" } });
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /"hard" does not match a defined agents\.profiles/);
});

test("validateAgentProfilesConfig rejects a non-object escalatePolicy", () => {
	const result = validateAgentProfilesConfig({ agents: { escalatePolicy: true } });
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /escalatePolicy must be an object/);
});

test("validateAgentProfilesConfig rejects a non-boolean escalatePolicy.enabled", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { hard: {} }, escalatePolicy: { enabled: "yes" } },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /escalatePolicy\.enabled must be a boolean/);
});

test("validateAgentProfilesConfig rejects escalatePolicy.toProfile referencing an undefined profile", () => {
	const result = validateAgentProfilesConfig({
		agents: { profiles: { hard: {} }, escalatePolicy: { toProfile: "ghost" } },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /toProfile "ghost" does not match/);
});

test("validateAgentProfilesConfig rejects a non-string escalatePolicy.toProfile", () => {
	const result = validateAgentProfilesConfig({
		agents: { escalatePolicy: { toProfile: 3 } },
	});
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /toProfile must be a string/);
});

// ---------------------------------------------------------------------------
// validateSpineConfig integration
// ---------------------------------------------------------------------------

test("validateSpineConfig accepts a full config with profiles and activeProfile", () => {
	const config = baseConfig({
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
			profiles: {
				default: { worker: { model: "cursor/auto" } },
				hard: { worker: { model: "anthropic/claude-opus" } },
			},
			activeProfile: "hard",
		},
	});
	assert.equal(validateSpineConfig(config), null);
});

test("validateSpineConfig rejects an activeProfile with no matching profile", () => {
	const config = baseConfig({
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
			profiles: { default: { worker: { model: "cursor/auto" } } },
			activeProfile: "ghost",
		},
	});
	const result = validateSpineConfig(config);
	assert.equal(result?.code, "CONFIG_AGENT_PROFILE_INVALID");
	assert.match(result.message, /"ghost" does not match/);
});

// ---------------------------------------------------------------------------
// applyActiveAgentProfile
// ---------------------------------------------------------------------------

test("applyActiveAgentProfile is a no-op when no activeProfile is set", () => {
	const config = { agents: { worker: { model: "inherit" } } };
	assert.deepEqual(applyActiveAgentProfile(config).agents, { worker: { model: "inherit" } });
});

test("applyActiveAgentProfile is a no-op for an empty/whitespace activeProfile", () => {
	const config = { agents: { worker: { model: "inherit" }, activeProfile: "   " } };
	assert.deepEqual(applyActiveAgentProfile(config).agents.worker, { model: "inherit" });
});

test("applyActiveAgentProfile is a no-op when profiles are absent", () => {
	const config = { agents: { worker: { model: "inherit" }, activeProfile: "hard" } };
	assert.deepEqual(applyActiveAgentProfile(config).agents.worker, { model: "inherit" });
});

test("applyActiveAgentProfile is a no-op when the named profile is missing", () => {
	const config = {
		agents: {
			worker: { model: "inherit" },
			profiles: { default: { worker: { model: "cursor/auto" } } },
			activeProfile: "ghost",
		},
	};
	assert.equal(applyActiveAgentProfile(config).agents.worker.model, "inherit");
});

test("applyActiveAgentProfile merges profile worker pin over base and keeps base thinking", () => {
	const config = {
		agents: {
			worker: { model: "inherit", thinking: "high" },
			profiles: { hard: { worker: { model: "anthropic/claude-opus" } } },
			activeProfile: "hard",
		},
	};
	const resolved = applyActiveAgentProfile(config);
	assert.equal(resolved.agents.worker.model, "anthropic/claude-opus");
	assert.equal(resolved.agents.worker.thinking, "high");
});

test("applyActiveAgentProfile deep-merges nested reviewer pins without clobbering siblings", () => {
	const config = {
		agents: {
			reviewer: {
				model: "inherit",
				thinking: "medium",
				plan: { model: "inherit", thinking: "medium" },
				code: { model: "inherit", thinking: "medium" },
				final: { model: "inherit", thinking: "medium" },
			},
			profiles: {
				hard: { reviewer: { plan: { model: "google/gemini-3.1-pro-preview" } } },
			},
			activeProfile: "hard",
		},
	};
	const resolved = applyActiveAgentProfile(config);
	assert.equal(resolved.agents.reviewer.plan.model, "google/gemini-3.1-pro-preview");
	// Untouched per-type pins fall back to base.
	assert.equal(resolved.agents.reviewer.code.model, "inherit");
	assert.equal(resolved.agents.reviewer.final.model, "inherit");
	assert.equal(resolved.agents.reviewer.model, "inherit");
});

test("applyActiveAgentProfile ignores non-object profile sections gracefully", () => {
	const config = {
		agents: {
			worker: { model: "inherit" },
			profiles: { hard: { worker: "not-an-object" } },
			activeProfile: "hard",
		},
	};
	assert.equal(applyActiveAgentProfile(config).agents.worker.model, "inherit");
});

test("applyActiveAgentProfile does not mutate the input config", () => {
	const config = {
		agents: {
			worker: { model: "inherit", thinking: "high" },
			profiles: { hard: { worker: { model: "anthropic/claude-opus" } } },
			activeProfile: "hard",
		},
	};
	applyActiveAgentProfile(config);
	assert.equal(config.agents.worker.model, "inherit");
	assert.equal(config.agents.profiles.hard.worker.model, "anthropic/claude-opus");
});

test("AGENT_MODEL_ACCESSORS exposes the worker/reviewer/supervisor model paths", () => {
	const rels = AGENT_MODEL_ACCESSORS.map((a) => a.rel).sort();
	assert.deepEqual(rels, [
		"reviewer.code.model",
		"reviewer.final.model",
		"reviewer.model",
		"reviewer.plan.model",
		"supervisor.model",
		"worker.model",
	]);
});

// ---------------------------------------------------------------------------
// `spine settings set agents.activeProfile` (completion criterion)
// ---------------------------------------------------------------------------

function configWithProfiles() {
	return baseConfig({
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
			profiles: {
				default: { worker: { model: "cursor/auto" } },
				hard: { worker: { model: "anthropic/claude-opus" } },
			},
		},
	});
}

test("settings set accepts switching activeProfile to a defined profile", () => {
	const result = runSettingsSetOperation(configWithProfiles(), {
		path: "agents.activeProfile",
		rawValue: "hard",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "hard");
});

test("settings set rejects switching activeProfile to an undefined profile", () => {
	const result = runSettingsSetOperation(configWithProfiles(), {
		path: "agents.activeProfile",
		rawValue: "ghost",
	});
	assert.equal(result.exitCode, 1);
	assert.match(result.error, /"ghost" does not match a defined agents\.profiles/);
});

test("settings set allows clearing activeProfile with an empty value", () => {
	const config = configWithProfiles();
	config.agents.activeProfile = "hard";
	const result = runSettingsSetOperation(config, {
		path: "agents.activeProfile",
		rawValue: "",
	});
	assert.equal(result.exitCode, 0);
	assert.equal(result.newValue, "");
});
