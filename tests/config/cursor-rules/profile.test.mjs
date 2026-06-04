import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";

import {
	DEFAULT_RULES_PROFILE,
	loadRulesProfile,
	mergeRulesProfile,
	validateRulesProfile,
} from "../../../src/config/cursor-rules/profile.mjs";

test("DEFAULT_RULES_PROFILE seeds worker include and discovery excludes", () => {
	assert.equal(DEFAULT_RULES_PROFILE.profileVersion, 1);
	assert.ok(DEFAULT_RULES_PROFILE.worker.alwaysInclude.includes("taskplane-worker-cursor.mdc"));
	assert.ok(DEFAULT_RULES_PROFILE.discovery.excludePatterns.includes("*-brutal-audit"));
	assert.ok(
		DEFAULT_RULES_PROFILE.discovery.excludeRelPaths.includes("audit-workflow.mdc"),
	);
});

test("loadRulesProfile returns built-in defaults when file missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-profile-"));
	try {
		const result = loadRulesProfile(root);
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.source, "default");
			assert.ok(result.profile.worker.alwaysInclude.includes("taskplane-worker-cursor.mdc"));
			assert.equal(result.profile.worker.globMatch, true);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("mergeRulesProfile applies neverInclude over alwaysInclude", () => {
	const merged = mergeRulesProfile(DEFAULT_RULES_PROFILE, {
		profileVersion: 1,
		worker: {
			alwaysInclude: ["extra-rule.mdc", "taskplane-worker-cursor.mdc"],
			neverInclude: ["taskplane-worker-cursor.mdc"],
			globMatch: true,
		},
		discovery: { excludePatterns: [], excludeRelPaths: [] },
	});
	assert.ok(merged.worker.alwaysInclude.includes("extra-rule.mdc"));
	assert.ok(!merged.worker.alwaysInclude.includes("taskplane-worker-cursor.mdc"));
	assert.ok(merged.worker.neverInclude.includes("taskplane-worker-cursor.mdc"));
});

test("loadRulesProfile rejects invalid JSON with RULES_PROFILE_INVALID", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-profile-bad-"));
	try {
		const spineDir = path.join(root, ".spine");
		fs.mkdirSync(spineDir, { recursive: true });
		fs.writeFileSync(path.join(spineDir, "rules-profile.json"), "{not json", "utf-8");
		const result = loadRulesProfile(root);
		assert.equal(result.ok, false);
		if (!result.ok) {
			assert.equal(result.error.code, "RULES_PROFILE_INVALID");
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateRulesProfile rejects unsupported profileVersion", () => {
	const error = validateRulesProfile({ profileVersion: 2, worker: {}, discovery: {} });
	assert.ok(error);
	assert.equal(error.code, "RULES_PROFILE_INVALID");
});

test("loadRulesProfile merges partial file overrides", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-profile-partial-"));
	try {
		const spineDir = path.join(root, ".spine");
		fs.mkdirSync(spineDir, { recursive: true });
		await writeFile(
			path.join(spineDir, "rules-profile.json"),
			JSON.stringify({
				profileVersion: 1,
				worker: { neverInclude: ["custom-skip.mdc"] },
			}),
			"utf-8",
		);
		const result = loadRulesProfile(root);
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.source, "file");
			assert.ok(result.profile.worker.neverInclude.includes("custom-skip.mdc"));
			assert.ok(result.profile.discovery.excludePatterns.includes("*-brutal-audit"));
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
