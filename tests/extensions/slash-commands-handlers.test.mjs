import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
	createInitialBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import {
	commitPendingTasks,
	createSlashContext,
	ensureDependenciesJson,
	loadBatchFixture,
	withGitProject,
	writeMinimalTask,
	writePiBatchState,
	writeSpineBatchState,
} from "./slash-harness.mjs";

function writeFailedSpineBatch(projectRoot, taskId = "TP-002") {
	const batchId = "20260601T170000";
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
				taskFolder: `spine-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "worker_failed",
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

function writeRunningSpineBatch(projectRoot, batchId = "20260601T120000", taskId = "TP-900") {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${taskId}-smoke`,
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
				taskIds: [taskId],
				lastHeartbeatAt: Date.now(),
				workerPid: 424242,
			},
		],
	});
	state.phase = "running";
	saveSpineBatchState(projectRoot, state);
	return state;
}

function writePausedSpineBatch(projectRoot, batchId = "20260601T130000", taskId = "TP-901") {
	const state = writeRunningSpineBatch(projectRoot, batchId, taskId);
	state.phase = "paused";
	saveSpineBatchState(projectRoot, state);
	return state;
}

function seedCommittedTask(projectRoot, taskId) {
	writeMinimalTask(projectRoot, taskId);
	ensureDependenciesJson(projectRoot);
	commitPendingTasks(projectRoot);
}

test("/spine-status reports idle reconciliation on clean repo", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async () => {
		await handlers.get("spine-status")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /No active batch|preflight/i);
	});
});

test("/spine-deps delegates to CLI and notifies graph output", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeMinimalTask(projectRoot, "TP-010");
		writeMinimalTask(projectRoot, "TP-011");
		await handlers.get("spine-deps")("all", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /TP-010|TP-011|dependency/i);
	});
});

test("/spine-plan succeeds after preflight passes", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		seedCommittedTask(projectRoot, "TP-020");
		await handlers.get("spine-plan")("pending", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /wave|task|plan/i);
	});
});

test("/spine-dismiss archives limbo batch state", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePiBatchState(projectRoot, loadBatchFixture("limbo-stale-20260531T165700.json"));
		await handlers.get("spine-dismiss")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /dismiss|archive|limbo/i);
		assert.equal(fs.existsSync(path.join(projectRoot, ".pi", "batch-state.json")), false);
	});
});

test("/spine-pause pauses a running spine batch", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeRunningSpineBatch(projectRoot);
		await handlers.get("spine-pause")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /pause/i);
		const saved = JSON.parse(
			fs.readFileSync(path.join(projectRoot, ".spine", "batch-state.json"), "utf-8"),
		);
		assert.equal(saved.phase, "paused");
	});
});

test("/spine-resume resumes a paused spine batch", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePausedSpineBatch(projectRoot);
		await handlers.get("spine-resume")("", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /resume|batch/i);
	});
});

test("/spine-retry-task resets a failed task", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeMinimalTask(projectRoot, "TP-002");
		const { taskId } = writeFailedSpineBatch(projectRoot, "TP-002");
		await handlers.get("spine-retry-task")(taskId, ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /retry|TP-002/i);
	});
});

test("/spine-skip-task skips a failed task", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeMinimalTask(projectRoot, "TP-002");
		const { taskId } = writeFailedSpineBatch(projectRoot, "TP-002");
		await handlers.get("spine-skip-task")(taskId, ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /skip|TP-002/i);
	});
});

test("/spine-abort archives an active spine batch", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writeRunningSpineBatch(projectRoot, "20260601T140000", "TP-902");
		await handlers.get("spine-abort")("", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /abort|archive/i);
		assert.equal(fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")), false);
	});
});

test("/spine-next prints reconciliation suggestion", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async () => {
		await handlers.get("spine-next")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /spine|preflight|plan/i);
	});
});

test("/spine-validate checks pending task packets", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		seedCommittedTask(projectRoot, "TP-030");
		await handlers.get("spine-validate")("pending", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /valid|passed|task/i);
	});
});

test("/spine-handoff writes operator note and notifies", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePiBatchState(projectRoot, loadBatchFixture("running-batch.json"));
		await handlers.get("spine-handoff")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /handoff/i);
		assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "handoff.md")));
	});
});

test("/spine-gate inspects integrate gate state", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		const orchBranch = "orch/spine-gate-20260601T150000";
		const state = createInitialBatchState({
			batchId: "20260601T150000",
			baseBranch: "main",
			orchBranch,
			wavePlan: [["TP-903"]],
			tasks: [
				{
					taskId: "TP-903",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/TP-903-smoke",
					startedAt: Date.now() - 60_000,
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
			],
			lanes: [],
		});
		state.phase = "completed";
		state.endedAt = Date.now();
		state.succeededTasks = 1;
		state.mergeResults = [{ waveIndex: 0, status: "succeeded" }];
		writeSpineBatchState(projectRoot, state);
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "gate-work.txt"), "orch", "utf-8");
		execFileSync("git", ["add", "gate-work.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		await handlers.get("spine-gate")("", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /gate|integrate|approve/i);
	});
});

test("/spine-integrate dry-run reports merge preview", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		const orchBranch = "orch/spine-int-20260601T160000";
		const state = createInitialBatchState({
			batchId: "20260601T160000",
			baseBranch: "main",
			orchBranch,
			wavePlan: [["TP-904"]],
			tasks: [
				{
					taskId: "TP-904",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/TP-904-smoke",
					startedAt: Date.now() - 60_000,
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
			],
			lanes: [],
		});
		state.phase = "completed";
		state.endedAt = Date.now();
		state.succeededTasks = 1;
		state.mergeResults = [{ waveIndex: 0, status: "succeeded" }];
		writeSpineBatchState(projectRoot, state);
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "integrate.txt"), "work", "utf-8");
		execFileSync("git", ["add", "integrate.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		await handlers.get("spine-integrate")("--dry-run", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /integrate|dry-run|merge/i);
	});
});

test("/spine-settings shows interactive configuration menu", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async () => {
		await handlers.get("spine-settings")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /lanes\.maxParallel|spine settings set/i);
	});
});

test("/spine-dashboard notifies listen URL and port source", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.dashboard = { port: 8211 };
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		await handlers.get("spine-dashboard")("--port 8212", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /8212|dashboard|http/i);
	});
});

test("/spine entry warns on limbo_stale diagnosis", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePiBatchState(projectRoot, loadBatchFixture("limbo-stale-20260531T165700.json"));
		await handlers.get("spine")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "warning");
		assert.match(notifications[0].message, /limbo|dismiss/i);
	});
});

test("/spine entry warns on needs_retry diagnosis", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePiBatchState(projectRoot, loadBatchFixture("needs-retry-batch.json"));
		await handlers.get("spine")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "warning");
		assert.match(notifications[0].message, /retry|TP-002/i);
	});
});

test("/spine entry reports running batch headline", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		writePiBatchState(projectRoot, loadBatchFixture("running-batch.json"));
		await handlers.get("spine")("", ctx);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /running|batch/i);
	});
});

test("/spine entry starts batch when scope provided after preflight", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		seedCommittedTask(projectRoot, "TP-040");
		await handlers.get("spine")("TP-040", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /batch|TP-040|start|succeeded|failed/i);
	});
});

test("/spine-deps truncates very large dependency output", async () => {
	const { handlers, notifications, ctx } = createSlashContext();
	await withGitProject(async (projectRoot) => {
		const tasks = {};
		for (let index = 0; index < 500; index += 1) {
			const taskId = `TP-${String(index).padStart(3, "0")}`;
			writeMinimalTask(projectRoot, taskId);
			tasks[taskId] = index > 0 ? [`TP-${String(index - 1).padStart(3, "0")}`] : [];
		}
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks }, null, 2),
			"utf-8",
		);
		commitPendingTasks(projectRoot);
		await handlers.get("spine-deps")("all", ctx);
		assert.equal(notifications.length, 1);
		assert.match(notifications[0].message, /truncated/i);
	});
});
