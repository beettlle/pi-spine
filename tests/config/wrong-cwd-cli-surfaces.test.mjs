import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runSpinePlan } from "../../bin/spine-plan.mjs";
import { runSpineTasksValidate } from "../../bin/spine-tasks.mjs";
import { missingConfigHint } from "../../src/config/missing-config-hint.mjs";
import {
	checkDependenciesJson,
	checkTasksRoot,
	checkTasksValidate,
} from "../../src/config/preflight/discovery.mjs";
import { loadSpineConfig } from "../../src/config/spine-config-load.mjs";

/**
 * SP-650 / FR-REL270-02: plan/tasks/discovery missing-config surfaces share
 * the honest cwd + dual-remediation hint (closes #202 with SP-649).
 */

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} suggestedCommand
 * @param {string} resolvedRoot
 */
function assertHonestHint(suggestedCommand, resolvedRoot) {
	assert.match(suggestedCommand, new RegExp(escapeRegExp(resolvedRoot)));
	assert.match(suggestedCommand, /spine init/i);
	assert.match(suggestedCommand, /cd\s+/i);
	assert.notEqual(suggestedCommand.trim(), "spine init");
}

test("missingConfigHint is single source of truth for CONFIG_MISSING", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp650-hint-"));
	const resolvedRoot = path.resolve(projectRoot);
	try {
		const hint = missingConfigHint(projectRoot);
		assert.equal(hint.resolvedRoot, resolvedRoot);
		assert.match(hint.message, new RegExp(escapeRegExp(resolvedRoot)));
		assert.match(hint.message, /cwd\/\$PWD|cwd/);
		assertHonestHint(hint.suggestedCommand, resolvedRoot);

		const loaded = loadSpineConfig(projectRoot);
		assert.equal(loaded.error?.code, "CONFIG_MISSING");
		assert.equal(loaded.error?.message, hint.message);
		assert.equal(loaded.error?.suggestedCommand, hint.suggestedCommand);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("runSpinePlan missing config uses honest suggestedCommand", async () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp650-plan-"));
	const resolvedRoot = path.resolve(projectRoot);
	try {
		await assert.rejects(
			() => runSpinePlan({ projectRoot, scope: "all" }),
			(err) => {
				assert.match(String(err?.message ?? ""), /spine-config\.json not found/);
				assert.match(String(err?.message ?? ""), new RegExp(escapeRegExp(resolvedRoot)));
				assertHonestHint(err.suggestedCommand, resolvedRoot);
				return true;
			},
		);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("runSpineTasksValidate missing config uses honest suggestedCommand", async () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp650-tasks-"));
	const resolvedRoot = path.resolve(projectRoot);
	try {
		await assert.rejects(
			() => runSpineTasksValidate({ projectRoot, scope: "all" }),
			(err) => {
				assert.match(String(err?.message ?? ""), /spine-config\.json not found/);
				assertHonestHint(err.suggestedCommand, resolvedRoot);
				return true;
			},
		);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("discovery missing-config paths use shared suggestedCommand", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp650-discovery-"));
	const resolvedRoot = path.resolve(projectRoot);
	const expected = missingConfigHint(projectRoot).suggestedCommand;
	try {
		const configResult = loadSpineConfig(projectRoot);
		assert.equal(configResult.error?.code, "CONFIG_MISSING");

		const tasksRoot = checkTasksRoot({ projectRoot, configResult });
		assert.equal(tasksRoot.ok, false);
		assert.equal(tasksRoot.suggestedCommand, expected);
		assertHonestHint(tasksRoot.suggestedCommand, resolvedRoot);

		const deps = checkDependenciesJson({ projectRoot, configResult });
		assert.equal(deps.ok, false);
		assert.equal(deps.suggestedCommand, expected);

		const validate = checkTasksValidate({ projectRoot, configResult });
		assert.equal(validate.ok, false);
		assert.equal(validate.suggestedCommand, expected);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});
