import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runSpineState } from "../../bin/spine-state.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
	validateBatchState,
} from "../../src/batch/state.mjs";

test("validateBatchState accepts healthy schema v1 state", () => {
	const state = createInitialBatchState({
		batchId: "20260601T120000",
		baseBranch: "main",
		orchBranch: "orch/spine-20260601T120000",
		wavePlan: [["TP-014"]],
		tasks: [
			{
				taskId: "TP-014",
				laneNumber: 1,
				status: "pending",
				taskFolder: "taskplane-tasks/TP-014-orchestration-journal",
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
				worktreePath: ".worktrees/spine-20260601T120000/lane-1",
				branch: "task/spine-lane-1-20260601T120000",
				taskIds: ["TP-014"],
				lastHeartbeatAt: null,
			},
		],
	});

	const result = validateBatchState(state);
	assert.equal(result.ok, true);
	assert.equal(state.segments.length, 1);
	assert.equal(state.segments[0].taskId, "TP-014");
});

test("validateBatchState rejects counter drift", () => {
	const state = createInitialBatchState({
		batchId: "20260601T120000",
		baseBranch: "main",
		orchBranch: "orch/spine-20260601T120000",
		wavePlan: [["TP-014"]],
		tasks: [
			{
				taskId: "TP-014",
				laneNumber: 1,
				status: "pending",
				taskFolder: "taskplane-tasks/TP-014-orchestration-journal",
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
				worktreePath: ".worktrees/spine-20260601T120000/lane-1",
				branch: "task/spine-lane-1-20260601T120000",
				taskIds: ["TP-014"],
				lastHeartbeatAt: null,
			},
		],
	});
	state.succeededTasks = 5;

	const result = validateBatchState(state);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => error.includes("exceeds totalTasks")));
});

test("runSpineState validate passes on archived batch-state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-state-"));
	const batchId = "20260601T140000";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["TP-014"]],
			tasks: [
				{
					taskId: "TP-014",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "taskplane-tasks/TP-014-orchestration-journal",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: "done",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: `.worktrees/spine-${batchId}/lane-1`,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: ["TP-014"],
					lastHeartbeatAt: Date.now(),
				},
			],
		});
		state.phase = "completed";
		state.succeededTasks = 1;

		const archivePath = path.join(root, ".spine", "runtime", batchId, "archive", "batch-state.json");
		fs.mkdirSync(path.dirname(archivePath), { recursive: true });
		fs.writeFileSync(archivePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");

		const result = runSpineState({
			projectRoot: root,
			args: ["validate", "--batch", batchId],
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /Batch state valid/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineState validate fails loud on corrupt active state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-state-bad-"));
	try {
		saveSpineBatchState(root, { batchId: "bad", phase: "running" });
		const result = runSpineState({ projectRoot: root, args: ["validate"] });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /validation failed/i);
		assert.match(result.output, /spine state validate --diagnose/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
