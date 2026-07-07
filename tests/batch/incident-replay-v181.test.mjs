/**
 * SP-514 — v1.8.1 incident replay regression (#170, #184 / FR-STA-06).
 *
 * Fixtures capture minimal batch-state + journal tails at the drift wedge.
 * Post-reconcile expectations (after SP-512 / SP-513):
 * - Batch A: state_drift heals to succeeded when lane .DONE + review APPROVE on disk.
 * - Batch B: pause → SIGTERM → resume does not surface engine_orphaned when contract verified.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { reconcilePausedResumeDoneInLane } from "../../src/batch/attached-runner.mjs";
import { journalPath } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { loadSpineBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES_DIR = path.join(process.cwd(), "tests/fixtures/incidents");

/**
 * @param {string} filename
 */
function loadIncidentFixture(filename) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 * @returns {string}
 */
function materializeIncidentFixture(projectRoot, fixture) {
	const batchId = fixture.meta.batchId;
	saveSpineBatchState(projectRoot, fixture.batchState);
	const journalFile = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}
	return batchId;
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 */
function provisionDoneInLaneWorktree(projectRoot, fixture) {
	const batchId = fixture.meta.batchId;
	const task = fixture.batchState.tasks[0];
	const taskFolderRel = task.taskFolder;
	const orchBranch = fixture.batchState.orchBranch;

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });

	const hostFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(hostFolder, { recursive: true });
	fs.writeFileSync(path.join(hostFolder, "PROMPT.md"), `# ${task.taskId}\n`, "utf-8");

	const laneFolder = path.join(laneWorktreePath(projectRoot, batchId, 1), taskFolderRel);
	fs.mkdirSync(laneFolder, { recursive: true });
	fs.writeFileSync(path.join(laneFolder, "PROMPT.md"), `# ${task.taskId}\n`, "utf-8");
	fs.writeFileSync(path.join(laneFolder, ".DONE"), "Completed: 2026-07-07\n", "utf-8");
}

test("v181 batch 20260705T210857 (#170): reconcile heals state_drift to terminal success", async () => {
	const fixture = loadIncidentFixture("v181-batch-20260705T210857.json");
	const projectRoot = await initGitRepo("spine-v181-incident-170-");
	try {
		materializeIncidentFixture(projectRoot, fixture);
		provisionDoneInLaneWorktree(projectRoot, fixture);

		const before = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(before.diagnosis, "state_drift", before.headline ?? before.diagnosis);
		assert.notEqual(
			before.suggestedCommand,
			`spine batch pause && spine batch retry ${fixture.batchState.tasks[0].taskId}`,
		);

		const saved = loadSpineBatchState(projectRoot).raw;
		const task = saved?.tasks?.find((entry) => entry.taskId === "SP-440");
		assert.equal(task?.status, fixture.meta.expectedReconcile.taskStatus);
		assert.equal(task?.doneFileFound, fixture.meta.expectedReconcile.doneFileFound);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("v181 batch 20260706T052912 (#184): pause SIGTERM resume does not surface engine_orphaned", async () => {
	const fixture = loadIncidentFixture("v181-batch-20260706T052912.json");
	const projectRoot = await initGitRepo("spine-v181-incident-184-");
	try {
		materializeIncidentFixture(projectRoot, fixture);
		provisionDoneInLaneWorktree(projectRoot, fixture);

		const loaded = loadSpineBatchState(projectRoot);
		const paused = reconcilePausedResumeDoneInLane({
			projectRoot,
			state: loaded.raw,
			batchId: fixture.meta.batchId,
		});
		assert.equal(paused.reconciled, true);
		assert.deepEqual(paused.taskIds, ["SP-497"]);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, fixture.meta.expectedReconcile.diagnosisNot, result.headline ?? result.diagnosis);

		const saved = loadSpineBatchState(projectRoot).raw;
		const task = saved?.tasks?.find((entry) => entry.taskId === "SP-497");
		assert.equal(task?.status, fixture.meta.expectedReconcile.taskStatus);
		assert.equal(task?.doneFileFound, fixture.meta.expectedReconcile.doneFileFound);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
