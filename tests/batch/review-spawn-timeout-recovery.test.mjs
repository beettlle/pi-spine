import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	DEFAULT_REVIEW_SPAWN_TIMEOUT_MS,
	honorReviewSpawnFailureWhenEligible,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
} from "../../src/batch/review.mjs";

test("DEFAULT_REVIEW_SPAWN_TIMEOUT_MS is 90 minutes", () => {
	assert.equal(DEFAULT_REVIEW_SPAWN_TIMEOUT_MS, 90 * 60 * 1000);
});

test("honorReviewSpawnFailureWhenEligible honors final review when contract passed", () => {
	const taskFolder = fs.mkdtempSync(path.join(os.tmpdir(), "spine-review-honor-final-"));
	try {
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "ok\n", "utf-8");
		const result = honorReviewSpawnFailureWhenEligible({
			spawnResult: {
				spawnFailed: true,
				exitCode: REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
				error: "reviewer spawn timed out",
			},
			reviewType: "final",
			taskFolder,
			contractVerifyResult: { ok: true, checks: [] },
			journal: null,
			stepNumber: 3,
			reviewLevel: 2,
		});
		assert.ok(result);
		assert.equal(result.ok, true);
		assert.equal(result.verdict, "PASS");
		assert.equal(result.honorReason, "spawn_timeout_with_done");
	} finally {
		fs.rmSync(taskFolder, { recursive: true, force: true });
	}
});

test("honorReviewSpawnFailureWhenEligible skips when contract failed", () => {
	const taskFolder = fs.mkdtempSync(path.join(os.tmpdir(), "spine-review-honor-skip-"));
	try {
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "ok\n", "utf-8");
		const result = honorReviewSpawnFailureWhenEligible({
			spawnResult: {
				spawnFailed: true,
				exitCode: REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
				error: "reviewer spawn timed out",
			},
			reviewType: "final",
			taskFolder,
			contractVerifyResult: { ok: false, checks: [{ field: "testCommand", ok: false }] },
			journal: null,
			stepNumber: 3,
			reviewLevel: 2,
		});
		assert.equal(result, null);
	} finally {
		fs.rmSync(taskFolder, { recursive: true, force: true });
	}
});

test("honorReviewSpawnFailureWhenEligible honors code review with .DONE", () => {
	const taskFolder = fs.mkdtempSync(path.join(os.tmpdir(), "spine-review-honor-code-"));
	try {
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "ok\n", "utf-8");
		const result = honorReviewSpawnFailureWhenEligible({
			spawnResult: {
				spawnFailed: true,
				exitCode: REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
				error: "reviewer spawn timed out",
			},
			reviewType: "code",
			taskFolder,
			contractVerifyResult: null,
			journal: null,
			stepNumber: 3,
			reviewLevel: 2,
		});
		assert.ok(result);
		assert.equal(result.ok, true);
		assert.equal(result.verdict, "APPROVE");
	} finally {
		fs.rmSync(taskFolder, { recursive: true, force: true });
	}
});
