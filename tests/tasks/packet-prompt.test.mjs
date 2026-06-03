import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	TASK_HEADING_RE,
	discoverTasks,
	parsePrompt,
	parsePromptDependencies,
	validatePrompt,
} from "../../src/tasks/packet/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "../../test/fixtures/taskplane");

test("TASK_HEADING_RE requires em dash (U+2014)", () => {
	const valid = "# Task: TP-007 — Taskplane compatibility parsers\n";
	const hyphen = "# Task: TP-007 - Taskplane compatibility parsers\n";

	assert.match(valid, TASK_HEADING_RE);
	assert.doesNotMatch(hyphen, TASK_HEADING_RE);
});

test("parsePrompt extracts required sections and steps from golden S fixture", () => {
	const markdown = fs.readFileSync(
		path.join(FIXTURES_ROOT, "FX-001-simple-fix/PROMPT.md"),
		"utf-8",
	);
	const prompt = parsePrompt(markdown);

	assert.equal(prompt.taskId, "FX-001");
	assert.equal(prompt.title, "Simple golden fixture");
	assert.deepEqual(prompt.missingSections, []);
	assert.ok(prompt.hasTesting);
	assert.equal(prompt.steps.length, 3);
	assert.deepEqual(prompt.fileScope, ["src/example.mjs"]);
	assert.deepEqual(prompt.dependencies, []);
});

test("validatePrompt rejects hyphen separator in heading", () => {
	const bad = `# Task: FX-BAD-001 - Bad heading

## Mission
x

## Dependencies
- **None**

## File Scope
- \`a.mjs\`

## Steps
### Step 0: T
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
	const result = validatePrompt(bad);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("\n"), /em dash/i);
});

test("discoverTasks finds three golden fixtures", () => {
	const discovered = discoverTasks(FIXTURES_ROOT);
	assert.equal(discovered.length, 3);
	assert.deepEqual(
		discovered.map((t) => t.taskId),
		["FX-001", "FX-002", "FX-003"],
	);
});

test("parsePromptDependencies parses list and Requires forms", () => {
	assert.deepEqual(parsePromptDependencies("- **None**"), []);
	assert.deepEqual(parsePromptDependencies("- TP-006\n- TP-007"), ["TP-006", "TP-007"]);
	assert.deepEqual(
		parsePromptDependencies("**Requires:** auth/AUTH-003\n**Requires:** BIL-002"),
		["AUTH-003", "BIL-002"],
	);
});
