import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runSpineReviewStep } from "../../bin/spine-review-step.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";
import {
	assertReviewToolAvailable,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	parseReviewLevel,
	parseReviewVerdict,
	resolveBatchJournalContext,
	runStepReview,
} from "../../src/batch/review.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} root
 * @param {number} reviewLevel
 */
function writeReviewTask(root, reviewLevel = 2) {
	const folder = path.join(root, "taskplane-tasks", "TP-777-review");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-777 — Review test

## Review Level: ${reviewLevel} (Plan and Code)

## Mission
Review pipeline test task.

## Dependencies
- **None**

## File Scope
- \`src/review-test.txt\`

## Steps
### Step 1: Work
- [ ] one

## Testing
Run npm test.

## Completion Criteria
- [ ] done

## Do NOT
- nothing
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	return folder;
}

test("parseReviewLevel reads PROMPT heading", () => {
	const level = parseReviewLevel("## Review Level: 2 (Plan and Code)\n");
	assert.equal(level, 2);
});

test("isReviewTypeRequired follows Taskplane rubric", () => {
	assert.equal(isReviewTypeRequired(0, "plan"), false);
	assert.equal(isReviewTypeRequired(1, "plan"), true);
	assert.equal(isReviewTypeRequired(1, "code"), false);
	assert.equal(isReviewTypeRequired(2, "code"), true);
});

test("buildReviewArtifactPath uses step-timestamp pattern", () => {
	const date = new Date("2026-06-01T12:30:45.123Z");
	const artifact = buildReviewArtifactPath("/tmp/task", 3, date);
	assert.match(artifact, /\/\.reviews\/3-20260601T123045\.md$/);
});

test("parseReviewVerdict reads JSON and markdown verdicts", () => {
	const jsonVerdict = parseReviewVerdict(
		"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"ok\"}\n```\n",
	);
	assert.equal(jsonVerdict.verdict, "APPROVE");
	assert.equal(jsonVerdict.feedback, "ok");

	const revise = parseReviewVerdict("### Verdict: REVISE\n### Summary\nFix tests.\n");
	assert.equal(revise.verdict, "REVISE");
	assert.match(revise.feedback, /Fix tests/);
});

test("resolveBatchJournalContext ignores SPINE_BATCH_ID without SPINE_JOURNAL_ATTACH", () => {
	const prev = {
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		attach: process.env.SPINE_JOURNAL_ATTACH,
	};
	process.env.SPINE_BATCH_ID = "20260601T999999";
	process.env.SPINE_PROJECT_ROOT = "/tmp/spine-fake-root";
	delete process.env.SPINE_JOURNAL_ATTACH;
	try {
		assert.equal(resolveBatchJournalContext(), undefined);
		process.env.SPINE_JOURNAL_ATTACH = "1";
		const ctx = resolveBatchJournalContext();
		assert.equal(ctx?.batchId, "20260601T999999");
		assert.equal(ctx?.projectRoot, "/tmp/spine-fake-root");
	} finally {
		for (const [key, value] of Object.entries(prev)) {
			if (value === undefined) delete process.env[key === "batchId" ? "SPINE_BATCH_ID" : key === "projectRoot" ? "SPINE_PROJECT_ROOT" : "SPINE_JOURNAL_ATTACH"];
			else process.env[key === "batchId" ? "SPINE_BATCH_ID" : key === "projectRoot" ? "SPINE_PROJECT_ROOT" : "SPINE_JOURNAL_ATTACH"] = value;
		}
	}
});

test("runStepReview stub APPROVE writes artifact and journal events", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-"));
	const batchId = "20260601T150000";
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			stub: true,
			journal: { projectRoot: root, batchId, taskId: "TP-777", laneNumber: 1 },
		});
		assert.equal(result.ok, true);
		assert.equal(result.verdict, "APPROVE");
		assert.ok(fs.existsSync(result.artifactPath));

		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.started"));
		assert.ok(events.some((event) => event.type === "review.completed"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview stub REVISE returns exitCode 2", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-revise-"));
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "code",
			stub: true,
			stubVerdict: "REVISE",
		});
		assert.equal(result.ok, false);
		assert.equal(result.verdict, "REVISE");
		assert.equal(result.exitCode, 2);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview fail-closed on stub spawn failure", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-fail-"));
	const batchId = "20260601T151000";
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			stubFail: true,
			journal: { projectRoot: root, batchId, taskId: "TP-777", laneNumber: 1 },
		});
		assert.equal(result.ok, false);
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 1);

		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.failed"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview skips when review level does not require type", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-skip-"));
	const taskFolder = writeReviewTask(root, 1);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "code",
			stub: true,
		});
		assert.equal(result.skipped, true);
		assert.equal(result.ok, true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineReviewStep CLI emits JSON verdict", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-cli-"));
	const taskFolder = writeReviewTask(root, 2);
	const prevStub = process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	try {
		const { exitCode, output, result } = runSpineReviewStep({
			taskFolder,
			worktreePath: root,
			args: ["--step", "1", "--type", "plan", "--stub"],
		});
		assert.equal(exitCode, 0);
		assert.equal(result?.verdict, "APPROVE");
		const parsed = JSON.parse(output.trim());
		assert.equal(parsed.verdict, "APPROVE");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevStub;
		delete process.env.SPINE_TASK_FOLDER;
		delete process.env.SPINE_WORKTREE;
		await rm(root, { recursive: true, force: true });
	}
});

test("assertReviewToolAvailable fails closed without pi at review level > 0", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-gate-"));
	const taskFolder = writeReviewTask(root, 2);
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	const prevNoPi = process.env.SPINE_REVIEW_TEST_NO_PI;
	delete process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const gate = assertReviewToolAvailable({ taskFolder });
		assert.equal(gate.ok, false);
		assert.match(gate.error ?? "", /fail closed/i);
	} finally {
		if (prevNoPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prevNoPi;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker fails closed when review tool unavailable at level > 0", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-worker-"));
	const batchId = "20260601T152000";
	const taskFolder = writeReviewTask(root, 2);
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	const prevNoPi = process.env.SPINE_REVIEW_TEST_NO_PI;
	delete process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			projectRoot: root,
			batchId,
			laneNumber: 1,
			taskId: "TP-777",
		});
		assert.equal(result.ok, false);
		assert.equal(result.classification, "review_failed");
		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.failed"));
	} finally {
		if (prevNoPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prevNoPi;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("stub worker stops when enforced review spawn fails", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-review-runner-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		enforce: process.env.SPINE_WORKER_STUB_ENFORCE_REVIEW,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		reviewFail: process.env.SPINE_REVIEW_STUB_FAIL,
		taskFolder: process.env.SPINE_TASK_FOLDER,
		worktree: process.env.SPINE_WORKTREE,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_ENFORCE_REVIEW = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_REVIEW_STUB_FAIL = "1";
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	try {
		const isolatedEnv = { ...process.env };
		delete isolatedEnv.SPINE_BATCH_ID;
		delete isolatedEnv.SPINE_PROJECT_ROOT;
		delete isolatedEnv.SPINE_JOURNAL_ATTACH;
		delete isolatedEnv.SPINE_TASK_ID;
		delete isolatedEnv.SPINE_LANE_NUMBER;
		delete isolatedEnv.SPINE_LANE_CORRELATION_ID;
		assert.throws(
			() => {
				execFileSync(process.execPath, [path.join(PACKAGE_ROOT, "bin/spine-worker-runner.mjs"), "--stub"], {
					cwd: root,
					stdio: "pipe",
					env: isolatedEnv,
				});
			},
			(err) => {
				assert.notEqual(err.status, 0);
				return true;
			},
		);
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), false);
	} finally {
		for (const [key, value] of Object.entries(prev)) {
			if (value === undefined) {
				if (key === "stub") delete process.env.SPINE_WORKER_STUB;
				if (key === "enforce") delete process.env.SPINE_WORKER_STUB_ENFORCE_REVIEW;
				if (key === "reviewStub") delete process.env.SPINE_REVIEW_STUB;
				if (key === "reviewFail") delete process.env.SPINE_REVIEW_STUB_FAIL;
				if (key === "taskFolder") delete process.env.SPINE_TASK_FOLDER;
				if (key === "worktree") delete process.env.SPINE_WORKTREE;
			}
		}
		fs.rmSync(root, { recursive: true, force: true });
	}
});
