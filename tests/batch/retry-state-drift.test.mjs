import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { appendJournalEvent, journalPath, readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordTaskSucceeded,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const INCIDENT_FIXTURES = path.join(process.cwd(), "tests/fixtures/incidents");

function writePromptParseFailedBatch(projectRoot, { batchId = "20260605T191325", taskId = "SP-118" } = {}) {
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
				taskFolder: `spine-tasks/${taskId}-adoption`,
				startedAt: Date.now() - 120_000,
				endedAt: Date.now() - 60_000,
				doneFileFound: false,
				exitReason: "prompt_parse_failed",
				classification: "prompt_parse_failed",
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
	updateSegmentForTask(state, taskId, "failed");
	state.segments[0].classification = "prompt_parse_failed";
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

function loadIncidentFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(INCIDENT_FIXTURES, name), "utf-8"));
}

function materializeIncidentFixture(projectRoot, fixture) {
	const batchId = fixture.meta?.batchId ?? fixture.batchState.batchId;
	saveSpineBatchState(projectRoot, fixture.batchState);

	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}
}

test("retryTask clears stale failure metadata before re-run", async () => {
	const projectRoot = await initGitRepo("spine-retry-clear-failure-");
	try {
		const { taskId } = writePromptParseFailedBatch(projectRoot);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "pending");
		assert.equal(saved?.tasks[0].exitReason, null);
		assert.equal(saved?.tasks[0].classification, undefined);
		assert.equal(saved?.segments[0].status, "pending");
		assert.equal(saved?.segments[0].classification, undefined);
		assert.equal(saved?.failedTasks, 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retry then task.completed updates counters and reconcile diagnosis", async () => {
	const projectRoot = await initGitRepo("spine-retry-success-reconcile-");
	try {
		const { batchId, taskId } = writePromptParseFailedBatch(projectRoot);

		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber: 1,
			classification: "prompt_parse_failed",
			exitCode: 1,
			output: "PROMPT parse failed",
		});

		const retry = retryTask({ projectRoot, taskId });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const state = loadSpineBatchState(projectRoot).raw;
		assert.ok(recordTaskSucceeded(state, taskId, { exitReason: "done" }));
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, batchId, "task.completed", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
		});

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.tasks[0].status, "succeeded");
		assert.equal(saved?.tasks[0].exitReason, "done");
		assert.equal(saved?.segments[0].status, "succeeded");
		assert.equal(saved?.failedTasks, 0);
		assert.equal(saved?.succeededTasks, 1);

		const reconcile = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(reconcile.diagnosis, "needs_retry");
		assert.notEqual(reconcile.exitReason, "prompt_parse_failed");
		assert.equal(reconcile.signals?.hasFailedTasks, false);
		assert.equal(reconcile.signals?.hasSegmentDrift, false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.completed" && event.taskId === taskId));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retry-clears-failed-classification fixture reconciles after success state", async () => {
	const projectRoot = await initGitRepo("spine-retry-incident-fixture-");
	try {
		const fixture = loadIncidentFixture("retry-clears-failed-classification.json");
		materializeIncidentFixture(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "needs_retry");
		assert.notEqual(result.exitReason, "prompt_parse_failed");
		assert.equal(result.signals?.failedTasks, 0);
		assert.equal(result.signals?.hasFailedTasks, false);
		assert.equal(result.batchId, "20260605T191325");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
