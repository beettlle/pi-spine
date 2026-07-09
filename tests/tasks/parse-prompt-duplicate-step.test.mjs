import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { runSpineTasksValidate } from "../../bin/spine-tasks.mjs";
import { validatePrompt as validatePromptStructure } from "../../src/tasks/packet/parse-prompt.mjs";
import { validatePrompt } from "../../src/tasks/packet/validate-prompt.mjs";
import { initGitRepo, destroyGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} stepsSection
 */
function promptWithSteps(stepsSection) {
	return `# Task: FX-148 — Duplicate step fixture

## Mission
Validate duplicate step detection.

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
${stepsSection}

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
}

test("validatePrompt rejects duplicate step numbers with actionable titles", () => {
	const markdown = promptWithSteps(`### Step 0: Preflight
- [ ] read

### Step 0: Poll semantics
- [ ] poll

### Step 1: Testing & Verification
- [ ] test
`);

	const structure = validatePromptStructure(markdown);
	assert.equal(structure.ok, false);
	assert.match(structure.errors.join("\n"), /Duplicate step number 0/);
	assert.match(structure.errors.join("\n"), /Preflight/);
	assert.match(structure.errors.join("\n"), /Poll semantics/);
});

test("validatePrompt accepts sequentially numbered steps", () => {
	const markdown = promptWithSteps(`### Step 0: Preflight
- [ ] read

### Step 1: Work
- [ ] work

### Step 2: Testing & Verification
- [ ] test
`);

	const structure = validatePromptStructure(markdown);
	assert.equal(structure.ok, true);
	assert.deepEqual(structure.errors, []);
});

test("validatePrompt reports multiple duplicate step numbers", () => {
	const markdown = promptWithSteps(`### Step 0: First zero
- [ ] a

### Step 0: Second zero
- [ ] b

### Step 1: First one
- [ ] c

### Step 1: Second one
- [ ] d

### Step 2: Testing & Verification
- [ ] test
`);

	const structure = validatePromptStructure(markdown);
	assert.equal(structure.ok, false);
	assert.match(structure.errors.join("\n"), /Duplicate step number 0/);
	assert.match(structure.errors.join("\n"), /Duplicate step number 1/);
});

test("runSpineTasksValidate fails for packet with duplicate step numbers", async () => {
	const projectRoot = await initGitRepo("spine-validate-dup-step-");
	const folder = path.join(projectRoot, "spine-tasks", "FX-148-dup-step");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		promptWithSteps(`### Step 0: Preflight
- [ ] read

### Step 0: Implementation
- [ ] work

### Step 1: Testing & Verification
- [ ] test
`),
		"utf-8",
	);

	try {
		const result = await runSpineTasksValidate({ projectRoot, scope: "FX-148" });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Duplicate step number 0/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validatePrompt wrapper surfaces duplicate step errors in required contract mode", () => {
	const markdown = `${promptWithSteps(`### Step 0: Preflight
- [ ] read

### Step 0: Work
- [ ] work

### Step 1: Testing & Verification
- [ ] test
`)}

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| fileScopeMustChange | \`src/example.mjs\` |
`;

	const result = validatePrompt(markdown, { mode: "required" });
	assert.equal(result.ok, false);
	assert.match(result.errors.join("\n"), /Duplicate step number 0/);
});
