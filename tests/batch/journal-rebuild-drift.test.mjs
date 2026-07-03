/**
 * SP-445 — doneInLane drift detection (GitHub #100).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { classifyTaskDoneSemantics } from "../../src/batch/diagnosis-task-done.mjs";
import { detectBatchStateDrift } from "../../src/batch/journal-rebuild.mjs";

test("detectBatchStateDrift flags running cache when reconcile sees doneInLane without journal terminal", () => {
	const cached = {
		tasks: [{ taskId: "SP-434", status: "running", laneNumber: 1 }],
	};
	const rebuilt = {
		tasks: [{ taskId: "SP-434", status: "running" }],
	};
	const events = [{ type: "task.started", taskId: "SP-434", ts: 1 }];
	const classified = [
		classifyTaskDoneSemantics(
			{ taskId: "SP-434", status: "running", laneNumber: 1, doneFileFound: false },
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

	const drift = detectBatchStateDrift(cached, rebuilt, events, classified);
	assert.equal(drift.drifted, true);
	assert.equal(drift.entries[0]?.field, "doneInLane");
	assert.equal(drift.entries[0]?.taskId, "SP-434");
});
