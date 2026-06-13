import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	buildDashboardSnapshot,
	buildDefaultViewStatus,
	buildWaveProgress,
	classifyLaneStatus,
	formatLaneHeartbeatDisplay,
	resolveLaneHeartbeatMeta,
	truncateWorktreePath,
} from "../../src/dashboard/snapshot.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { formatLaneHeartbeatDisplay as viewFormatLaneHeartbeatDisplay } from "../../src/dashboard/view.mjs";
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

test("resolveLaneHeartbeatMeta reads latest lane heartbeat kind and phase", () => {
	const events = [
		{
			type: "lane.heartbeat",
			laneId: "lane-2",
			payload: { laneNumber: 2, heartbeatKind: "worker_alive", workerPhase: "launching" },
		},
		{
			type: "lane.heartbeat",
			laneId: "lane-2",
			payload: { laneNumber: 2, heartbeatKind: "checkpoint", workerPhase: "pi" },
		},
	];
	assert.deepEqual(resolveLaneHeartbeatMeta(2, events), {
		heartbeatKind: "checkpoint",
		workerPhase: "pi",
	});
});

test("formatLaneHeartbeatDisplay shows launching instead of age", () => {
	assert.equal(
		formatLaneHeartbeatDisplay({ workerPhase: "launching", heartbeatAgeSeconds: 12 }),
		"launching",
	);
	assert.equal(
		viewFormatLaneHeartbeatDisplay({ workerPhase: "launching", heartbeatAgeSeconds: 12 }),
		"launching",
	);
	assert.equal(formatLaneHeartbeatDisplay({ workerPhase: "pi", heartbeatAgeSeconds: 12 }), "12s");
});

test("dashboard snapshot exposes launching heartbeat display from journal", async () => {
	const projectRoot = await initGitRepo("spine-dash-launch-");
	try {
		const base = loadFixture("running-batch.json");
		const batchId = base.batchId;
		appendJournalEvent(projectRoot, batchId, "lane.heartbeat", {
			laneNumber: 1,
			taskId: "TP-002",
			heartbeatKind: "worker_alive",
			workerPhase: "launching",
			statusMtimeMs: null,
		});
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
			],
			tasks: base.tasks.map((task, index) => ({
				...task,
				laneNumber: index === 2 ? 2 : 1,
			})),
		};
		writeSpineBatchState(projectRoot, fixture);

		const snapshot = buildDashboardSnapshot(projectRoot);
		const lane1 = snapshot.lanes.find((lane) => lane.laneId === "lane-1");
		assert.equal(lane1?.workerPhase, "launching");
		assert.equal(lane1?.heartbeatKind, "worker_alive");
		assert.equal(lane1?.heartbeatDisplay, "launching");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildDefaultViewStatus exposes gate missing affordance for needs_integrate", () => {
	const reconciliation = {
		diagnosis: "needs_integrate",
		headline: "Batch ready to integrate",
		suggestedCommand: "spine integrate",
		alternatives: ["spine gate status"],
	};
	const defaultView = buildDefaultViewStatus(reconciliation, null);
	assert.equal(defaultView.diagnosis, "needs_integrate");
	assert.equal(defaultView.headline, reconciliation.headline);
	assert.equal(defaultView.suggestedCommand, "spine integrate");
	assert.ok(defaultView.gateApplicable);
	assert.equal(defaultView.gate?.status, "missing");
});

test("idle snapshot diagnosis null matches reconcile", async () => {
	const projectRoot = await initGitRepo("spine-dash-idle-");
	try {
		const reconcile = reconcileBatch({ projectRoot });
		const snapshot = buildDashboardSnapshot(projectRoot);
		assert.equal(snapshot.diagnosis, reconcile.diagnosis);
		assert.equal(snapshot.headline, reconcile.headline);
		assert.equal(snapshot.suggestedCommand, reconcile.suggestedCommand);
		assert.equal(snapshot.defaultView.headline, reconcile.headline);
		assert.equal(snapshot.defaultView.suggestedCommand, reconcile.suggestedCommand);
		assert.equal(snapshot.diagnosis, null);
		assert.equal(snapshot.defaultView.gate, null);
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
		const lane1 = snapshot.lanes.find((lane) => lane.laneId === "lane-1");
		const lane2 = snapshot.lanes.find((lane) => lane.laneId === "lane-2");
		assert.deepEqual(lane1?.activeTaskIds, ["TP-002"]);
		assert.deepEqual(lane2?.activeTaskIds, ["TP-003"]);
		assert.deepEqual(lane1?.taskIds, ["TP-001", "TP-002"]);
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
