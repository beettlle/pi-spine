import assert from "node:assert/strict";
import test from "node:test";

import { CONTRACT_FIELD_NAMES, parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { validateContract } from "../../src/tasks/packet/validate-contract.mjs";

const VALID_CONTRACT_TABLE = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm run coverage:check\` |
| fileScopeMustChange | \`src/batch/review.mjs\`, \`bin/spine-tasks.mjs\` |
| fileScopeMustNotChange | \`src/planner/**\` |
| minLineCoverage | 77 |
| artifactsMustExist | \`tests/batch/final-verdict.test.mjs\` |
`;

function promptWithContract(contractSection) {
	return `# Task: SP-999 — Contract fixture

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

${contractSection}

## Steps
### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
}

test("parseContract extracts all five contract fields from a valid table", () => {
	const parsed = parseContract(promptWithContract(VALID_CONTRACT_TABLE));

	assert.equal(parsed.hasSection, true);
	assert.equal(parsed.rawTableValid, true);
	assert.deepEqual(parsed.errors, []);
	assert.deepEqual(parsed.unknownFields, []);
	assert.equal(parsed.testCommand, "npm run coverage:check");
	assert.deepEqual(parsed.fileScopeMustChange, ["src/batch/review.mjs", "bin/spine-tasks.mjs"]);
	assert.deepEqual(parsed.fileScopeMustNotChange, ["src/planner/**"]);
	assert.equal(parsed.minLineCoverage, 77);
	assert.deepEqual(parsed.artifactsMustExist, ["tests/batch/final-verdict.test.mjs"]);
});

test("validateContract passes for a valid contract table", () => {
	const parsed = parseContract(promptWithContract(VALID_CONTRACT_TABLE));
	const result = validateContract(parsed, { mode: "required" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.deepEqual(result.warnings, []);
});

test("parseContract and validateContract handle an empty contract table", () => {
	const emptyTable = `## Contract

| Field | Value |
|-------|-------|
`;

	const parsed = parseContract(promptWithContract(emptyTable));

	assert.equal(parsed.rawTableValid, true);
	assert.equal(parsed.testCommand, null);
	assert.deepEqual(parsed.fileScopeMustChange, []);
	assert.deepEqual(parsed.fileScopeMustNotChange, []);
	assert.equal(parsed.minLineCoverage, null);
	assert.deepEqual(parsed.artifactsMustExist, []);

	const required = validateContract(parsed, { mode: "required" });
	assert.equal(required.ok, false);
	assert.match(required.errors.join("\n"), /empty/i);

	const optional = validateContract(parsed, { mode: "optional" });
	assert.equal(optional.ok, true);
});

test("validateContract warns on unknown contract fields", () => {
	const withUnknown = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| customGate | \`true\` |
| extraField | \`noop\` |
`;

	const parsed = parseContract(promptWithContract(withUnknown));
	const result = validateContract(parsed, { mode: "required" });

	assert.equal(result.ok, true);
	assert.deepEqual(parsed.unknownFields, ["customGate", "extraField"]);
	assert.deepEqual(
		result.warnings,
		["Unknown contract field: customGate", "Unknown contract field: extraField"],
	);
});

test("parseContract reports duplicate field rows as errors", () => {
	const duplicateRows = `## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| testCommand | \`npm run test:core\` |
`;

	const parsed = parseContract(promptWithContract(duplicateRows));
	const result = validateContract(parsed, { mode: "required" });

	assert.equal(result.ok, false);
	assert.match(result.errors.join("\n"), /Duplicate contract field row: testCommand/);
});

test("parseContract accepts plain-text testCommand values", () => {
	const plainCommand = `## Contract

| Field | Value |
|-------|-------|
| testCommand | true |
`;

	const parsed = parseContract(promptWithContract(plainCommand));
	assert.equal(parsed.testCommand, "true");
});

test("parseContract returns hasSection false when Contract heading is absent", () => {
	const parsed = parseContract(promptWithContract(""));
	assert.equal(parsed.hasSection, false);
	assert.equal(parsed.rawTableValid, false);
});

test("CONTRACT_FIELD_NAMES lists all normative contract fields", () => {
	assert.deepEqual(CONTRACT_FIELD_NAMES, [
		"testCommand",
		"fileScopeMustChange",
		"fileScopeMustNotChange",
		"minLineCoverage",
		"artifactsMustExist",
	]);
});
