/**
 * Regression: templates/spine-config.json testing.* must stay Phase-A evidence-safe.
 * Fails if shell metacharacters (e.g. &&) return before Phase B (SP-653).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseEvidenceCommandArgv } from "../../src/batch/evidence-command.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATE_PATH = path.join(REPO_ROOT, "templates/spine-config.json");
const TESTING_FIELDS = ["build", "test", "testWithCoverage"];

test("every template testing.* command parses via evidence validator", () => {
	const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));
	assert.ok(template.testing && typeof template.testing === "object");

	for (const field of TESTING_FIELDS) {
		const command = template.testing[field];
		assert.equal(typeof command, "string", `testing.${field} must be a string`);
		assert.ok(command.trim(), `testing.${field} must be non-empty`);
		const argv = parseEvidenceCommandArgv(command);
		assert.ok(argv.length > 0, `testing.${field} must parse to non-empty argv`);
	}
});

test("template testing commands reject && drift (Phase A)", () => {
	const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));
	for (const field of TESTING_FIELDS) {
		const command = template.testing[field];
		assert.equal(
			command.includes("&&"),
			false,
			`testing.${field} must not use && until Phase B (SP-653)`,
		);
	}
});
