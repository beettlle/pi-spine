import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const STALE_PROMPT = "# Task SP-420 — stale contract\n\nfileScopeMustChange: src/old.mjs\n";
const FIXED_PROMPT = "# Task SP-420 — fixed contract\n\nfileScopeMustChange: src/new.mjs\n";

/**
 * Failed-batch fixture with a packet present on base AND in the lane worktree
 * (committed on main so the worktree branched off it). Mirrors the #378
 * scenario: the operator edits the base PROMPT.md after the failure, and the
 * lane copy is stale until retry refreshes it.
 *
 * @param {string} projectRoot
 * @param {{ fixBasePrompt?: boolean, dirtyLaneFile?: boolean }} [options]
 */
async function writeFailedBatchWithPacket(projectRoot, options = {}) {
	const { fixBasePrompt = true, dirtyLaneFile = false } = options;
	const batchId = "20261122T150000";
	const taskId = "SP-420";
	const taskFolderRel = `spine-tasks/${taskId}-smoke`;
	const orchBranch = `orch/spine-${batchId}`;

	// Base packet committed on main so the lane worktree inherits the stale copy.
	const hostFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(hostFolder, { recursive: true });
	fs.writeFileSync(path.join(hostFolder, "PROMPT.md"), STALE_PROMPT, "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "stale packet"], { cwd: projectRoot, stdio: "ignore" });

	execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
	const { worktreePath } = provisionLaneWorktree({
		projectRoot,
		batchId,
		laneNumber: 1,
		orchBranch,
	});
	assert.equal(
		fs.readFileSync(path.join(worktreePath, taskFolderRel, "PROMPT.md"), "utf-8"),
		STALE_PROMPT,
		"fixture: lane worktree must start with the stale packet",
	);

	// Operator fixes the packet on base after the failure. The base edit stays
	// uncommitted on purpose — retry reads the base working tree, not a ref.
	if (fixBasePrompt) {
		fs.writeFileSync(path.join(hostFolder, "PROMPT.md"), FIXED_PROMPT, "utf-8");
	}

	if (dirtyLaneFile) {
		// Tracked file modified in the lane worktree (uncommitted product work
		// left behind by the failed run).
		const laneFile = path.join(worktreePath, "lane-product.txt");
		fs.writeFileSync(laneFile, "committed lane work", "utf-8");
		execFileSync("git", ["add", "lane-product.txt"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane product work"], { cwd: worktreePath, stdio: "ignore" });
		fs.writeFileSync(laneFile, "uncommitted lane work", "utf-8");
	}

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 120_000,
				endedAt: Date.now() - 60_000,
				doneFileFound: false,
				exitReason: "worker_failed",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath,
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = "failed";
	state.failedTasks = 1;
	state.endedAt = Date.now();
	state.lastError = "worker subprocess died";
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);

	return { batchId, taskId, taskFolderRel, worktreePath };
}

test("#378: retry refreshes stale lane PROMPT from base, commits it, and journals task.packet_refreshed", async () => {
	const projectRoot = await initGitRepo("spine-retry-refresh-prompt-");
	try {
		const { batchId, taskId, taskFolderRel, worktreePath } =
			await writeFailedBatchWithPacket(projectRoot);

		const laneCommitCountBefore = Number(
			execFileSync("git", ["rev-list", "--count", "HEAD"], {
				cwd: worktreePath,
				encoding: "utf-8",
			}).trim(),
		);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		// Lane copy now holds the fixed base content.
		const lanePromptPath = path.join(worktreePath, taskFolderRel, "PROMPT.md");
		assert.equal(fs.readFileSync(lanePromptPath, "utf-8"), FIXED_PROMPT);

		// Refresh is committed in the lane, and only the packet file changed.
		const laneCommitCountAfter = Number(
			execFileSync("git", ["rev-list", "--count", "HEAD"], {
				cwd: worktreePath,
				encoding: "utf-8",
			}).trim(),
		);
		assert.equal(laneCommitCountAfter, laneCommitCountBefore + 1);
		const lastCommitSubject = execFileSync("git", ["log", "-1", "--format=%s"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.equal(lastCommitSubject, `sync packet from base before retry (${taskId})`);
		const lastCommitFiles = execFileSync("git", ["show", "--name-only", "--format="], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.equal(lastCommitFiles, `${taskFolderRel.replace(/\\/g, "/")}/PROMPT.md`);

		// Journal records the refresh.
		const events = readJournalEvents(projectRoot, batchId);
		const refreshedEvent = events.find((event) => event.type === "task.packet_refreshed");
		assert.ok(refreshedEvent, "expected task.packet_refreshed journal event");
		assert.equal(refreshedEvent.taskId, taskId);
		assert.equal(refreshedEvent.payload?.files?.[0]?.file, "PROMPT.md");
		assert.equal(refreshedEvent.payload?.files?.[0]?.committed, true);
		assert.ok(refreshedEvent.payload?.files?.[0]?.commitSha, "expected a commit sha");

		// Result surfaces the refresh to the operator.
		assert.ok(Array.isArray(result.packetRefreshed));
		assert.match(result.output ?? "", /Packet refreshed from base: PROMPT\.md/);

		// The worktree must be clean after the pathspec commit.
		const porcelain = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.equal(porcelain, "");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("#378: retry leaves an identical packet untouched (no event, no commit)", async () => {
	const projectRoot = await initGitRepo("spine-retry-refresh-identical-");
	try {
		const { batchId, taskId, worktreePath } = await writeFailedBatchWithPacket(projectRoot, {
			fixBasePrompt: false,
		});

		const laneCommitCountBefore = Number(
			execFileSync("git", ["rev-list", "--count", "HEAD"], {
				cwd: worktreePath,
				encoding: "utf-8",
			}).trim(),
		);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);

		assert.equal(result.packetRefreshed, undefined);
		assert.doesNotMatch(result.output ?? "", /Packet refreshed/);

		const laneCommitCountAfter = Number(
			execFileSync("git", ["rev-list", "--count", "HEAD"], {
				cwd: worktreePath,
				encoding: "utf-8",
			}).trim(),
		);
		assert.equal(laneCommitCountAfter, laneCommitCountBefore);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(!events.some((event) => event.type === "task.packet_refreshed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("#378: retry succeeds without a base packet (existing fixtures keep working)", async () => {
	const projectRoot = await initGitRepo("spine-retry-refresh-nopacket-");
	try {
		const batchId = "20261122T150100";
		const taskId = "SP-421";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		const { worktreePath } = provisionLaneWorktree({
			projectRoot,
			batchId,
			laneNumber: 1,
			orchBranch,
		});

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 1,
					status: "failed",
					taskFolder: `spine-tasks/${taskId}-smoke`,
					startedAt: Date.now() - 120_000,
					endedAt: Date.now() - 60_000,
					doneFileFound: false,
					exitReason: "worker_failed",
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath,
					branch: laneTaskBranch(batchId, 1),
					taskIds: [taskId],
					lastHeartbeatAt: null,
				},
			],
		});
		state.phase = "failed";
		state.failedTasks = 1;
		state.endedAt = Date.now();
		updateSegmentForTask(state, taskId, "failed");
		saveSpineBatchState(projectRoot, state);

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.packetRefreshed, undefined);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
		assert.ok(!events.some((event) => event.type === "task.packet_refreshed"));
		assert.ok(!events.some((event) => event.type === "task.packet_refresh_failed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("#378: refresh commit does not sweep uncommitted lane product work", async () => {
	const projectRoot = await initGitRepo("spine-retry-refresh-dirtylane-");
	try {
		const { taskId, worktreePath } = await writeFailedBatchWithPacket(projectRoot, {
			dirtyLaneFile: true,
		});

		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.ok(result.packetRefreshed);

		// The dirty lane file is still dirty — untouched by the refresh commit.
		const porcelain = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.match(porcelain, /lane-product\.txt/);
		assert.equal(fs.readFileSync(path.join(worktreePath, "lane-product.txt"), "utf-8"), "uncommitted lane work");

		// The refresh commit carries only the packet file.
		const lastCommitFiles = execFileSync("git", ["show", "--name-only", "--format="], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.equal(lastCommitFiles, "spine-tasks/SP-420-smoke/PROMPT.md");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
