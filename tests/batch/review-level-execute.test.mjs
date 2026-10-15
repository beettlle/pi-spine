/**
 * SP-827 / GitHub #336 — execute packets run at an effective Review Level of 0:
 * `readReviewLevel` returns 0 for `**Type:** execute` packets regardless of the
 * declared level, so no engine review phase runs; `llm` packets are unchanged.
 * `validatePrompt` warns (does not fail) when an execute packet declares a
 * Review Level above 0.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { readReviewLevel } from "../../src/batch/review-artifacts.mjs";
import { isReviewTypeRequired } from "../../src/batch/review-shared.mjs";
import { validatePrompt } from "../../src/tasks/packet/validate-prompt.mjs";

/**
 * @param {{ type?: "llm" | "execute", reviewLevel: number }} options
 */
function promptMarkdown({ type, reviewLevel }) {
	const typeLine = type ? `\n**Type:** ${type}\n` : "";
	return `# Task: SP-827 — Effective review level fixture

## Review Level: ${reviewLevel}
${typeLine}
## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |

## Steps
### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
}

/**
 * @param {string} markdown
 */
function writeTaskFolder(markdown) {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sp827-review-level-"));
	tempFolders.push(folder);
	fs.writeFileSync(path.join(folder, "PROMPT.md"), markdown);
	return folder;
}

/** @type {string[]} */
const tempFolders = [];

after(() => {
	for (const folder of tempFolders) {
		fs.rmSync(folder, { recursive: true, force: true });
	}
});

test("readReviewLevel: llm packet without Type line returns declared level 0/1/2", () => {
	for (const level of [0, 1, 2]) {
		const folder = writeTaskFolder(promptMarkdown({ reviewLevel: level }));
		assert.equal(readReviewLevel(folder), level, `llm packet at level ${level}`);
	}
});

test("readReviewLevel: execute packet returns effective level 0 at declared 0/1/2", () => {
	for (const level of [0, 1, 2]) {
		const folder = writeTaskFolder(promptMarkdown({ type: "execute", reviewLevel: level }));
		assert.equal(readReviewLevel(folder), 0, `execute packet at level ${level}`);
	}
});

test("readReviewLevel: explicit llm packet at level 2 returns 2", () => {
	const folder = writeTaskFolder(promptMarkdown({ type: "llm", reviewLevel: 2 }));
	assert.equal(readReviewLevel(folder), 2);
});

test("isReviewTypeRequired: no plan/code/final review for an execute packet at level 2", () => {
	const folder = writeTaskFolder(promptMarkdown({ type: "execute", reviewLevel: 2 }));
	const level = readReviewLevel(folder);
	assert.equal(level, 0);
	for (const reviewType of ["plan", "code", "final"]) {
		assert.equal(isReviewTypeRequired(level, reviewType), false, reviewType);
	}
});

test("validatePrompt: execute packet at Review Level 1 stays ok with one Review Level warning", () => {
	const result = validatePrompt(promptMarkdown({ type: "execute", reviewLevel: 1 }));
	assert.equal(result.ok, true, JSON.stringify(result.errors));
	const reviewLevelWarnings = result.warnings.filter((w) => w.includes("Review Level"));
	assert.equal(reviewLevelWarnings.length, 1, JSON.stringify(result.warnings));
});

test("validatePrompt: execute packet at Review Level 0 has no Review Level warning", () => {
	const result = validatePrompt(promptMarkdown({ type: "execute", reviewLevel: 0 }));
	assert.equal(result.ok, true, JSON.stringify(result.errors));
	assert.equal(result.warnings.some((w) => w.includes("Review Level")), false, JSON.stringify(result.warnings));
});

test("validatePrompt: llm packet at Review Level 2 has no Review Level warning", () => {
	const result = validatePrompt(promptMarkdown({ type: "llm", reviewLevel: 2 }));
	assert.equal(result.ok, true, JSON.stringify(result.errors));
	assert.equal(result.warnings.some((w) => w.includes("Review Level")), false, JSON.stringify(result.warnings));
});
