import assert from "node:assert/strict";
import test from "node:test";
import {
	findFirstWaveNeedingMerge,
	hasPendingWaveMerge,
	recordWaveMergeResult,
	succeededWaveMergeIndices,
} from "../../src/batch/merge/wave-merge-state.mjs";
import { findResumableWave } from "../../src/batch/resume-multi-validate.mjs";

test("hasPendingWaveMerge is true when an intermediate wave lacks mergeResults", () => {
	const state = {
		wavePlan: [["TP-1"], ["TP-2"], ["TP-3"], ["SP-303", "SP-304"], ["SP-305"]],
		tasks: [
			{ taskId: "TP-1", status: "succeeded" },
			{ taskId: "TP-2", status: "succeeded" },
			{ taskId: "TP-3", status: "succeeded" },
			{ taskId: "SP-303", status: "succeeded" },
			{ taskId: "SP-304", status: "succeeded" },
			{ taskId: "SP-305", status: "pending" },
		],
		mergeResults: [
			{ waveIndex: 0, status: "succeeded" },
			{ waveIndex: 1, status: "succeeded" },
			{ waveIndex: 2, status: "succeeded" },
		],
		currentWaveIndex: 3,
	};

	assert.equal(hasPendingWaveMerge(state), true);
	assert.equal(findFirstWaveNeedingMerge(state), 3);
	assert.equal(findResumableWave(state, []), 3);
});

test("hasPendingWaveMerge is false when every terminal wave is recorded", () => {
	const state = {
		wavePlan: [["TP-1"], ["TP-2"]],
		tasks: [
			{ taskId: "TP-1", status: "succeeded" },
			{ taskId: "TP-2", status: "succeeded" },
		],
		mergeResults: [
			{ waveIndex: 0, status: "succeeded" },
			{ waveIndex: 1, status: "succeeded" },
		],
	};

	assert.equal(hasPendingWaveMerge(state), false);
	assert.deepEqual([...succeededWaveMergeIndices(state)], [0, 1]);
});

test("recordWaveMergeResult records forceMerged flag and updates existing wave row", () => {
	const state = {
		resilience: { forceMergedWaves: [3] },
		mergeResults: [{ waveIndex: 3, status: "failed", failedLane: 1 }],
	};

	const row = recordWaveMergeResult({
		state,
		waveIndex: 3,
		status: "succeeded",
		mergeCommit: "abc123",
	});

	assert.equal(row.forceMerged, true);
	assert.equal(state.mergeResults.length, 1);
	assert.equal(state.mergeResults[0].status, "succeeded");
	assert.equal(state.mergeResults[0].mergeCommit, "abc123");
});
