import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	CONTRACT_TEST_WORKER_ENV_KEYS,
	buildContractTestEnv,
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-worker-env-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

/** Exit 1 when SPINE_IS_WORKER is set — mirrors nested_batch_spawn_blocked preconditions. */
const FAIL_IF_WORKER_ENV =
	'node -e "process.exit(process.env.SPINE_IS_WORKER === \'1\' ? 1 : 0)"';

test("buildContractTestEnv removes worker-only keys", () => {
	const env = buildContractTestEnv({
		SPINE_IS_WORKER: "1",
		SPINE_BATCH_ID: "20260705T004723",
		PATH: "/bin",
		HOME: "/tmp",
	});
	for (const key of CONTRACT_TEST_WORKER_ENV_KEYS) {
		assert.equal(env[key], undefined, `expected ${key} to be stripped`);
	}
	assert.equal(env.SPINE_BATCH_ID, undefined);
	assert.equal(env.SPINE_PARENT_BATCH_ID, "20260705T004723");
	assert.equal(env.PATH, "/bin");
	assert.equal(env.HOME, "/tmp");
});

test("runContractTestCommand subprocess does not inherit SPINE_IS_WORKER", async () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		process.env.SPINE_IS_WORKER = "1";
		await withWorktree((worktreePath) => {
			const result = runContractTestCommand(worktreePath, FAIL_IF_WORKER_ENV);
			assert.equal(result.ok, true, result.output);
		});
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});

test("verifyContract testCommand passes under worker env when subprocess is sanitized", async () => {
	const prev = process.env.SPINE_IS_WORKER;
	try {
		process.env.SPINE_IS_WORKER = "1";
		await withWorktree((worktreePath) => {
			const result = verifyContract(worktreePath, {
				testCommand: FAIL_IF_WORKER_ENV,
			});
			assert.equal(result.ok, true);
			const testCheck = result.checks.find((check) => check.field === "testCommand");
			assert.ok(testCheck?.ok, testCheck?.message);
		});
	} finally {
		if (prev === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev;
	}
});
