import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { runTaskOnLane, shouldRunCodeReview } from "../../src/batch/engine-lanes.mjs";
import {
	findCodeReviewStepNumber,
	findCompletedCodeReview,
	findLatestStepReviewArtifact,
} from "../../src/batch/review.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} options
 */
function writeCodeReviewTask(
	projectRoot,
	{
		taskId,
		reviewLevel = 2,
		suffix = "code-review",
		fileScope = "src/code-review.txt",
	},
) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	const reviewHeading =
		reviewLevel > 0 ? `\n## Review Level: ${reviewLevel} (Plan and Code)\n` : "\n## Review Level: 0 (None)\n";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Engine code review test
${reviewHeading}
## Mission
Engine code review phase test.

## Dependencies
- **None**

## File Scope
- \`${fileScope}\`

## Steps
### Step 0: Preflight
- [ ] one

### Step 1: Implement
- [ ] work

### Step 2: Testing & Verification
> **Code review checkpoint**
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- touch unrelated files
`,
		"utf-8",
	);
	return { folder, taskFolderRel: `spine-tasks/${taskId}-${suffix}` };
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {object} params
 */
async function provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel }) {
	const orchBranch = `orch/spine-${batchId}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	provisionLaneWorktree({
		projectRoot,
		batchId,
		laneNumber: 1,
		orchBranch,
	});

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "pending",
				taskFolder: taskFolderRel,
				startedAt: null,
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: wt,
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return { state, wt, orchBranch, lane: state.lanes[0], task: state.tasks[0] };
}

function restoreEnv(prev, keys) {
	for (const key of keys) {
		if (prev[key] === undefined) delete process.env[key];
		else process.env[key] = prev[key];
	}
}

test("shouldRunCodeReview requires review level 2 or higher", () => {
	assert.equal(shouldRunCodeReview({ reviewLevel: 0 }), false);
	assert.equal(shouldRunCodeReview({ reviewLevel: 1 }), false);
	assert.equal(shouldRunCodeReview({ reviewLevel: 2 }), true);
	assert.equal(shouldRunCodeReview({ reviewLevel: 3 }), true);
});

test("findCodeReviewStepNumber prefers step with code review checkpoint", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "code-step-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-code-step");
	fs.mkdirSync(taskFolder, { recursive: true });
	try {
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			`### Step 0: Preflight
- [ ] one
### Step 1: Work
- [ ] two
### Step 2: Testing
> **Code review checkpoint**
- [ ] three
### Step 3: Delivery
- [ ] four
`,
			"utf-8",
		);
		assert.equal(findCodeReviewStepNumber(taskFolder), 2);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedCodeReview honors journal review.completed code APPROVE", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "honor-code-journal-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-honor-code");
	fs.mkdirSync(taskFolder, { recursive: true });
	const artifactPath = path.join(taskFolder, ".reviews", "2-20260611T22000000.md");
	try {
		const events = [
			{
				type: "review.completed",
				taskId: "TP-honor-code",
				payload: {
					reviewType: "code",
					verdict: "APPROVE",
					feedback: "Worker passed code review.",
					artifactPath,
				},
			},
		];
		const honored = findCompletedCodeReview({
			taskFolder,
			journalEvents: events,
			taskId: "TP-honor-code",
		});
		assert.equal(honored?.verdict, "APPROVE");
		assert.equal(honored?.source, "journal");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedCodeReview honors step artifact APPROVE for code review step", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "honor-code-artifact-"));
	try {
		const { folder: taskFolder } = writeCodeReviewTask(root, {
			taskId: "TP-198",
			suffix: "honor-code-artifact",
		});
		const reviewsDir = path.join(taskFolder, ".reviews");
		fs.mkdirSync(reviewsDir, { recursive: true });
		const artifactPath = path.join(reviewsDir, "2-20260611T22000000.md");
		fs.writeFileSync(
			artifactPath,
			"### Verdict: APPROVE\n```json\n{\"verdict\":\"APPROVE\",\"feedback\":\"artifact approve\"}\n```\n",
			"utf-8",
		);
		const latest = findLatestStepReviewArtifact(taskFolder, 2);
		assert.equal(latest?.artifactPath, artifactPath);

		const honored = findCompletedCodeReview({
			taskFolder,
			journalEvents: [],
			taskId: "TP-198",
		});
		assert.equal(honored?.verdict, "APPROVE");
		assert.equal(honored?.source, "artifact");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runTaskOnLane runs engine code review for RL2 without worker nested spawn", async () => {
	const projectRoot = await initGitRepo("spine-code-review-rl2-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		codeVerdict: process.env.SPINE_ENGINE_CODE_STUB_VERDICT,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_CODE_STUB_VERDICT = "APPROVE";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	delete process.env.SPINE_WORKER_RUNNER;
	try {
		const batchId = "20260611T195000";
		const taskId = "TP-195";
		const { taskFolderRel } = writeCodeReviewTask(projectRoot, { taskId, suffix: "engine-code" });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "engine code review fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-code-review",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		const codeStarted = events.filter(
			(event) =>
				event.type === "review.started" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "code",
		);
		assert.equal(codeStarted.length, 1, "engine should run exactly one code review");
		const codeVerdict = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "code",
		);
		assert.equal(codeVerdict?.payload?.verdict, "APPROVE");
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === taskId));
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "codeVerdict", "finalVerdict", "workerRunner"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane skips engine code review when review level is 0", async () => {
	const projectRoot = await initGitRepo("spine-code-review-skip-rl0-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	delete process.env.SPINE_ENGINE_FINAL_STUB_VERDICT;
	try {
		const batchId = "20260611T195010";
		const taskId = "TP-199";
		const { taskFolderRel } = writeCodeReviewTask(projectRoot, {
			taskId,
			reviewLevel: 0,
			suffix: "skip-rl0",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "skip rl0 fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-skip-rl0",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.some(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "code",
			),
			false,
		);
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane skips engine code review when review level is 1", async () => {
	const projectRoot = await initGitRepo("spine-code-review-skip-rl1-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	try {
		const batchId = "20260611T195011";
		const taskId = "TP-200";
		const { taskFolderRel } = writeCodeReviewTask(projectRoot, {
			taskId,
			reviewLevel: 1,
			suffix: "skip-rl1",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "skip rl1 fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-skip-rl1",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.some(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "code",
			),
			false,
		);
		assert.ok(
			events.some(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "final",
			),
		);
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane honors journal review.completed code APPROVE without duplicate spawn", async () => {
	const projectRoot = await initGitRepo("spine-code-honor-journal-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	try {
		const batchId = "20260611T195100";
		const taskId = "TP-196";
		const { taskFolderRel } = writeCodeReviewTask(projectRoot, { taskId, suffix: "honor-journal" });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "code honor journal fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });

		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			correlationId: "corr-worker-code",
			reviewType: "code",
			verdict: "APPROVE",
			feedback: "Worker journal code approve",
			artifactPath: path.join(taskFolderRel, ".reviews", "2-20260611T22000000.md"),
		});

		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-code-honor-journal",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.filter(
				(event) => event.type === "review.started" && event.taskId === taskId && event.payload?.reviewType === "code",
			).length,
			0,
		);
		const verdictEvent = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "code",
		);
		assert.equal(verdictEvent?.payload?.honored, true);
		assert.equal(verdictEvent?.payload?.honorSource, "journal");
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane re-invokes worker after code REVISE and succeeds on APPROVE", async () => {
	const projectRoot = await initGitRepo("spine-code-revise-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		codeVerdicts: process.env.SPINE_ENGINE_CODE_STUB_VERDICTS,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_CODE_STUB_VERDICTS = "REVISE,APPROVE";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	try {
		const batchId = "20260611T195200";
		const taskId = "TP-197";
		const { taskFolderRel } = writeCodeReviewTask(projectRoot, { taskId, suffix: "revise-code" });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "code revise fixture");

		const { state, lane, task, wt } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-code-revise",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(task.codeReviewAttempts, 2);
		const events = readJournalEvents(projectRoot, batchId);
		const codeVerdicts = events
			.filter(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "code",
			)
			.map((event) => event.payload?.verdict);
		assert.deepEqual(codeVerdicts, ["REVISE", "APPROVE"]);
		assert.equal(
			events.filter((event) => event.type === "lane.completed" && event.taskId === taskId).length,
			2,
		);
		assert.equal(fs.existsSync(path.join(wt, taskFolderRel, ".DONE")), true);
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "codeVerdicts", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});
