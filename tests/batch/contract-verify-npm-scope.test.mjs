import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	isRefusedNpmTestDashDashCommand,
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import { TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT } from "../../src/tasks/validate-contract-warn.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-npm-scope-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

test("isRefusedNpmTestDashDashCommand matches npm test -- <path>", () => {
	assert.equal(isRefusedNpmTestDashDashCommand("npm test -- tests/foo.test.mjs"), true);
	assert.equal(
		isRefusedNpmTestDashDashCommand("npm run typecheck && npm test -- tests/foo.test.mjs"),
		true,
	);
});

test("isRefusedNpmTestDashDashCommand allows scoped node --test", () => {
	assert.equal(isRefusedNpmTestDashDashCommand("node --test tests/foo.test.mjs"), false);
	assert.equal(isRefusedNpmTestDashDashCommand("npm test"), false);
	assert.equal(isRefusedNpmTestDashDashCommand("true"), false);
});

test("runContractTestCommand refuses npm test -- before spawn", async () => {
	await withWorktree((worktreePath) => {
		const markerPath = path.join(worktreePath, "spawn-marker.txt");
		const command = `npm test -- tests/foo.test.mjs; node -e "require('node:fs').writeFileSync('${markerPath.replace(/\\/g, "\\\\")}', 'spawned')"`;
		const result = runContractTestCommand(worktreePath, command);

		assert.equal(result.ok, false);
		assert.equal(result.refusedBeforeSpawn, true);
		assert.equal(result.exitCode, 1);
		assert.match(result.summary, /refused before spawn/i);
		assert.match(result.summary, /npm test -- <path>/);
		assert.match(result.summary, new RegExp(TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.equal(fs.existsSync(markerPath), false, "subprocess must not run when command is refused");
	});
});

test("runContractTestCommand still executes allowed scoped commands", async () => {
	await withWorktree((worktreePath) => {
		const result = runContractTestCommand(worktreePath, 'node -e "process.exit(0)"');
		assert.equal(result.ok, true, result.output);
	});
});

test("verifyContract surfaces npm test -- refusal as contract failure", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: "npm test -- tests/foo.test.mjs",
		});

		assert.equal(result.ok, false);
		const testCheck = result.checks.find((check) => check.field === "testCommand");
		assert.ok(testCheck);
		assert.equal(testCheck.ok, false);
		assert.match(testCheck.message, /refused before spawn|Contract testCommand failed/i);
		assert.match(testCheck.message, /npm test -- <path>|npm test --/);
	});
});
