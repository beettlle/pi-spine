import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { buildContractTestEnv } from "../../src/batch/contract-verify.mjs";
import { detectNestedWorkerContext, startBatch } from "../../src/batch/engine.mjs";

test("buildContractTestEnv moves SPINE_BATCH_ID to SPINE_PARENT_BATCH_ID", () => {
	const env = buildContractTestEnv({
		SPINE_BATCH_ID: "20260705T004723",
		SPINE_IS_WORKER: "1",
		PATH: "/bin",
	});
	assert.equal(env.SPINE_BATCH_ID, undefined);
	assert.equal(env.SPINE_PARENT_BATCH_ID, "20260705T004723");
	assert.equal(env.SPINE_IS_WORKER, undefined);
});

test("detectNestedWorkerContext blocks parent batch in lane worktree", () => {
	const prevBatch = process.env.SPINE_BATCH_ID;
	const prevParent = process.env.SPINE_PARENT_BATCH_ID;
	const prevWorker = process.env.SPINE_IS_WORKER;
	const worktreeRoot = "/repo/.worktrees/spine-20260705T004723/lane-1";
	try {
		delete process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_BATCH_ID;
		process.env.SPINE_PARENT_BATCH_ID = "20260705T004723";
		const result = detectNestedWorkerContext(worktreeRoot);
		assert.ok(result !== null);
		assert.match(result, /parent batch 20260705T004723/);
	} finally {
		if (prevBatch === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prevBatch;
		if (prevParent === undefined) delete process.env.SPINE_PARENT_BATCH_ID;
		else process.env.SPINE_PARENT_BATCH_ID = prevParent;
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
	}
});

test("startBatch blocks nested spawn when SPINE_PARENT_BATCH_ID set in lane worktree", async () => {
	const prevParent = process.env.SPINE_PARENT_BATCH_ID;
	const prevWorker = process.env.SPINE_IS_WORKER;
	const worktreeParent = path.join(os.tmpdir(), ".worktrees");
	const worktreeDir = await mkdtemp(path.join(worktreeParent, "spine-nested-contract-"));
	try {
		delete process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_BATCH_ID;
		process.env.SPINE_PARENT_BATCH_ID = "20260705T004723";
		const result = await startBatch({
			projectRoot: worktreeDir,
			scope: "all",
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "nested_batch_spawn_blocked");
	} finally {
		if (prevParent === undefined) delete process.env.SPINE_PARENT_BATCH_ID;
		else process.env.SPINE_PARENT_BATCH_ID = prevParent;
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
		await rm(worktreeDir, { recursive: true, force: true });
	}
});

test("buildContractTestEnv allows isolated fixture batch start without parent batch id", async () => {
	const prevBatch = process.env.SPINE_BATCH_ID;
	const prevParent = process.env.SPINE_PARENT_BATCH_ID;
	const prevWorker = process.env.SPINE_IS_WORKER;
	const prevStub = process.env.SPINE_WORKER_STUB;
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-contract-fixture-"));
	try {
		process.env.SPINE_BATCH_ID = "20260705T004723";
		process.env.SPINE_IS_WORKER = "1";
		process.env.SPINE_WORKER_STUB = "1";
		const contractEnv = buildContractTestEnv();
		assert.equal(contractEnv.SPINE_BATCH_ID, undefined);
		assert.equal(contractEnv.SPINE_PARENT_BATCH_ID, "20260705T004723");
		delete process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_BATCH_ID;
		process.env.SPINE_PARENT_BATCH_ID = contractEnv.SPINE_PARENT_BATCH_ID;
		const nested = detectNestedWorkerContext(projectRoot);
		assert.equal(nested, null);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
		if (prevBatch === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prevBatch;
		if (prevParent === undefined) delete process.env.SPINE_PARENT_BATCH_ID;
		else process.env.SPINE_PARENT_BATCH_ID = prevParent;
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
	}
});
