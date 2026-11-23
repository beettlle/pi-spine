import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { archiveBatchStatePath, completeBatch } from "../../src/batch/lifecycle.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
test("first complete after integrate reports pending during the finalize window, then succeeds once finalize lands (#379)", async () => {
	const projectRoot = await initGitRepo("spine-complete-finalize-race-");
	const batchId = "20261122T234441";
	const orchBranch = `orch/spine-${batchId}`;

	try {
		// Real gate approve + integrate so the journal carries the production
		// finalize-window signals (gate.approved, integrate.completed).
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
		execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		// #379 finalize window: the engine's PID-clear save (post-merge-limbo.mjs
		// finalizeBatchForIntegrate, #198) leaves phase running with no recorded
		// PID while the terminal-phase write is still pending.
		const finalizeWindowState = {
			batchId,
			phase: "running",
			baseBranch: "main",
			orchBranch,
			startedAt: Date.now() - 60_000,
			failedTasks: 0,
			succeededTasks: 1,
			totalTasks: 1,
			mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "cafef00d" }],
			tasks: [
				{
					taskId: "SP-886",
					status: "succeeded",
					taskFolder: path.join("spine-tasks", "SP-886-batch-complete-land-race"),
					doneFileFound: true,
				},
			],
		};
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			`${JSON.stringify(finalizeWindowState, null, 2)}\n`,
			"utf-8",
		);
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId, batchState: finalizeWindowState, config });
		approveIntegrateGate({ projectRoot, batchId });
		const integrate = integrateOrchToBase({ projectRoot, batchId });
		assert.equal(integrate.ok, true, integrate.error ?? "integrate failed");

		const eventsBefore = readJournalEvents(projectRoot, batchId).map((event) => event.type);
		assert.ok(eventsBefore.includes("gate.approved"), "setup: gate.approved must be journaled");
		assert.ok(eventsBefore.includes("integrate.completed"), "setup: integrate.completed must be journaled");

		// First complete races the open finalize window: pending wait, not a
		// batch_state_changed_during_terminal_write hard failure, and nothing is
		// archived.
		const first = completeBatch({ projectRoot, batchId });
		assert.equal(first.ok, false);
		assert.equal(first.exitCode, 1);
		assert.equal(first.pending, true);
		assert.equal(first.error, "engine_finishing_land_loop");
		assert.equal(first.suggestedCommand, "spine wait --until completed --timeout 10m");
		assert.ok(
			fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")),
			"first complete must not archive mid-finalize",
		);
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, batchId)));

		// The engine's finalize lands: phase completed is persisted (#293 guard
		// still protects the reverse ordering tested above).
		const landed = JSON.parse(fs.readFileSync(path.join(projectRoot, ".spine", "batch-state.json"), "utf-8"));
		landed.phase = "completed";
		landed.endedAt = landed.endedAt ?? Date.now();
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			`${JSON.stringify(landed, null, 2)}\n`,
			"utf-8",
			);

		// The reported "retry works": the next complete succeeds and archives.
		const second = completeBatch({ projectRoot, batchId });
		assert.equal(second.ok, true, second.headline ?? second.error);
		assert.equal(second.diagnosis, "completed");
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, batchId)));
		assert.ok(!fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));

		// This ordering (finalize beat complete) must not journal the #293 skip.
		assert.equal(
			readJournalEvents(projectRoot, batchId).some((event) => event.type === "batch.late_finalize_skipped"),
			false,
			"late_finalize_skipped is for archive-beats-finalize, not this ordering",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

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
