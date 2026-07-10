/**
 * SP-570 — operator salvage list after batch abort (#158).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { archiveBatchStatePath } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	formatSalvageListOutput,
	isNonSalvageableExitReason,
	listSalvageableLanes,
} from "../../src/batch/salvage-batch.mjs";
import { createInitialBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260703T231119";

/**
 * @param {string} projectRoot
 * @param {object} [overrides]
 */
function writeArchivedBatch(projectRoot, overrides = {}) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [["SP-470"], ["SP-471"]],
		tasks: [
			{
				taskId: "SP-470",
				laneNumber: 1,
				status: "succeeded",
				taskFolder: "spine-tasks/SP-470-fixture",
				doneFileFound: true,
				exitReason: "done",
			},
			{
				taskId: "SP-471",
				laneNumber: 2,
				status: "failed",
				taskFolder: "spine-tasks/SP-471-fixture",
				doneFileFound: false,
				exitReason: "contract_failed",
			},
		],
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-470"] },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-471"] },
		],
	});
	state.phase = "aborted";
	state.endedAt = Date.now();
	Object.assign(state, overrides);

	const archivePath = archiveBatchStatePath(projectRoot, BATCH_ID);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	return state;
}

/**
 * @param {string} projectRoot
 */
function seedSalvageJournal(projectRoot) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-470", laneNumber: 1 });
	appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
		taskId: "SP-470",
		laneNumber: 1,
		commitSha: "lane1sha",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.completed", {
		taskId: "SP-470",
		doneFileFound: true,
		exitReason: "done",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-471", laneNumber: 2 });
	appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
		taskId: "SP-471",
		laneNumber: 2,
		commitSha: "lane2sha",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
		taskId: "SP-471",
		exitReason: "contract_failed",
		classification: "contract_failed",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.aborted", { reason: "operator abort" });
}

/**
 * @param {string} projectRoot
 * @param {number} laneNumber
 * @param {string} fileName
 */
function commitLaneBranchWork(projectRoot, laneNumber, fileName) {
	const branch = laneTaskBranch(BATCH_ID, laneNumber);
	execFileSync("git", ["branch", branch, "main"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", branch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, fileName), `lane ${laneNumber} work\n`, "utf-8");
	execFileSync("git", ["add", fileName], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", `lane ${laneNumber} salvage work`], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("isNonSalvageableExitReason flags contract and review failures", () => {
	assert.equal(isNonSalvageableExitReason("contract_failed"), true);
	assert.equal(isNonSalvageableExitReason("review_exhausted"), true);
	assert.equal(isNonSalvageableExitReason("done"), false);
});

test("listSalvageableLanes exits non-zero when journal is missing", async () => {
	const projectRoot = await initGitRepo("salvage-list-no-journal-");
	try {
		const result = listSalvageableLanes(projectRoot, BATCH_ID);
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.error, "journal_missing");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("listSalvageableLanes reports salvageable lane diff vs main", async () => {
	const projectRoot = await initGitRepo("salvage-list-ok-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-lane-1.txt");
		commitLaneBranchWork(projectRoot, 2, "salvage-lane-2.txt");

		const result = listSalvageableLanes(projectRoot, BATCH_ID);
		assert.equal(result.ok, true);
		assert.equal(result.lanes.length, 1);
		assert.equal(result.lanes[0].laneNumber, 1);
		assert.equal(result.lanes[0].salvageableTasks.join(","), "SP-470");
		assert.ok(result.lanes[0].commitsAhead >= 1);
		assert.match(result.lanes[0].diffStat, /salvage-lane-1\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("formatSalvageListOutput renders JSON", async () => {
	const projectRoot = await initGitRepo("salvage-list-json-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-json.txt");

		const result = listSalvageableLanes(projectRoot, BATCH_ID);
		const output = formatSalvageListOutput(result, { json: true });
		const parsed = JSON.parse(output);
		assert.equal(parsed.ok, true);
		assert.equal(parsed.lanes[0].laneNumber, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch salvage --dry-run lists salvageable lanes", async () => {
	const projectRoot = await initGitRepo("salvage-cli-list-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-cli.txt");

		const cli = await runSpineBatch({
			projectRoot,
			args: ["salvage", "--batch", BATCH_ID, "--dry-run"],
		});
		assert.equal(cli.exitCode, 0);
		assert.match(cli.output ?? "", /Lane 1:/);
		assert.match(cli.output ?? "", /SP-470/);
		assert.match(cli.output ?? "", /salvage-cli\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch salvage without --dry-run returns usage", async () => {
	const projectRoot = await initGitRepo("salvage-cli-usage-");
	try {
		const cli = await runSpineBatch({
			projectRoot,
			args: ["salvage", "--batch", BATCH_ID],
		});
		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /--dry-run/);
		assert.match(cli.output ?? "", /--integrate/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch salvage missing journal exits non-zero", async () => {
	const projectRoot = await initGitRepo("salvage-cli-missing-journal-");
	try {
		const cli = await runSpineBatch({
			projectRoot,
			args: ["salvage", "--batch", BATCH_ID, "--dry-run"],
		});
		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /journal/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
