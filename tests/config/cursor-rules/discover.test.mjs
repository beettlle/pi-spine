import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";

import {
	classifyCursorRuleSpineClass,
	discoverCursorRules,
	getCursorRuleExclusionReason,
	loadRulesManifest,
	RULES_MANIFEST_REL_PATH,
} from "../../../src/config/cursor-rules/discover.mjs";
import { DEFAULT_RULES_PROFILE } from "../../../src/config/cursor-rules/profile.mjs";

function makeRulesRoot(root) {
	const rulesRoot = path.join(root, ".cursor", "rules");
	fs.mkdirSync(rulesRoot, { recursive: true });
	return rulesRoot;
}

test("discoverCursorRules returns empty manifest when rules root is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-discover-empty-"));
	try {
		const result = discoverCursorRules({
			projectRoot: root,
			profile: DEFAULT_RULES_PROFILE,
			writeManifest: false,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(result.manifest.rules, []);
		assert.deepEqual(result.manifest.excluded, []);
		assert.equal(result.manifest.rulesRoot, ".cursor/rules");
		assert.ok(result.manifest.generatedAt);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("discoverCursorRules excludes brutal-audit rules via profile patterns", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-discover-excluded-"));
	try {
		const rulesRoot = makeRulesRoot(root);
		await writeFile(
			path.join(rulesRoot, "rust-brutal-audit.mdc"),
			"---\nglobs: ['**/*.rs']\nalwaysApply: false\n---\n",
			"utf-8",
		);
		await writeFile(
			path.join(rulesRoot, "manual-rule.mdc"),
			"---\nalwaysApply: false\n---\n",
			"utf-8",
		);

		const result = discoverCursorRules({
			projectRoot: root,
			profile: DEFAULT_RULES_PROFILE,
			writeManifest: false,
		});

		assert.deepEqual(
			result.manifest.excluded.map((entry) => entry.relPath),
			["rust-brutal-audit.mdc"],
		);
		assert.equal(result.manifest.excluded[0].reason, "excludePattern");
		assert.equal(result.manifest.excluded[0].spineClass, "excluded");
		assert.equal(result.manifest.rules.length, 1);
		assert.equal(result.manifest.rules[0].relPath, "manual-rule.mdc");
		assert.equal(result.manifest.rules[0].spineClass, "manual");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("discoverCursorRules records parse warn entries in manifest rules", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-discover-warn-"));
	try {
		const rulesRoot = makeRulesRoot(root);
		await writeFile(
			path.join(rulesRoot, "bad-frontmatter.mdc"),
			"---\nalwaysApply: maybe\n---\n",
			"utf-8",
		);

		const result = discoverCursorRules({
			projectRoot: root,
			profile: DEFAULT_RULES_PROFILE,
			writeManifest: false,
		});

		assert.equal(result.manifest.rules.length, 1);
		assert.equal(result.manifest.rules[0].parseStatus, "warn");
		assert.ok(result.manifest.rules[0].warnings?.length);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("discoverCursorRules manifest round-trip via atomic write", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-discover-roundtrip-"));
	try {
		const rulesRoot = makeRulesRoot(root);
		await writeFile(
			path.join(rulesRoot, "always.mdc"),
			"---\nalwaysApply: true\ndescription: test\n---\n",
			"utf-8",
		);
		await writeFile(
			path.join(rulesRoot, "globbed.mdc"),
			'---\nglobs: ["src/**/*.mjs"]\nalwaysApply: false\n---\n',
			"utf-8",
		);

		const discovered = discoverCursorRules({
			projectRoot: root,
			profile: DEFAULT_RULES_PROFILE,
			writeManifest: true,
		});
		assert.ok(discovered.manifestPath?.endsWith(RULES_MANIFEST_REL_PATH));

		const loaded = loadRulesManifest(root);
		assert.deepEqual(loaded?.rules, discovered.manifest.rules);
		assert.deepEqual(loaded?.excluded, discovered.manifest.excluded);
		assert.equal(loaded?.rulesRoot, ".cursor/rules");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("classifyCursorRuleSpineClass prefers always over globs", () => {
	assert.equal(
		classifyCursorRuleSpineClass({
			alwaysApply: true,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
			relPath: "x.mdc",
			description: null,
			warnings: [],
		}),
		"always",
	);
	assert.equal(
		classifyCursorRuleSpineClass({
			alwaysApply: false,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
			relPath: "x.mdc",
			description: null,
			warnings: [],
		}),
		"glob",
	);
});

test("getCursorRuleExclusionReason matches excludeRelPaths exactly", () => {
	assert.equal(
		getCursorRuleExclusionReason(DEFAULT_RULES_PROFILE.discovery, "audit-workflow.mdc"),
		"excludeRelPath",
	);
	assert.equal(
		getCursorRuleExclusionReason(DEFAULT_RULES_PROFILE.discovery, "java-brutal-audit.mdc"),
		"excludePattern",
	);
	assert.equal(
		getCursorRuleExclusionReason(DEFAULT_RULES_PROFILE.discovery, "taskplane-worker-cursor.mdc"),
		null,
	);
});
