import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	buildDashboardSnapshot,
	buildWaveProgress,
	classifyLaneStatus,
	truncateWorktreePath,
} from "../../src/dashboard/snapshot.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("idle snapshot diagnosis null matches reconcile", async () => {
	const projectRoot = await initGitRepo("spine-dash-idle-");
	try {
		const reconcile = reconcileBatch({ projectRoot });
		const snapshot = buildDashboardSnapshot(projectRoot);
		assert.equal(snapshot.diagnosis, reconcile.diagnosis);
		assert.equal(snapshot.headline, reconcile.headline);
		assert.equal(snapshot.suggestedCommand, reconcile.suggestedCommand);
		assert.equal(snapshot.diagnosis, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("running batch fixture has lanes and waves", async () => {
	const projectRoot = await initGitRepo("spine-dash-running-");
	try {
		const base = loadFixture("running-batch.json");
		const fixture = {
			...base,
			currentWaveIndex: 1,
			totalWaves: 2,
			wavePlan: [["TP-001"], ["TP-002", "TP-003"]],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: path.join(projectRoot, ".worktrees", "spine-test", "lane-1"),
					branch: `task/spine-lane-1-${base.batchId}`,
					taskIds: ["TP-001", "TP-002"],
					lastHeartbeatAt: Date.now(),
				},
				{
					laneNumber: 2,
					laneId: "lane-2",
					worktreePath: path.join(projectRoot, ".worktrees", "spine-test", "lane-2"),
					branch: `task/spine-lane-2-${base.batchId}`,
					taskIds: ["TP-003"],
					lastHeartbeatAt: Date.now(),
				},
			],
			tasks: base.tasks.map((task, index) => ({
				...task,
				laneNumber: index === 2 ? 2 : 1,
			})),
		};
		writeSpineBatchState(projectRoot, fixture);

		const snapshot = buildDashboardSnapshot(projectRoot);
		assert.equal(snapshot.batchId, base.batchId);
		assert.equal(snapshot.lanes.length, 2);
		assert.equal(snapshot.waves.totalWaves, 2);
		assert.equal(snapshot.waves.currentWaveIndex, 1);
		assert.equal(snapshot.waves.waves.length, 2);
		assert.ok(snapshot.lanes.some((lane) => lane.laneId === "lane-1"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("truncateWorktreePath keeps trailing segments", () => {
	const truncated = truncateWorktreePath("/Users/me/proj/.worktrees/spine-2026/lane-2");
	assert.equal(truncated, ".worktrees/spine-2026/lane-2");
});

test("classifyLaneStatus stale when heartbeat old", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1 },
	});
	const lane = {
		laneNumber: 1,
		laneId: "lane-1",
		taskIds: ["TP-002"],
		lastHeartbeatAt: Date.now() - 5 * 60 * 1000,
	};
	const classifiedTasks = [
		{
			taskId: "TP-002",
			status: "running",
			classification: "running",
			taskFolder: null,
			doneFileFound: false,
		},
	];

	const status = classifyLaneStatus({
		lane,
		classifiedTasks,
		stallConfig,
		now: Date.now(),
	});
	assert.equal(status, "stale");
});

test("buildWaveProgress marks prior waves completed", () => {
	const waves = buildWaveProgress({
		raw: {
			wavePlan: [["A"], ["B", "C"]],
			currentWaveIndex: 1,
			totalWaves: 2,
		},
	});
	assert.equal(waves.waves[0].status, "completed");
	assert.equal(waves.waves[1].status, "active");
});
