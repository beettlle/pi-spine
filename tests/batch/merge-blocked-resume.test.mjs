import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";
import {
	findResumableWave,
	validateMultiTaskResume,
} from "../../src/batch/resume-multi-validate.mjs";
import { createInitialBatchState, saveSpineBatchState } from "../../src/batch/state.mjs";
import {
	laneTaskBranch,
	provisionLaneWorktree,
} from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260701T031142";

test("findResumableWave skips succeeded merged waves when later wave has pending tasks", () => {
	const state = {
		wavePlan: [["SP-399", "SP-400"], ["SP-401"]],
		currentWaveIndex: 0,
		tasks: [
			{ taskId: "SP-399", status: "succeeded" },
			{ taskId: "SP-400", status: "succeeded" },
			{ taskId: "SP-401", status: "pending" },
		],
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }],
	};
	const pendingTasks = [{ taskId: "SP-401" }];

	assert.equal(findResumableWave(state, pendingTasks), 1);
});

test("validateMultiTaskResume allows force resume from merge_blocked", async () => {
	const projectRoot = await initGitRepo("spine-merge-blocked-resume-");
	try {
		const orchBranch = `orch/spine-${BATCH_ID}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 2, orchBranch });

		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["SP-399", "SP-400"], ["SP-401"]],
			tasks: [
				{
					taskId: "SP-399",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-399",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
				{
					taskId: "SP-400",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-400",
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
				{
					taskId: "SP-401",
					laneNumber: 2,
					status: "pending",
					taskFolder: "spine-tasks/SP-401",
					startedAt: null,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: lane1.worktreePath,
					branch: laneTaskBranch(BATCH_ID, 1),
					taskIds: ["SP-399", "SP-400"],
					lastHeartbeatAt: null,
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: lane2.worktreePath,
					branch: laneTaskBranch(BATCH_ID, 2),
					taskIds: ["SP-401"],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "merge_blocked";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc123" }];
		state.lastError = "merge conflict on bin/spine-batch.mjs";
		saveSpineBatchState(projectRoot, state);

		const blocked = validateMultiTaskResume({ projectRoot, force: false });
		assert.equal(blocked.ok, false);
		assert.match(blocked.output ?? "", /merge blocked/i);
		assert.match(blocked.output ?? "", /--force/);

		const result = validateMultiTaskResume({ projectRoot, force: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.resumableWave, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildSuggestedCommand recommends resume --force for merge_blocked phase", () => {
	const command = buildSuggestedCommand("failed", {
		phase: "merge_blocked",
		batchId: BATCH_ID,
	});
	assert.equal(command, "spine batch resume --force");
});
