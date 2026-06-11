import assert from "node:assert/strict";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordTaskTransition,
	resetTaskForRetry,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("recordTaskTransition writes batch-state and journal atomically", async () => {
	const projectRoot = await initGitRepo("spine-state-transition-");
	try {
		const state = createInitialBatchState({
			batchId: "20260611T120000",
			baseBranch: "main",
			orchBranch: "orch/spine-test",
			wavePlan: [["SP-1"]],
			tasks: [{ taskId: "SP-1", laneNumber: 1, status: "failed", taskFolder: "spine-tasks/SP-1" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-1"] }],
		});
		state.phase = "failed";
		resetTaskForRetry(state, "SP-1");
		recordTaskTransition({
			projectRoot,
			state,
			journalType: "task.retry_requested",
			journalPayload: { taskId: "SP-1", previousClassification: "failed", pendingSegments: 1 },
		});
		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.tasks?.[0]?.status, "pending");
		const events = readJournalEvents(projectRoot, "20260611T120000");
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
