/**
 * SP-820 (#334) — reviewer provider request errors are classified as
 * `review_provider_error`, not the generic `*_review_spawn_failed`:
 *
 * - pure classifier: Gemini 400 `thought_signature` / `INVALID_ARGUMENT`
 *   payloads and `MALFORMED_FUNCTION_CALL` markers match; quota payloads
 *   (429 / z.ai `1308`) keep their own path; empty/generic input is null.
 * - runStepReview wiring: a stub reviewer writing the Gemini 400 to stderr
 *   and exiting 1 yields result + journaled `review.failed` payload carrying
 *   `reason`/`providerMessage`/`httpStatus`, with the SP-814 re-spawn budget
 *   unchanged; generic spawn failures keep no provider fields.
 * - exit-reason mapping in `runReviewPollLoop` (DI stubs): provider-error
 *   results map to `${reviewType}_review_provider_error`; generic spawn
 *   failures and timeouts keep their existing reasons.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runStepReview } from "../../src/batch/review-step-run.mjs";
import { runReviewPollLoop } from "../../src/batch/engine-lanes/review-poll.mjs";
import { REVIEW_TIMEOUT_REASON } from "../../src/batch/review.mjs";
import {
	REVIEW_PROVIDER_ERROR_REASON,
	classifyReviewerProviderError,
	classifyReviewerSpawnFailure,
	providerErrorFields,
} from "../../src/batch/reviewer-provider-error.mjs";

const BATCH_ID = "20261014T210000";
const TASK_ID = "SP-820";
const LANE_NUMBER = 2;

// Gemini 400 body as it lands on the reviewer's stderr (#334): status prefix,
// nested error envelope, thought_signature message, INVALID_ARGUMENT status.
const GEMINI_400 =
	'400 {"error":{"code":400,"message":"Please ensure that the number of function response parts is equal to the number of function call parts of the function call turn. Function call is missing a thought_signature","status":"INVALID_ARGUMENT"}}';
// z.ai usage-limit payload — quota's own path, never a provider request error.
const ZAI_1308 =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}';

test("classifier: Gemini 400 thought_signature payload matches with httpStatus 400", () => {
	const result = classifyReviewerProviderError(GEMINI_400);
	assert.ok(result, "expected a classification");
	assert.equal(result.httpStatus, 400);
	assert.match(result.providerMessage, /thought_signature/);
	assert.ok(result.providerMessage.length <= 500, "providerMessage capped at 500 chars");
});

test("classifier: MALFORMED_FUNCTION_CALL marker on stdout matches without a status", () => {
	const output = 'finishReason: MALFORMED_FUNCTION_CALL — no artifact written';
	const result = classifyReviewerProviderError(output);
	assert.ok(result, "expected a classification");
	assert.equal(result.httpStatus, null);
	assert.match(result.providerMessage, /MALFORMED_FUNCTION_CALL/);
	assert.ok(result.providerMessage.length <= 500);
});

test("classifier: z.ai 1308 quota payload returns null — quota keeps its own path", () => {
	assert.equal(classifyReviewerProviderError(ZAI_1308), null);
});

test("classifier: empty, non-string, generic, and boundary statuses return null", () => {
	assert.equal(classifyReviewerProviderError(""), null);
	assert.equal(classifyReviewerProviderError(undefined), null);
	assert.equal(classifyReviewerProviderError(null), null);
	assert.equal(classifyReviewerProviderError(42), null);
	assert.equal(classifyReviewerProviderError("Error: pi crashed with a segfault"), null);
	// 408 (request timeout) and non-quota 429 are excluded from the 4xx rule.
	assert.equal(
		classifyReviewerProviderError('408 {"error":{"message":"request timed out"}}'),
		null,
	);
	assert.equal(
		classifyReviewerProviderError('429 {"error":{"message":"slow down please"}}'),
		null,
	);
	// 5xx stays generic (transient overload, not a request rejection).
	assert.equal(
		classifyReviewerProviderError('503 {"error":{"message":"model overloaded"}}'),
		null,
	);
});

test("classifier: spawn failure joins error + stderr + stdout tails", () => {
	const fromError = classifyReviewerSpawnFailure({
		error: GEMINI_400,
		stderrTail: "",
		stdoutTail: "",
	});
	assert.equal(fromError?.httpStatus, 400);

	const fromTail = classifyReviewerSpawnFailure({
		error: "reviewer exited with code 1",
		stderrTail: GEMINI_400,
		stdoutTail: "",
	});
	assert.equal(fromTail?.httpStatus, 400);
	assert.match(fromTail?.providerMessage ?? "", /thought_signature/);

	// A quota payload anywhere in the tails keeps the generic path (null).
	assert.equal(
		classifyReviewerSpawnFailure({ error: "boom", stderrTail: ZAI_1308, stdoutTail: "" }),
		null,
	);
	assert.equal(classifyReviewerSpawnFailure(null), null);
	assert.equal(classifyReviewerSpawnFailure({}), null);
});

test("providerErrorFields: empty when unclassified, full fields when classified", () => {
	assert.deepEqual(providerErrorFields(null), {});
	assert.deepEqual(providerErrorFields({ httpStatus: null, providerMessage: "msg" }), {
		reason: REVIEW_PROVIDER_ERROR_REASON,
		providerMessage: "msg",
	});
	const withStatus = providerErrorFields({ httpStatus: 400, providerMessage: "msg" });
	assert.equal(withStatus.httpStatus, 400);
});

test("classifier caps pathological provider messages at 500 characters", () => {
	const longMessage = "x".repeat(900);
	const output = `400 {"error":{"code":400,"message":"${longMessage}","status":"INVALID_ARGUMENT"}}`;
	const result = classifyReviewerProviderError(output);
	assert.ok(result);
	assert.equal(result.providerMessage.length, 500);
});

/**
 * Fake `pi` on PATH (pattern: tests/batch/review-no-artifact-respawn.test.mjs).
 * Behavior via env vars inherited by the reviewer child:
 *  - SPX820_MODE — "provider-error" (Gemini 400 on stderr, exit 1),
 *    "generic" (plain stderr, exit SPX820_EXIT)
 */
function writeFakePi(binDir) {
	const script = `#!/usr/bin/env node
const mode = process.env.SPX820_MODE ?? "generic";
if (mode === "provider-error") {
	console.error(process.env.SPX820_PAYLOAD);
	process.exit(1);
}
console.error("boom: something else went wrong");
process.exit(Number(process.env.SPX820_EXIT ?? 3));
`;
	const piPath = path.join(binDir, "pi");
	fs.writeFileSync(piPath, script, "utf-8");
	fs.chmodSync(piPath, 0o755);
	return piPath;
}

/** Snapshot + clear the env vars that gate the real spawn paths. */
function cleanSpawnEnv() {
	const prev = {
		path: process.env.PATH,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		isWorker: process.env.SPINE_IS_WORKER,
		taskFolder: process.env.SPINE_TASK_FOLDER,
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		stub: process.env.SPINE_REVIEW_STUB,
		stubFail: process.env.SPINE_REVIEW_STUB_FAIL,
		reviewTimeout: process.env.SPINE_REVIEW_TIMEOUT_MS,
	};
	delete process.env.SPINE_WORKER_RUNNER;
	delete process.env.SPINE_IS_WORKER;
	delete process.env.SPINE_TASK_FOLDER;
	delete process.env.SPINE_REVIEW_TEST_NO_PI;
	delete process.env.SPINE_REVIEW_STUB;
	delete process.env.SPINE_REVIEW_STUB_FAIL;
	delete process.env.SPINE_REVIEW_TIMEOUT_MS;
	return prev;
}

/**
 * @param {ReturnType<typeof cleanSpawnEnv>} prev
 * @param {string} binDir
 */
function restoreSpawnEnv(prev, binDir) {
	process.env.PATH = (prev.path ?? "").split(path.delimiter)
		.filter((entry) => entry !== binDir)
		.join(path.delimiter);
	for (const [key, value] of Object.entries(prev)) {
		if (key === "path") continue;
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

/**
 * @param {string} root
 */
function writeReviewTask(root) {
	const taskFolder = path.join(root, "spine-tasks", TASK_ID);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${TASK_ID} — Provider error fixture

**Size:** S

## Review Level: 1 (Plan Only)

## Mission
Fixture for provider error classification.

## File Scope
- \`src/fixture.txt\`

## Steps
### Step 1: Work
- [ ] one
`,
		"utf-8",
	);
	return taskFolder;
}

test("runStepReview: Gemini 400 on stderr exit 1 → review_provider_error in result and journal", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-820-provider-error-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;
		process.env.SPX820_MODE = "provider-error";
		process.env.SPX820_PAYLOAD = GEMINI_400;

		const taskFolder = writeReviewTask(root);
		const journal = { projectRoot: root, batchId: BATCH_ID, taskId: TASK_ID, laneNumber: LANE_NUMBER };

		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			journal,
		});

		assert.equal(result.ok, false);
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 1);
		assert.equal(result.reason, REVIEW_PROVIDER_ERROR_REASON);
		assert.equal(result.httpStatus, 400);
		assert.match(result.providerMessage ?? "", /thought_signature/);

		const events = readJournalEvents(root, BATCH_ID);
		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.reason, REVIEW_PROVIDER_ERROR_REASON);
		assert.equal(failed.payload?.httpStatus, 400);
		assert.match(failed.payload?.providerMessage ?? "", /thought_signature/);
		assert.ok(failed.payload?.reviewerOutputLogRef, "reviewer log still persisted");

		// SP-814 retry budget unchanged: non-zero exit is re-spawned once.
		const retry = events.find((event) => event.type === "review.spawn_retry");
		assert.ok(retry, "non-zero exit must remain retry-eligible");
		assert.ok(!events.some((event) => event.type === "review.completed"));
	} finally {
		delete process.env.SPX820_MODE;
		delete process.env.SPX820_PAYLOAD;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview: generic spawn failure keeps no provider fields", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-820-generic-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;
		process.env.SPX820_MODE = "generic";
		process.env.SPX820_EXIT = "3";

		const taskFolder = writeReviewTask(root);
		const journal = { projectRoot: root, batchId: BATCH_ID, taskId: TASK_ID, laneNumber: LANE_NUMBER };

		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			journal,
		});

		assert.equal(result.ok, false);
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 3);
		assert.equal(result.reason, undefined);
		assert.equal(result.providerMessage, undefined);
		assert.equal(result.httpStatus, undefined);

		const events = readJournalEvents(root, BATCH_ID);
		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.reason, undefined);
		assert.equal(failed.payload?.providerMessage, undefined);
	} finally {
		delete process.env.SPX820_MODE;
		delete process.env.SPX820_EXIT;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});

/**
 * Drives runReviewPollLoop with injected stubs and captures the exit reason
 * handed to the phase failure recorder.
 *
 * @param {Record<string, any>} reviewResult
 */
async function runPollLoopWithResult(reviewResult) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-820-poll-"));
	try {
		const captured = { exitReason: null };
		const outcome = await runReviewPollLoop({
			reviewType: "code",
			passVerdict: "APPROVE",
			attemptField: "codeReviewAttempts",
			attemptKey: "codeReviewAttempt",
			maxAttempts: 2,
			runEngineReview: async () => reviewResult,
			recordReviewTaskFailure: async (ctx) => {
				captured.exitReason = ctx.exitReason;
				return { ok: true };
			},
			invalidVerdictOutput: "code review artifact missing APPROVE or REVISE verdict",
			journalEvents: [],
			projectRoot: root,
			state: {},
			batchId: BATCH_ID,
			config: {},
			task: { taskId: TASK_ID },
			lane: { laneNumber: LANE_NUMBER, laneId: "lane-2" },
			taskFolderInWorktree: path.join(root, "spine-tasks", TASK_ID),
			wt: root,
			taskBranch: "lane-2",
			laneCorrelationId: "corr-820",
			fileScopePaths: [],
		});
		return { outcome, captured };
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

test("exit mapping: provider-error review result yields code_review_provider_error", async () => {
	const { outcome, captured } = await runPollLoopWithResult({
		ok: false,
		spawnFailed: true,
		reason: REVIEW_PROVIDER_ERROR_REASON,
		providerMessage: "missing thought_signature",
		httpStatus: 400,
		error: GEMINI_400,
		exitCode: 1,
	});
	assert.equal(outcome.ok, false);
	assert.equal(outcome.error, "code_review_provider_error");
	assert.equal(captured.exitReason, "code_review_provider_error");
});

test("exit mapping: generic spawn failure still yields code_review_spawn_failed", async () => {
	const { outcome, captured } = await runPollLoopWithResult({
		ok: false,
		spawnFailed: true,
		error: "pi binary not found",
		exitCode: 1,
	});
	assert.equal(outcome.ok, false);
	assert.equal(outcome.error, "code_review_spawn_failed");
	assert.equal(captured.exitReason, "code_review_spawn_failed");
});

test("exit mapping: timeout keeps code_review_timeout", async () => {
	const { outcome, captured } = await runPollLoopWithResult({
		ok: false,
		spawnFailed: true,
		reason: REVIEW_TIMEOUT_REASON,
		error: "reviewer spawn timed out",
		exitCode: 124,
	});
	assert.equal(outcome.ok, false);
	assert.equal(outcome.error, "code_review_timeout");
	assert.equal(captured.exitReason, "code_review_timeout");
});
