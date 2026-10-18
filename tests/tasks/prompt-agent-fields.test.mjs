import assert from "node:assert/strict";
import test from "node:test";

import { parsePrompt, validatePrompt } from "../../src/tasks/packet/index.mjs";

const CONTRACT = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| fileScopeMustChange | \`src/example.mjs\` |
`;

/**
 * @param {string} header Extra header lines placed before ## Mission
 */
function prompt(header = "") {
	return `# Task: FX-900 — Agent fields

**Size:** S
${header}

## Mission
Do the thing.

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

${CONTRACT}
## Steps
### Step 0: Work
- [ ] one

### Step 1: Testing & Verification
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- touch unrelated files
`;
}

const AGENTS = {
	worker: { model: "anthropic/claude-sonnet-4" },
	reviewer: { model: "openai/gpt-5" },
	profiles: {
		gem: { worker: { model: "google/gemini-2.5-pro" }, reviewer: { model: "openai/gpt-5" } },
		gemReview: { reviewer: { model: "google/gemini-3.1-pro" } },
		claudeReview: { reviewer: { model: "anthropic/claude-opus-4" } },
		noReviewer: { worker: { model: "openai/gpt-5" } },
	},
};

test("parsePrompt returns null for all three fields when absent", () => {
	const parsed = parsePrompt(prompt());
	assert.equal(parsed.profile, null);
	assert.equal(parsed.thinking, null);
	assert.equal(parsed.reviewerProfile, null);
});

test("parsePrompt parses each field with case-insensitive labels and trimmed values", () => {
	const parsed = parsePrompt(
		prompt("**profile:**   gem  \n**THINKING:** high\n**reviewer profile:** claudeReview\t"),
	);
	assert.equal(parsed.profile, "gem");
	assert.equal(parsed.thinking, "high");
	assert.equal(parsed.reviewerProfile, "claudeReview");
});

test("parsePrompt keeps Profile and Reviewer Profile distinct", () => {
	const parsed = parsePrompt(prompt("**Reviewer Profile:** rev"));
	assert.equal(parsed.profile, null);
	assert.equal(parsed.reviewerProfile, "rev");
});

test("validatePrompt accepts every thinking level", () => {
	for (const level of ["off", "minimal", "low", "medium", "high", "xhigh"]) {
		const result = validatePrompt(prompt(`**Thinking:** ${level}`));
		assert.equal(result.ok, true, `${level}: ${result.errors.join("; ")}`);
	}
});

test("validatePrompt rejects an unrecognised Thinking value", () => {
	const result = validatePrompt(prompt("**Thinking:** extreme"));
	assert.equal(result.ok, false);
	assert.ok(
		result.errors.some((e) => e.includes("**Thinking:** must be one of off|minimal|low|medium|high|xhigh")),
		result.errors.join("; "),
	);
});

test("validatePrompt rejects malformed profile names", () => {
	const result = validatePrompt(prompt("**Profile:** bad name!\n**Reviewer Profile:** a/b"));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /Profile:\*\* malformed profile name "bad name!"/.test(e)));
	assert.ok(result.errors.some((e) => /Reviewer Profile:\*\* malformed profile name "a\/b"/.test(e)));
});

test("execute task with agent fields warns instead of erroring", () => {
	const result = validatePrompt(
		prompt("**Type:** execute\n**Profile:** gem\n**Thinking:** low\n**Reviewer Profile:** x"),
		{ agents: AGENTS },
	);
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.warnings.filter((w) => /execute task/.test(w)).length, 3);
});

test("without agents option, profile names are not checked against config", () => {
	const result = validatePrompt(prompt("**Profile:** nope\n**Reviewer Profile:** nada"));
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("with agents: unknown Profile is an error", () => {
	const result = validatePrompt(prompt("**Profile:** nope"), { agents: AGENTS });
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /Profile:\*\* "nope" is not defined in agents\.profiles/.test(e)));
});

test("with agents: unknown Reviewer Profile is an error", () => {
	const result = validatePrompt(prompt("**Reviewer Profile:** nada"), { agents: AGENTS });
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /Reviewer Profile:\*\* "nada" is not defined/.test(e)));
});

test("with agents: reviewer profile without reviewer block warns", () => {
	const result = validatePrompt(prompt("**Reviewer Profile:** noReviewer"), { agents: AGENTS });
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(
		result.warnings.some((w) => w.includes("falls back to the next reviewer precedence level")),
		result.warnings.join("; "),
	);
});

test("with agents: gemini worker profile + gemini reviewer profile is a same-family error", () => {
	const result = validatePrompt(prompt("**Profile:** gem\n**Reviewer Profile:** gemReview"), {
		agents: AGENTS,
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /same model family/.test(e)), result.errors.join("; "));
});

test("with agents: same-family against the base worker model is an error", () => {
	const result = validatePrompt(prompt("**Reviewer Profile:** claudeReview"), { agents: AGENTS });
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /same model family/.test(e)), result.errors.join("; "));
});

test("with agents: cross-family reviewer profile is OK", () => {
	const result = validatePrompt(prompt("**Profile:** gem\n**Reviewer Profile:** claudeReview"), {
		agents: AGENTS,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.deepEqual(result.warnings.filter((w) => /Profile/.test(w)), []);
});
