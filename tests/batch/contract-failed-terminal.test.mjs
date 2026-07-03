/**
 * SP-425 — contract_failed terminal path (GitHub #85).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runFinalReviewPhase } from "../../src/batch/engine-lanes/review.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { metricsFilePath } from "../../src/batch/metrics.mjs";
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
function writeContractFailedFixture(projectRoot, { taskId = "SP-425", suffix = "contract-failed" } = {}) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${suffix}`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`${minimalValidPromptMarkdown(taskId, {
			fileScope: "src/contract-failed-fixture.txt",
			mission: "Contract failure must not masquerade as review_exhausted.",
		})}

## Review Level: 2 (Plan + Code)

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`false\` |
| fileScopeMustChange | \`src/contract-failed-fixture.txt\` |
`,
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
	return { folder, taskFolderRel: `spine-tasks/${taskId}-${suffix}` };
}

function execCommit(cwd, message) {
	execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {object} params
 */
async function provisionContractFailedLane(projectRoot, { batchId, taskId, taskFolderRel }) {
	const orchBranch = `orch/spine-${batchId}`;
	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const wt = laneWorktreePath(projectRoot, batchId, 1);
	provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	fs.mkdirSync(path.dirname(path.join(wt, "src/contract-failed-fixture.txt")), { recursive: true });
	fs.writeFileSync(path.join(wt, "src/contract-failed-fixture.txt"), "fixture\n", "utf-8");
	fs.mkdirSync(taskFolderInWorktree, { recursive: true });
	fs.copyFileSync(
		path.join(projectRoot, taskFolderRel, "PROMPT.md"),
		path.join(taskFolderInWorktree, "PROMPT.md"),
	);
	fs.writeFileSync(
		path.join(taskFolderInWorktree, ".DONE"),
		JSON.stringify({ taskId, completedAt: new Date().toISOString() }, null, 2),
		"utf-8",
	);
	execCommit(wt, "lane contract fixture");

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

	const task = state.tasks[0];
	const lane = state.lanes[0];
	return { state, lane, task, wt, taskFolderInWorktree };
}

test("runFinalReviewPhase fails fast with contract_failed and does not consume finalAttempts", async () => {
	const projectRoot = await initGitRepo("spine-contract-failed-terminal-");
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	const prevCodeVerdict = process.env.SPINE_ENGINE_CODE_STUB_VERDICT;
	const prevFinalVerdict = process.env.SPINE_ENGINE_FINAL_STUB_VERDICT;
	delete process.env.SPINE_WORKER_STUB;
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_CODE_STUB_VERDICT = "APPROVE";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "PASS";
	try {
		const batchId = "20260702T220000";
		const taskId = "SP-425";
		writeContractFailedFixture(projectRoot, { taskId });
		execCommit(projectRoot, "contract failed fixture");

		const { state, lane, task, wt, taskFolderInWorktree } = await provisionContractFailedLane(
			projectRoot,
			{
				batchId,
				taskId,
				taskFolderRel: `spine-tasks/${taskId}-contract-failed`,
			},
		);

		const result = await runFinalReviewPhase({
			projectRoot,
			state,
			batchId,
			config: { review: { maxFinalAttempts: 3 }, metrics: { enabled: true } },
			task,
			lane,
			taskFolderInWorktree,
			wt,
			taskBranch: lane.branch,
			laneCorrelationId: "corr-contract-failed",
			fileScopePaths: ["src/contract-failed-fixture.txt"],
			baseBranch: "main",
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitReason, "contract_failed");
		assert.equal(task.exitReason, "contract_failed");
		assert.equal(task.finalAttempts ?? 0, 0);
		assert.equal(task.contractOk, false);
		assert.equal(fs.existsSync(path.join(taskFolderInWorktree, ".DONE")), false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "contract.verified" && event.payload?.ok === false));
		assert.ok(events.some((event) => event.type === "contract.failed"));
		assert.equal(
			events.some(
				(event) =>
					event.type === "task.verdict_recorded" &&
					event.payload?.reviewType === "final" &&
					event.payload?.verdict === "REVISE",
			),
			false,
		);
		assert.equal(events.some((event) => event.type === "review.exhausted"), false);

		const metricsPath = metricsFilePath(projectRoot, { metrics: { enabled: true } });
		const metricsLine = fs
			.readFileSync(metricsPath, "utf-8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line))
			.find((record) => record.taskId === taskId);
		assert.equal(metricsLine?.exitReason, "contract_failed");
		assert.equal(metricsLine?.failureKind, "contract");
		assert.equal(metricsLine?.contractOk, false);
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		if (prevCodeVerdict === undefined) delete process.env.SPINE_ENGINE_CODE_STUB_VERDICT;
		else process.env.SPINE_ENGINE_CODE_STUB_VERDICT = prevCodeVerdict;
		if (prevFinalVerdict === undefined) delete process.env.SPINE_ENGINE_FINAL_STUB_VERDICT;
		else process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = prevFinalVerdict;
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch surfaces contract_failed headline for failed task", async () => {
	const projectRoot = await initGitRepo("spine-contract-failed-diagnose-");
	try {
		const batchId = "20260702T220100";
		const taskId = "SP-425";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "failed",
					taskFolder: `spine-tasks/${taskId}-contract-diagnose`,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 60_000,
					doneFileFound: false,
					exitReason: "contract_failed",
					contractOk: false,
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
		state.phase = "failed";
		state.failedTasks = 1;
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "contract.failed", {
			taskId,
			laneNumber: 1,
			checks: [{ ok: false, message: "testCommand failed" }],
		});

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.diagnosis, "needs_retry");
		assert.match(reconciliation.headline ?? "", /failed contract verification/i);
		assert.match(reconciliation.suggestedCommand ?? "", /PROMPT\.md/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
