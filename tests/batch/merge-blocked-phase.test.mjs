import assert from "node:assert/strict";
import test from "node:test";
import { recordMergeBlocked } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { deriveMacroPhase } from "../../src/batch/macro-phase.mjs";
import {
	createInitialBatchState,
	readBatchEnginePid,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260628T062636";
const MERGE_CONFLICT_ERROR =
	"merge conflict on docs/PRD.md, .spine/rules-manifest.json; automatic resolution supports docs/adoption/*, docs/PRD.md, .spine/rules-manifest.json, and out-of-scope dependency drift (prefer orch when the lane did not commit the path)";

function buildIncidentBatchState() {
	const taskIds = ["SP-134", "SP-135", "SP-136", "SP-137"];
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [taskIds.slice(0, 3), [taskIds[3]]],
		tasks: taskIds.map((taskId, index) => ({
			taskId,
			laneNumber: index < 3 ? index + 1 : 4,
			status: "succeeded",
			taskFolder: `spine-tasks/${taskId}`,
			startedAt: Date.now(),
			endedAt: Date.now(),
			doneFileFound: true,
			exitReason: null,
		})),
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: "/tmp/lane-1",
				branch: `task/spine-lane-1-${BATCH_ID}`,
				taskIds: ["SP-134"],
				lastHeartbeatAt: null,
				workerPid: null,
			},
			{
				laneNumber: 2,
				laneId: "lane-2",
				worktreePath: "/tmp/lane-2",
				branch: `task/spine-lane-2-${BATCH_ID}`,
				taskIds: ["SP-135"],
				lastHeartbeatAt: null,
				workerPid: null,
			},
			{
				laneNumber: 3,
				laneId: "lane-3",
				worktreePath: "/tmp/lane-3",
				branch: `task/spine-lane-3-${BATCH_ID}`,
				taskIds: ["SP-136"],
				lastHeartbeatAt: null,
				workerPid: null,
			},
			{
				laneNumber: 4,
				laneId: "lane-4",
				worktreePath: "/tmp/lane-4",
				branch: `task/spine-lane-4-${BATCH_ID}`,
				taskIds: ["SP-137"],
				lastHeartbeatAt: null,
				workerPid: null,
			},
		],
	});
	state.phase = "merging";
	state.succeededTasks = 4;
	state.failedTasks = 0;
	state.totalTasks = 4;
	state.currentWaveIndex = 1;
	state.lastError = MERGE_CONFLICT_ERROR;
	state.mergeResults = [
		{ waveIndex: 0, status: "succeeded", mergeCommit: "aaa111" },
		{
			waveIndex: 1,
			status: "failed",
			failedLane: 4,
			failureReason: MERGE_CONFLICT_ERROR,
			failureClass: "MergeConflict",
		},
	];
	recordBatchEnginePid(state, 22683);
	return state;
}

test("recordMergeBlocked sets terminal merge_blocked phase and clears enginePid", async () => {
	const projectRoot = await initGitRepo("spine-merge-blocked-record-");
	try {
		const state = buildIncidentBatchState();
		saveSpineBatchState(projectRoot, state);

		recordMergeBlocked({
			projectRoot,
			state,
			batchId: BATCH_ID,
			error: MERGE_CONFLICT_ERROR,
			waveIndex: 1,
			laneNumber: 4,
			failureClass: "MergeConflict",
		});

		assert.equal(state.phase, "merge_blocked");
		assert.ok(state.endedAt);
		assert.equal(state.lastError, MERGE_CONFLICT_ERROR);
		assert.equal(readBatchEnginePid(state), null);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const blocked = events.filter((event) => event.type === "batch.merge_blocked");
		assert.equal(blocked.length, 1);
		assert.equal(blocked[0]?.payload?.fromPhase, "merging");
		assert.equal(blocked[0]?.payload?.waveIndex, 1);
		assert.equal(blocked[0]?.laneId, "lane-4");
		assert.equal(blocked[0]?.payload?.failureClass, "MergeConflict");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch diagnoses merge_blocked as failed merge, not needs_merge", async () => {
	const projectRoot = await initGitRepo("spine-merge-blocked-reconcile-");
	try {
		const state = buildIncidentBatchState();
		recordMergeBlocked({
			projectRoot,
			state,
			batchId: BATCH_ID,
			error: MERGE_CONFLICT_ERROR,
			waveIndex: 1,
			laneNumber: 4,
			failureClass: "MergeConflict",
		});

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.phase, "merge_blocked");
		assert.equal(reconciliation.diagnosis, "failed");
		assert.notEqual(reconciliation.diagnosis, "needs_merge");
		assert.equal(reconciliation.mergeFailed, true);
		assert.equal(reconciliation.failedWaveIndex, 1);
		assert.equal(reconciliation.failedLane, 4);
		assert.match(reconciliation.headline, /wave 2 merge conflict on lane-4/);
		assert.equal(reconciliation.suggestedCommand, "spine batch resume --force");
		assert.equal(
			deriveMacroPhase({
				diagnosis: reconciliation.diagnosis,
				batchPhase: reconciliation.phase,
			}),
			"failed",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("legacy merging phase with endedAt and failed mergeResults reconciles as failed", async () => {
	const projectRoot = await initGitRepo("spine-merge-blocked-legacy-");
	try {
		const state = buildIncidentBatchState();
		state.endedAt = Date.now();
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, BATCH_ID, "batch.merge_failed", {
			laneNumber: 4,
			waveIndex: 1,
			failureClass: "MergeConflict",
			error: MERGE_CONFLICT_ERROR,
		});

		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(reconciliation.phase, "merging");
		assert.equal(reconciliation.diagnosis, "failed");
		assert.notEqual(reconciliation.diagnosis, "needs_merge");
		assert.equal(reconciliation.mergeFailed, true);
		assert.match(reconciliation.headline, /wave 2 merge conflict on lane-4/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
