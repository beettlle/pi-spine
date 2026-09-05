// @ts-nocheck
/**
 * SP-752 / #230 — row-scoped matrix operations:
 *
 * - `parseMatrixRowRef` parses `SP-X[rowId]` identity tokens.
 * - `retryTaskRow` resets exactly one failed row without touching sibling rows.
 * - `skipTaskRow` cancels one row (excluded from execution + aggregation).
 * - Whole-task `retryTask` resets failed rows but never re-runs succeeded ones.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	parseMatrixRowRef,
	retryTaskRow,
	skipTaskRow,
} from "../../src/batch/retry-row.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeFailedMatrixBatch(projectRoot, { batchId = "20260601T170000", taskId = "SP-900" } = {}) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: `spine-tasks/${taskId}-matrix`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "matrix_sub_lane_failed:b",
				isMatrix: true,
				matrixType: "execute",
				matrixRows: [
					{
						rowId: "a",
						status: "succeeded",
						exitCode: 0,
						commitSha: "aaa1111",
						worktreePath: "/tmp/spine-carry-a",
						branch: `task/spine-matrix-1-${batchId}-sp_900-a`,
					},
					{ rowId: "b", status: "failed", exitCode: 1, commitSha: null },
				],
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "failed";
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId };
}

test("parseMatrixRowRef parses SP-X[rowId] and rejects plain ids", () => {
	assert.deepEqual(parseMatrixRowRef("SP-100[us_east]"), { taskId: "SP-100", rowId: "us_east" });
	assert.deepEqual(parseMatrixRowRef("TP-9[a]"), { taskId: "TP-9", rowId: "a" });
	assert.equal(parseMatrixRowRef("SP-100"), null, "plain task id is not a row ref");
	assert.equal(parseMatrixRowRef("SP-100[]"), null, "empty row id rejected");
	assert.equal(parseMatrixRowRef("SP-100[a][b]"), null, "nested brackets rejected");
	assert.equal(parseMatrixRowRef(""), null);
	assert.equal(parseMatrixRowRef(null), null);
	assert.equal(parseMatrixRowRef("[a]"), null, "missing task id rejected");
});

test("retryTaskRow resets only the named row and keeps succeeded rows", async () => {
	const projectRoot = await initGitRepo("spine-retry-row-atomic-");
	try {
		const { batchId, taskId } = writeFailedMatrixBatch(projectRoot);

		const result = retryTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.rowId, "b");
		assert.equal(result.unblocked, true, "retrying the last failed row unblocks the batch");

		const saved = loadSpineBatchState(projectRoot).raw;
		assert.equal(saved?.phase, "paused");
		assert.equal(saved?.tasks[0].status, "pending");
		const rows = saved?.tasks[0].matrixRows ?? [];
		assert.equal(rows.find((row) => row.rowId === "a")?.status, "succeeded", "succeeded row untouched");
		assert.equal(rows.find((row) => row.rowId === "a")?.worktreePath, "/tmp/spine-carry-a");
		assert.equal(rows.find((row) => row.rowId === "b")?.status, "pending", "named row reset for re-run");
		assert.equal(rows.find((row) => row.rowId === "b")?.exitCode, null);

		const events = readJournalEvents(projectRoot, batchId);
		const retryEvent = events.find((event) => event.type === "task.retry_requested");
		assert.ok(retryEvent);
		assert.equal(retryEvent.payload?.rowId, "b");
		assert.deepEqual(retryEvent.payload?.retriedRowIds, ["b"]);
		assert.equal(saved?.resilience?.retryCountByScope?.[`${taskId}[b]`], 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTaskRow leaves other failed rows failed (retry each row explicitly)", async () => {
	const projectRoot = await initGitRepo("spine-retry-row-scope-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.tasks[0].matrixRows.push({ rowId: "c", status: "failed", exitCode: 2, commitSha: null });
		state.tasks[0].exitReason = "matrix_sub_lane_failed:b, c";
		saveSpineBatchState(projectRoot, state);

		const result = retryTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, true, result.output ?? result.error);

		const rows = loadSpineBatchState(projectRoot).raw?.tasks[0].matrixRows ?? [];
		assert.equal(rows.find((row) => row.rowId === "b")?.status, "pending");
		assert.equal(rows.find((row) => row.rowId === "c")?.status, "failed", "sibling failed row not re-run");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTaskRow rejects succeeded, unknown rows, and non-matrix tasks", async () => {
	const projectRoot = await initGitRepo("spine-retry-row-guard-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);

		const succeeded = retryTaskRow({ projectRoot, taskId, rowId: "a" });
		assert.equal(succeeded.ok, false);
		assert.equal(succeeded.error, "row_not_retryable");
		assert.match(succeeded.output, /never re-executed/);

		const unknown = retryTaskRow({ projectRoot, taskId, rowId: "zz" });
		assert.equal(unknown.ok, false);
		assert.equal(unknown.error, "row_not_found");
		assert.match(unknown.output, /Matrix rows: a, b/);

		const nonMatrix = retryTaskRow({ projectRoot, taskId: "SP-404", rowId: "a" });
		assert.equal(nonMatrix.ok, false);
		assert.equal(nonMatrix.error, "task_not_found");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("retryTaskRow refuses while the batch is running", async () => {
	const projectRoot = await initGitRepo("spine-retry-row-phase-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = retryTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, false);
		assert.equal(result.error, "cannot_retry");
		assert.match(result.output, /Pause the batch first/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("whole-task retry resets failed rows to pending but preserves succeeded and canceled rows", async () => {
	const projectRoot = await initGitRepo("spine-retry-matrix-whole-");
	try {
		const { batchId, taskId } = writeFailedMatrixBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.tasks[0].matrixRows.push({ rowId: "c", status: "canceled", exitCode: null, commitSha: null });
		saveSpineBatchState(projectRoot, state);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.deepEqual(result.retriedRowIds, ["b"]);
		assert.match(result.output, /Matrix rows re-running: b/);

		const rows = loadSpineBatchState(projectRoot).raw?.tasks[0].matrixRows ?? [];
		assert.equal(rows.find((row) => row.rowId === "a")?.status, "succeeded", "succeeded rows carry over");
		assert.equal(rows.find((row) => row.rowId === "b")?.status, "pending", "failed rows re-run");
		assert.equal(rows.find((row) => row.rowId === "c")?.status, "canceled", "canceled stays excluded");

		const retryEvent = readJournalEvents(projectRoot, batchId).find(
			(event) => event.type === "task.retry_requested",
		);
		assert.deepEqual(retryEvent?.payload?.retriedRowIds, ["b"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTaskRow cancels one row and journals matrix.row_skipped", async () => {
	const projectRoot = await initGitRepo("spine-skip-row-");
	try {
		const { batchId, taskId } = writeFailedMatrixBatch(projectRoot);

		const result = skipTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.match(result.output, /excluded from matrix aggregation/);
		assert.match(result.output, /spine batch resume --force/, "failed batch resumes with --force");

		const saved = loadSpineBatchState(projectRoot).raw;
		const rows = saved?.tasks[0].matrixRows ?? [];
		assert.equal(rows.find((row) => row.rowId === "b")?.status, "canceled");
		assert.equal(saved?.tasks[0].status, "failed", "task status untouched by row cancel");

		const event = readJournalEvents(projectRoot, batchId).find(
			(entry) => entry.type === "matrix.row_skipped",
		);
		assert.ok(event, "matrix.row_skipped journaled");
		assert.equal(event.taskId, taskId);
		assert.equal(event.payload?.rowId, "b");
		assert.equal(event.payload?.previousStatus, "failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTaskRow suggests landing carried-over rows when every row is resolved", async () => {
	const projectRoot = await initGitRepo("spine-skip-row-resolved-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);

		const result = skipTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, true);
		assert.match(result.output, /spine batch retry SP-900/, "all resolved → land carry-overs via retry");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTaskRow rejects succeeded rows and double cancel", async () => {
	const projectRoot = await initGitRepo("spine-skip-row-guard-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);

		const succeeded = skipTaskRow({ projectRoot, taskId, rowId: "a" });
		assert.equal(succeeded.ok, false);
		assert.equal(succeeded.error, "row_not_cancellable");
		assert.match(succeeded.output, /already succeeded/);

		const first = skipTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(first.ok, true);

		const second = skipTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(second.ok, false);
		assert.equal(second.error, "row_not_cancellable");
		assert.match(second.output, /already canceled/);

		const unknown = skipTaskRow({ projectRoot, taskId, rowId: "zz" });
		assert.equal(unknown.ok, false);
		assert.equal(unknown.error, "row_not_found");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTaskRow can cancel a row stuck in running after a crash (paused batch)", async () => {
	const projectRoot = await initGitRepo("spine-skip-row-running-");
	try {
		const { taskId } = writeFailedMatrixBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		state.tasks[0].matrixRows[1].status = "running";
		state.phase = "paused";
		saveSpineBatchState(projectRoot, state);

		const result = skipTaskRow({ projectRoot, taskId, rowId: "b" });
		assert.equal(result.ok, true, result.output ?? result.error);
		const rows = loadSpineBatchState(projectRoot).raw?.tasks[0].matrixRows ?? [];
		assert.equal(rows.find((row) => row.rowId === "b")?.status, "canceled");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("skipTaskRow rejects non-matrix tasks with a whole-task hint", async () => {
	const projectRoot = await initGitRepo("spine-skip-row-nonmatrix-");
	try {
		const { batchId, taskId } = writeFailedMatrixBatch(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		delete state.tasks[0].matrixRows;
		state.tasks[0].isMatrix = false;
		saveSpineBatchState(projectRoot, state);

		const result = skipTaskRow({ projectRoot, taskId, rowId: "a" });
		assert.equal(result.ok, false);
		assert.equal(result.error, "not_a_matrix_task");
		assert.match(result.output, new RegExp(`spine batch skip ${taskId}`));
		assert.equal(loadSpineBatchState(projectRoot).raw?.batchId, batchId);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
