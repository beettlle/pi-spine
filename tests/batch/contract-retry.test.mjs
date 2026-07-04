import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	verifyContract,
	writeContractFailureLog,
	CONTRACT_TEST_DEFAULT_RETRIES,
	CONTRACT_TEST_RETRY_DELAY_MS,
} from "../../src/batch/contract-verify.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-retry-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

test("testCommand fails once then succeeds on retry — contract passes", async () => {
	await withWorktree((worktreePath) => {
		const marker = path.join(worktreePath, ".retry-marker");
		// First run creates the marker and exits 1; second run sees it and exits 0.
		const command = `if [ -f "${marker}" ]; then exit 0; else touch "${marker}" && exit 1; fi`;

		const result = verifyContract(worktreePath, {
			testCommand: command,
			artifactsMustExist: [],
		}, { contract: { testRetries: 1, testRetryDelayMs: 0 } });

		assert.equal(result.ok, true, `Expected ok but got: ${JSON.stringify(result.checks)}`);
		assert.equal(result.checks[0].field, "testCommand");
		assert.equal(result.checks[0].ok, true);
		assert.match(result.checks[0].message, /passed on attempt 2 of 2/);
		assert.equal(result.retries, 1);
	});
});

test("testCommand fails all retries — contract_failed as before", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: "false",
			artifactsMustExist: [],
		}, { contract: { testRetries: 2, testRetryDelayMs: 0 } });

		assert.equal(result.ok, false);
		assert.equal(result.checks[0].field, "testCommand");
		assert.equal(result.checks[0].ok, false);
		assert.match(result.checks[0].message, /failed after 3 attempt\(s\)/);
		assert.equal(result.retries, 2);
	});
});

test("retry count configurable via spine-config contract.testRetries", async () => {
	await withWorktree((worktreePath) => {
		const marker = path.join(worktreePath, ".attempt-count");
		// Increment a counter on each call; succeed on attempt 3.
		const command = [
			`count=0`,
			`if [ -f "${marker}" ]; then count=$(cat "${marker}"); fi`,
			`count=$((count + 1))`,
			`echo $count > "${marker}"`,
			`if [ "$count" -ge 3 ]; then exit 0; else exit 1; fi`,
		].join("; ");

		const noRetry = verifyContract(worktreePath, {
			testCommand: command,
			artifactsMustExist: [],
		}, { contract: { testRetries: 0, testRetryDelayMs: 0 } });
		assert.equal(noRetry.ok, false, "Should fail with 0 retries");

		// Reset marker.
		fs.unlinkSync(marker);

		const twoRetries = verifyContract(worktreePath, {
			testCommand: command,
			artifactsMustExist: [],
		}, { contract: { testRetries: 2, testRetryDelayMs: 0 } });
		assert.equal(twoRetries.ok, true, "Should pass with 2 retries (attempt 3)");
		assert.match(twoRetries.checks[0].message, /passed on attempt 3 of 3/);
	});
});

test("failed output captured to .reviews/ directory", async () => {
	await withWorktree((worktreePath) => {
		const taskFolder = path.join(worktreePath, "task-folder");
		fs.mkdirSync(taskFolder, { recursive: true });

		const result = verifyContract(worktreePath, {
			testCommand: "echo 'test output to stderr' >&2 && echo 'test output to stdout' && exit 1",
			artifactsMustExist: [],
		}, {
			contract: { testRetries: 0, testRetryDelayMs: 0 },
			taskFolder,
		});

		assert.equal(result.ok, false);

		const reviewsDir = path.join(taskFolder, ".reviews");
		assert.ok(fs.existsSync(reviewsDir), ".reviews/ directory should be created");

		const logFiles = fs.readdirSync(reviewsDir).filter((f) => f.startsWith("contract-fail-"));
		assert.ok(logFiles.length >= 1, "At least one failure log should exist");

		const logContent = fs.readFileSync(path.join(reviewsDir, logFiles[0]), "utf-8");
		assert.match(logContent, /Contract testCommand failure log/);
		assert.match(logContent, /Exit code: 1/);
		assert.match(logContent, /Attempt: 1 of 1/);
		assert.match(logContent, /test output to stdout/);
		assert.match(logContent, /test output to stderr/);
	});
});

test("no retry when testCommand succeeds first time (no performance cost)", async () => {
	await withWorktree((worktreePath) => {
		const start = Date.now();
		const result = verifyContract(worktreePath, {
			testCommand: "true",
			artifactsMustExist: [],
		}, { contract: { testRetries: 3, testRetryDelayMs: 5000 } });
		const elapsed = Date.now() - start;

		assert.equal(result.ok, true);
		assert.equal(result.checks[0].ok, true);
		assert.equal(result.checks[0].message, "testCommand passed");
		assert.equal(result.retries, undefined, "No retries field when no retries occurred");
		assert.ok(elapsed < 2000, `Should complete quickly without retry delay (took ${elapsed}ms)`);
	});
});

test("writeContractFailureLog creates log file with header", async () => {
	await withWorktree((worktreePath) => {
		const taskFolder = path.join(worktreePath, "my-task");
		const logPath = writeContractFailureLog(
			taskFolder,
			"npm test",
			{ exitCode: 1, output: "FAIL: some test\nError: assertion", bufferOverflow: false },
			1,
			2,
		);

		assert.ok(logPath, "Should return log path");
		assert.ok(fs.existsSync(logPath), "Log file should exist");

		const content = fs.readFileSync(logPath, "utf-8");
		assert.match(content, /Command: npm test/);
		assert.match(content, /Exit code: 1/);
		assert.match(content, /Attempt: 1 of 2/);
		assert.match(content, /Buffer overflow: no/);
		assert.match(content, /FAIL: some test/);
	});
});

test("writeContractFailureLog returns null when taskFolder is undefined", () => {
	const result = writeContractFailureLog(
		undefined,
		"npm test",
		{ exitCode: 1, output: "error" },
		1,
		1,
	);
	assert.equal(result, null);
});

test("CONTRACT_TEST_DEFAULT_RETRIES is 1", () => {
	assert.equal(CONTRACT_TEST_DEFAULT_RETRIES, 1);
});

test("CONTRACT_TEST_RETRY_DELAY_MS is 5000", () => {
	assert.equal(CONTRACT_TEST_RETRY_DELAY_MS, 5000);
});

test("multiple failure logs captured across retry attempts", async () => {
	await withWorktree((worktreePath) => {
		const taskFolder = path.join(worktreePath, "task-multi");
		fs.mkdirSync(taskFolder, { recursive: true });

		const result = verifyContract(worktreePath, {
			testCommand: "echo 'attempt output' && exit 1",
			artifactsMustExist: [],
		}, {
			contract: { testRetries: 2, testRetryDelayMs: 0 },
			taskFolder,
		});

		assert.equal(result.ok, false);

		const reviewsDir = path.join(taskFolder, ".reviews");
		const logFiles = fs.readdirSync(reviewsDir).filter((f) => f.startsWith("contract-fail-"));
		assert.equal(logFiles.length, 3, "Should have one log per attempt (3 total)");
	});
});
