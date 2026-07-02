import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	CONTRACT_TEST_COMMAND_MAX_BUFFER,
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-buffer-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

test("CONTRACT_TEST_COMMAND_MAX_BUFFER exceeds legacy 256KB limit", () => {
	assert.ok(CONTRACT_TEST_COMMAND_MAX_BUFFER > 256 * 1024);
});

test("runContractTestCommand captures large stdout without killing child", async () => {
	await withWorktree((worktreePath) => {
		const byteCount = 300 * 1024;
		const result = runContractTestCommand(
			worktreePath,
			`node -e "process.stdout.write('x'.repeat(${byteCount}))"`,
		);

		assert.equal(result.ok, true);
		assert.ok(result.output.length >= byteCount);
	});
});

test("runContractTestCommand surfaces ENOBUFS with scoped testCommand guidance", async () => {
	await withWorktree((worktreePath) => {
		const byteCount = 50 * 1024;
		const result = runContractTestCommand(
			worktreePath,
			`node -e "process.stdout.write('x'.repeat(${byteCount}))"`,
			{ maxBuffer: 1024 },
		);

		assert.equal(result.ok, false);
		assert.equal(result.bufferOverflow, true);
		assert.match(result.summary, /scoped testCommand/i);
		assert.match(result.summary, /maxBuffer/i);
	});
});

test("verifyContract reports buffer overflow with scoped testCommand guidance", async () => {
	await withWorktree((worktreePath) => {
		const byteCount = 50 * 1024;
		const overflowCommand = `node -e "process.stdout.write('x'.repeat(${byteCount}))"`;

		const direct = runContractTestCommand(worktreePath, overflowCommand, { maxBuffer: 1024 });
		assert.equal(direct.bufferOverflow, true);

		const result = verifyContract(worktreePath, {
			testCommand: overflowCommand,
			artifactsMustExist: [],
		}, {
			contractTestMaxBuffer: 1024,
		});

		assert.equal(result.ok, false);
		assert.equal(result.checks[0].field, "testCommand");
		assert.equal(result.checks[0].ok, false);
		assert.match(result.checks[0].message, /scoped testCommand/i);
		assert.match(result.checks[0].message, /maxBuffer/i);
	});
});
