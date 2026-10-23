/**
 * Contract reviewCommand step (SP-845).
 *
 * Covers the four outcomes the task packet demands: blocking review failures
 * fail the contract with a `reviewCommand` check; a failed testCommand skips
 * the review entirely; advisory failures pass the contract but journal
 * `contract.review_advisory` and append a STATUS.md Discoveries row; and the
 * review timeout (`contract.reviewTimeoutMs`) is honored independently of
 * `contract.testTimeoutMs`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { verifyContract } from "../../src/batch/contract-verify.mjs";
import {
	appendReviewAdvisoryDiscovery,
	formatReviewTimeoutLabel,
	resolveContractReviewOptions,
	runContractReviewCommand,
	runContractReviewStep,
} from "../../src/batch/contract-review.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS } from "../../src/config/contract.mjs";

const POSIX_ONLY = { skip: process.platform === "win32" };

async function withTmp(prefix, run) {
	const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
	try {
		await run(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

const STATUS_TEMPLATE = `# SP-845: fixture — Status

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log
`;

test("resolveContractReviewOptions defaults to 20 min blocking and reads config overrides", () => {
	assert.deepEqual(resolveContractReviewOptions({}), {
		timeoutMs: CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS,
		policy: "blocking",
	});
	assert.deepEqual(resolveContractReviewOptions({ contract: {} }), {
		timeoutMs: CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS,
		policy: "blocking",
	});
	assert.deepEqual(
		resolveContractReviewOptions({ contract: { reviewTimeoutMs: 30000, reviewPolicy: "advisory" } }),
		{ timeoutMs: 30000, policy: "advisory" },
	);
	// Unknown policy values fall back to blocking, never silently advisory.
	assert.equal(resolveContractReviewOptions({ contract: { reviewPolicy: "off" } }).policy, "blocking");
});

test("formatReviewTimeoutLabel formats minutes like the test timeout labels", () => {
	assert.equal(formatReviewTimeoutLabel(20 * 60 * 1000), "20 min");
	assert.equal(formatReviewTimeoutLabel(30 * 1000), "0.5 min");
	assert.equal(formatReviewTimeoutLabel(500), "0.01 min");
});

test("runContractReviewCommand passes 'true' and empty commands without spawning", async () => {
	await withTmp("spine-review-noop-", async (worktreePath) => {
		const pass = await runContractReviewCommand(worktreePath, "true");
		assert.equal(pass.ok, true);
		assert.equal(pass.exitCode, 0);

		const empty = await runContractReviewCommand(worktreePath, "   ");
		assert.equal(empty.ok, true);
	});
}, POSIX_ONLY);

test("runContractReviewCommand refuses newlines and shell metacharacters before spawn", async () => {
	await withTmp("spine-review-guard-", async (worktreePath) => {
		const newline = await runContractReviewCommand(worktreePath, "bash one.sh\nbash two.sh");
		assert.equal(newline.ok, false);
		assert.equal(newline.refusedBeforeSpawn, true);
		assert.match(newline.summary, /reviewCommand must not contain newlines/);

		const metachar = await runContractReviewCommand(worktreePath, "bash one.sh; bash two.sh");
		assert.equal(metachar.ok, false);
		assert.equal(metachar.refusedBeforeSpawn, true);
		assert.match(metachar.summary, /reviewCommand refused before spawn/);
	});
}, POSIX_ONLY);

test("runContractReviewCommand reports failing exits with a summary", async () => {
	await withTmp("spine-review-fail-", async (worktreePath) => {
		const result = await runContractReviewCommand(worktreePath, "echo review-output && exit 7");
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 7);
		assert.match(result.summary, /reviewCommand failed \(exit 7\)/);
		assert.match(result.summary, /review-output/);
	});
}, POSIX_ONLY);

test("blocking review failure fails the contract with a reviewCommand check", async () => {
	await withTmp("spine-review-blocking-", async (worktreePath) => {
		const result = await verifyContract(
			worktreePath,
			{ testCommand: "true", reviewCommand: "exit 3", artifactsMustExist: [] },
			{ contract: { testRetries: 0 } },
		);

		assert.equal(result.ok, false);
		const reviewCheck = result.checks.find((check) => check.field === "reviewCommand");
		assert.ok(reviewCheck, JSON.stringify(result.checks));
		assert.equal(reviewCheck.ok, false);
		assert.match(reviewCheck.message, /Contract reviewCommand failed/);
	});
}, POSIX_ONLY);

test("a failed testCommand skips the review step entirely", async () => {
	await withTmp("spine-review-skip-", async (worktreePath) => {
		const result = await verifyContract(
			worktreePath,
			{ testCommand: "exit 1", reviewCommand: "exit 1", artifactsMustExist: [] },
			{ contract: { testRetries: 0 } },
		);

		assert.equal(result.ok, false);
		assert.ok(!result.checks.some((check) => check.field === "reviewCommand"), JSON.stringify(result.checks));
		assert.ok(result.checks.some((check) => check.field === "testCommand" && check.ok === false));
	});
}, POSIX_ONLY);

test("advisory review failure passes the contract, journals, and appends a STATUS row", async () => {
	await withTmp("spine-review-advisory-", async (dir) => {
		const worktreePath = path.join(dir, "wt");
		const taskFolder = path.join(dir, "task");
		fs.mkdirSync(worktreePath, { recursive: true });
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(taskFolder, "STATUS.md"), STATUS_TEMPLATE, "utf-8");

		const config = {
			contract: { testRetries: 0, reviewPolicy: "advisory" },
			projectRoot: dir,
			batchId: "B-845",
			taskId: "SP-845",
			taskFolder,
		};

		const result = await verifyContract(
			worktreePath,
			{ testCommand: "true", reviewCommand: "echo stet noise && exit 1", artifactsMustExist: [] },
			config,
		);

		assert.equal(result.ok, true, JSON.stringify(result.checks));
		const reviewCheck = result.checks.find((check) => check.field === "reviewCommand");
		assert.ok(reviewCheck);
		assert.equal(reviewCheck.ok, true);
		assert.match(reviewCheck.message, /advisory, not blocking/);
		assert.match(reviewCheck.message, /exit 1/);

		const events = readJournalEvents(dir, "B-845");
		const advisory = events.find((event) => event.type === "contract.review_advisory");
		assert.ok(advisory, "expected contract.review_advisory journal event");
		assert.equal(advisory.taskId, "SP-845");
		assert.equal(advisory.payload.exitCode, 1);
		assert.equal(advisory.payload.timedOut, false);
		assert.match(advisory.payload.summary, /exit 1/);

		const status = fs.readFileSync(path.join(taskFolder, "STATUS.md"), "utf-8");
		assert.match(
			status,
			/\| reviewCommand failed \(exit 1\)[^|]*\| advisory — noted, not blocking \| contract review step \|/,
		);
	});
}, POSIX_ONLY);

test("blocking review timeout honors contract.reviewTimeoutMs independently of testTimeoutMs", async () => {
	await withTmp("spine-review-timeout-", async (worktreePath) => {
		const result = await verifyContract(
			worktreePath,
			{ testCommand: "true", reviewCommand: "sleep 30", artifactsMustExist: [] },
			{ contract: { testRetries: 0, reviewTimeoutMs: 500 } },
		);

		assert.equal(result.ok, false);
		const reviewCheck = result.checks.find((check) => check.field === "reviewCommand");
		assert.ok(reviewCheck);
		assert.equal(reviewCheck.ok, false);
		assert.match(reviewCheck.message, /reviewCommand timed out after 0\.01 min/);
		assert.doesNotMatch(reviewCheck.message, /exit \d/);
	});
}, POSIX_ONLY);

test("runContractReviewStep returns null without a reviewCommand and appends no row without STATUS", async () => {
	await withTmp("spine-review-null-", async (dir) => {
		const step = await runContractReviewStep(dir, { reviewCommand: null }, {});
		assert.equal(step, null);

		// Best-effort STATUS append: missing task folder is a silent no-op.
		assert.equal(appendReviewAdvisoryDiscovery(undefined, "summary"), false);
		assert.equal(appendReviewAdvisoryDiscovery(path.join(dir, "missing"), "summary"), false);
	});
});
