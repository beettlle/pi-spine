import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	classifyTasksForOrphanDetect,
	computePendingTasks,
	detectPostMergeLimboFromResumeSignals,
	findResumableWave,
	isTaskResumable,
} from "../../src/batch/resume-validation.mjs";

const LEAF_PATH = path.join(process.cwd(), "src/batch/resume-validation.mjs");

test("resume-validation leaf does not import reconcile.mjs", () => {
	const source = fs.readFileSync(LEAF_PATH, "utf8");
	assert.doesNotMatch(source, /from\s+["']\.\/reconcile\.mjs["']/);
	assert.doesNotMatch(source, /from\s+["']\.\.\/.*reconcile\.mjs["']/);
});

test("isTaskResumable accepts pending, running, and resumable segments", () => {
	const state = {
		segments: [{ taskId: "SP-468", status: "running" }],
	};
	assert.equal(isTaskResumable(state, { taskId: "SP-468", status: "succeeded" }), true);
	assert.equal(isTaskResumable(state, { taskId: "SP-469", status: "pending" }), true);
	assert.equal(isTaskResumable(state, { taskId: "SP-470", status: "failed" }), false);
});

test("computePendingTasks filters to resumable tasks only", () => {
	const state = {
		tasks: [
			{ taskId: "SP-468", status: "succeeded" },
			{ taskId: "SP-469", status: "pending" },
		],
		segments: [],
	};
	const pending = computePendingTasks(state);
	assert.equal(pending.length, 1);
	assert.equal(pending[0].taskId, "SP-469");
});

test("findResumableWave skips succeeded merged waves when later wave has pending tasks", () => {
	const state = {
		wavePlan: [["SP-399", "SP-400"], ["SP-401"]],
		currentWaveIndex: 0,
		tasks: [
			{ taskId: "SP-399", status: "succeeded" },
			{ taskId: "SP-400", status: "succeeded" },
			{ taskId: "SP-401", status: "pending" },
		],
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }],
	};
	assert.equal(findResumableWave(state, [{ taskId: "SP-401" }]), 1);
});

test("detectPostMergeLimboFromResumeSignals uses state mergeResults without journal", () => {
	const state = {
		phase: "running",
		endedAt: null,
		batchId: "20260705T210857",
		tasks: [{ taskId: "SP-468", status: "succeeded" }],
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }],
	};
	const git = { orchBranchExists: true, orchMergedToBase: false };
	assert.equal(
		detectPostMergeLimboFromResumeSignals({ state, git, journalEvents: [], gateRecordExists: false }),
		true,
	);
});

test("detectPostMergeLimboFromResumeSignals detects journal-only limbo when mergeResults empty", () => {
	const state = {
		phase: "running",
		endedAt: null,
		batchId: "20260630T212050",
		totalWaves: 1,
		tasks: [{ taskId: "SP-468", status: "succeeded" }],
		mergeResults: [],
	};
	const git = { orchBranchExists: true, orchMergedToBase: false };
	const journalEvents = [{ type: "batch.merge_completed", payload: { waveIndex: 0 } }];
	assert.equal(
		detectPostMergeLimboFromResumeSignals({ state, git, journalEvents, gateRecordExists: false }),
		true,
	);
});

test("detectPostMergeLimboFromResumeSignals rejects when gate already exists", () => {
	const state = {
		phase: "running",
		endedAt: null,
		batchId: "20260705T210857",
		totalWaves: 1,
		tasks: [{ taskId: "SP-468", status: "succeeded" }],
		mergeResults: [],
	};
	const git = { orchBranchExists: true, orchMergedToBase: false };
	const journalEvents = [{ type: "batch.merge_completed", payload: { waveIndex: 0 } }];
	assert.equal(
		detectPostMergeLimboFromResumeSignals({ state, git, journalEvents, gateRecordExists: true }),
		false,
	);
});

test("classifyTasksForOrphanDetect maps running status to running classification", () => {
	const classified = classifyTasksForOrphanDetect([
		{ taskId: "SP-468", laneNumber: 1, status: "running" },
		{ taskId: "SP-469", laneNumber: 2, status: "pending" },
	]);
	assert.deepEqual(classified, [
		{ taskId: "SP-468", laneNumber: 1, classification: "running" },
		{ taskId: "SP-469", laneNumber: 2, classification: "pending" },
	]);
});
