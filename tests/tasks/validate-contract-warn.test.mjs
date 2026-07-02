import assert from "node:assert/strict";
import test from "node:test";

import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import {
	collectFileScopeMustNotChangeWarnings,
	FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT,
	validateContract,
} from "../../src/tasks/packet/validate-contract.mjs";

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
