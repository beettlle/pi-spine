/**
 * SP-780 — journalCorruptLines diagnosis signal for torn journal lines (#296).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runSpineStatus } from "../../bin/spine-status.mjs";
import { appendJournalEvent, journalPath } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * Minimal running batch fixture with one valid journal event, plus a torn
 * JSON fragment appended directly to the journal file (crash mid-append).
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {number} Byte offset of the torn line inside events.jsonl.
 */
function writeBatchWithTornJournal(projectRoot, batchId) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [["SP-1"]],
		tasks: [
			{
				taskId: "SP-1",
				laneNumber: 1,
				status: "running",
				taskFolder: "spine-tasks/SP-1-smoke",
				startedAt: Date.now(),
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: ["SP-1"],
				lastHeartbeatAt: null,
				workerPid: null,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "batch.started", { baseBranch: "main" });
	const journalFile = journalPath(projectRoot, batchId);
	const tornOffset = fs.statSync(journalFile).size;
	fs.appendFileSync(journalFile, '{"type":"x"', "utf-8");
	return tornOffset;
}

test("reconcileBatch reports journalCorruptLines signal for a torn journal line", async () => {
	const projectRoot = await initGitRepo("spine-journal-diag-");
	try {
		const batchId = "20260815T171000";
		const tornOffset = writeBatchWithTornJournal(projectRoot, batchId);

		// verbose: true mirrors how `spine status --diagnose` invokes reconcileBatch.
		const result = reconcileBatch({ projectRoot, verbose: true });
		const signal = result.signals?.journalCorruptLines;
		assert.ok(signal, "journalCorruptLines signal must be present");
		assert.equal(signal.count, 1);
		assert.deepEqual(signal.lines, [{ lineNumber: 2, byteOffset: tornOffset }]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --diagnose renders the journalCorruptLines signal", async () => {
	const projectRoot = await initGitRepo("spine-journal-diag-render-");
	try {
		const batchId = "20260815T171100";
		writeBatchWithTornJournal(projectRoot, batchId);

		const rendered = runSpineStatus({ projectRoot, diagnose: true });
		assert.equal(rendered.exitCode, 0);
		assert.ok(
			rendered.output.includes("journalCorruptLines"),
			"--diagnose output must include journalCorruptLines",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("clean journal produces no journalCorruptLines signal", async () => {
	const projectRoot = await initGitRepo("spine-journal-diag-clean-");
	try {
		const batchId = "20260815T171200";
		writeBatchWithTornJournal(projectRoot, batchId);
		// Strip the torn fragment so the journal holds only the valid event.
		const journalFile = journalPath(projectRoot, batchId);
		const raw = fs.readFileSync(journalFile, "utf-8");
		fs.writeFileSync(journalFile, raw.replace('{"type":"x"', ""), "utf-8");

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.signals?.journalCorruptLines, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
