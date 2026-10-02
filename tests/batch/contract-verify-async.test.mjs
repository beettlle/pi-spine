/**
 * Async contract verification (SP-800 / #305).
 *
 * Proves verifyContract / runContractTestCommand never block the event loop
 * while a slow testCommand runs — a concurrent setInterval keeps ticking, which
 * a spawnSync / Atomics.wait implementation would freeze — and that timed-out
 * commands report `timedOut: true` with an explicit "timed out after N min"
 * message instead of a bare exit code.
 */

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";

const POSIX_ONLY = { skip: process.platform === "win32" };

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-async-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

test("verifyContract does not block the event loop while a slow testCommand runs", async () => {
	await withWorktree(async (worktreePath) => {
		let ticks = 0;
		const timer = setInterval(() => {
			ticks += 1;
		}, 50);
		try {
			const result = await verifyContract(worktreePath, {
				testCommand: "sleep 2",
				artifactsMustExist: [],
			}, { contract: { testRetries: 0 } });

			assert.equal(result.ok, true, JSON.stringify(result.checks));
			assert.equal(result.checks[0].field, "testCommand");
			assert.equal(result.checks[0].ok, true);
		} finally {
			clearInterval(timer);
		}
		// A blocking (spawnSync / Atomics.wait) implementation would freeze this
		// interval for the whole 2s sleep and advance it ~0 times.
		assert.ok(ticks >= 10, `expected >=10 interval ticks during sleep 2, got ${ticks}`);
	});
}, POSIX_ONLY);

test("runContractTestCommand reports timedOut with the timeout message", async () => {
	await withWorktree(async (worktreePath) => {
		const result = await runContractTestCommand(worktreePath, "sleep 30", { timeoutMs: 500 });

		assert.equal(result.ok, false);
		assert.equal(result.timedOut, true);
		assert.equal(result.bufferOverflow, undefined);
		assert.match(result.summary, /timed out after 0\.01 min/);
	});
}, POSIX_ONLY);

test("verifyContract surfaces the timeout message instead of an exit code", async () => {
	await withWorktree(async (worktreePath) => {
		const result = await verifyContract(worktreePath, {
			testCommand: "sleep 30",
			artifactsMustExist: [],
		}, {
			contract: { testRetries: 0 },
			contractTestTimeoutMs: 500,
		});

		assert.equal(result.ok, false);
		const testCheck = result.checks.find((check) => check.field === "testCommand");
		assert.ok(testCheck);
		assert.equal(testCheck.ok, false);
		assert.match(testCheck.message, /timed out after 0\.01 min/);
		assert.doesNotMatch(testCheck.message, /exit \d/);
	});
}, POSIX_ONLY);
