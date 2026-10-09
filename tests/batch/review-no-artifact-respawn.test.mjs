/**
 * SP-814 (#332) — reviewer exits without an artifact: one bounded re-spawn,
 * `review.spawn_retry` journal event, diagnostics + reviewer output log on
 * persistent failure, timeout honour unchanged.
 *
 * Uses a fake `pi` on PATH (pattern: tests/batch/worker-runner-done-missing.test.mjs)
 * that counts invocations in a temp file and reads its behavior from env vars
 * inherited by the reviewer child (buildReviewerChildEnv copies process.env).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chmodSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	REVIEW_SPAWN_MAX_ATTEMPTS,
	REVIEW_SPAWN_RETRY_REASON_NO_ARTIFACT,
	runStepReview,
} from "../../src/batch/review-step-run.mjs";
import {
	reviewerOutputLogPath,
	reviewerOutputLogRef,
} from "../../src/batch/reviewer-output.mjs";
import {
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
} from "../../src/batch/review-spawn.mjs";

const BATCH_ID = "20261009T204506";
const TASK_ID = "SP-814";
const LANE_NUMBER = 4;

/**
 * @param {string} root
 */
function writeRespawnTask(root) {
	const taskFolder = path.join(root, "spine-tasks", TASK_ID);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${TASK_ID} — Reviewer respawn fixture

**Size:** M

## Review Level: 2 (Plan and Code)

## Mission
Fixture for reviewer no-artifact respawn.

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

/**
 * Fake `pi` on PATH. Invocation counting and behavior live in env vars so the
 * reviewer child (which inherits the parent env) picks them up:
 *  - SPX814_COUNT_FILE — temp file holding the invocation count
 *  - SPX814_MODE — "flaky" (attempt 1 exits 0 with no artifact, attempt >= 2
 *    writes a valid APPROVE artifact parsed from the prompt), "never" (always
 *    exits SPX814_EXIT without an artifact), "hang" (sleeps forever)
 *  - SPX814_EXIT — exit code for "never" mode
 */
function writeFakePi(binDir) {
	const script = `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const countFile = process.env.SPX814_COUNT_FILE;
let n = 0;
try {
	n = Number(fs.readFileSync(countFile, "utf-8").trim()) || 0;
} catch {}
n += 1;
fs.writeFileSync(countFile, String(n));

const mode = process.env.SPX814_MODE ?? "flaky";
const exitCode = Number(process.env.SPX814_EXIT ?? 0);

console.log(\`FAKE_REVIEWER_STDOUT_ATTEMPT_\${n}\`);
console.error(\`FAKE_REVIEWER_STDERR_ATTEMPT_\${n}\`);

if (mode === "hang") {
	// Never exits on its own; the spawn timeout must terminate it.
	setInterval(() => {}, 1_000);
} else if (mode === "flaky" && n >= 2) {
	const prompt = process.argv[process.argv.length - 1] ?? "";
	const match = prompt.match(/Write your review to: \`([^\`]+)\`/);
	if (match) {
		fs.mkdirSync(path.dirname(match[1]), { recursive: true });
		fs.writeFileSync(
			match[1],
			[
				"## Plan Review: Work",
				"",
				"### Verdict: APPROVE",
				"",
				"### Summary",
				"Fake reviewer approved.",
				"",
				"\`\`\`json",
				JSON.stringify({ verdict: "APPROVE", feedback: "Fake reviewer approved." }, null, 2),
				"\`\`\`",
				"",
		]
			.join("\\n"),
			"utf-8",
		);
	}
}
if (mode !== "hang") process.exit(exitCode);
`;
	const piPath = path.join(binDir, "pi");
	fs.writeFileSync(piPath, script, "utf-8");
	chmodSync(piPath, 0o755);
	return piPath;
}

/**
 * Read the fake pi invocation count.
 *
 * @param {string} countFile
 */
function readSpawnCount(countFile) {
	return Number(fs.readFileSync(countFile, "utf-8").trim()) || 0;
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

test("attempt 1 exits 0 without artifact, attempt 2 writes it — review succeeds with one retry", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-respawn-flaky-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;

		const countFile = path.join(root, "spawn-count");
		fs.writeFileSync(countFile, "0", "utf-8");
		process.env.SPX814_COUNT_FILE = countFile;
		process.env.SPX814_MODE = "flaky";

		const taskFolder = writeRespawnTask(root);
		const journal = { projectRoot: root, batchId: BATCH_ID, taskId: TASK_ID, laneNumber: LANE_NUMBER };

		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			journal,
		});

		assert.equal(result.ok, true);
		assert.equal(result.verdict, "APPROVE");
		assert.equal(result.spawnFailed, false);
		assert.equal(readSpawnCount(countFile), 2, "exactly two spawns: one flaky + one retry");

		const events = readJournalEvents(root, BATCH_ID);
		const retry = events.find((event) => event.type === "review.spawn_retry");
		assert.ok(retry, "expected review.spawn_retry journal event");
		assert.equal(retry.payload?.attempt, 2);
		assert.equal(retry.payload?.reason, REVIEW_SPAWN_RETRY_REASON_NO_ARTIFACT);
		assert.equal(retry.payload?.exitCode, 0);
		assert.equal(typeof retry.payload?.durationMs, "number");
		assert.ok(
			fs.existsSync(path.join(root, retry.payload?.reviewerOutputLogRef ?? "/missing")),
			"reviewerOutputLogRef must point at an existing log",
		);
		assert.ok(!events.some((event) => event.type === "review.failed"), "no review.failed on recovery");
		assert.ok(events.some((event) => event.type === "review.completed"));

		const attempt1Log = fs.readFileSync(
			reviewerOutputLogPath(root, BATCH_ID, LANE_NUMBER, TASK_ID, "plan"),
			"utf-8",
		);
		assert.match(attempt1Log, /attempt 1/);
		assert.match(attempt1Log, /FAKE_REVIEWER_STDERR_ATTEMPT_1/);
	} finally {
		delete process.env.SPX814_COUNT_FILE;
		delete process.env.SPX814_MODE;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});

test("both attempts produce no artifact — exactly 2 spawns, diagnostics + log on review.failed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-respawn-never-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;

		const countFile = path.join(root, "spawn-count");
		fs.writeFileSync(countFile, "0", "utf-8");
		process.env.SPX814_COUNT_FILE = countFile;
		process.env.SPX814_MODE = "never";
		process.env.SPX814_EXIT = "0";

		const taskFolder = writeRespawnTask(root);
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
		assert.equal(result.error, "reviewer exited but produced no artifact");
		assert.equal(readSpawnCount(countFile), REVIEW_SPAWN_MAX_ATTEMPTS, "exactly two spawns, no third");

		const events = readJournalEvents(root, BATCH_ID);
		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.exitCode, 0);
		assert.equal(typeof failed.payload?.durationMs, "number");
		assert.match(failed.payload?.outputTail ?? "", /FAKE_REVIEWER_STDERR_ATTEMPT_2/);
		const logRef = failed.payload?.reviewerOutputLogRef;
		assert.ok(logRef, "review.failed must carry reviewerOutputLogRef");
		assert.equal(logRef, reviewerOutputLogRef(BATCH_ID, LANE_NUMBER, TASK_ID, "plan"));
		assert.ok(fs.existsSync(path.join(root, logRef)), "reviewer log file must exist");

		const logContent = fs.readFileSync(path.join(root, logRef), "utf-8");
		assert.match(logContent, /attempt 1/);
		assert.match(logContent, /attempt 2/);
		assert.match(logContent, /FAKE_REVIEWER_STDERR_ATTEMPT_1/);
		assert.match(result.outputTail ?? "", /FAKE_REVIEWER_STDERR_ATTEMPT_2/);
		assert.ok(!events.some((event) => event.type === "review.completed"));
	} finally {
		delete process.env.SPX814_COUNT_FILE;
		delete process.env.SPX814_MODE;
		delete process.env.SPX814_EXIT;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});

test("timeout (exit 124) is not re-spawned — honour behaviour unchanged", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-respawn-timeout-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;
		process.env.SPINE_REVIEW_TIMEOUT_MS = "300";

		const countFile = path.join(root, "spawn-count");
		fs.writeFileSync(countFile, "0", "utf-8");
		process.env.SPX814_COUNT_FILE = countFile;
		process.env.SPX814_MODE = "hang";

		const taskFolder = writeRespawnTask(root);
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
		assert.equal(result.exitCode, REVIEW_SPAWN_TIMEOUT_EXIT_CODE);
		assert.equal(result.reason, REVIEW_TIMEOUT_REASON);
		assert.equal(readSpawnCount(countFile), 1, "timeout must not be re-spawned");

		const events = readJournalEvents(root, BATCH_ID);
		assert.ok(!events.some((event) => event.type === "review.spawn_retry"));
		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.reason, REVIEW_TIMEOUT_REASON);
	} finally {
		delete process.env.SPX814_COUNT_FILE;
		delete process.env.SPX814_MODE;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});

test("non-zero exit with stderr is re-spawned once; stderr lands in outputTail", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-respawn-nonzero-"));
	const prev = cleanSpawnEnv();
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		writeFakePi(binDir);
		process.env.PATH = `${binDir}${path.delimiter}${prev.path ?? ""}`;

		const countFile = path.join(root, "spawn-count");
		fs.writeFileSync(countFile, "0", "utf-8");
		process.env.SPX814_COUNT_FILE = countFile;
		process.env.SPX814_MODE = "never";
		process.env.SPX814_EXIT = "3";

		const taskFolder = writeRespawnTask(root);
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
		assert.equal(readSpawnCount(countFile), 2, "non-zero exit must be re-spawned exactly once");

		const events = readJournalEvents(root, BATCH_ID);
		const retry = events.find((event) => event.type === "review.spawn_retry");
		assert.ok(retry, "expected review.spawn_retry journal event");
		assert.equal(retry.payload?.exitCode, 3);

		const failed = events.find((event) => event.type === "review.failed");
		assert.ok(failed, "expected review.failed terminal event");
		assert.equal(failed.payload?.exitCode, 3);
		assert.match(failed.payload?.outputTail ?? "", /FAKE_REVIEWER_STDERR_ATTEMPT_2/);
		assert.match(result.outputTail ?? "", /FAKE_REVIEWER_STDERR_ATTEMPT_2/);
	} finally {
		delete process.env.SPX814_COUNT_FILE;
		delete process.env.SPX814_MODE;
		delete process.env.SPX814_EXIT;
		restoreSpawnEnv(prev, path.join(root, "bin"));
		await rm(root, { recursive: true, force: true });
	}
});
