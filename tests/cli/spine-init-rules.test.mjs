import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runInit } from "../../bin/spine-init.mjs";
import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";
import { RULES_PROFILE_REL_PATH } from "../../src/config/cursor-rules/profile.mjs";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("runInit copies rules profile, discovers manifest, standards default []", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-init-rules-"));
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "taskplane-worker-cursor.mdc"),
			"---\nalwaysApply: true\n---\n",
			"utf-8",
		);

		const result = runInit(projectRoot, []);
		assert.equal(result.ok, true);
		assert.deepEqual(result.config.standards, []);

		assert.ok(fs.existsSync(path.join(projectRoot, RULES_PROFILE_REL_PATH)));
		assert.ok(fs.existsSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH)));

		const profile = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_PROFILE_REL_PATH), "utf-8"),
		);
		assert.ok(profile.worker.alwaysInclude.includes("taskplane-worker-cursor.mdc"));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runInit dry-run plans rules files without writing", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-init-rules-dry-"));
	try {
		const result = runInit(projectRoot, ["--dry-run"]);
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);

		const profileAction = result.actions.find((a) => a.path === RULES_PROFILE_REL_PATH);
		assert.ok(profileAction);
		assert.equal(fs.existsSync(path.join(projectRoot, RULES_PROFILE_REL_PATH)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("rules-manifest.json is not listed in .gitignore", () => {
	const gitignorePath = path.join(REPO_ROOT, ".gitignore");
	const content = fs.readFileSync(gitignorePath, "utf-8");
	assert.equal(content.includes("rules-manifest.json"), false);
});
