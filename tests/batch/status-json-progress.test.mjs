import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { runSpineStatus } from "../../bin/spine-status.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	computeStatusProgress,
	formatStatusJson,
	STATUS_JSON_PROGRESS_FIELD_NAMES,
} from "../../src/batch/status-json.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("computeStatusProgress derives wave and task counts from batch raw", () => {
	const progress = computeStatusProgress({
		batchRaw: {
			succeededTasks: 2,
			totalTasks: 3,
			currentWaveIndex: 1,
			totalWaves: 2,
			wavePlan: [["TP-001"], ["TP-002", "TP-003"]],
		},
		succeededTasks: 2,
		totalTasks: 3,
		pendingTasks: 1,
	});

	assert.deepEqual(progress, {
		succeededTasks: 2,
		pendingTasks: 1,
		totalTasks: 3,
		currentWaveIndex: 1,
		waveCount: 2,
	});
});

test("computeStatusProgress returns null without batch raw", () => {
	assert.equal(computeStatusProgress({ batchRaw: null, pendingTasks: 0 }), null);
});

test("formatStatusJson includes documented progress field names", () => {
	const output = formatStatusJson({
		diagnosis: "running",
		batchId: "20260620T120000",
		phase: "running",
		headline: "Batch is running",
		suggestedCommand: "spine status --diagnose",
		succeededTasks: 2,
		pendingTasks: 1,
		totalTasks: 3,
		currentWaveIndex: 1,
		waveCount: 2,
	});
	const parsed = JSON.parse(output);

	for (const field of STATUS_JSON_PROGRESS_FIELD_NAMES) {
		assert.ok(field in parsed, `expected ${field} in status JSON`);
	}
	assert.equal(parsed.succeededTasks, 2);
	assert.equal(parsed.pendingTasks, 1);
	assert.equal(parsed.totalTasks, 3);
	assert.equal(parsed.currentWaveIndex, 1);
	assert.equal(parsed.waveCount, 2);
});

test("spine status --json includes task and wave progress for active batch", async () => {
	const projectRoot = await initGitRepo("spine-status-json-progress-");
	try {
		const fixture = loadFixture("lane-throughput-multi-lane.json");
		writeSpineBatchState(projectRoot, fixture);

		const { output } = runSpineStatus({ projectRoot, json: true });
		const parsed = JSON.parse(output);

		assert.equal(parsed.batchId, fixture.batchId);
		assert.equal(parsed.phase, "running");
		assert.equal(parsed.succeededTasks, 2);
		assert.equal(parsed.totalTasks, 3);
		assert.equal(parsed.currentWaveIndex, 1);
		assert.equal(parsed.waveCount, 2);
		assert.equal(parsed.pendingTasks, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --json omits progress counts when no batch is active", async () => {
	const projectRoot = await initGitRepo("spine-status-json-idle-");
	try {
		const { output } = runSpineStatus({ projectRoot, json: true });
		const parsed = JSON.parse(output);

		assert.equal(parsed.batchId, null);
		for (const field of STATUS_JSON_PROGRESS_FIELD_NAMES) {
			assert.equal(parsed[field], undefined, `expected ${field} absent when idle`);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch exposes progress fields for spine watch consumers", async () => {
	const projectRoot = await initGitRepo("spine-status-json-reconcile-");
	try {
		const fixture = loadFixture("lane-throughput-multi-lane.json");
		writeSpineBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.succeededTasks, 2);
		assert.equal(result.totalTasks, 3);
		assert.equal(result.pendingTasks, 1);
		assert.equal(result.currentWaveIndex, 1);
		assert.equal(result.waveCount, 2);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
