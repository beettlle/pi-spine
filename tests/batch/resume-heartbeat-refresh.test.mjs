/**
 * SP-448 — lane heartbeat refresh on resume (GitHub #100).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	createInitialBatchState,
	recordBatchEnginePid,
	refreshLaneHeartbeatsOnResume,
} from "../../src/batch/state.mjs";

test("refreshLaneHeartbeatsOnResume aligns lane heartbeats to engineStartedAt", () => {
	const state = createInitialBatchState({
		batchId: "20260702T153101",
		baseBranch: "main",
		orchBranch: "orch/spine-20260702T153101",
		wavePlan: [["SP-434"]],
		tasks: [{ taskId: "SP-434", laneNumber: 1, status: "pending" }],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				taskIds: ["SP-434"],
				lastHeartbeatAt: Date.now() - 3_600_000,
			},
		],
	});

	recordBatchEnginePid(state, process.pid);
	refreshLaneHeartbeatsOnResume(state);

	assert.equal(state.lanes[0].lastHeartbeatAt, state.resilience.engineStartedAt);
});
