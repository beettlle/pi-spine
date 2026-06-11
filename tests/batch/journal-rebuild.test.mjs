import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	detectBatchStateDrift,
	readJournalTimeline,
	rebuildBatchStateFromJournal,
} from "../../src/batch/journal-rebuild.mjs";
import { journalPath } from "../../src/batch/journal.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const INCIDENT_FIXTURES = path.join(process.cwd(), "tests/fixtures/incidents");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(INCIDENT_FIXTURES, name), "utf-8"));
}

function materializeFixture(projectRoot, fixture) {
	const batchId = fixture.meta?.batchId ?? fixture.batchState.batchId;
	saveSpineBatchState(projectRoot, fixture.batchState);
	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}
	return batchId;
}

test("readJournalTimeline filters task and batch lifecycle events", () => {
	const events = [
		{ type: "lane.heartbeat", taskId: "TP-1" },
		{ type: "task.started", taskId: "TP-1" },
		{ type: "batch.completed", batchId: "b1" },
	];
	const timeline = readJournalTimeline(events);
	assert.equal(timeline.length, 2);
	assert.equal(timeline[0].type, "task.started");
});

test("rebuildBatchStateFromJournal applies task.completed over stale failed cache", () => {
	const tasks = [
		{
			taskId: "SP-118",
			laneNumber: 1,
			status: "failed",
			taskFolder: "spine-tasks/SP-118",
			exitReason: "prompt_parse_failed",
			classification: "prompt_parse_failed",
		},
	];
	const state = createInitialBatchState({
		batchId: "20260605T191325",
		baseBranch: "main",
		orchBranch: "orch/spine-test",
		wavePlan: [["SP-118"]],
		tasks,
		lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-118"] }],
	});
	const events = [
		{
			type: "task.retry_requested",
			taskId: "SP-118",
			timestamp: "2026-06-05T19:20:00.000Z",
			payload: {},
		},
		{
			type: "task.started",
			taskId: "SP-118",
			timestamp: "2026-06-05T19:21:00.000Z",
			payload: {},
		},
		{
			type: "task.completed",
			taskId: "SP-118",
			timestamp: "2026-06-05T19:25:00.000Z",
			payload: { exitReason: "done" },
		},
	];
	const rebuilt = rebuildBatchStateFromJournal(state, events);
	const task = rebuilt.tasks.find((entry) => entry.taskId === "SP-118");
	assert.equal(task.status, "succeeded");
	assert.equal(task.exitReason, "done");
	assert.equal(rebuilt.succeededTasks, 1);
	assert.equal(rebuilt.failedTasks, 0);
});

test("detectBatchStateDrift flags journal completed vs cache failed", () => {
	const tasks = [{ taskId: "SP-1", laneNumber: 1, status: "failed", exitReason: "err", taskFolder: "spine-tasks/SP-1" }];
	const cached = createInitialBatchState({
		batchId: "b1",
		baseBranch: "main",
		orchBranch: "orch/spine-test",
		wavePlan: [["SP-1"]],
		tasks,
		lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-1"] }],
	});
	cached.failedTasks = 1;
	const rebuilt = structuredClone(cached);
	rebuilt.tasks[0].status = "succeeded";
	rebuilt.tasks[0].exitReason = "done";
	rebuilt.succeededTasks = 1;
	rebuilt.failedTasks = 0;
	const events = [
		{
			type: "task.completed",
			taskId: "SP-1",
			timestamp: "2026-06-05T19:25:00.000Z",
			payload: { exitReason: "done" },
		},
	];
	const drift = detectBatchStateDrift(cached, rebuilt, events);
	assert.equal(drift.drifted, true);
	assert.ok(drift.entries.some((entry) => entry.field === "status"));
});

test("detectBatchStateDrift ignores incomplete journal when cache failed", () => {
	const tasks = [{ taskId: "SP-1", laneNumber: 1, status: "failed", exitReason: "err", taskFolder: "spine-tasks/SP-1" }];
	const cached = createInitialBatchState({
		batchId: "b1",
		baseBranch: "main",
		orchBranch: "orch/spine-test",
		wavePlan: [["SP-1"]],
		tasks,
		lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-1"] }],
	});
	const rebuilt = structuredClone(cached);
	rebuilt.tasks[0].status = "running";
	const events = [
		{
			type: "task.started",
			taskId: "SP-1",
			timestamp: "2026-06-05T19:20:00.000Z",
			payload: {},
		},
	];
	const drift = detectBatchStateDrift(cached, rebuilt, events);
	assert.equal(drift.drifted, false);
});

test("incident orphan-running fixture: journal timeline is readable", async () => {
	const projectRoot = await initGitRepo("spine-journal-rebuild-orphan-");
	try {
		const fixture = loadFixture("orphan-running-resume.json");
		const batchId = materializeFixture(projectRoot, fixture);
		const { readJournalEvents } = await import("../../src/batch/journal.mjs");
		const events = readJournalEvents(projectRoot, batchId);
		const timeline = readJournalTimeline(events);
		assert.ok(timeline.some((event) => event.type === "task.started"));
		const rebuilt = rebuildBatchStateFromJournal(fixture.batchState, timeline);
		const task = rebuilt.tasks.find((entry) => entry.taskId === "SAT-040");
		assert.equal(task.status, "running");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
