import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseCursorRuleFrontmatter } from "../../../src/config/cursor-rules/parse-frontmatter.mjs";

const FIXTURES_DIR = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../tests/fixtures/cursor-rules",
);

function readFixture(name) {
	return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

test("parseCursorRuleFrontmatter returns skip when frontmatter missing", () => {
	const content = readFixture("no-frontmatter.mdc");
	const result = parseCursorRuleFrontmatter(content, "no-frontmatter.mdc");
	assert.equal(result.parseStatus, "skip");
	assert.deepEqual(result.globs, []);
	assert.equal(result.alwaysApply, false);
});

test("parseCursorRuleFrontmatter parses array globs fixture", () => {
	const result = parseCursorRuleFrontmatter(readFixture("array-globs.mdc"), "array-globs.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.deepEqual(result.globs, ["**/*.js", "**/*.mjs"]);
	assert.equal(result.alwaysApply, false);
	assert.equal(result.description, "Array globs fixture");
});

test("parseCursorRuleFrontmatter splits comma-separated globs", () => {
	const result = parseCursorRuleFrontmatter(readFixture("comma-globs.mdc"), "comma-globs.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.deepEqual(result.globs, ["**/PROMPT.md", "**/STATUS.md", "**/spine-tasks/**"]);
});

test("parseCursorRuleFrontmatter treats empty globs array as no patterns", () => {
	const result = parseCursorRuleFrontmatter(readFixture("empty-globs.mdc"), "empty-globs.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.deepEqual(result.globs, []);
});

test("parseCursorRuleFrontmatter defaults missing globs key to empty array", () => {
	const result = parseCursorRuleFrontmatter(readFixture("missing-globs.mdc"), "missing-globs.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.deepEqual(result.globs, []);
});

test("parseCursorRuleFrontmatter coerces alwaysApply booleans", () => {
	const trueResult = parseCursorRuleFrontmatter(readFixture("always-apply-true.mdc"), "always-apply-true.mdc");
	assert.equal(trueResult.alwaysApply, true);

	const coerced = parseCursorRuleFrontmatter(
		"---\nalwaysApply: yes\ndescription: test\n---\n",
		"coerced.mdc",
	);
	assert.equal(coerced.alwaysApply, true);
	assert.equal(coerced.parseStatus, "ok");

	const falseCoerced = parseCursorRuleFrontmatter(
		"---\nalwaysApply: false\nglobs: []\n---\n",
		"false.mdc",
	);
	assert.equal(falseCoerced.alwaysApply, false);
});

test("parseCursorRuleFrontmatter matches repo comma-separated task authoring layout", () => {
	const content = `---
description: "Create Taskplane-style task packets"
globs: "**/PROMPT.md, **/STATUS.md, **/taskplane-tasks/**, **/docs/task-management/**"
alwaysApply: false
---
`;
	const result = parseCursorRuleFrontmatter(content, "taskplane-task-authoring.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.equal(result.globs.length, 4);
	assert.match(result.globs.join(","), /PROMPT\.md/);
});

test("parseCursorRuleFrontmatter matches general-llm alwaysApply true layout", () => {
	const content = `---
alwaysApply: true
description: "Universal rules"
---
`;
	const result = parseCursorRuleFrontmatter(content, "general-llm-anti-patterns.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.equal(result.alwaysApply, true);
	assert.deepEqual(result.globs, []);
});

test("parseCursorRuleFrontmatter matches audit-workflow empty globs layout", () => {
	const content = `---
description: "Phase completion verification workflow"
globs: []
alwaysApply: false
---
`;
	const result = parseCursorRuleFrontmatter(content, "audit-workflow.mdc");
	assert.equal(result.parseStatus, "ok");
	assert.deepEqual(result.globs, []);
	assert.equal(result.alwaysApply, false);
});

test("parseCursorRuleFrontmatter warns on invalid alwaysApply and bad globs", () => {
	const invalidBool = parseCursorRuleFrontmatter(
		"---\nalwaysApply: maybe\ndescription: x\n---\n",
		"invalid-bool.mdc",
	);
	assert.equal(invalidBool.parseStatus, "warn");
	assert.equal(invalidBool.alwaysApply, false);
	assert.ok(invalidBool.warnings.some((w) => /alwaysApply/.test(w)));

	const badGlobs = parseCursorRuleFrontmatter(
		"---\nglobs: not-json-array\n---\n",
		"bad-globs.mdc",
	);
	assert.equal(badGlobs.parseStatus, "ok");
	assert.deepEqual(badGlobs.globs, ["not-json-array"]);

	const unclosed = parseCursorRuleFrontmatter("---\nalwaysApply: true\n", "unclosed.mdc");
	assert.equal(unclosed.parseStatus, "warn");
	assert.ok(unclosed.warnings.some((w) => /unclosed/.test(w)));
});

