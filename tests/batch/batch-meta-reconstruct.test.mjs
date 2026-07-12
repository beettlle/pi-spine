/**
 * SP-620 — reconstruct batch-state from batch-meta on force-resume (FR-REL240-04 / #126).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	ensureForceResumeBatchState,
	reconstructBatchStateFromRuntime,
	wavePlansConflict,
} from "../../src/batch/batch-meta-reconstruct.mjs";
import { saveBatchMetaRuntimeArtifact } from "../../src/batch/batch-meta.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { validateMultiTaskResume } from "../../src/batch/resume-multi-validate.mjs";
import { loadSpineBatchState, spineBatchStatePath } from "../../src/batch/state.mjs";
import { ensureOrchBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260711T180000";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string[][]} wavePlan
 */
function writeMeta(projectRoot, batchId, wavePlan) {
	return saveBatchMetaRuntimeArtifact({
		projectRoot,
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		totalWaves: wavePlan.length,
		mode: "batch",
		tasksRoot: "spine-tasks",
		wavePlan,
	});
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string[][]} wavePlan
 */
function seedJournalProgress(projectRoot, batchId, wavePlan) {
	appendJournalEvent(projectRoot, batchId, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan,
		scope: wavePlan.flat(),
	});
	appendJournalEvent(projectRoot, batchId, "lane.provisioned", {
		laneNumber: 1,
		laneId: "lane-1",
	});
	appendJournalEvent(projectRoot, batchId, "lane.tasks_serialized", {
		laneNumber: 1,
		waveIndex: 0,
		taskIds: wavePlan[0] ?? [],
	});
	for (const taskId of wavePlan[0] ?? []) {
		appendJournalEvent(projectRoot, batchId, "task.started", {
			taskId,
			laneNumber: 1,
			laneId: "lane-1",
		});
	}
}

test("wavePlansConflict detects mismatched wave topology", () => {
	assert.equal(wavePlansConflict([["A", "B"], ["C"]], [["A", "B"], ["C"]]), false);
	assert.equal(wavePlansConflict([["A", "B"], ["C"]], [["A"], ["B", "C"]]), true);
	assert.equal(wavePlansConflict([["A"]], []), false);
});

test("reconstructBatchStateFromRuntime rebuilds from meta + journal when state missing", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-recon-");
	try {
		const wavePlan = [
			["TP-A", "TP-B"],
			["TP-C"],
		];
		writeMeta(projectRoot, BATCH_ID, wavePlan);
		seedJournalProgress(projectRoot, BATCH_ID, wavePlan);

		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);

		const result = reconstructBatchStateFromRuntime(projectRoot);
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.batchId, BATCH_ID);
		assert.equal(result.reconstructedFrom, "batch-meta+journal");
		assert.deepEqual(result.state.wavePlan, wavePlan);
		assert.equal(result.state.totalWaves, 2);
		assert.equal(result.state.baseBranch, "main");
		assert.equal(result.state.orchBranch, `orch/spine-${BATCH_ID}`);
		assert.equal(result.state.tasks.length, 3);
		assert.ok(result.state.tasks.every((task) => task.status === "running" || task.status === "pending"));
		assert.equal(result.state.phase, "failed");
		assert.equal(result.state.currentWaveIndex, 0);
		assert.equal(result.state.resilience?.resumeForced, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("ensureForceResumeBatchState restores corrupt live state from meta", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-corrupt-");
	try {
		const wavePlan = [["TP-X"]];
		writeMeta(projectRoot, BATCH_ID, wavePlan);
		seedJournalProgress(projectRoot, BATCH_ID, wavePlan);

		const statePath = spineBatchStatePath(projectRoot);
		fs.mkdirSync(path.dirname(statePath), { recursive: true });
		fs.writeFileSync(statePath, "{not-json", "utf-8");

		const ensured = ensureForceResumeBatchState(projectRoot, { force: true });
		assert.equal(ensured.ok, true, ensured.output ?? ensured.error);
		assert.equal(ensured.attempted, true);
		assert.equal(ensured.reason, "corrupt");
		assert.equal(ensured.batchId, BATCH_ID);

		const loaded = loadSpineBatchState(projectRoot);
		assert.ok(loaded.raw);
		assert.equal(loaded.raw.batchId, BATCH_ID);
		assert.deepEqual(loaded.raw.wavePlan, wavePlan);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconstructBatchStateFromRuntime fails closed when meta missing", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-missing-");
	try {
		const result = reconstructBatchStateFromRuntime(projectRoot);
		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_meta_missing");
		assert.match(result.output ?? "", /batch-meta\.json/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconstructBatchStateFromRuntime fails closed when multiple metas are ambiguous", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-batch-meta-ambig-"));
	try {
		writeMeta(projectRoot, "20260711T100000", [["TP-1"]]);
		writeMeta(projectRoot, "20260711T110000", [["TP-2"]]);

		const result = reconstructBatchStateFromRuntime(projectRoot);
		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_meta_ambiguous");
		assert.match(result.output ?? "", /multiple batch-meta/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("reconstructBatchStateFromRuntime fails closed on journal vs meta wave conflict", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-conflict-");
	try {
		writeMeta(projectRoot, BATCH_ID, [
			["TP-A", "TP-B"],
			["TP-C"],
		]);
		// Journal claims a different wave topology (wrong-wave limbo).
		seedJournalProgress(projectRoot, BATCH_ID, [["TP-A"], ["TP-B", "TP-C"]]);

		const result = reconstructBatchStateFromRuntime(projectRoot);
		assert.equal(result.ok, false);
		assert.equal(result.error, "batch_meta_wave_conflict");
		assert.match(result.output ?? "", /wrong wave|conflicts/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateMultiTaskResume --force reconstructs missing state then validates", async () => {
	const projectRoot = await initGitRepo("spine-batch-meta-resume-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const wavePlan = [["TP-R1"]];
		writeMeta(projectRoot, BATCH_ID, wavePlan);
		seedJournalProgress(projectRoot, BATCH_ID, wavePlan);

		ensureOrchBranch(projectRoot, "main", `orch/spine-${BATCH_ID}`);
		provisionLaneWorktree({
			projectRoot,
			batchId: BATCH_ID,
			laneNumber: 1,
			orchBranch: `orch/spine-${BATCH_ID}`,
		});

		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);

		const withoutForce = validateMultiTaskResume({ projectRoot, force: false });
		assert.equal(withoutForce.ok, false);
		assert.equal(withoutForce.error, "no_active_batch");

		const withForce = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(withForce.ok, true, withForce.output ?? withForce.error);
		assert.equal(withForce.batchId, BATCH_ID);
		assert.equal(withForce.phase, "failed");
		assert.ok(withForce.pendingTasks?.length >= 1);

		const loaded = loadSpineBatchState(projectRoot);
		assert.ok(loaded.raw);
		assert.deepEqual(loaded.raw.wavePlan, wavePlan);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
