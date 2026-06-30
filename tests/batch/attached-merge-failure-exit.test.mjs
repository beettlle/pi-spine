/**
 * SP-357 — attached batch prints merge failure headline and exits non-zero (GitHub #38).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	ATTACHED_LAND_LOOP_MILESTONE_TYPES,
	formatAttachedBatchCliResult,
	formatAttachedMilestoneLine,
	runAttachedBatchEngine,
} from "../../src/batch/attached-runner.mjs";
import { recordMergeBlocked } from "../../src/batch/lifecycle.mjs";
import {
	createInitialBatchState,
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
	return state;
}

test("attached milestone types include batch.merge_blocked", () => {
	assert.ok(ATTACHED_LAND_LOOP_MILESTONE_TYPES.has("batch.merge_blocked"));
	assert.equal(
		formatAttachedMilestoneLine({ type: "batch.merge_blocked", payload: { waveIndex: 1 } }),
		"[spine] batch.merge_blocked wave=1\n",
	);
});

test("formatAttachedBatchCliResult prints merge failure headline and exits non-zero for merge_blocked", async () => {
	const projectRoot = await initGitRepo("spine-attached-merge-blocked-cli-");
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

		const cli = formatAttachedBatchCliResult({
			projectRoot,
			operation: "start",
			result: {
				ok: false,
				exitCode: 1,
				batchId: BATCH_ID,
				error: "merge_failed",
				output: MERGE_CONFLICT_ERROR,
			},
		});

		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /wave 2 merge conflict on lane-4/);
		assert.match(cli.output ?? "", /→ spine batch resume --force/);
		assert.doesNotMatch(cli.output ?? "", /Batch start failed/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runAttachedBatchEngine streams merge_blocked milestone before merge failure CLI output", async () => {
	const projectRoot = await initGitRepo("spine-attached-merge-blocked-stream-");
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

		const streamed = [];
		const engineResult = await runAttachedBatchEngine({
			projectRoot,
			write: (line) => streamed.push(line),
			runEngine: async () => ({
				ok: false,
				exitCode: 1,
				batchId: BATCH_ID,
				error: "merge_failed",
			}),
		});

		const cli = formatAttachedBatchCliResult({
			projectRoot,
			operation: "start",
			result: engineResult,
		});

		assert.equal(cli.exitCode, 1);
		assert.ok(
			streamed.some((line) => line.includes("[spine] batch.merge_blocked")),
			`expected merge_blocked milestone in ${JSON.stringify(streamed)}`,
		);
		assert.match(cli.output ?? "", /wave 2 merge conflict on lane-4/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
