import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isCliEntrypoint } from "../../bin/spine-cli/shared.mjs";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPINE_BIN = path.join(REPO_ROOT, "bin", "spine.mjs");

/**
 * @param {string} entryPath
 * @param {string[]} argv
 */
function runViaEntry(entryPath, argv) {
	return spawnSync(process.execPath, [entryPath, ...argv], {
		cwd: REPO_ROOT,
		encoding: "utf-8",
	});
}

test("isCliEntrypoint returns true when argv[1] is a symlink to the module", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-cli-entry-"));
	const symlinkPath = path.join(tmpDir, "spine-link");
	fs.symlinkSync(SPINE_BIN, symlinkPath);

	assert.equal(isCliEntrypoint(`file://${SPINE_BIN}`, symlinkPath), true);
});

test("isCliEntrypoint returns false for an unrelated script path", () => {
	const unrelated = path.join(REPO_ROOT, "package.json");
	assert.equal(isCliEntrypoint(`file://${SPINE_BIN}`, unrelated), false);
});

test("isCliEntrypoint returns false when argv[1] is missing", () => {
	assert.equal(isCliEntrypoint(`file://${SPINE_BIN}`, undefined), false);
});

test("spine help via symlink produces stdout and exit 0", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-cli-symlink-"));
	const symlinkPath = path.join(tmpDir, "spine-link");
	fs.symlinkSync(SPINE_BIN, symlinkPath);

	const result = runViaEntry(symlinkPath, ["help"]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.notEqual(result.stdout.trim(), "", "expected non-empty stdout from symlink entrypoint");
	assert.match(result.stdout, /pi-spine/);
});

test("spine version via symlink produces stdout and exit 0", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-cli-symlink-"));
	const symlinkPath = path.join(tmpDir, "spine-link");
	fs.symlinkSync(SPINE_BIN, symlinkPath);

	const result = runViaEntry(symlinkPath, ["version"]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.notEqual(result.stdout.trim(), "", "expected non-empty stdout from symlink entrypoint");
	assert.match(result.stdout, /Node:/);
});
