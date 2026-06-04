import assert from "node:assert/strict";
import test from "node:test";

import {
	expandFileScopeProbes,
	ruleGlobsMatchFileScope,
} from "../../../src/config/cursor-rules/match-globs.mjs";

test("expandFileScopeProbes returns empty for empty scope", () => {
	assert.deepEqual(expandFileScopeProbes([]), []);
	assert.deepEqual(expandFileScopeProbes(undefined), []);
});

test("expandFileScopeProbes adds synthetic probes for dir/* and dir/**", () => {
	const probes = expandFileScopeProbes(["src/config/*", "tests/**"]);
	assert.ok(probes.includes("src/config/*"));
	assert.ok(probes.includes("src/config/__probe__.mjs"));
	assert.ok(probes.includes("tests/**"));
	assert.ok(probes.includes("tests/__probe__/__probe__.mjs"));
	assert.ok(probes.includes("tests/nested/__probe__.js"));
});

test("expandFileScopeProbes keeps literal file paths", () => {
	const probes = expandFileScopeProbes(["src/foo.mjs"]);
	assert.deepEqual(probes, ["src/foo.mjs"]);
});

test("expandFileScopeProbes expands in-path wildcards", () => {
	const probes = expandFileScopeProbes(["bin/*.mjs"]);
	assert.ok(probes.includes("bin/*.mjs"));
	assert.ok(probes.includes("bin/__probe__.mjs"));
});

test("ruleGlobsMatchFileScope is false for empty file scope", () => {
	assert.equal(ruleGlobsMatchFileScope(["**/*.mjs"], []), false);
	assert.equal(ruleGlobsMatchFileScope(["**/*"], []), false);
});

test("ruleGlobsMatchFileScope matches **/* when file scope is non-empty", () => {
	assert.equal(ruleGlobsMatchFileScope(["**/*"], ["src/a.mjs"]), true);
});

test("ruleGlobsMatchFileScope matches JS globs against mjs scope", () => {
	assert.equal(ruleGlobsMatchFileScope(["**/*.mjs"], ["src/config/select.mjs"]), true);
	assert.equal(ruleGlobsMatchFileScope(["**/*.swift"], ["src/config/select.mjs"]), false);
});

test("ruleGlobsMatchFileScope matches scope glob entries against rule globs", () => {
	assert.equal(ruleGlobsMatchFileScope(["**/*.mjs"], ["bin/*.mjs"]), true);
	assert.equal(ruleGlobsMatchFileScope(["bin/**"], ["bin/*.mjs"]), true);
});
