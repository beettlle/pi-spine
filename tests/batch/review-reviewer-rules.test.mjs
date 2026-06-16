import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	buildReviewRequest,
	buildReviewerSystemPrompt,
	runStepReview,
} from "../../src/batch/review.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SP251_TASK_FOLDER = path.join(PROJECT_ROOT, "spine-tasks", "SP-251-review-spawn-integration");

test("buildReviewerSystemPrompt includes project standards when rules manifest exists", () => {
	const systemPrompt = buildReviewerSystemPrompt({
		worktreePath: PROJECT_ROOT,
		taskFolder: SP251_TASK_FOLDER,
		reviewType: "plan",
		config: {},
	});

	assert.match(systemPrompt, /independent reviewer/i);
	assert.match(systemPrompt, /## Project standards for review/);
	assert.match(systemPrompt, /critical-rules-quick-reference\.mdc/);
});

test("buildReviewerSystemPrompt emits reviewer.rules_selected journal event", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-rules-journal-"));
	const batchId = "batch-reviewer-rules";
	try {
		fs.mkdirSync(path.join(root, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		buildReviewerSystemPrompt({
			worktreePath: PROJECT_ROOT,
			taskFolder: SP251_TASK_FOLDER,
			reviewType: "plan",
			config: {},
			journal: {
				projectRoot: root,
				batchId,
				taskId: "SP-251",
				laneNumber: 1,
			},
		});

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "reviewer.rules_selected");
		assert.equal(events[0].payload.reviewType, "plan");
		assert.ok(Array.isArray(events[0].payload.scopePaths));
		assert.ok(events[0].payload.scopePaths.includes("src/batch/review.mjs"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewRequest user prompt does not include injected standards block", () => {
	const artifactPath = path.join(SP251_TASK_FOLDER, ".reviews", "test-artifact.md");
	const userPrompt = buildReviewRequest({
		reviewType: "plan",
		stepNumber: 1,
		stepName: "Wire review spawn",
		taskFolder: SP251_TASK_FOLDER,
		worktreePath: PROJECT_ROOT,
		outputPath: artifactPath,
	});

	assert.doesNotMatch(userPrompt, /## Project standards for review/);
	assert.doesNotMatch(userPrompt, /critical-rules-quick-reference\.mdc/);
});

test("runStepReview stub path does not emit reviewer.rules_selected", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-rules-stub-"));
	const batchId = "batch-reviewer-stub";
	const taskFolder = path.join(root, "spine-tasks", "TP-rules-stub");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.mkdirSync(path.join(root, ".spine", "runtime", batchId, "journal"), {
		recursive: true,
	});
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: TP-rules-stub

## Review Level: 2

## Mission
Stub path test.

## File Scope
- \`src/batch/review.mjs\`

## Steps
### Step 1: Work
- [ ] one
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\n", "utf-8");

	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: PROJECT_ROOT,
			stepNumber: 1,
			reviewType: "plan",
			stub: true,
			journal: { projectRoot: root, batchId, taskId: "TP-rules-stub", laneNumber: 1 },
		});
		assert.equal(result.ok, true);
		const events = readJournalEvents(root, batchId);
		assert.ok(events.some((event) => event.type === "review.completed"));
		assert.equal(
			events.some((event) => event.type === "reviewer.rules_selected"),
			false,
			"stub path must not load reviewer rules",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
