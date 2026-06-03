import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runSpineReportProgress } from "../../bin/spine-report-progress.mjs";
import { runSpineReviewStep } from "../../bin/spine-review-step.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runStepReview } from "../../src/batch/review.mjs";

/**
 * @param {string} root
 */
function writeReviewTask(root) {
	const folder = path.join(root, "spine-tasks", "TP-888-attach");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-888 — Attach test

## Review Level: 2 (Plan and Code)

## Mission
Attach isolation test task.

## Dependencies
- **None**

## File Scope
- \`src/attach-test.txt\`

## Steps
### Step 1: Work
- [ ] one

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

test("runStepReview with worker attach env does not journal when attach suppressed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-attach-review-"));
	const batchId = "20260603Tattach001";
	const taskFolder = writeReviewTask(root);
	const prev = {
		attach: process.env.SPINE_JOURNAL_ATTACH,
		suppress: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH,
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
	};
	process.env.SPINE_JOURNAL_ATTACH = "1";
	process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
	process.env.SPINE_PROJECT_ROOT = root;
	process.env.SPINE_BATCH_ID = batchId;
	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			stub: true,
		});
		assert.equal(result.ok, true);
		assert.equal(readJournalEvents(root, batchId).length, 0);
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
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineReviewStep with worker attach env does not journal when attach suppressed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-attach-cli-"));
	const batchId = "20260603Tattach002";
	const taskFolder = writeReviewTask(root);
	const prev = {
		attach: process.env.SPINE_JOURNAL_ATTACH,
		suppress: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH,
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		stub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_JOURNAL_ATTACH = "1";
	process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
	process.env.SPINE_PROJECT_ROOT = root;
	process.env.SPINE_BATCH_ID = batchId;
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const { exitCode } = runSpineReviewStep({
			taskFolder,
			worktreePath: root,
			args: ["--step", "1", "--type", "plan", "--stub"],
		});
		assert.equal(exitCode, 0);
		assert.equal(readJournalEvents(root, batchId).length, 0);
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
								: "SPINE_REVIEW_STUB";
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineReportProgress with worker attach env does not journal when attach suppressed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-attach-progress-"));
	const batchId = "20260603Tattach003";
	const prev = {
		attach: process.env.SPINE_JOURNAL_ATTACH,
		suppress: process.env.SPINE_SUPPRESS_JOURNAL_ATTACH,
		batchId: process.env.SPINE_BATCH_ID,
		projectRoot: process.env.SPINE_PROJECT_ROOT,
		taskId: process.env.SPINE_TASK_ID,
	};
	process.env.SPINE_JOURNAL_ATTACH = "1";
	process.env.SPINE_SUPPRESS_JOURNAL_ATTACH = "1";
	process.env.SPINE_PROJECT_ROOT = root;
	process.env.SPINE_BATCH_ID = batchId;
	process.env.SPINE_TASK_ID = "TP-888";
	try {
		const { exitCode } = runSpineReportProgress({
			args: ["--step", "1"],
			worktreePath: root,
		});
		assert.equal(exitCode, 1);
		assert.equal(readJournalEvents(root, batchId).length, 0);
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
								: "SPINE_TASK_ID";
			if (value === undefined) delete process.env[envKey];
			else process.env[envKey] = value;
		}
		await rm(root, { recursive: true, force: true });
	}
});
