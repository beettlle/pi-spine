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
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	isJournalAttachBlocked,
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
	const folder = path.join(root, "spine-tasks", "TP-777-review");
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
	assert.equal(isReviewTypeRequired(0, "final"), false);
	assert.equal(isReviewTypeRequired(1, "final"), true);
	assert.equal(isReviewTypeRequired(2, "final"), true);
});

test("buildReviewArtifactPath uses step-timestamp pattern", () => {
	const date = new Date("2026-06-01T12:30:45.123Z");
	const artifact = buildReviewArtifactPath("/tmp/task", 3, date);
	assert.match(artifact, /\/\.reviews\/3-20260601T123045\.md$/);
});

test("buildFinalReviewArtifactPath uses final-timestamp pattern", () => {
	const date = new Date("2026-06-10T12:00:00.000Z");
	const artifact = buildFinalReviewArtifactPath("/tmp/task", date);
	assert.match(artifact, /\/\.reviews\/final-20260610T120000\.md$/);
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

test("parseReviewVerdict accepts PASS REVISE REPLAN when reviewType is final", () => {
	const passJson = parseReviewVerdict(
		"```json\n{\"verdict\":\"PASS\",\"feedback\":\"ship it\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(passJson.verdict, "PASS");
	assert.equal(passJson.feedback, "ship it");

	const revise = parseReviewVerdict("### Verdict: REVISE\n### Summary\nTighten scope.\n", {
		reviewType: "final",
	});
	assert.equal(revise.verdict, "REVISE");

	const replan = parseReviewVerdict(
		"### Verdict: REPLAN\n```json\n{\"verdict\":\"REPLAN\",\"feedback\":\"wrong contract\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(replan.verdict, "REPLAN");
	assert.equal(replan.feedback, "wrong contract");
});

test("parseReviewVerdict step mode rejects final-only verdict enums", () => {
	const passAttempt = parseReviewVerdict(
		"```json\n{\"verdict\":\"PASS\",\"feedback\":\"nope\"}\n```\n",
		{ reviewType: "code" },
	);
	assert.equal(passAttempt.verdict, null);

	const replanAttempt = parseReviewVerdict("### Verdict: REPLAN\n", { reviewType: "plan" });
	assert.equal(replanAttempt.verdict, null);
});

test("parseReviewVerdict accepts PASS REVISE REPLAN for final review type", () => {
	const passJson = parseReviewVerdict(
		"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"ship it\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(passJson.verdict, "PASS");

	const replan = parseReviewVerdict(
		"### Verdict: REPLAN\n```json\n{\"verdict\":\"REPLAN\",\"feedback\":\"scope wrong\"}\n```\n",
		{ reviewType: "final" },
	);
	assert.equal(replan.verdict, "REPLAN");
	assert.equal(replan.feedback, "scope wrong");

	const stepStillApprove = parseReviewVerdict(
		"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\"}\n```\n",
	);
	assert.equal(stepStillApprove.verdict, null);
});

test("resolveBatchJournalContext ignores SPINE_BATCH_ID without SPINE_JOURNAL_ATTACH", () => {
	const prev = {
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		attach: process.env.SPINE_JOURNAL_ATTACH,
		suppress: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH,
	};
	process.env.SPINE_BATCH_ID = "20260601T999999";
	process.env.SPINE_PROJECT_ROOT = "/tmp/spine-fake-root";
	delete process.env.SPINE_JOURNAL_ATTACH;
	delete process.env.SPINE_SUPPRESS_JOURNAL_ATTACH;
	try {
		assert.equal(resolveBatchJournalContext(), undefined);
		delete process.env.SPINE_SUPPRESS_JOURNAL_ATTACH;
		process.env.SPINE_JOURNAL_ATTACH = "1";
		const ctx = resolveBatchJournalContext();
		assert.equal(ctx?.batchId, "20260601T999999");
		assert.equal(ctx?.projectRoot, "/tmp/spine-fake-root");
	} finally {
		for (const [key, value] of Object.entries(prev)) {
			const envKey =
				key === "batchId"
					? "SPINE_BATCH_ID"
					: key === "projectRoot"
						? "SPINE_PROJECT_ROOT"
						: key === "attach"
							? "SPINE_JOURNAL_ATTACH"
							: key === "suppress"
								? "SPINE_SUPPRESS_JOURNAL_ATTACH"
								: "SPINE_JOURNAL_ATTACH";
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
	}
});

test("isJournalAttachBlocked honors SPINE_SUPPRESS_JOURNAL_ATTACH", () => {
	const prev = process.env.SPINE_SUPPRESS_JOURNAL_ATTACH;
	delete process.env.SPINE_SUPPRESS_JOURNAL_ATTACH;
	try {
		assert.equal(isJournalAttachBlocked(), false);
		process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
		assert.equal(isJournalAttachBlocked(), true);
	} finally {
		if (prev === undefined) delete process.env.SPINE_SUPPRESS_JOURNAL_ATTACH;
		else process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = prev;
	}
});

test("resolveBatchJournalContext blocked when attach suppressed", () => {
	const prev = {
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		attach: process.env.SPINE_JOURNAL_ATTACH,
		suppress: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH,
	};
	process.env.SPINE_BATCH_ID = "20260601T999999";
	process.env.SPINE_PROJECT_ROOT = "/tmp/spine-fake-root";
	process.env.SPINE_JOURNAL_ATTACH = "1";
	process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
	try {
		assert.equal(resolveBatchJournalContext(), undefined);
	} finally {
		for (const [key, value] of Object.entries(prev)) {
			const envKey =
				key === "batchId"
					? "SPINE_BATCH_ID"
					: key === "projectRoot"
						? "SPINE_PROJECT_ROOT"
						: key === "attach"
							? "SPINE_JOURNAL_ATTACH"
							: "SPINE_SUPPRESS_JOURNAL_ATTACH";
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
	}
});

test("runStepReview ignores SPINE_REVIEW_STUB_FAIL without stub mode", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-stubfail-env-"));
	const taskFolder = writeReviewTask(root, 2);
	const prevFail = process.env.SPINE_REVIEW_STUB_FAIL;
	const prevStub = process.env.SPINE_REVIEW_STUB;
	const prevNoPi = process.env.SPINE_REVIEW_TEST_NO_PI;
	delete process.env.SPINE_REVIEW_STUB;
	process.env.SPINE_REVIEW_STUB_FAIL = "1";
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
		});
		assert.equal(result.spawnFailed, true);
		assert.notEqual(result.error, "review spawn failed (stub)");
	} finally {
		if (prevFail === undefined) delete process.env.SPINE_REVIEW_STUB_FAIL;
		else process.env.SPINE_REVIEW_STUB_FAIL = prevFail;
		if (prevStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevStub;
		if (prevNoPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prevNoPi;
		await rm(root, { recursive: true, force: true });
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

test("runStepReview final stub PASS writes final artifact path", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-final-"));
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "final",
			stub: true,
			stubVerdict: "PASS",
		});
		assert.equal(result.ok, true);
		assert.equal(result.verdict, "PASS");
		assert.match(result.artifactPath, /\/\.reviews\/final-\d{8}T\d{6}\.md$/);
		assert.ok(fs.existsSync(result.artifactPath));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview final spawn failure exits non-zero at review level >= 1", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-final-fail-"));
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "final",
			stubFail: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 1);
		assert.match(result.artifactPath, /\/\.reviews\/final-/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineReviewStep CLI --type final emits JSON verdict", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-final-cli-"));
	const taskFolder = writeReviewTask(root, 2);
	const prev = {
		stub: process.env.SPINE_REVIEW_STUB,
		taskFolder: process.env.SPINE_TASK_FOLDER,
		worktree: process.env.SPINE_WORKTREE,
	};
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	try {
		const { exitCode, output, result } = runSpineReviewStep({
			taskFolder,
			worktreePath: root,
			args: ["--step", "1", "--type", "final", "--stub"],
		});
		assert.equal(exitCode, 0);
		assert.equal(result?.verdict, "PASS");
		const parsed = JSON.parse(output.trim());
		assert.equal(parsed.verdict, "PASS");
		assert.match(parsed.artifactPath, /final-/);
	} finally {
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
		if (prev.worktree === undefined) delete process.env.SPINE_WORKTREE;
		else process.env.SPINE_WORKTREE = prev.worktree;
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineReviewStep CLI emits JSON verdict", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-cli-"));
	const taskFolder = writeReviewTask(root, 2);
	const batchId = "20260601Tcli000";
	const prev = {
		stub: process.env.SPINE_REVIEW_STUB,
		attach: process.env.SPINE_JOURNAL_ATTACH,
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
	};
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_JOURNAL_ATTACH;
	process.env.SPINE_TASK_FOLDER = taskFolder;
	process.env.SPINE_WORKTREE = root;
	try {
		const { exitCode, output, result } = runSpineReviewStep({
			taskFolder,
			worktreePath: root,
			args: ["--step", "1", "--type", "plan", "--stub"],
			journal: { projectRoot: root, batchId, taskId: "TP-777", laneNumber: 1 },
		});
		assert.equal(exitCode, 0);
		assert.equal(result?.verdict, "APPROVE");
		const parsed = JSON.parse(output.trim());
		assert.equal(parsed.verdict, "APPROVE");
		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.completed"));
	} finally {
		if (prev.stub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.stub;
		if (prev.attach === undefined) delete process.env.SPINE_JOURNAL_ATTACH;
		else process.env.SPINE_JOURNAL_ATTACH = prev.attach;
		if (prev.batchId === undefined) delete process.env.SPINE_BATCH_ID;
		else process.env.SPINE_BATCH_ID = prev.batchId;
		if (prev.projectRoot === undefined) delete process.env.SPINE_PROJECT_ROOT;
		else process.env.SPINE_PROJECT_ROOT = prev.projectRoot;
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
