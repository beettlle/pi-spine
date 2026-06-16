import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_RULES_PROFILE } from "../../../src/config/cursor-rules/profile.mjs";
import { selectRulesForReviewer } from "../../../src/config/cursor-rules/select.mjs";

/** @type {import("../../../src/config/cursor-rules/discover.mjs").CursorRulesManifest} */
function minimalManifest(rules) {
	return {
		generatedAt: new Date().toISOString(),
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
}

test("selectRulesForReviewer returns empty when reviewer.enabled is false", () => {
	const manifest = minimalManifest([
		{
			relPath: "critical-rules-quick-reference.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
	]);

	const profile = {
		...DEFAULT_RULES_PROFILE,
		reviewer: {
			...DEFAULT_RULES_PROFILE.reviewer,
			enabled: false,
		},
	};

	const result = selectRulesForReviewer({
		manifest,
		profile,
		scopePaths: ["src/foo.mjs"],
		standards: [".cursor/rules/critical-rules-quick-reference.mdc"],
	});

	assert.deepEqual(result.paths, []);
	assert.deepEqual(result.entries, []);
	assert.equal(result.capped, false);
	assert.equal(result.globMatchEnabled, true);
	assert.ok(result.fileScopeProbeCount > 0, "scope probe count still computed");
});

test("selectRulesForReviewer never selects taskplane-worker-cursor.mdc", () => {
	const manifest = minimalManifest([
		{
			relPath: "taskplane-worker-cursor.mdc",
			spineClass: "always",
			alwaysApply: false,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
		{
			relPath: "critical-rules-quick-reference.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
	]);

	const result = selectRulesForReviewer({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		scopePaths: [],
	});

	assert.ok(
		!result.paths.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
		"worker execution rule excluded via reviewer.neverInclude",
	);
	assert.ok(
		!result.paths.includes(".cursor/rules/taskplane-task-authoring.mdc"),
		"task authoring rule excluded via reviewer.neverInclude",
	);
	assert.ok(
		result.paths.includes(".cursor/rules/critical-rules-quick-reference.mdc"),
		"always-class rules included without scope",
	);
});

test("selectRulesForReviewer selects glob rules when scopePaths match", () => {
	const manifest = minimalManifest([
		{
			relPath: "javascript-3-development-standards.mdc",
			spineClass: "glob",
			alwaysApply: false,
			description: null,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
		},
		{
			relPath: "critical-rules-quick-reference.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
	]);

	const withScope = selectRulesForReviewer({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		scopePaths: ["src/foo.mjs"],
	});

	assert.ok(
		withScope.paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"glob rule activates on scoped path",
	);

	const finalScope = selectRulesForReviewer({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		scopePaths: [],
	});

	assert.ok(
		!finalScope.paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"glob rule omitted on empty final review scope",
	);
	assert.ok(
		finalScope.paths.includes(".cursor/rules/critical-rules-quick-reference.mdc"),
		"always-class rules remain on empty scope",
	);
});

test("selectRulesForReviewer appends standards without duplicates", () => {
	const manifest = minimalManifest([
		{
			relPath: "javascript-3-development-standards.mdc",
			spineClass: "glob",
			alwaysApply: false,
			description: null,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
		},
		{
			relPath: "critical-rules-quick-reference.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
	]);

	const jsPath = ".cursor/rules/javascript-3-development-standards.mdc";
	const result = selectRulesForReviewer({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		scopePaths: ["src/foo.mjs"],
		standards: [jsPath, ".cursor/rules/critical-rules-quick-reference.mdc"],
	});

	const jsCount = result.paths.filter((entry) => entry === jsPath).length;
	assert.equal(jsCount, 1, "deduped standards append");
	assert.ok(result.entries.find((entry) => entry.contextPath === jsPath)?.source === "glob");
});

test("selectRulesForReviewer respects neverLoad", () => {
	const manifest = minimalManifest([
		{
			relPath: "javascript-3-development-standards.mdc",
			spineClass: "glob",
			alwaysApply: false,
			description: null,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
		},
	]);

	const result = selectRulesForReviewer({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		scopePaths: ["src/foo.mjs"],
		neverLoad: [".cursor/rules/javascript-3-development-standards.mdc"],
	});

	assert.ok(
		!result.paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"neverLoad blocks glob-selected path",
	);
});

test("selectRulesForReviewer uses profile.reviewer.maxRules cap", () => {
	const manifest = minimalManifest([
		{
			relPath: "rule-a.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
		{
			relPath: "rule-b.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
		{
			relPath: "rule-c.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
	]);

	const profile = {
		...DEFAULT_RULES_PROFILE,
		reviewer: {
			...DEFAULT_RULES_PROFILE.reviewer,
			maxRules: 2,
		},
	};

	const result = selectRulesForReviewer({
		manifest,
		profile,
		scopePaths: [],
	});

	assert.equal(result.paths.length, 2);
	assert.equal(result.capped, true);
	assert.ok(Array.isArray(result.dropped));
	assert.equal(result.dropped?.length, 1);
});
