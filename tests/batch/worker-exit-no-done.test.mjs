import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	DIAGNOSIS_TAXONOMY,
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
} from "../../src/batch/diagnosis.mjs";
import {
	inferWorkerDoneMissingFailure,
	outputIndicatesWorkerDoneMissing,
} from "../../src/batch/diagnosis-worker-done-missing.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { workerOutputLogPath } from "../../src/batch/worker-output.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260620T014612";
const TASK_ID = "SP-019";
const DONE_MISSING_OUTPUT = "pi exited but .DONE was not created";

test("DIAGNOSIS_TAXONOMY includes worker_done_missing distinct from worker_orphaned and needs_retry", () => {
	assert.ok(DIAGNOSIS_TAXONOMY.includes("worker_done_missing"));
	assert.ok(DIAGNOSIS_TAXONOMY.includes("worker_orphaned"));
	assert.ok(DIAGNOSIS_TAXONOMY.includes("needs_retry"));
	assert.notEqual(DIAGNOSIS_TAXONOMY.indexOf("worker_done_missing"), -1);
});

test("outputIndicatesWorkerDoneMissing matches runner stderr message", () => {
	assert.equal(outputIndicatesWorkerDoneMissing(DONE_MISSING_OUTPUT), true);
	assert.equal(
		outputIndicatesWorkerDoneMissing("agent session finished but .DONE was not created"),
		true,
	);
	assert.equal(outputIndicatesWorkerDoneMissing("worker launch failed"), false);
});

test("inferWorkerDoneMissingFailure reads task.failed payload from journal", () => {
	const events = [
		{
			type: "lane.died",
			taskId: TASK_ID,
			payload: { taskId: TASK_ID, laneNumber: 1, reason: "failed" },
		},
		{
			type: "task.failed",
			taskId: TASK_ID,
			payload: {
				taskId: TASK_ID,
				laneNumber: 1,
				classification: "failed",
				exitCode: 1,
				doneFound: false,
				output: DONE_MISSING_OUTPUT,
				changedFileCount: 0,
				salvageable: false,
				workerOutputLogRef: `.spine/runtime/${BATCH_ID}/lanes/lane-1/worker-output-${TASK_ID}.log`,
			},
		},
	];

	const hint = inferWorkerDoneMissingFailure({ journalEvents: events, failedTaskId: TASK_ID });
	assert.ok(hint);
	assert.equal(hint.changedFileCount, 0);
	assert.match(hint.output ?? "", /pi exited but \.DONE was not created/);
});

test("buildHeadline and buildSuggestedCommand for worker_done_missing cite worker log", () => {
	const logRef = `.spine/runtime/${BATCH_ID}/lanes/lane-1/worker-output-${TASK_ID}.log`;
	const headline = buildHeadline("worker_done_missing", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		changedFileCount: 0,
		workerOutputLogRef: logRef,
		workerOutputSnippet: DONE_MISSING_OUTPUT,
	});
	assert.match(headline, /exited without \.DONE/);
	assert.match(headline, /0 scoped files/);
	assert.match(headline, new RegExp(logRef.replace(/\./g, "\\.")));
	assert.match(headline, /pi exited but \.DONE was not created/);

	assert.equal(
		buildSuggestedCommand("worker_done_missing", { failedTaskId: TASK_ID }),
		`spine batch retry ${TASK_ID}`,
	);
});

test("reconcileBatch diagnoses worker_done_missing for issue #18 journal pattern", async () => {
	const projectRoot = await initGitRepo("spine-worker-done-missing-");
	try {
		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch: `orch/spine-${BATCH_ID}`,
			wavePlan: [[TASK_ID]],
			tasks: [
				{
					taskId: TASK_ID,
					laneNumber: 1,
					status: "failed",
					taskFolder: `spine-tasks/${TASK_ID}-worker-exit`,
					startedAt: Date.now() - 10_000,
					endedAt: Date.now(),
					doneFileFound: false,
					exitReason: "failed",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
					branch: laneTaskBranch(BATCH_ID, 1),
					taskIds: [TASK_ID],
					lastHeartbeatAt: Date.now() - 10_000,
				},
			],
		});
		state.phase = "running";
		state.failedTasks = 1;
		saveSpineBatchState(projectRoot, state);

		const logPath = workerOutputLogPath(projectRoot, BATCH_ID, 1, TASK_ID);
		fs.mkdirSync(path.dirname(logPath), { recursive: true });
		fs.writeFileSync(
			logPath,
			`worker boot\n${DONE_MISSING_OUTPUT}\n`,
			"utf-8",
		);

		appendJournalEvent(projectRoot, BATCH_ID, "task.started", {
			taskId: TASK_ID,
			laneNumber: 1,
		});
		appendJournalEvent(projectRoot, BATCH_ID, "lane.died", {
			laneNumber: 1,
			laneId: "lane-1",
			taskId: TASK_ID,
			reason: "failed",
		});
		appendJournalEvent(projectRoot, BATCH_ID, "lane.salvage_inspection", {
			laneNumber: 1,
			laneId: "lane-1",
			taskId: TASK_ID,
			changedFileCount: 0,
			salvageable: false,
			retryCommand: `spine batch retry ${TASK_ID}`,
		});
		appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
			taskId: TASK_ID,
			laneNumber: 1,
			laneId: "lane-1",
			classification: "failed",
			exitCode: 1,
			doneFound: false,
			output: DONE_MISSING_OUTPUT,
			changedFileCount: 0,
			salvageable: false,
			workerOutputLogRef: `.spine/runtime/${BATCH_ID}/lanes/lane-1/worker-output-${TASK_ID}.log`,
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "worker_done_missing");
		assert.notEqual(result.diagnosis, "worker_orphaned");
		assert.notEqual(result.diagnosis, "needs_retry");
		assert.equal(result.suggestedCommand, `spine batch retry ${TASK_ID}`);
		assert.match(result.headline, /exited without \.DONE/);
		assert.match(result.headline, /0 scoped files/);
		assert.match(result.headline, /worker-output-SP-019\.log/);
		assert.match(result.headline, /pi exited but \.DONE was not created/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildDiagnosisOutput bundles worker_done_missing headline and retry command", () => {
	const output = buildDiagnosisOutput("worker_done_missing", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		changedFileCount: 0,
		workerOutputLogRef: `.spine/runtime/${BATCH_ID}/lanes/lane-1/worker-output-${TASK_ID}.log`,
		workerOutputSnippet: DONE_MISSING_OUTPUT,
	});
	assert.equal(output.diagnosis, "worker_done_missing");
	assert.match(output.headline, /exited without \.DONE/);
	assert.equal(output.suggestedCommand, `spine batch retry ${TASK_ID}`);
});
