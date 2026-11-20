/**
 * SP-874 / GitHub #294 — step-0 plan review must be ordered before later-step
 * plan reviews for the same task/lane. A packet that declares a plan-review
 * checkpoint at a later step must not silently drop the required step-0 plan
 * review, and a later-step plan verdict must not satisfy the step-0 gate.
 *
 * Covers:
 * - findPlanReviewStepOrder schedule shape (step 0 first, checkpoint after).
 * - runPlanReviewPhase journals the step-0 review before the later checkpoint
 *   review when multiple plan reviews are queued.
 * - Honor scan step filtering: a later-step verdict cannot pre-satisfy the
 *   step-0 gate (journal or artifact source).
 * - Fail-closed preservation: an exhausted step-0 rework loop stops the
 *   schedule before any later-step plan review runs.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { runPlanReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import { findPlanReviewStepOrder } from "../../src/batch/engine-lanes/review-plan.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const STUB_ENV_KEYS = [
	"SPINE_WORKER_STUB",
	"SPINE_REVIEW_STUB",
	"SPINE_ENGINE_PLAN_STUB_VERDICTS",
];

function snapshotStubEnv() {
	return Object.fromEntries(STUB_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreStubEnv(prev) {
	for (const key of STUB_ENV_KEYS) {
		if (prev[key] === undefined) delete process.env[key];
		else process.env[key] = prev[key];
	}
}

function execCommit(cwd, message) {
	execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

/**
 * Write a task packet with controllable step layout.
 *
 * @param {string} projectRoot
 * @param {object} options
 * @param {string} options.taskId
 * @param {string} options.suffix
 * @param {number} [options.reviewLevel]
 * @param {number[]} options.steps Step numbers to emit, ascending.
 * @param {number|null} [options.checkpointStep] Step receiving the plan-review checkpoint marker.
 */
function writeOrderedTask(projectRoot, { taskId, suffix, reviewLevel = 1, steps, checkpointStep = null }) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	const stepSections = steps
		.map((step) => {
			const marker = step === checkpointStep ? "> **Plan-review checkpoint**\n\n" : "";
			return `### Step ${step}: Work ${step}\n${marker}- [ ] work item ${step}\n`;
		})
		.join("\n");
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Plan review ordering

## Review Level: ${reviewLevel} (Plan)

## Mission
Step-0 plan review must run before later-step plan reviews (#294).

## Dependencies
- **None**

## File Scope
- \`src/${taskId}-order.txt\`

## Steps
${stepSections}
## Completion Criteria
- [ ] done
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	return { folder, taskFolderRel: `spine-tasks/${taskId}-${suffix}` };
}

/**
 * Provision a one-lane batch state with the task marked running/.DONE so the
 * review phase can run against it (mirrors review-honor-guard.test.mjs).
 *
 * @param {string} projectRoot
 * @param {object} params
 */
function provisionOrderLane(projectRoot, { batchId, taskId, taskFolderRel }) {
	const orchBranch = `orch/spine-${batchId}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 60_000,
				endedAt: null,
				doneFileFound: true,
				exitReason: null,
				finalAttempts: 0,
				planReviewAttempts: 0,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: Date.now(),
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return {
		state,
		wt,
		lane: state.lanes[0],
		task: state.tasks[0],
		taskFolderInWorktree: path.join(wt, taskFolderRel),
	};
}

/**
 * Plan review.started step numbers in journal order.
 * @param {Array<Record<string, any>>} events
 * @param {string} taskId
 */
function planReviewStartedSteps(events, taskId) {
	return events
		.filter(
			(event) =>
				event.type === "review.started" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "plan",
		)
		.map((event) => event.payload?.stepNumber);
}

function writePlanApproveArtifact(taskFolder, stepNumber) {
	const reviewsDir = path.join(taskFolder, ".reviews");
	fs.mkdirSync(reviewsDir, { recursive: true });
	const artifactPath = path.join(reviewsDir, `${stepNumber}-20261009T010101.md`);
	fs.writeFileSync(
		artifactPath,
		"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"lane plan approve\"}\n```\n",
		"utf-8",
	);
	return artifactPath;
}

test("findPlanReviewStepOrder queues step 0 before a later plan-review checkpoint step", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "plan-order-"));
	try {
		const { folder } = writeOrderedTask(root, {
			taskId: "SP-874",
			suffix: "order-step0-first",
			steps: [0, 1],
			checkpointStep: 1,
		});
		assert.deepEqual(findPlanReviewStepOrder(folder), [0, 1]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findPlanReviewStepOrder keeps a single step when the checkpoint is step 0", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "plan-order-"));
	try {
		const { folder } = writeOrderedTask(root, {
			taskId: "SP-874",
			suffix: "order-checkpoint-step0",
			steps: [0, 1, 2],
			checkpointStep: 0,
		});
		assert.deepEqual(findPlanReviewStepOrder(folder), [0]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findPlanReviewStepOrder falls back to the minimum step without a checkpoint", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "plan-order-"));
	try {
		const withZero = writeOrderedTask(root, {
			taskId: "SP-874",
			suffix: "order-fallback-zero",
			steps: [0, 1, 2],
		});
		assert.deepEqual(findPlanReviewStepOrder(withZero.folder), [0]);

		const withoutZero = writeOrderedTask(root, {
			taskId: "SP-874",
			suffix: "order-fallback-min",
			steps: [2, 3, 4],
		});
		assert.deepEqual(findPlanReviewStepOrder(withoutZero.folder), [2]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findPlanReviewStepOrder handles missing PROMPT.md and empty step layout", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "plan-order-"));
	try {
		const missing = path.join(root, "spine-tasks", "absent-folder");
		assert.deepEqual(findPlanReviewStepOrder(missing), [0]);

		const { folder } = writeOrderedTask(root, {
			taskId: "SP-874",
			suffix: "order-no-steps",
			steps: [],
		});
		// Steps removed post-write leaves a prompt with no ### Step headings.
		const promptPath = path.join(folder, "PROMPT.md");
		fs.writeFileSync(promptPath, "# Task: no steps\n\n## Review Level: 1 (Plan)\n", "utf-8");
		assert.deepEqual(findPlanReviewStepOrder(folder), [0]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findPlanReviewStepOrder keeps single-step schedule for smoke packet shape", () => {
	// AD-002/AD-003 real-pi-smoke shape: checkpoint at the first step, no step 0.
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "plan-order-"));
	try {
		const { folder } = writeOrderedTask(root, {
			taskId: "AD-002",
			suffix: "order-smoke-shape",
			steps: [1, 2, 3],
			checkpointStep: 1,
		});
		assert.deepEqual(findPlanReviewStepOrder(folder), [1]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runPlanReviewPhase journals the step-0 review before the later checkpoint-step review", async () => {
	const projectRoot = await initGitRepo("spine-plan-order-");
	const prev = snapshotStubEnv();
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS;
	try {
		const batchId = "20261120T010101";
		const taskId = "SP-874a";
		const { taskFolderRel } = writeOrderedTask(projectRoot, {
			taskId,
			suffix: "phase-order",
			steps: [0, 1],
			checkpointStep: 1,
		});
		execCommit(projectRoot, "plan order fixture");

		const { state, lane, task, taskFolderInWorktree } = provisionOrderLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt: path.dirname(taskFolderInWorktree),
			taskBranch: lane.branch,
			laneCorrelationId: "corr-plan-order",
			fileScopePaths: [`src/${taskId}-order.txt`],
		});

		assert.equal(result.ok, true, JSON.stringify(result));
		assert.equal(task.planReviewAttempts, 2);

		const events = readJournalEvents(projectRoot, batchId);
		assert.deepEqual(
			planReviewStartedSteps(events, taskId),
			[0, 1],
			"step-0 plan review must be journaled before the later checkpoint-step review",
		);

		const verdicts = events
			.filter(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "plan",
			)
			.map((event) => event.payload?.verdict);
		assert.deepEqual(verdicts, ["APPROVE", "APPROVE"]);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("later-step journal verdict cannot satisfy the step-0 gate — step 0 is reviewed first", async () => {
	const projectRoot = await initGitRepo("spine-plan-order-");
	const prev = snapshotStubEnv();
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS;
	try {
		const batchId = "20261120T010102";
		const taskId = "SP-874b";
		const { taskFolderRel } = writeOrderedTask(projectRoot, {
			taskId,
			suffix: "phase-journal-filter",
			steps: [0, 1],
			checkpointStep: 1,
		});
		execCommit(projectRoot, "plan order journal filter fixture");

		const { state, lane, task, taskFolderInWorktree, wt } = provisionOrderLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		// Worker stub checkpoint review for the LATER step (#294 timeline): a
		// trustworthy in-folder journal verdict that must not pre-satisfy the
		// unreviewed step-0 gate.
		const artifactPath = writePlanApproveArtifact(taskFolderInWorktree, 1);
		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: "corr-later-step-verdict",
			stepNumber: 1,
			reviewType: "plan",
			reviewLevel: 1,
			verdict: "APPROVE",
			feedback: "Stub reviewer approved.",
			artifactPath,
			stub: true,
		});

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-plan-order-filter",
			fileScopePaths: [`src/${taskId}-order.txt`],
		});

		assert.equal(result.ok, true, JSON.stringify(result));

		const events = readJournalEvents(projectRoot, batchId);
		// Step 0 was not covered by the later-step verdict, so the engine ran it
		// first; step 1 was then satisfied by its own journaled verdict.
		assert.deepEqual(planReviewStartedSteps(events, taskId), [0]);
		assert.equal(result.honored, true);
		const honoredVerdict = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "plan" &&
				event.payload?.honored === true,
		);
		assert.ok(honoredVerdict, "honored plan verdict must be journaled");
		assert.equal(honoredVerdict.payload?.honorSource, "journal");
		assert.equal(task.planReviewAttempts, 2);

		const verdicts = events
			.filter(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "plan",
			)
			.map((event) => event.payload?.verdict);
		assert.deepEqual(verdicts, ["APPROVE", "APPROVE"]);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("later-step plan artifact cannot satisfy the step-0 gate — artifact fallback is step-filtered", async () => {
	const projectRoot = await initGitRepo("spine-plan-order-");
	const prev = snapshotStubEnv();
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS;
	try {
		const batchId = "20261120T010103";
		const taskId = "SP-874c";
		const { taskFolderRel } = writeOrderedTask(projectRoot, {
			taskId,
			suffix: "phase-artifact-filter",
			steps: [0, 1],
			checkpointStep: 1,
		});
		execCommit(projectRoot, "plan order artifact filter fixture");

		const { state, lane, task, taskFolderInWorktree, wt } = provisionOrderLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		// Only a later-step APPROVE artifact exists — no step-0 artifact.
		writePlanApproveArtifact(taskFolderInWorktree, 1);

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-plan-order-artifact",
			fileScopePaths: [`src/${taskId}-order.txt`],
		});

		assert.equal(result.ok, true, JSON.stringify(result));

		const events = readJournalEvents(projectRoot, batchId);
		// The 1-*.md artifact must not satisfy step 0: engine reviews step 0
		// first, then step 1 is honored from the artifact fallback.
		assert.deepEqual(planReviewStartedSteps(events, taskId), [0]);
		assert.equal(result.honored, true);
		const honoredVerdict = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "plan" &&
				event.payload?.honored === true,
		);
		assert.ok(honoredVerdict, "honored plan verdict must be journaled");
		assert.equal(honoredVerdict.payload?.honorSource, "artifact");
		assert.equal(task.planReviewAttempts, 2);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("single-step packet honor fast-path is unchanged by step filtering", async () => {
	const projectRoot = await initGitRepo("spine-plan-order-");
	const prev = snapshotStubEnv();
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS;
	try {
		const batchId = "20261120T010104";
		const taskId = "SP-874d";
		const { taskFolderRel } = writeOrderedTask(projectRoot, {
			taskId,
			suffix: "phase-single-step",
			steps: [0, 1],
		});
		execCommit(projectRoot, "plan order single step fixture");

		const { state, lane, task, taskFolderInWorktree, wt } = provisionOrderLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		// Trustworthy step-0 journal verdict for the only scheduled step.
		const artifactPath = writePlanApproveArtifact(taskFolderInWorktree, 0);
		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
			correlationId: "corr-single-step-verdict",
			stepNumber: 0,
			reviewType: "plan",
			reviewLevel: 1,
			verdict: "APPROVE",
			feedback: "Stub reviewer approved.",
			artifactPath,
			stub: true,
		});

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-plan-order-single",
			fileScopePaths: [`src/${taskId}-order.txt`],
		});

		assert.equal(result.ok, true, JSON.stringify(result));
		assert.equal(result.honored, true);
		assert.equal(task.planReviewAttempts, 1);

		const events = readJournalEvents(projectRoot, batchId);
		assert.deepEqual(
			planReviewStartedSteps(events, taskId),
			[],
			"no checkpoint packet honors the step-0 verdict without spawning a duplicate review",
		);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("exhausted step-0 rework loop stops the schedule before any later-step plan review", async () => {
	const projectRoot = await initGitRepo("spine-plan-order-");
	const prev = snapshotStubEnv();
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS = "REVISE,REVISE";
	try {
		const batchId = "20261120T010105";
		const taskId = "SP-874e";
		const { taskFolderRel } = writeOrderedTask(projectRoot, {
			taskId,
			suffix: "phase-fail-closed",
			steps: [0, 1],
			checkpointStep: 1,
		});
		execCommit(projectRoot, "plan order fail closed fixture");

		const { state, lane, task, taskFolderInWorktree, wt } = provisionOrderLane(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		const result = await runPlanReviewPhase({
			projectRoot,
			state,
			batchId,
			config: { review: { maxPlanReviewAttempts: 2 } },
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-plan-order-fail",
			fileScopePaths: [`src/${taskId}-order.txt`],
		});

		// Fail-closed (#294 item 2): the step-0 schedule exhausts and the task
		// fails — the checkpoint-step review must never start.
		assert.equal(result.ok, false);
		assert.equal(result.exitReason, "review_exhausted");
		assert.equal(task.status, "failed");
		assert.equal(task.exitReason, "review_exhausted");

		const events = readJournalEvents(projectRoot, batchId);
		// Attempt 1 + the post-rework attempt both target step 0; no later-step
		// review may start while step 0 is unreviewed.
		const startedSteps = planReviewStartedSteps(events, taskId);
		assert.equal(startedSteps.length, 2);
		assert.ok(
			startedSteps.every((step) => step === 0),
			`exhausted step-0 rework must stop the schedule before the later-step review (got ${JSON.stringify(startedSteps)})`,
		);
		const taskFailed = events.find(
			(event) => event.type === "task.failed" && event.taskId === taskId,
		);
		assert.ok(taskFailed, "task.failed must be journaled");
		assert.equal(taskFailed.payload?.classification, "review_exhausted");
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});
