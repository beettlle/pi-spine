import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	isExitVerificationTask,
	shouldRunContractVerifyForWorker,
} from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";

const exitPrompt = `# Task: SP-214 — Phase 23 exit verification

## Mission
Verify exit criteria.

## Dependencies
- **None**

## File Scope
- \`spine-tasks/CONTEXT.md\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`spine-tasks/CONTEXT.md\` |

## Steps
### Step 1: Verify
- [ ] run checks

## Completion Criteria
- [ ] done

## Do NOT
- skip tests
`;

const normalPrompt = `# Task: SP-099 — Normal stub task

## Mission
Do work.

## Dependencies
- **None**

## File Scope
- \`src/foo.txt\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/foo.txt\` |

## Steps
### Step 1: Work
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

test("isExitVerificationTask detects exit verification headings", () => {
	assert.equal(isExitVerificationTask(exitPrompt), true);
	assert.equal(isExitVerificationTask(normalPrompt), false);
});

test("shouldRunContractVerifyForWorker skips stub for normal tasks", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const parsed = parseContract(normalPrompt);
		assert.equal(shouldRunContractVerifyForWorker(normalPrompt, parsed, {}), false);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("shouldRunContractVerifyForWorker runs stub contract for exit tasks", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const parsed = parseContract(exitPrompt);
		assert.equal(shouldRunContractVerifyForWorker(exitPrompt, parsed, {}), true);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("runPhase23ExitVerify --skip-test passes structural checks in repo", async () => {
	const { runPhase23ExitVerify } = await import("../../bin/spine-cli/verify.mjs");
	const projectRoot = process.cwd();
	const result = runPhase23ExitVerify({ projectRoot, skipTest: true });
	assert.ok(result.checks.length >= 5);
	const engineLanes = result.checks.find((check) => check.id === "engine-lanes-loc");
	assert.ok(engineLanes?.ok, engineLanes?.message);
	const locPolicy = result.checks.find((check) => check.id === "batch-loc-policy");
	assert.ok(locPolicy?.ok, locPolicy?.message);
});

test("spine verify phase23-exit CLI is wired", async () => {
	const { runSpineVerify } = await import("../../bin/spine-cli/verify.mjs");
	const result = runSpineVerify({
		projectRoot: process.cwd(),
		args: ["phase23-exit", "--skip-test"],
	});
	assert.equal(result.exitCode, 0);
	assert.match(result.output ?? "", /Phase 23 exit/);
});
