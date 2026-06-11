import assert from "node:assert/strict";
import test from "node:test";

import {
	listEditableFields,
	parseSettingPath,
	SETTINGS_FIELDS,
	validateSettingValue,
} from "../../src/config/settings-fields.mjs";

test("SETTINGS_FIELDS lists at least five editable paths", () => {
	assert.ok(SETTINGS_FIELDS.length >= 5);
	const paths = SETTINGS_FIELDS.map((f) => f.path);
	assert.deepEqual(
		paths.sort(),
		[
			"agents.worker.model",
			"agents.worker.thinking",
			"dashboard.port",
			"gates.requireBeforeIntegrate",
			"lanes.autoIntegrateBetweenWaves",
			"lanes.maxParallel",
			"lanes.workerBackend",
		].sort(),
	);
});

test("listEditableFields returns shallow copies", () => {
	const listed = listEditableFields();
	assert.equal(listed.length, SETTINGS_FIELDS.length);
	listed[0].label = "mutated";
	assert.notEqual(SETTINGS_FIELDS[0].label, "mutated");
});

test("parseSettingPath rejects unknown path", () => {
	const result = parseSettingPath("lanes.unknown");
	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.match(result.error, /Unknown setting path/);
	}
});

test("parseSettingPath accepts registered path", () => {
	const result = parseSettingPath("lanes.maxParallel");
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.path, "lanes.maxParallel");
		assert.equal(result.field.type, "number");
	}
});

test("lanes.maxParallel accepts valid integer and coerces string", () => {
	for (const value of [3, "4"]) {
		const result = validateSettingValue("lanes.maxParallel", value);
		assert.equal(result.ok, true, String(value));
		if (result.ok) {
			assert.equal(result.normalizedValue, typeof value === "string" ? 4 : 3);
		}
	}
});

test("lanes.maxParallel rejects below min and above max", () => {
	const low = validateSettingValue("lanes.maxParallel", 0);
	assert.equal(low.ok, false);
	if (!low.ok) assert.match(low.error, />= 1/);

	const high = validateSettingValue("lanes.maxParallel", 33);
	assert.equal(high.ok, false);
	if (!high.ok) assert.match(high.error, /<= 32/);

	const badType = validateSettingValue("lanes.maxParallel", "abc");
	assert.equal(badType.ok, false);
});

test("gates.requireBeforeIntegrate accepts booleans and CLI strings", () => {
	for (const [raw, expected] of [
		[true, true],
		[false, false],
		["true", true],
		["0", false],
		["no", false],
	]) {
		const result = validateSettingValue("gates.requireBeforeIntegrate", raw);
		assert.equal(result.ok, true, String(raw));
		if (result.ok) assert.equal(result.normalizedValue, expected);
	}

	const invalid = validateSettingValue("gates.requireBeforeIntegrate", "maybe");
	assert.equal(invalid.ok, false);
});

test("agents.worker.model accepts inherit and optional empty", () => {
	const inherit = validateSettingValue("agents.worker.model", "inherit");
	assert.equal(inherit.ok, true);
	if (inherit.ok) assert.equal(inherit.normalizedValue, "inherit");

	const empty = validateSettingValue("agents.worker.model", "");
	assert.equal(empty.ok, true);
	if (empty.ok) assert.equal(empty.normalizedValue, "");
});

test("agents.worker.thinking accepts enum values case-insensitively", () => {
	const result = validateSettingValue("agents.worker.thinking", "HIGH");
	assert.equal(result.ok, true);
	if (result.ok) assert.equal(result.normalizedValue, "high");

	const invalid = validateSettingValue("agents.worker.thinking", "turbo");
	assert.equal(invalid.ok, false);
	if (!invalid.ok) assert.match(invalid.error, /off, low, medium, high/);
});

test("dashboard.port accepts valid port range", () => {
	const ok = validateSettingValue("dashboard.port", "8109");
	assert.equal(ok.ok, true);
	if (ok.ok) assert.equal(ok.normalizedValue, 8109);

	const low = validateSettingValue("dashboard.port", 80);
	assert.equal(low.ok, false);
	if (!low.ok) assert.match(low.error, />= 1024/);

	const high = validateSettingValue("dashboard.port", 70000);
	assert.equal(high.ok, false);
	if (!high.ok) assert.match(high.error, /<= 65535/);
});

test("lanes.workerBackend accepts registered enum values", () => {
	for (const value of ["subprocess", "agentSession"]) {
		const result = validateSettingValue("lanes.workerBackend", value);
		assert.equal(result.ok, true, value);
		if (result.ok) assert.equal(result.normalizedValue, value);
	}
	const invalid = validateSettingValue("lanes.workerBackend", "agentsession");
	assert.equal(invalid.ok, false);
});

test("validateSettingValue rejects unknown path", () => {
	const result = validateSettingValue("project.name", "x");
	assert.equal(result.ok, false);
	if (!result.ok) assert.match(result.error, /Unknown setting path/);
});
