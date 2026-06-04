import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { loadRulesManifest } from "../../../src/config/cursor-rules/discover.mjs";
import { DEFAULT_RULES_PROFILE } from "../../../src/config/cursor-rules/profile.mjs";
import {
	contextPathToRuleRelPath,
	ruleRelPathToContextPath,
	selectRulesForWorker,
} from "../../../src/config/cursor-rules/select.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** @type {import("../../../src/config/cursor-rules/discover.mjs").CursorRulesManifest} */
function minimalManifest(rules) {
	return {
		generatedAt: new Date().toISOString(),
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
}

test("context path helpers round-trip under .cursor/rules", () => {
	const rel = "javascript-3-development-standards.mdc";
	const ctx = ruleRelPathToContextPath(rel);
	assert.equal(ctx, ".cursor/rules/javascript-3-development-standards.mdc");
	assert.equal(contextPathToRuleRelPath(ctx), rel);
});

test("selectRulesForWorker includes alwaysInclude and always-class rules", () => {
	const manifest = minimalManifest([
		{
			relPath: "critical-rules-quick-reference.mdc",
			spineClass: "always",
			alwaysApply: true,
			description: null,
			globs: [],
			parseStatus: "ok",
		},
		{
			relPath: "javascript-3-development-standards.mdc",
			spineClass: "glob",
			alwaysApply: false,
			description: null,
			globs: ["**/*.mjs"],
			parseStatus: "ok",
		},
	]);

	const result = selectRulesForWorker({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		fileScope: [],
	});

	assert.ok(
		result.paths.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
		"alwaysInclude from profile",
	);
	assert.ok(
		result.paths.includes(".cursor/rules/critical-rules-quick-reference.mdc"),
		"always-class rule",
	);
	assert.ok(
		!result.paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"no glob match on empty file scope",
	);
});

test("selectRulesForWorker selects JS globs and excludes Swift for JS-only scope", () => {
	const manifest = loadRulesManifest(PROJECT_ROOT);
	assert.ok(manifest, "committed manifest required for integration case");

	const jsScope = [
		"src/config/cursor-rules/match-globs.mjs",
		"src/config/cursor-rules/select.mjs",
		"tests/config/cursor-rules/match-globs.test.mjs",
	];

	const result = selectRulesForWorker({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		fileScope: jsScope,
		maxRules: 100,
	});

	const paths = result.paths;
	assert.ok(
		paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"JS standards selected",
	);
	assert.ok(
		!paths.includes(".cursor/rules/swift-6-development-standards.mdc"),
		"Swift standards excluded",
	);
	assert.ok(!paths.includes(".cursor/rules/swift-5-9-development-standards.mdc"));
});

test("selectRulesForWorker matches OWASP for bin/*.mjs scope via scope glob", () => {
	const manifest = minimalManifest([
		{
			relPath: "owasp-secure-coding-practices.mdc",
			spineClass: "glob",
			alwaysApply: false,
			description: null,
			globs: ["bin/**", "**/*.mjs"],
			parseStatus: "ok",
		},
	]);

	const result = selectRulesForWorker({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		fileScope: ["bin/*.mjs"],
		maxRules: 20,
	});

	assert.ok(
		result.paths.includes(".cursor/rules/owasp-secure-coding-practices.mdc"),
		"OWASP selected for bin/*.mjs scope",
	);
});

test("selectRulesForWorker appends standards without duplicates", () => {
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
	const result = selectRulesForWorker({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		fileScope: ["src/worker.mjs"],
		standards: [jsPath, ".cursor/rules/critical-rules-quick-reference.mdc"],
		maxRules: 20,
	});

	const jsCount = result.paths.filter((entry) => entry === jsPath).length;
	assert.equal(jsCount, 1, "deduped standards append");
	assert.ok(result.entries.find((entry) => entry.contextPath === jsPath)?.source === "glob");
});

test("selectRulesForWorker respects neverLoad and neverInclude", () => {
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

	const profile = {
		...DEFAULT_RULES_PROFILE,
		worker: {
			...DEFAULT_RULES_PROFILE.worker,
			neverInclude: ["taskplane-worker-cursor.mdc"],
		},
	};

	const result = selectRulesForWorker({
		manifest,
		profile,
		fileScope: ["src/worker.mjs"],
		neverLoad: [".cursor/rules/javascript-3-development-standards.mdc"],
	});

	assert.ok(
		!result.paths.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
		"neverInclude wins",
	);
	assert.ok(
		!result.paths.includes(".cursor/rules/javascript-3-development-standards.mdc"),
		"neverLoad blocks appended/glob paths",
	);
});

test("selectRulesForWorker exports journal-friendly entries shape", () => {
	const manifest = minimalManifest([]);
	const result = selectRulesForWorker({
		manifest,
		profile: DEFAULT_RULES_PROFILE,
		fileScope: ["src/a.mjs"],
	});

	assert.equal(result.ok, true);
	assert.ok(Array.isArray(result.paths));
	assert.ok(Array.isArray(result.entries));
	assert.equal(typeof result.globMatchEnabled, "boolean");
	assert.equal(typeof result.fileScopeProbeCount, "number");
	for (const entry of result.entries) {
		assert.ok(entry.relPath);
		assert.ok(entry.contextPath);
		assert.ok(entry.source);
	}
});
