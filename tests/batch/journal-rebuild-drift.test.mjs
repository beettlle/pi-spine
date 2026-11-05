/**
 * SP-445 — doneInLane drift detection (GitHub #100).
 * SP-850 — post-`.DONE` review/contract pipeline is not state drift (#356, #371).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { classifyTaskDoneSemantics } from "../../src/batch/diagnosis-task-done.mjs";
import { detectBatchStateDrift } from "../../src/batch/journal-rebuild.mjs";
import { journalHasOpenPostDonePipeline } from "../../src/batch/journal-rebuild-drift.mjs";

const TASK = "SP-434";

/**
 * Build a cached/rebuilt/classified scenario where the lane shows `.DONE` while
 * the cache still says pending/running (the SP-850 false-positive window).
 *
 * @param {string} [cachedStatus]
 */
function buildDoneInLaneScenario(cachedStatus = "running") {
	const cached = { tasks: [{ taskId: TASK, status: cachedStatus, laneNumber: 1 }] };
	const rebuilt = { tasks: [{ taskId: TASK, status: cachedStatus }] };
	const classified = [
		classifyTaskDoneSemantics(
			{ taskId: TASK, status: cachedStatus, laneNumber: 1, doneFileFound: false },
			{
				tasksRoot: "/tmp/tasks",
				projectRoot: "/tmp",
				batchId: "20260702T153101",
				lanes: [{ laneNumber: 1, worktreePath: "/tmp/lane-1" }],
			},
		),
	];
	classified[0].doneInLane = true;
	classified[0].classification = "terminal-success";
	return { cached, rebuilt, classified };
}

test("detectBatchStateDrift flags running cache when reconcile sees doneInLane without journal terminal", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	const events = [{ type: "task.started", taskId: TASK, ts: 1 }];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, true);
	assert.equal(drift.entries[0]?.field, "doneInLane");
	assert.equal(drift.entries[0]?.taskId, TASK);
});

test("detectBatchStateDrift skips doneInLane drift while a code review is open (SP-850)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.started", taskId: TASK, payload: { reviewType: "code" }, ts: 2 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, false);
	assert.equal(drift.entries.length, 0);
});

test("detectBatchStateDrift skips doneInLane drift while a final review is open (SP-850)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.completed", taskId: TASK, payload: { reviewType: "code", verdict: "APPROVE" }, ts: 2 },
		{ type: "review.started", taskId: TASK, payload: { reviewType: "final" }, ts: 3 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, false);
	assert.equal(drift.entries.length, 0);
});

test("detectBatchStateDrift skips doneInLane drift while contract verification is in flight (SP-850)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	// Contract verify has no "started" marker — it only journals contract.verified /
	// contract.failed when it finishes, so the in-flight window is a resolved review
	// with no terminal lifecycle (the #371 window).
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.completed", taskId: TASK, payload: { reviewType: "code", verdict: "APPROVE" }, ts: 2 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, false);
	assert.equal(drift.entries.length, 0);
});

test("detectBatchStateDrift skips doneInLane drift after contract.verified before task.completed (SP-850)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.completed", taskId: TASK, payload: { reviewType: "code", verdict: "APPROVE" }, ts: 2 },
		{ type: "contract.verified", taskId: TASK, payload: { ok: true }, ts: 3 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, false);
	assert.equal(drift.entries.length, 0);
});

test("detectBatchStateDrift still flags doneInLane drift when pipeline events belong to another task (SP-850)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.started", taskId: "SP-999", payload: { reviewType: "code" }, ts: 2 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, true);
	assert.equal(drift.entries[0]?.field, "doneInLane");
});

test("detectBatchStateDrift still flags status drift when the journal is terminal and the cache is stale (SP-850)", () => {
	const { cached, classified } = buildDoneInLaneScenario("pending");
	const rebuilt = { tasks: [{ taskId: TASK, status: "succeeded" }] };
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "review.completed", taskId: TASK, payload: { reviewType: "code", verdict: "APPROVE" }, ts: 2 },
		{ type: "contract.verified", taskId: TASK, payload: { ok: true }, ts: 3 },
		{ type: "task.completed", taskId: TASK, ts: 4 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, true);
	assert.equal(drift.entries[0]?.field, "status");
	assert.equal(drift.entries[0]?.taskId, TASK);
});

test("detectBatchStateDrift still flags doneInLane drift when terminal artifacts are complete (SP-850 / #170 heal)", () => {
	const { cached, rebuilt, classified } = buildDoneInLaneScenario();
	// v181 incident shape: worker `.DONE` + lane completed + approved verdict, but
	// cache stuck — the entry must survive so reconcileBatchStateDrift heals it.
	const events = [
		{ type: "task.started", taskId: TASK, ts: 1 },
		{ type: "lane.completed", taskId: TASK, ts: 2 },
		{ type: "review.completed", taskId: TASK, payload: { reviewType: "code", verdict: "APPROVE" }, ts: 3 },
		{ type: "task.verdict_recorded", taskId: TASK, payload: { verdict: "APPROVE" }, ts: 4 },
	];

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, true);
	assert.equal(drift.entries[0]?.field, "doneInLane");
});

test("journalHasOpenPostDonePipeline detects open review for the task (SP-850)", () => {
	const events = [
		{ type: "task.started", taskId: TASK },
		{ type: "review.started", taskId: TASK, payload: { reviewType: "final" } },
	];
	assert.equal(journalHasOpenPostDonePipeline(events, TASK), true);
});

test("journalHasOpenPostDonePipeline ignores other tasks and non-pipeline events (SP-850)", () => {
	const events = [
		{ type: "review.started", taskId: "SP-999", payload: { reviewType: "code" } },
		{ type: "lane.completed", taskId: TASK },
		{ type: "gate.approved", taskId: TASK },
	];
	assert.equal(journalHasOpenPostDonePipeline(events, TASK), false);
	assert.equal(journalHasOpenPostDonePipeline([], TASK), false);
	assert.equal(journalHasOpenPostDonePipeline(null, TASK), false);
});
