import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { listSalvageableLanes } from "../../src/batch/salvage-batch-list.mjs";
import { rebuildBatchStateFromJournal } from "../../src/batch/journal-rebuild.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("salvage lists commits and diagnose identifies spawn failure after final review spawn failed", async () => {
	const projectRoot = await initGitRepo("salvage-final-review-spawn-");
	const batchId = "testbatch009";
	const taskId = "TP-999";
	
	fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, "src", "main.js"), "base\n", "utf-8");
	
	execFileSync("git", ["add", "-A"], { cwd: projectRoot });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot });
	
	try {
		// Mock the lane worktree with a commit ahead of base
		const wt = laneWorktreePath(projectRoot, batchId, 1);
		fs.mkdirSync(path.dirname(wt), { recursive: true });
		execFileSync("git", ["worktree", "add", "-B", `task/spine-lane-1-${batchId}`, wt, "main"], { cwd: projectRoot });
		fs.writeFileSync(path.join(wt, "src", "main.js"), "changed\n", "utf-8");
		const wtTaskFolder = path.join(wt, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(wtTaskFolder, { recursive: true });
		fs.writeFileSync(path.join(wtTaskFolder, ".DONE"), "done\n", "utf-8");
		// Also create it in main so that resolveTaskFolderPath doesn't fail early?
		fs.mkdirSync(path.join(projectRoot, "spine-tasks", `${taskId}-smoke`), { recursive: true });
		
		execFileSync("git", ["add", "-A"], { cwd: wt });
		execFileSync("git", ["commit", "-m", "feat(TP-999): work"], { cwd: wt });

		// Mock the batch journal
		appendJournalEvent(projectRoot, batchId, "batch.started", { id: batchId, baseBranch: "main" });
		appendJournalEvent(projectRoot, batchId, "lane.started", { laneNumber: 1, laneId: "lane-1", tasks: [taskId] });
		appendJournalEvent(projectRoot, batchId, "task.started", { taskId, laneNumber: 1, taskFolder: `${taskId}-smoke` });
		// Worker commits and finishes
		appendJournalEvent(projectRoot, batchId, "lane.committed", { taskId, laneNumber: 1 });
		appendJournalEvent(projectRoot, batchId, "worker.finished", { taskId, laneNumber: 1, doneFound: true, classification: "terminal-success" });
		// Engine runs final review, it fails to spawn
		appendJournalEvent(projectRoot, batchId, "review.failed", { taskId, classification: "final_review_spawn_failed" });
		appendJournalEvent(projectRoot, batchId, "task.failed", { taskId, laneNumber: 1, classification: "final_review_spawn_failed", exitReason: "final_review_spawn_failed" });
		
		const events = readJournalEvents(projectRoot, batchId);
		const seedState = {
			id: batchId,
			tasksRoot: path.join(projectRoot, "spine-tasks"),
			lanes: [{ laneNumber: 1, taskIds: [taskId] }],
			tasks: [{ taskId, taskFolder: `${taskId}-smoke` }]
		};
		const rebuilt = rebuildBatchStateFromJournal(seedState, events);

		// For reconcileBatch, we need the seed state to be saved
		const { saveEngineBatchState } = await import("../../src/batch/pause.mjs");
		saveEngineBatchState(projectRoot, seedState);

		const state = reconcileBatch({ projectRoot, batchId, verbose: true });
		const list = listSalvageableLanes(projectRoot, batchId);
		assert.equal(list.ok, true, `salvage list should succeed: ${JSON.stringify(list)}`);
		assert.equal(list.lanes?.length, 1, "should list 1 lane");
		assert.ok(list.lanes[0].commitsAhead > 0, "should have commits ahead");

		const diagnosis = reconcileBatch({ projectRoot, batchId, verbose: true });
		assert.equal(diagnosis.diagnosis, "needs_retry");
		assert.ok(!diagnosis.headline.includes("increase SPINE_REVIEW_TIMEOUT_MS"));
		assert.match(diagnosis.headline, /final review spawn/i);
		
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
