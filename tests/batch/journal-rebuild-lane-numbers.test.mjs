import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { rebuildBatchStateFromJournal } from "../../src/batch/journal-rebuild.mjs";
import { listSalvageableLanes } from "../../src/batch/salvage-batch-list.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { archiveBatchState } from "../../src/batch/lifecycle-archive.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "lanetest001";
const TASK_IDS = ["TP-101", "TP-102", "TP-103"];

/**
 * Seed state for a 3-lane wave: one task per lane, planning-time lane assignment.
 */
function threeLaneSeed() {
	return {
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [TASK_IDS],
		lanes: TASK_IDS.map((taskId, index) => ({
			laneNumber: index + 1,
			laneId: `lane-${index + 1}`,
			taskIds: [taskId],
			branch: laneTaskBranch(BATCH_ID, index + 1),
		})),
		tasks: TASK_IDS.map((taskId, index) => ({
			taskId,
			laneNumber: index + 1,
			taskFolder: `${taskId}-smoke`,
		})),
	};
}

/**
 * #287 timeline: 3-lane wave, task events WITHOUT laneNumber (older journal
 * producers), TP-102 fails DirtyWorktree, operator retries and the batch resumes.
 *
 * @param {boolean} retriedTaskCompleted Whether the retried task ends succeeded.
 */
function lanelessDirtyWorktreeRetryEvents(retriedTaskCompleted = true) {
	return [
		{ type: "batch.started", batchId: BATCH_ID, payload: { baseBranch: "main" } },
		...TASK_IDS.map((_, index) => ({
			type: "lane.provisioned",
			batchId: BATCH_ID,
			payload: { laneNumber: index + 1, laneId: `lane-${index + 1}` },
		})),
		// Older producers omit laneNumber on task.started — the collapse trigger.
		...TASK_IDS.map((taskId) => ({ type: "task.started", taskId, payload: { taskId } })),
		{
			type: "task.failed",
			taskId: "TP-102",
			payload: { classification: "DirtyWorktree", exitReason: "DirtyWorktree" },
		},
		{ type: "batch.failed", payload: { fromPhase: "running", toPhase: "failed" } },
		// spine batch retry TP-102 + spine batch resume
		{ type: "task.retry_requested", taskId: "TP-102", payload: { previousClassification: "DirtyWorktree" } },
		{
			type: "batch.resumed",
			payload: { fromPhase: "failed", toPhase: "running", resumeForced: true },
		},
		{ type: "task.started", taskId: "TP-102", payload: { taskId: "TP-102", resumed: true } },
		...TASK_IDS.map((taskId, index) => ({
			type: "lane.committed",
			taskId,
			payload: { laneNumber: index + 1, commitSha: `sha-${index + 1}` },
		})),
		...TASK_IDS.map((taskId, index) => {
			if (taskId === "TP-102" && !retriedTaskCompleted) return null;
			return { type: "task.completed", taskId, payload: { endedAt: 1000 + index } };
		}).filter(Boolean),
	];
}

function taskLaneMap(rebuilt) {
	return Object.fromEntries((rebuilt.tasks ?? []).map((task) => [task.taskId, task.laneNumber]));
}

test("rebuild keeps 3 tasks on lanes 1-3 after DirtyWorktree retry when task.started lacks laneNumber (#287)", () => {
	const events = lanelessDirtyWorktreeRetryEvents();
	const rebuilt = rebuildBatchStateFromJournal(threeLaneSeed(), events);

	assert.deepEqual(taskLaneMap(rebuilt), {
		"TP-101": 1,
		"TP-102": 2,
		"TP-103": 3,
	});

	// Lane stubs stay distinct and keep their own task after retry.
	const lanesById = Object.fromEntries((rebuilt.lanes ?? []).map((lane) => [lane.laneNumber, lane]));
	assert.deepEqual(Object.keys(lanesById).sort(), ["1", "2", "3"]);
	assert.deepEqual(lanesById[1].taskIds, ["TP-101"]);
	assert.deepEqual(lanesById[2].taskIds, ["TP-102"]);
	assert.deepEqual(lanesById[3].taskIds, ["TP-103"]);

	// Retried task ends succeeded via its task.completed timeline event.
	const retried = rebuilt.tasks.find((task) => task.taskId === "TP-102");
	assert.equal(retried.status, "succeeded");
});

test("rebuild without any seed still keeps explicit journal laneNumbers distinct", () => {
	const events = [
		{ type: "batch.started", batchId: BATCH_ID, payload: { baseBranch: "main" } },
		{ type: "task.started", taskId: "TP-101", payload: { laneNumber: 1 } },
		{ type: "task.started", taskId: "TP-102", payload: { laneNumber: 2 } },
		{ type: "task.started", taskId: "TP-103", payload: { laneNumber: 3 } },
	];
	const rebuilt = rebuildBatchStateFromJournal(null, events);
	assert.deepEqual(taskLaneMap(rebuilt), {
		"TP-101": 1,
		"TP-102": 2,
		"TP-103": 3,
	});
});

test("explicit journal laneNumber still wins over a stale seed (journal-wins preserved)", () => {
	const events = [
		{ type: "task.started", taskId: "TP-102", payload: { laneNumber: 3, laneId: "lane-3" } },
	];
	const seed = {
		batchId: BATCH_ID,
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-102"] }],
		tasks: [{ taskId: "TP-102", laneNumber: 1 }],
	};
	const rebuilt = rebuildBatchStateFromJournal(seed, events);
	assert.equal(rebuilt.tasks.find((task) => task.taskId === "TP-102").laneNumber, 3);
});

test("laneless task with no seed lane falls back to lane 1 (last resort)", () => {
	const events = [{ type: "task.started", taskId: "TP-201", payload: { taskId: "TP-201" } }];
	const rebuilt = rebuildBatchStateFromJournal(null, events);
	assert.equal(rebuilt.tasks.find((task) => task.taskId === "TP-201").laneNumber, 1);
});

test("salvage dry-run lists every lane with commits ahead after DirtyWorktree retry rebuild (#287)", async () => {
	const projectRoot = await initGitRepo("journal-rebuild-lanes-");
	try {
		// One worktree + commit ahead of main per lane, as a completed 3-lane wave leaves behind.
		for (const laneNumber of [1, 2, 3]) {
			const wt = laneWorktreePath(projectRoot, BATCH_ID, laneNumber);
			fs.mkdirSync(path.dirname(wt), { recursive: true });
			execFileSync(
				"git",
				["worktree", "add", "-B", laneTaskBranch(BATCH_ID, laneNumber), wt, "main"],
				{ cwd: projectRoot, stdio: "ignore" },
			);
			fs.writeFileSync(path.join(wt, `lane-${laneNumber}.txt`), `${BATCH_ID} lane ${laneNumber}\n`, "utf-8");
			execFileSync("git", ["add", "-A"], { cwd: wt, stdio: "ignore" });
			execFileSync("git", ["commit", "-m", `feat(TP-10${laneNumber}): lane ${laneNumber} work`], {
				cwd: wt,
				stdio: "ignore",
			});
		}

		for (const event of lanelessDirtyWorktreeRetryEvents()) {
			appendJournalEvent(projectRoot, BATCH_ID, event.type, {
				...(event.taskId ? { taskId: event.taskId } : {}),
				...event.payload,
			});
		}

		// Archived seed (post-dismiss salvage path) knows the planning-time lanes.
		archiveBatchState(projectRoot, BATCH_ID, threeLaneSeed());

		const list = listSalvageableLanes(projectRoot, BATCH_ID);
		assert.equal(list.ok, true, `salvage list should succeed: ${JSON.stringify(list)}`);
		assert.deepEqual(
			(list.lanes ?? []).map((lane) => lane.laneNumber),
			[1, 2, 3],
			"all three lanes must be listed, not just lane 1",
		);
		assert.deepEqual(
			(list.lanes ?? []).map((lane) => lane.salvageableTasks),
			[["TP-101"], ["TP-102"], ["TP-103"]],
		);
		for (const lane of list.lanes ?? []) {
			assert.ok(lane.commitsAhead >= 1, `lane ${lane.laneNumber} should have commits ahead`);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
