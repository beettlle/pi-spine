import assert from "node:assert/strict";
import test from "node:test";
import { isPostMergeLimbo } from "../../src/batch/limbo-detect.mjs";

const BASE_STATE = {
	phase: "running",
	endedAt: null,
	tasks: [{ taskId: "SP-424", status: "succeeded" }],
	mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }],
};

const GIT_LIMBO = { orchBranchExists: true, orchMergedToBase: false };

test("isPostMergeLimbo is true when tasks and merges succeeded with open orch branch", () => {
	assert.equal(isPostMergeLimbo(BASE_STATE, GIT_LIMBO), true);
});

test("isPostMergeLimbo rejects non-running or ended batches", () => {
	assert.equal(isPostMergeLimbo({ ...BASE_STATE, phase: "completed" }, GIT_LIMBO), false);
	assert.equal(isPostMergeLimbo({ ...BASE_STATE, endedAt: Date.now() }, GIT_LIMBO), false);
	assert.equal(isPostMergeLimbo({ ...BASE_STATE, phase: "merging" }, GIT_LIMBO), false);
});

test("isPostMergeLimbo rejects empty or partial task/merge state", () => {
	assert.equal(isPostMergeLimbo({ ...BASE_STATE, tasks: [] }, GIT_LIMBO), false);
	assert.equal(
		isPostMergeLimbo(
			{ ...BASE_STATE, tasks: [{ taskId: "SP-424", status: "failed" }] },
			GIT_LIMBO,
		),
		false,
	);
	assert.equal(isPostMergeLimbo({ ...BASE_STATE, mergeResults: [] }, GIT_LIMBO), false);
	assert.equal(
		isPostMergeLimbo(
			{ ...BASE_STATE, mergeResults: [{ waveIndex: 0, status: "failed" }] },
			GIT_LIMBO,
		),
		false,
	);
});

test("isPostMergeLimbo respects git orch branch signals", () => {
	assert.equal(isPostMergeLimbo(BASE_STATE, { orchMergedToBase: true }), false);
	assert.equal(isPostMergeLimbo(BASE_STATE, { orchBranchExists: false }), false);
	assert.equal(isPostMergeLimbo(BASE_STATE, {}), true);
});

test("isPostMergeLimbo rejects null or non-object state", () => {
	assert.equal(isPostMergeLimbo(null, GIT_LIMBO), false);
	assert.equal(isPostMergeLimbo(undefined, GIT_LIMBO), false);
	assert.equal(isPostMergeLimbo("not-state", GIT_LIMBO), false);
});
