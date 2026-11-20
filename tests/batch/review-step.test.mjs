import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewRequest } from "../../src/batch/review-step.mjs";

// SP-873 (#331): post-hoc Step 0 plan review must not reject finished work as
// premature completion. These tests pin the post-hoc wording in the plan
// prompt while keeping the APPROVE/REVISE output contract unchanged.

function buildPlanPrompt() {
	return buildReviewRequest({
		reviewType: "plan",
		stepNumber: 0,
		stepName: "Preflight",
		taskFolder: "/tmp/nonexistent",
		worktreePath: "/tmp/nonexistent",
		outputPath: "/tmp/nonexistent/.reviews/plan-step-0.md",
	});
}

test("plan review prompt states the review runs after the worker finished (post-hoc)", () => {
	const prompt = buildPlanPrompt();
	assert.match(prompt, /POST-HOC plan review/);
	assert.match(prompt, /after the worker finished/i);
	assert.match(prompt, /#331/);
});

test("plan review prompt treats checked STATUS and .DONE as expected, not premature", () => {
	const prompt = buildPlanPrompt();
	assert.match(prompt, /STATUS checkboxes/);
	assert.match(prompt, /`\.DONE` marker/);
	assert.match(prompt, /expected state/);
	assert.match(prompt, /NOT evidence of premature completion/);
	assert.match(prompt, /must not trigger REVISE/);
});

test("plan review prompt guides reviewers to judge plan quality, not implementation timing", () => {
	const prompt = buildPlanPrompt();
	assert.match(prompt, /Judge the quality of the plan/);
	assert.match(prompt, /fit to the task PROMPT/);
	assert.match(prompt, /not whether implementation already happened/);
});

test("plan review prompt keeps the APPROVE/REVISE output contract", () => {
	const prompt = buildPlanPrompt();
	assert.match(prompt, /## Output/);
	assert.match(prompt, /Write your review to:/);
	assert.match(prompt, /Include `### Verdict: APPROVE` or `### Verdict: REVISE` and a JSON block\./);
});

test("code review prompt does not include the plan-only post-hoc instructions", () => {
	const prompt = buildReviewRequest({
		reviewType: "code",
		stepNumber: 1,
		taskFolder: "/tmp/nonexistent",
		worktreePath: "/tmp/nonexistent",
		outputPath: "/tmp/nonexistent/.reviews/code-step-1.md",
	});
	assert.doesNotMatch(prompt, /POST-HOC plan review/);
	assert.doesNotMatch(prompt, /not evidence of premature completion/i);
});
