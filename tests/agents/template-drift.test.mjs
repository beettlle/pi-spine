import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAgentSessionWorkerPrompt } from "../../src/batch/agent-session-worker.mjs";
import {
	buildCommitBoundaryHint,
	buildReviewLevelHint,
	buildWorkerTailPrompt,
	WORKER_TOOLS_HINT,
} from "../../src/batch/worker-prompt.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKER_TEMPLATE = path.join(PACKAGE_ROOT, "templates/agents/worker.md");

test("worker.md documents spine tools, stall checkpoint, and coverage policy", () => {
	const text = fs.readFileSync(WORKER_TEMPLATE, "utf-8");
	assert.match(text, /spine_review_step/);
	assert.match(text, /spine_report_progress/);
	assert.match(text, /lane\.checkpoint_warning|stall grace/i);
	assert.match(text, /77%/);
});

test("worker-prompt tail aligns with worker.md commit and review conventions", () => {
	const commitHint = buildCommitBoundaryHint("SP-064");
	assert.match(commitHint, /feat\(SP-064\): complete Step N/);
	assert.doesNotMatch(commitHint, /\{taskId\} step \{n\}/i);

	const reviewHint = buildReviewLevelHint(2);
	assert.match(reviewHint, /spine_review_step/);
	assert.match(reviewHint, /Review Level > 0/);

	assert.match(WORKER_TOOLS_HINT, /spine_report_progress/);
});

test("buildWorkerTailPrompt does not contradict worker.md on commit format", () => {
	const taskFolder = path.join(PACKAGE_ROOT, "spine-tasks/SP-064-commit-convention-align");
	const donePath = path.join(taskFolder, ".DONE");
	const tail = buildWorkerTailPrompt({
		worktreePath: PACKAGE_ROOT,
		taskFolder,
		donePath,
		taskIdHint: "SP-064",
		reviewLevel: 2,
		includePromptInclude: false,
		config: {},
		projectRoot: PACKAGE_ROOT,
	});
	assert.match(tail, /feat\(SP-064\): complete Step N/);
	assert.doesNotMatch(tail, /step \{n\}:/i);
	assert.doesNotMatch(tail, /restart from Step 0/i);
});

test("buildAgentSessionWorkerPrompt includes review hint when level > 0", () => {
	const taskFolder = path.join(PACKAGE_ROOT, "spine-tasks/SP-064-commit-convention-align");
	const prompt = buildAgentSessionWorkerPrompt({
		worktreePath: PACKAGE_ROOT,
		taskFolder,
		config: {},
	});
	assert.match(prompt, /spine_review_step/);
	assert.match(prompt, /feat\(SP-064\): complete Step N/);
});
