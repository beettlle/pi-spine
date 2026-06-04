import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SERIAL_TASK_IDS = ["TP-961", "TP-962", "TP-963", "TP-964"];
const PARALLEL_TASK_IDS = ["TP-971", "TP-972", "TP-973", "TP-974"];

function writeSmokeTask(projectRoot, taskId, fileScopePath) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: fileScopePath,
			mission: "Resume multi-task lane serialization fixture.",
		}),
		"utf-8",
	);
}

function writeDependencies(projectRoot, taskIds) {
	const tasks = Object.fromEntries(taskIds.map((taskId) => [taskId, []]));
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

function laneIdForNumber(laneNumber) {
	return `lane-${laneNumber}`;
}

function laneTaskStartOrder(events, laneNumber) {
	const laneId = laneIdForNumber(laneNumber);
	const ordered = [];
	for (const event of events) {
		if (event.laneId !== laneId) continue;
		if (event.type === "task.started") {
			ordered.push({ phase: "started", taskId: event.taskId, at: event.timestamp });
		}
		if (event.type === "task.completed" || event.type === "task.skipped_done_on_disk") {
			ordered.push({ phase: "ended", taskId: event.taskId, at: event.timestamp });
		}
	}
	return ordered;
}

function buildPausedMultiLaneState({ batchId, orchBranch, worktreePaths, taskSpecs, wavePlan }) {
	const tasks = taskSpecs.map((spec) => ({
		taskId: spec.taskId,
		laneNumber: spec.laneNumber,
		status: "running",
		taskFolder: `spine-tasks/${spec.taskId}-smoke`,
		startedAt: Date.now(),
		endedAt: null,
		doneFileFound: false,
		exitReason: null,
	}));

	const lanesByNumber = new Map();
	for (const spec of taskSpecs) {
		if (!lanesByNumber.has(spec.laneNumber)) {
			lanesByNumber.set(spec.laneNumber, {
				laneNumber: spec.laneNumber,
				laneId: laneIdForNumber(spec.laneNumber),
				worktreePath: worktreePaths[spec.laneNumber - 1],
				branch: laneTaskBranch(batchId, spec.laneNumber),
				taskIds: [],
				lastHeartbeatAt: null,
			});
		}
		lanesByNumber.get(spec.laneNumber).taskIds.push(spec.taskId);
	}

	return createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch,
		wavePlan,
		tasks,
		lanes: [...lanesByNumber.values()],
	});
}

test("resumeBatch serializes four tasks on one lane", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-serial-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		for (const taskId of SERIAL_TASK_IDS) {
			writeSmokeTask(projectRoot, taskId, "src/shared/**");
		}
		writeDependencies(projectRoot, SERIAL_TASK_IDS);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "resume serial lane tasks"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260604T120001";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const state = buildPausedMultiLaneState({
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath],
			taskSpecs: SERIAL_TASK_IDS.map((taskId) => ({ taskId, laneNumber: 1 })),
			wavePlan: [SERIAL_TASK_IDS],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, batchId);
		const serialized = events.find((event) => event.type === "lane.tasks_serialized");
		assert.ok(serialized, "expected lane.tasks_serialized journal event on resume");
		assert.equal(serialized.laneId, laneIdForNumber(1));
		assert.deepEqual(serialized.payload?.taskIds, SERIAL_TASK_IDS);

		const order = laneTaskStartOrder(events, 1);
		for (let index = 1; index < SERIAL_TASK_IDS.length; index++) {
			const prevTaskId = SERIAL_TASK_IDS[index - 1];
			const taskId = SERIAL_TASK_IDS[index];
			const prevEnd = order.find((entry) => entry.taskId === prevTaskId && entry.phase === "ended");
			const nextStart = order.find((entry) => entry.taskId === taskId && entry.phase === "started");
			assert.ok(prevEnd && nextStart, `expected ordering for ${prevTaskId} then ${taskId}`);
			assert.ok(nextStart.at >= prevEnd.at, `${taskId} must start after ${prevTaskId} ends on same lane`);
		}

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		assert.equal(final?.succeededTasks, SERIAL_TASK_IDS.length);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch runs two lanes with two tasks each in parallel", async () => {
	const projectRoot = await initGitRepo("spine-resume-multi-parallel-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSmokeTask(projectRoot, PARALLEL_TASK_IDS[0], "src/lane-a/**");
		writeSmokeTask(projectRoot, PARALLEL_TASK_IDS[1], "src/lane-a/**");
		writeSmokeTask(projectRoot, PARALLEL_TASK_IDS[2], "src/lane-b/**");
		writeSmokeTask(projectRoot, PARALLEL_TASK_IDS[3], "src/lane-b/**");
		writeDependencies(projectRoot, PARALLEL_TASK_IDS);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "resume parallel lane tasks"], { cwd: projectRoot, stdio: "ignore" });

		const batchId = "20260604T120002";
		const orchBranch = `orch/spine-${batchId}`;
		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });

		const lane1 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 1, orchBranch });
		const lane2 = provisionLaneWorktree({ projectRoot, batchId, laneNumber: 2, orchBranch });
		const state = buildPausedMultiLaneState({
			batchId,
			orchBranch,
			worktreePaths: [lane1.worktreePath, lane2.worktreePath],
			taskSpecs: [
				{ taskId: PARALLEL_TASK_IDS[0], laneNumber: 1 },
				{ taskId: PARALLEL_TASK_IDS[1], laneNumber: 1 },
				{ taskId: PARALLEL_TASK_IDS[2], laneNumber: 2 },
				{ taskId: PARALLEL_TASK_IDS[3], laneNumber: 2 },
			],
			wavePlan: [PARALLEL_TASK_IDS],
		});
		state.phase = "paused";
		state.currentWaveIndex = 0;
		saveSpineBatchState(projectRoot, state);

		const result = await resumeBatch({ projectRoot });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, batchId);
		const serializedEvents = events.filter((event) => event.type === "lane.tasks_serialized");
		assert.equal(serializedEvents.length, 2, "each lane with two tasks should serialize");
		assert.ok(
			serializedEvents.some(
				(event) =>
					event.laneId === laneIdForNumber(1) &&
					event.payload?.taskIds?.length === 2 &&
					event.payload.taskIds[0] === PARALLEL_TASK_IDS[0],
			),
		);
		assert.ok(
			serializedEvents.some(
				(event) =>
					event.laneId === laneIdForNumber(2) &&
					event.payload?.taskIds?.length === 2 &&
					event.payload.taskIds[0] === PARALLEL_TASK_IDS[2],
			),
		);

		const lane1Start = events.find(
			(event) =>
				event.type === "task.started" &&
				event.laneId === laneIdForNumber(1) &&
				event.taskId === PARALLEL_TASK_IDS[0],
		);
		const lane2Start = events.find(
			(event) =>
				event.type === "task.started" &&
				event.laneId === laneIdForNumber(2) &&
				event.taskId === PARALLEL_TASK_IDS[2],
		);
		assert.ok(lane1Start && lane2Start, "disjoint lanes should both start workers");

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		assert.equal(final?.succeededTasks, PARALLEL_TASK_IDS.length);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
