import assert from "node:assert/strict";
import test from "node:test";

import { INTEGRATIONS_DEFAULTS } from "../../src/config/defaults.mjs";
import { validateIntegrationsConfig } from "../../src/config/spine-config-schema.mjs";
import { applyConfigDefaults } from "../../src/config/merge-defaults.mjs";

// --- defaults ---

test("INTEGRATIONS_DEFAULTS exposes the issues umbrella with github provider, sync off", () => {
	assert.deepEqual(INTEGRATIONS_DEFAULTS, {
		issues: { provider: "github", syncOnLand: false },
	});
});

test("applyConfigDefaults fills integrations.issues when the section is missing", () => {
	const config = {};
	applyConfigDefaults(config);
	assert.deepEqual(config.integrations, {
		issues: { provider: "github", syncOnLand: false },
	});
});

test("applyConfigDefaults preserves explicit issues values", () => {
	const config = { integrations: { issues: { provider: "github", syncOnLand: true } } };
	applyConfigDefaults(config);
	assert.deepEqual(config.integrations.issues, { provider: "github", syncOnLand: true });
});

// --- acceptance: integrations.issues ---

test("absent integrations section is valid", () => {
	assert.equal(validateIntegrationsConfig({}), null);
	assert.equal(validateIntegrationsConfig({ integrations: null }), null);
});

test("accepts full integrations.issues section (provider + syncOnLand)", () => {
	assert.equal(
		validateIntegrationsConfig({
			integrations: { issues: { provider: "github", syncOnLand: true } },
		}),
		null,
	);
});

test("accepts partial issues values (absent keys fall back to defaults)", () => {
	assert.equal(validateIntegrationsConfig({ integrations: { issues: {} } }), null);
	assert.equal(validateIntegrationsConfig({ integrations: { issues: { provider: "github" } } }), null);
	assert.equal(validateIntegrationsConfig({ integrations: { issues: { syncOnLand: false } } }), null);
});

test("provider is structural only — any string passes schema validation", () => {
	assert.equal(
		validateIntegrationsConfig({ integrations: { issues: { provider: "gitlab" } } }),
		null,
	);
});

// --- rejection: legacy integrations.github (fail closed, no alias) ---

test("rejects integrations.github with CONFIG_INTEGRATIONS_INVALID", () => {
	const error = validateIntegrationsConfig({ integrations: { github: { syncOnLand: true } } });
	assert.ok(error);
	assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
	assert.match(error.message, /integrations\.github is no longer supported/);
	assert.match(error.message, /integrations\.issues/);
	assert.match(error.suggestedCommand, /rename integrations\.github to integrations\.issues/);
});

test("rejects integrations.github even when empty or alongside a valid issues section", () => {
	for (const github of [{}, { syncOnLand: false }, null]) {
		const error = validateIntegrationsConfig({
			integrations: { github, issues: { provider: "github", syncOnLand: true } },
		});
		assert.ok(error, `github=${JSON.stringify(github)} must be rejected`);
		assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
	}
});

// --- rejection: invalid types ---

test("rejects non-object integrations section", () => {
	for (const integrations of ["github", 42, true, []]) {
		const error = validateIntegrationsConfig({ integrations });
		assert.ok(error, `integrations=${JSON.stringify(integrations)} must be rejected`);
		assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
		assert.match(error.message, /integrations must be an object/);
	}
});

test("rejects non-object integrations.issues", () => {
	for (const issues of ["github", 42, true, []]) {
		const error = validateIntegrationsConfig({ integrations: { issues } });
		assert.ok(error, `issues=${JSON.stringify(issues)} must be rejected`);
		assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
		assert.match(error.message, /integrations\.issues must be an object/);
	}
});

test("rejects non-string integrations.issues.provider", () => {
	for (const provider of [42, true, {}, []]) {
		const error = validateIntegrationsConfig({ integrations: { issues: { provider } } });
		assert.ok(error, `provider=${JSON.stringify(provider)} must be rejected`);
		assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
		assert.match(error.message, /integrations\.issues\.provider must be a string/);
	}
});

test("rejects non-boolean integrations.issues.syncOnLand", () => {
	for (const syncOnLand of ["yes", 1, {}, []]) {
		const error = validateIntegrationsConfig({ integrations: { issues: { syncOnLand } } });
		assert.ok(error, `syncOnLand=${JSON.stringify(syncOnLand)} must be rejected`);
		assert.equal(error.code, "CONFIG_INTEGRATIONS_INVALID");
		assert.match(error.message, /integrations\.issues\.syncOnLand must be a boolean/);
	}
});
