import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	loadSpineConfig,
	loadSpineConfigFile,
} from "../../src/config/spine-config-load.mjs";

/**
 * SP-649 / FR-REL270-01: missing-config errors must include resolved cwd
 * and dual remediation (cd to project root or spine init here).
 */
test("loadSpineConfigFile CONFIG_MISSING includes resolved root and dual remediation", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp649-missing-config-"));
	const resolvedRoot = path.resolve(projectRoot);

	try {
		const result = loadSpineConfigFile(projectRoot);

		assert.equal(result.config, null);
		assert.ok(result.error);
		assert.equal(result.error.code, "CONFIG_MISSING");
		assert.match(result.error.message, /spine-config\.json not found/);
		assert.match(result.error.message, new RegExp(escapeRegExp(resolvedRoot)));
		assert.match(result.error.message, /cwd\/\$PWD|cwd/);
		assert.match(result.error.message, /project root/i);
		assert.match(result.error.message, /spine init/i);
		assert.match(result.error.suggestedCommand, new RegExp(escapeRegExp(resolvedRoot)));
		assert.match(result.error.suggestedCommand, /spine init/i);
		assert.notEqual(result.error.suggestedCommand.trim(), "spine init");
		assert.match(result.error.suggestedCommand, /cd\s+/i);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("loadSpineConfig propagates honest CONFIG_MISSING from file load", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp649-missing-load-"));
	const resolvedRoot = path.resolve(projectRoot);

	try {
		const result = loadSpineConfig(projectRoot);

		assert.equal(result.config, null);
		assert.ok(result.error);
		assert.equal(result.error.code, "CONFIG_MISSING");
		assert.match(result.error.message, new RegExp(escapeRegExp(resolvedRoot)));
		assert.notEqual(result.error.suggestedCommand.trim(), "spine init");
		assert.match(result.error.suggestedCommand, /cd\s+/i);
		assert.match(result.error.suggestedCommand, /spine init/i);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
