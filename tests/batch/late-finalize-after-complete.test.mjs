import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { finalizeBatchForIntegrate } from "../../src/batch/post-merge-limbo.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

/**
 * Archive a batch the way `spine batch complete` does (#293 / SP-790): copy the
 * state into `.spine/runtime/<batchId>/archive/batch-state.json` and remove the
 * active `.spine/batch-state.json`.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {Record<string, any>} state
 */
function archiveBatch(projectRoot, batchId, state) {
	const archiveDir = path.join(projectRoot, ".spine", "runtime", batchId, "archive");
	fs.mkdirSync(archiveDir, { recursive: true });
	fs.writeFileSync(
		path.join(archiveDir, "batch-state.json"),
		JSON.stringify(state, null, 2),
		"utf-8",
	);
	fs.rmSync(path.join(projectRoot, ".spine", "batch-state.json"));
}

test("late finalizeBatchForIntegrate after archive does not resurrect batch-state (#293)", async () => {
	const projectRoot = await initGitRepo("spine-late-finalize-");
	const batchId = "20260927T002714";
	const taskId = "SP-774";
	const orchBranch = `orch/spine-${batchId}`;

	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: path.join("spine-tasks", `${taskId}-late`),
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: [taskId],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "cafebabe" }];
		saveSpineBatchState(projectRoot, state);

		// The operator runs gate approve → integrate → spine batch complete while
		// the engine is still collecting extended evidence inside
		// finalizeBatchForIntegrate. `batch complete` archives and removes the
		// active state; the engine's late finalize must not recreate it.
		archiveBatch(projectRoot, batchId, { ...state, phase: "completed" });
		assert.equal(loadSpineBatchState(projectRoot).raw, null);

		const result = finalizeBatchForIntegrate({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw ?? state,
			batchId,
			orchBranch,
			resumed: false,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.lateFinalizeSkipped, "archived");

		// Core #293 assertion: the active state file stays gone.
		assert.equal(loadSpineBatchState(projectRoot).raw, null, "late finalize recreated .spine/batch-state.json");

		const events = readJournalEvents(projectRoot, batchId);
		const skipped = events.filter((event) => event.type === "batch.late_finalize_skipped");
		assert.equal(skipped.length, 1, "batch.late_finalize_skipped should be journaled exactly once");
		assert.equal(skipped[0]?.payload?.reason, "archived");
		assert.equal(skipped[0]?.batchId, batchId);

		assert.equal(
			events.some((event) => event.type === "batch.land_loop_finalized"),
			false,
			"land_loop_finalized must not be journaled after archive",
		);

		// Defense in depth: the pre-gate save attempt is guard-rejected visibly.
		const rejected = events.filter((event) => event.type === "batch.state_write_rejected");
		assert.ok(
			rejected.some(
				(event) => event.payload?.reason === "archived_batch_resurrection",
			),
			"pre-gate save should be journaled as batch.state_write_rejected",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("late finalize still persists when no archive raced the gate open (control)", async () => {
	const projectRoot = await initGitRepo("spine-late-finalize-control-");
	const batchId = "20260927T002715";
	const taskId = "SP-775";
	const orchBranch = `orch/spine-${batchId}`;

	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "succeeded",
					taskFolder: path.join("spine-tasks", `${taskId}-ctrl`),
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: [taskId],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "cafed00d" }];
		saveSpineBatchState(projectRoot, state);

		const result = finalizeBatchForIntegrate({
			projectRoot,
			state: loadSpineBatchState(projectRoot).raw ?? state,
			batchId,
			orchBranch,
			resumed: false,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.lateFinalizeSkipped, undefined);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));
		assert.equal(
			events.some((event) => event.type === "batch.late_finalize_skipped"),
			false,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
