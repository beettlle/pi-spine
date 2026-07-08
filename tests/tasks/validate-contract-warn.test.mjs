import assert from "node:assert/strict";
import test from "node:test";

import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import {
	collectFileScopeMustNotChangeWarnings,
	FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT,
	validateContract,
} from "../../src/tasks/packet/validate-contract.mjs";
import {
	collectNpmTestDashDashErrors,
	collectNpmTestDashDashWarnings,
	collectTestCommandScopeWarnings,
	TEST_COMMAND_COVERAGE_FIX_HINT,
	TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT,
	TEST_COMMAND_NPM_TEST_FIX_HINT,
} from "../../src/tasks/validate-contract-warn.mjs";

/**
 * @param {string[]} mustNotChange
 * @param {string} [taskId]
 */
function promptWithMustNotChange(mustNotChange, taskId = "SP-413") {
	const patterns = mustNotChange.map((p) => `\`${p}\``).join(", ");
	return `# Task: ${taskId} — Must-not warn fixture

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
| fileScopeMustNotChange | ${patterns} |

## Steps
### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
}

test("validateContract warns when fileScopeMustNotChange includes spine-tasks/**", () => {
	const parsed = parseContract(promptWithMustNotChange(["spine-tasks/**", "extension/**"]));
	const result = validateContract(parsed, { mode: "required", taskId: "SP-413" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 1);
	assert.match(result.warnings[0], /fileScopeMustNotChange: "spine-tasks\/\*\*"/);
	assert.match(result.warnings[0], /orchestration artifacts under spine-tasks\//);
	assert.match(result.warnings[0], new RegExp(FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("validateContract warns when pattern matches current task folder only", () => {
	const parsed = parseContract(
		promptWithMustNotChange(["spine-tasks/SP-413-validate-spine-tasks-must-not-warn/**"]),
	);
	const result = validateContract(parsed, { mode: "required", taskId: "SP-413" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 1);
	assert.match(result.warnings[0], /blocks required worker outputs for this task folder/);
	assert.match(result.warnings[0], /SP-413-validate-spine-tasks-must-not-warn/);
});

test("validateContract is quiet for parallel product-path guards", () => {
	const parsed = parseContract(
		promptWithMustNotChange(["extension/**", ".spine/**", "src/planner/**"]),
	);
	const result = validateContract(parsed, { mode: "required", taskId: "SP-413" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.warnings, []);
});

test("collectFileScopeMustNotChangeWarnings dedupes broad spine-tasks ban over task folder", () => {
	const parsed = parseContract(promptWithMustNotChange(["spine-tasks/**"]));
	const warnings = collectFileScopeMustNotChangeWarnings(parsed, { taskId: "SP-413" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /orchestration artifacts under spine-tasks\//);
});

test("collectFileScopeMustNotChangeWarnings ignores other task folders", () => {
	const parsed = parseContract(promptWithMustNotChange(["spine-tasks/SP-999-other-task/**"]));
	const warnings = collectFileScopeMustNotChangeWarnings(parsed, { taskId: "SP-413" });

	assert.deepEqual(warnings, []);
});

test("collectFileScopeMustNotChangeWarnings respects custom tasksRoot", () => {
	const parsed = parseContract(
		promptWithMustNotChange(["taskplane-tasks/**"], "TP-100"),
	);
	const warnings = collectFileScopeMustNotChangeWarnings(parsed, {
		taskId: "TP-100",
		tasksRoot: "taskplane-tasks",
	});

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /taskplane-tasks\//);
});

test("collectFileScopeMustNotChangeWarnings skips current-task check without taskId", () => {
	const parsed = parseContract(
		promptWithMustNotChange(["spine-tasks/SP-413-example-slug/**"]),
	);
	const warnings = collectFileScopeMustNotChangeWarnings(parsed, { taskId: null });

	assert.deepEqual(warnings, []);
});

/**
 * @param {string} testCommand
 * @param {"S"|"M"|"L"} [size]
 */
function promptWithTestCommand(testCommand, size = "S") {
	return `# Task: SP-521 — Scoped contract fixture

**Size:** ${size}

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`${testCommand}\` |
| fileScopeMustChange | \`src/example.mjs\` |

## Steps
### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`;
}

test("collectTestCommandScopeWarnings warns on coverage:check for Size S", () => {
	const parsed = parseContract(
		promptWithTestCommand(
			"npm run typecheck && SPINE_WORKER_STUB=1 node --test tests/foo.test.mjs && npm run coverage:check",
		),
	);
	const warnings = collectTestCommandScopeWarnings(parsed, { taskSize: "S" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /coverage:check/);
	assert.match(warnings[0], new RegExp(TEST_COMMAND_COVERAGE_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("collectTestCommandScopeWarnings warns on npm test for Size M", () => {
	const parsed = parseContract(
		promptWithTestCommand("npm run typecheck && SPINE_WORKER_STUB=1 npm test", "M"),
	);
	const warnings = collectTestCommandScopeWarnings(parsed, { taskSize: "M" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /npm test/);
	assert.match(warnings[0], new RegExp(TEST_COMMAND_NPM_TEST_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("collectNpmTestDashDashWarnings warns on npm test -- <path> for Size S", () => {
	const parsed = parseContract(
		promptWithTestCommand("npm test -- tests/foo.test.mjs"),
	);
	const warnings = collectNpmTestDashDashWarnings(parsed, { taskSize: "S" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /npm test -- <path>/);
	assert.match(warnings[0], /full suite/);
	assert.match(
		warnings[0],
		new RegExp(TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
	);
});

test("collectTestCommandScopeWarnings prefers npm test -- warning over generic npm test", () => {
	const parsed = parseContract(
		promptWithTestCommand("npm run typecheck && npm test -- tests/foo.test.mjs", "M"),
	);
	const warnings = collectTestCommandScopeWarnings(parsed, { taskSize: "M" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /npm test -- <path>/);
	assert.doesNotMatch(warnings[0], new RegExp(TEST_COMMAND_NPM_TEST_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("collectNpmTestDashDashWarnings is quiet for scoped node --test on Size S", () => {
	const parsed = parseContract(
		promptWithTestCommand(
			"npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/foo.test.mjs",
		),
	);
	const warnings = collectNpmTestDashDashWarnings(parsed, { taskSize: "S" });

	assert.deepEqual(warnings, []);
});

test("collectNpmTestDashDashWarnings allows npm test -- on Size L", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs", "L"));
	const warnings = collectNpmTestDashDashWarnings(parsed, { taskSize: "L" });

	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /npm test -- <path>/);
});

test("collectNpmTestDashDashWarnings is quiet for required Size S (promoted to error)", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs"));
	const warnings = collectNpmTestDashDashWarnings(parsed, { taskSize: "S", mode: "required" });

	assert.deepEqual(warnings, []);
});

test("collectNpmTestDashDashErrors errors on npm test -- <path> for Size S", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs"));
	const errors = collectNpmTestDashDashErrors(parsed, { taskSize: "S" });

	assert.equal(errors.length, 1);
	assert.match(errors[0], /npm test -- <path>/);
	assert.match(
		errors[0],
		new RegExp(TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
	);
});

test("collectNpmTestDashDashErrors errors on npm test -- <path> for Size M", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs", "M"));
	const errors = collectNpmTestDashDashErrors(parsed, { taskSize: "M" });

	assert.equal(errors.length, 1);
	assert.match(errors[0], /Size M/);
});

test("collectNpmTestDashDashErrors is quiet for Size L", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs", "L"));
	const errors = collectNpmTestDashDashErrors(parsed, { taskSize: "L" });

	assert.deepEqual(errors, []);
});

test("collectTestCommandScopeWarnings is quiet for scoped node --test on Size S", () => {
	const parsed = parseContract(
		promptWithTestCommand(
			"npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/foo.test.mjs",
		),
	);
	const warnings = collectTestCommandScopeWarnings(parsed, { taskSize: "S" });

	assert.deepEqual(warnings, []);
});

test("collectTestCommandScopeWarnings allows coverage:check on Size L", () => {
	const parsed = parseContract(
		promptWithTestCommand("npm run typecheck && npm run coverage:check", "L"),
	);
	const warnings = collectTestCommandScopeWarnings(parsed, { taskSize: "L" });

	assert.deepEqual(warnings, []);
});

test("validateContract warns on SP-516-shaped coverage chain for Size S", () => {
	const parsed = parseContract(
		promptWithTestCommand(
			"npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/status-classification-align.test.mjs && npm run coverage:check",
		),
	);
	const result = validateContract(parsed, { mode: "required", taskId: "SP-516", taskSize: "S" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 1);
	assert.match(result.warnings[0], /coverage:check/);
});

test("validateContract errors on npm test -- false scope for required Size S", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs"));
	const result = validateContract(parsed, { mode: "required", taskId: "SP-522", taskSize: "S" });

	assert.equal(result.ok, false);
	assert.equal(result.errors.length, 1);
	assert.match(result.errors[0], /npm test -- <path>/);
	assert.match(result.errors[0], /node --test/);
	assert.deepEqual(result.warnings.filter((w) => /npm test --/.test(w)), []);
});

test("validateContract errors on npm test -- false scope for required Size M", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs", "M"));
	const result = validateContract(parsed, { mode: "required", taskId: "SP-540", taskSize: "M" });

	assert.equal(result.ok, false);
	assert.equal(result.errors.length, 1);
	assert.match(result.errors[0], /Size M/);
});

test("validateContract warns on npm test -- false scope for optional Size S", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs"));
	const result = validateContract(parsed, { mode: "optional", taskId: "SP-522", taskSize: "S" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 1);
	assert.match(result.warnings[0], /npm test -- <path>/);
});

test("validateContract warns on npm test -- false scope for required Size L", () => {
	const parsed = parseContract(promptWithTestCommand("npm test -- tests/foo.test.mjs", "L"));
	const result = validateContract(parsed, { mode: "required", taskId: "SP-540", taskSize: "L" });

	assert.equal(result.ok, true);
	assert.deepEqual(result.errors, []);
	assert.equal(result.warnings.length, 1);
	assert.match(result.warnings[0], /npm test -- <path>/);
});
