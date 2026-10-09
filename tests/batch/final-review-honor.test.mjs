import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { runTaskOnLane } from "../../src/batch/engine-lanes.mjs";
import { runFinalReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import {
	findCompletedFinalReview,
	findLatestFinalReviewArtifact,
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
function writeFinalReviewTask(
	projectRoot,
	{
		taskId,
		reviewLevel = 1,
		suffix = "honor",
		fileScope = "src/final-honor.txt",
	},
) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	const reviewHeading =
		reviewLevel > 0 ? `\n## Review Level: ${reviewLevel} (Plan)\n` : "\n## Review Level: 0 (None)\n";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Final review honor test
${reviewHeading}
## Mission
Honor worker final review.

## Dependencies
- **None**

## File Scope
- \`${fileScope}\`

## Steps
### Step 0: Done
- [ ] one

### Step 1: Testing & Verification
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

test("findCompletedFinalReview honors journal review.completed final PASS", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "honor-journal-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-honor-journal");
	fs.mkdirSync(taskFolder, { recursive: true });
	const artifactPath = path.join(taskFolder, ".reviews", "final-20260611T22000000.md");
	try {
		const events = [
			{
				type: "review.completed",
				taskId: "TP-honor-journal",
				payload: {
					reviewType: "final",
					verdict: "PASS",
					feedback: "Worker passed final review.",
					artifactPath,
				},
			},
		];
		const honored = findCompletedFinalReview({
			taskFolder,
			journalEvents: events,
			taskId: "TP-honor-journal",
		});
		assert.equal(honored?.verdict, "PASS");
		assert.equal(honored?.source, "journal");
		assert.equal(honored?.feedback, "Worker passed final review.");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("findCompletedFinalReview honors latest final artifact PASS", () => {
	const root = fs.mkdtempSync(path.join(import.meta.dirname, "honor-artifact-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-honor-artifact");
	const reviewsDir = path.join(taskFolder, ".reviews");
	fs.mkdirSync(reviewsDir, { recursive: true });
	const artifactPath = path.join(reviewsDir, "final-20260611T22000000.md");
	try {
		fs.writeFileSync(
			artifactPath,
			"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"artifact pass\"}\n```\n",
			"utf-8",
		);
		const latest = findLatestFinalReviewArtifact(taskFolder);
		assert.equal(latest?.artifactPath, artifactPath);

		const honored = findCompletedFinalReview({
			taskFolder,
			journalEvents: [],
			taskId: "TP-honor-artifact",
		});
		assert.equal(honored?.verdict, "PASS");
		assert.equal(honored?.source, "artifact");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runTaskOnLane honors pre-existing worker final review without spawn failure", async () => {
	const projectRoot = await initGitRepo("spine-honor-lane-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const batchId = "20260611T220600";
		const taskId = "TP-192";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, { taskId, suffix: "honor-lane" });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review honor fixture");

		const { state, lane, task, wt } = await provisionLaneTask(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		const artifactPath = path.join(wt, taskFolderRel, ".reviews", "final-20260611T22000000.md");
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		fs.writeFileSync(
			artifactPath,
			"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"worker final pass\"}\n```\n",
			"utf-8",
		);

		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: {},
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-final-honor",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.some((event) => event.type === "task.failed" && event.taskId === taskId),
			false,
		);
		const verdictEvent = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "final",
		);
		assert.equal(verdictEvent?.payload?.verdict, "PASS");
		assert.equal(verdictEvent?.payload?.honored, true);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === taskId));
	} finally {
		restoreEnv(prev, ["stub", "reviewStub"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runFinalReviewPhase journals contract.verified before a real (non-stub) journal honor", async () => {
	const projectRoot = await initGitRepo("spine-honor-contract-order-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
	};
	delete process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_REVIEW_STUB;
	try {
		const batchId = "20260611T220602";
		const taskId = "TP-194";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, {
			taskId,
			suffix: "honor-contract-order",
		});
		// A verifiable contract makes the live batch run contract verification
		// before any honor fast path (SP-813 / #328).
		fs.appendFileSync(
			path.join(projectRoot, taskFolderRel, "PROMPT.md"),
			"\n## Contract\n\n| Field | Value |\n|-------|-------|\n| testCommand | `true` |\n",
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "contract order honor fixture");

		const { state, lane, task, wt } = await provisionLaneTask(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		// Worker-style journal honor: relative artifactPath resolved against the
		// lane worktree stays honorable in a live (non-stub) batch.
		const reviewsDir = path.join(wt, taskFolderRel, ".reviews");
		fs.mkdirSync(reviewsDir, { recursive: true });
		fs.writeFileSync(
			path.join(reviewsDir, "final-20260611T220602.md"),
			"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"worker final pass\"}\n```\n",
			"utf-8",
		);
		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			correlationId: "corr-worker-final-live",
			reviewType: "final",
			verdict: "PASS",
			feedback: "Worker journal final pass",
			artifactPath: path.join(taskFolderRel, ".reviews", "final-20260611T220602.md"),
		});

		const result = await runFinalReviewPhase({
			projectRoot,
			state,
			batchId,
			config: {},
			task,
			lane,
			taskFolderInWorktree: path.join(wt, taskFolderRel),
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-honor-contract-order",
			fileScopePaths: ["src/final-honor.txt"],
			baseBranch: "main",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		const contractIndex = events.findIndex(
			(event) => event.type === "contract.verified" && event.taskId === taskId,
		);
		assert.ok(contractIndex >= 0, "contract.verified must be journaled for a non-stub honor");
		assert.equal(events[contractIndex].payload?.ok, true);
		const verdictIndex = events.findIndex(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "final" &&
				event.payload?.honored === true,
		);
		assert.ok(
			verdictIndex > contractIndex,
			"contract.verified must precede task.verdict_recorded { honored: true }",
		);
		assert.equal(events[verdictIndex].payload?.honorSource, "journal");
	} finally {
		restoreEnv(prev, ["stub", "reviewStub"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane honors journal review.completed final PASS without duplicate spawn", async () => {
	const projectRoot = await initGitRepo("spine-honor-journal-lane-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	try {
		const batchId = "20260611T220601";
		const taskId = "TP-193";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, { taskId, suffix: "honor-journal-lane" });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review journal honor fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, {
			batchId,
			taskId,
			taskFolderRel,
		});

		appendJournalEvent(projectRoot, batchId, "review.completed", {
			taskId,
			laneNumber: 1,
			correlationId: "corr-worker-final",
			reviewType: "final",
			verdict: "PASS",
			feedback: "Worker journal final pass",
			artifactPath: path.join(taskFolderRel, ".reviews", "final-20260611T22000000.md"),
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
			laneCorrelationId: "corr-final-honor-journal",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.filter(
				(event) =>
					event.type === "review.started" &&
					event.taskId === taskId &&
					event.payload?.reviewType === "final",
			).length,
			0,
		);
		const verdictEvent = events.find(
			(event) =>
				event.type === "task.verdict_recorded" &&
				event.taskId === taskId &&
				event.payload?.reviewType === "final",
		);
		assert.equal(verdictEvent?.payload?.honored, true);
		assert.equal(verdictEvent?.payload?.honorSource, "journal");
	} finally {
		restoreEnv(prev, ["stub", "reviewStub"]);
		await destroyGitRepo(projectRoot);
	}
});
