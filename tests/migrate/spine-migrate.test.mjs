import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	parseMigrateArgs,
	runMigrateFromTaskplane,
} from "../../bin/spine-migrate-from-taskplane.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Tracked fixture — do not use gitignored `.pi/` (absent on clean CI checkouts).
const FIXTURE = path.join(REPO_ROOT, "tests", "fixtures", "migrate", "taskplane-config.json");

test("parseMigrateArgs rejects --source without value", () => {
	assert.throws(
		() => parseMigrateArgs(["--source", "--force"]),
		(err) => err instanceof Error && /Missing value for --source/.test(err.message),
	);
});

test("runMigrateFromTaskplane fails when source file is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-migrate-missing-"));
	try {
		const result = runMigrateFromTaskplane(root, ["--source", ".pi/missing-config.json"]);
		assert.equal(result.ok, false);
		assert.match(result.error, /not found|ENOENT|Cannot/i);
		assert.equal(result.exitCode, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runMigrateFromTaskplane refuses overwrite without force", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-migrate-existing-"));
	try {
		fs.mkdirSync(path.join(root, ".spine"), { recursive: true });
		fs.writeFileSync(path.join(root, ".spine", "spine-config.json"), "{}\n", "utf-8");

		const result = runMigrateFromTaskplane(root, ["--source", FIXTURE]);
		assert.equal(result.ok, false);
		assert.match(result.error, /already has/);
		assert.match(result.suggestedCommand, /--force/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runMigrateFromTaskplane dry-run does not write config", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-migrate-dry-"));
	try {
		const result = runMigrateFromTaskplane(root, ["--dry-run", "--source", FIXTURE]);
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.equal(result.action, "dry-run");
		assert.equal(fs.existsSync(path.join(root, ".spine", "spine-config.json")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
