import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	mergeWaveLanesToOrch,
	parseFinalReviewVerdict,
	runEngineFinalReview,
	runTaskOnLane,
	shouldRunFinalReview,
} from "../../src/batch/engine-lanes.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
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
		suffix = "final",
		fileScope = "src/final-review.txt",
		mission = "Final review engine test task.",
	},
) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	const reviewHeading =
		reviewLevel > 0 ? `\n## Review Level: ${reviewLevel} (Plan)\n` : "\n## Review Level: 0 (None)\n";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Final review test
${reviewHeading}
## Mission
${mission}

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

test("parseFinalReviewVerdict accepts PASS, REVISE, and REPLAN", () => {
	const pass = parseFinalReviewVerdict(
		"### Verdict: PASS\n```json\n{\"verdict\":\"PASS\",\"feedback\":\"ok\"}\n```\n",
	);
	assert.equal(pass.verdict, "PASS");

	const replan = parseFinalReviewVerdict("### Verdict: REPLAN\n### Summary\nEdit PROMPT.\n");
	assert.equal(replan.verdict, "REPLAN");
});

test("shouldRunFinalReview skips when review level is 0", () => {
	assert.equal(shouldRunFinalReview({ config: {}, reviewLevel: 0 }), false);
	assert.equal(shouldRunFinalReview({ config: {}, reviewLevel: 1 }), true);
	assert.equal(
		shouldRunFinalReview({ config: { review: { requireFinalVerdict: false } }, reviewLevel: 2 }),
		false,
	);
});

test("runTaskOnLane skips final review when review level is 0", async () => {
	const projectRoot = await initGitRepo("spine-final-skip-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "REPLAN";
	try {
		const batchId = "20260611T120000";
		const taskId = "TP-151";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, {
			taskId,
			reviewLevel: 0,
			suffix: "skip-final",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review skip fixture");

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
			laneCorrelationId: "corr-final-skip",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.some((event) => event.type === "task.verdict_recorded" && event.taskId === taskId),
			false,
		);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === taskId));
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane journals task.verdict_recorded on PASS final review", async () => {
	const projectRoot = await initGitRepo("spine-final-pass-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	try {
		const batchId = "20260611T120100";
		const taskId = "TP-152";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, {
			taskId,
			reviewLevel: 1,
			suffix: "pass-final",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review pass fixture");

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
			laneCorrelationId: "corr-final-pass",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const events = readJournalEvents(projectRoot, batchId);
		const verdictEvent = events.find(
			(event) => event.type === "task.verdict_recorded" && event.taskId === taskId,
		);
		assert.ok(verdictEvent, "expected task.verdict_recorded");
		assert.equal(verdictEvent.payload?.verdict, "PASS");
		assert.equal(verdictEvent.payload?.reviewType, "final");
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane re-invokes worker after REVISE and succeeds on PASS", async () => {
	const projectRoot = await initGitRepo("spine-final-revise-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdicts: process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS = "REVISE,PASS";
	try {
		const batchId = "20260611T120200";
		const taskId = "TP-153";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, {
			taskId,
			reviewLevel: 1,
			suffix: "revise-final",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review revise fixture");

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
			laneCorrelationId: "corr-final-revise",
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(task.finalAttempts, 2);
		const events = readJournalEvents(projectRoot, batchId);
		const verdicts = events
			.filter((event) => event.type === "task.verdict_recorded" && event.taskId === taskId)
			.map((event) => event.payload?.verdict);
		assert.deepEqual(verdicts, ["REVISE", "PASS"]);
		assert.equal(
			events.filter((event) => event.type === "lane.completed" && event.taskId === taskId).length,
			2,
		);
		assert.equal(fs.existsSync(path.join(wt, taskFolderRel, ".DONE")), true);
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdicts"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane caps REVISE at maxFinalAttempts with review_exhausted", async () => {
	const projectRoot = await initGitRepo("spine-final-exhausted-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdicts: process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS = "REVISE,REVISE,REVISE";
	try {
		const batchId = "20260611T120300";
		const taskId = "TP-154";
		const { taskFolderRel } = writeFinalReviewTask(projectRoot, {
			taskId,
			reviewLevel: 1,
			suffix: "exhausted-final",
		});
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review exhausted fixture");

		const { state, lane, task } = await provisionLaneTask(projectRoot, { batchId, taskId, taskFolderRel });
		const result = await runTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch: "main",
			config: { review: { maxFinalAttempts: 3 } },
			task,
			lane,
			taskFolderRel,
			laneCorrelationId: "corr-final-exhausted",
		});

		assert.equal(result.ok, false);
		assert.equal(task.exitReason, "review_exhausted");
		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "review.exhausted" && event.taskId === taskId));
		assert.equal(
			events.some((event) => event.type === "task.completed" && event.taskId === taskId),
			false,
		);
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdicts"]);
		await destroyGitRepo(projectRoot);
	}
});

test("runTaskOnLane fails with needs_replan and does not keep .DONE", async () => {
	const projectRoot = await initGitRepo("spine-final-replan-");
	const prev = {
		stub: process.env.SPINE_WORKER_STUB,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "REPLAN";
	try {
		const batchId = "20260611T120400";
		const taskId = "FX-153";
		const repoFixture = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../test/fixtures/taskplane/FX-final-replan",
		);
		const taskFolderRel = "test/fixtures/taskplane/FX-final-replan";
		const destFixture = path.join(projectRoot, taskFolderRel);
		fs.mkdirSync(path.dirname(destFixture), { recursive: true });
		fs.cpSync(repoFixture, destFixture, { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
			"utf-8",
		);
		execCommit(projectRoot, "final review replan fixture");

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
			laneCorrelationId: "corr-final-replan",
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitReason, "needs_replan");
		assert.equal(task.exitReason, "needs_replan");
		assert.equal(fs.existsSync(path.join(wt, taskFolderRel, ".DONE")), false);
		const events = readJournalEvents(projectRoot, batchId);
		const verdictEvent = events.find(
			(event) => event.type === "task.verdict_recorded" && event.taskId === taskId,
		);
		assert.equal(verdictEvent?.payload?.verdict, "REPLAN");
	} finally {
		restoreEnv(prev, ["stub", "reviewStub", "finalVerdict"]);
		await destroyGitRepo(projectRoot);
	}
});

test("mergeWaveLanesToOrch blocks when a wave task has exitReason needs_replan", async () => {
	const projectRoot = await initGitRepo("spine-final-merge-block-");
	const batchId = "20260611T120500";
	const taskId = "FX-153";
	const orchBranch = `orch/spine-${batchId}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: "test/fixtures/taskplane/FX-final-replan",
				startedAt: Date.now() - 1000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "needs_replan",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "running";
	state.mergeResults = [];
	saveSpineBatchState(projectRoot, state);

	const merge = await mergeWaveLanesToOrch({
		projectRoot,
		state,
		batchId,
		baseBranch: "main",
		orchBranch,
		waveIndex: 0,
	});

	assert.equal(merge.ok, false);
	assert.equal(merge.exitReason, "needs_replan");
	assert.match(merge.error ?? "", /needs_replan/);
});

test("runEngineFinalReview stub writes final artifact path", () => {
	const prev = {
		reviewStub: process.env.SPINE_REVIEW_STUB,
		finalVerdict: process.env.SPINE_ENGINE_FINAL_STUB_VERDICT,
	};
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	const root = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "final-stub-"));
	const taskFolder = path.join(root, "spine-tasks", "TP-stub");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		minimalValidPromptMarkdown("TP-stub", { fileScope: "src/stub.txt" }).replace(
			"## Mission",
			"## Review Level: 1 (Plan)\n\n## Mission",
		),
		"utf-8",
	);
	try {
		const result = runEngineFinalReview({
			taskFolder,
			worktreePath: root,
			config: {},
		});
		assert.equal(result.verdict, "PASS");
		assert.match(result.artifactPath, /\/\.reviews\/final-\d{8}T\d{6}\.md$/);
		assert.equal(fs.existsSync(result.artifactPath), true);
	} finally {
		restoreEnv(prev, ["reviewStub", "finalVerdict"]);
		fs.rmSync(root, { recursive: true, force: true });
	}
});
