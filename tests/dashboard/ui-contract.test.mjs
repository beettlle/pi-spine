import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import {
	alternativeActionLabel,
	bannerUsesDiagnosisNotPhase,
	buildActionChips,
	buildBannerModel,
	buildDashboardViewModel,
	buildGateAffordanceModel,
	buildLaneTableModel,
	buildLaneTableSummaryModel,
	diagnosisBadgeClass,
	isIdleSnapshot,
	primaryActionLabel,
	shouldShowGateAffordance,
} from "../../src/dashboard/view.mjs";
import {
	createDashboardServer,
	listenDashboardServer,
	resolveStaticAsset,
} from "../../src/dashboard/server.mjs";
import { buildLaneRows } from "../../src/dashboard/snapshot.mjs";
import {
	deriveLanesThroughput,
	deriveLaneThroughputStats,
	summarizeLaneThroughput,
} from "../../src/dashboard/lane-throughput.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PUBLIC_DIR = path.join(process.cwd(), "src/dashboard/public");
const BATCH_STATE_FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");
const THROUGHPUT_MULTI_LANE_FIXTURE = "lane-throughput-multi-lane.json";
const THROUGHPUT_BASE_TS = Date.parse("2026-06-20T12:00:00.000Z");

function loadBatchStateFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(BATCH_STATE_FIXTURES, name), "utf-8"));
}

function journalForMultiLaneThroughputFixture() {
	return [
		{
			type: "task.started",
			laneId: "lane-1",
			taskId: "TP-001",
			timestamp: new Date(THROUGHPUT_BASE_TS).toISOString(),
		},
		{
			type: "task.completed",
			laneId: "lane-1",
			taskId: "TP-001",
			timestamp: new Date(THROUGHPUT_BASE_TS + 60 * 60 * 1000).toISOString(),
		},
		{
			type: "task.started",
			laneId: "lane-2",
			taskId: "TP-002",
			timestamp: new Date(THROUGHPUT_BASE_TS).toISOString(),
		},
		{
			type: "task.completed",
			laneId: "lane-2",
			taskId: "TP-002",
			timestamp: new Date(THROUGHPUT_BASE_TS + 30 * 60 * 1000).toISOString(),
		},
	];
}

function classifiedTasksFromFixture(fixture) {
	const classificationByStatus = {
		succeeded: "terminal-success",
		running: "running",
		pending: "pending",
		failed: "terminal-failure",
	};
	return (fixture.tasks ?? []).map((task) => ({
		taskId: task.taskId,
		laneNumber: task.laneNumber,
		status: task.status,
		classification: classificationByStatus[task.status] ?? task.status,
	}));
}

test("diagnosisBadgeClass maps needs_integrate separately from running", () => {
	assert.equal(diagnosisBadgeClass("needs_integrate"), "badge-integrate");
	assert.equal(diagnosisBadgeClass("running"), "badge-running");
	assert.notEqual(diagnosisBadgeClass("needs_integrate"), diagnosisBadgeClass("running"));
});

test("idle snapshot uses reconcile headline", () => {
	const snapshot = {
		diagnosis: null,
		batchId: null,
		headline: "No active batch — ready to plan or start",
		suggestedCommand: "spine preflight",
		alternatives: ["spine plan all"],
	};
	assert.ok(isIdleSnapshot(snapshot));
	const vm = buildDashboardViewModel(snapshot);
	assert.ok(vm.idle);
	assert.equal(vm.banner.headline, snapshot.headline);
	assert.equal(vm.banner.badgeClass, "badge-idle");
});

test("buildActionChips exposes copyable primary and alternatives", () => {
	const snapshot = {
		diagnosis: "needs_integrate",
		suggestedCommand: "spine integrate",
		alternatives: ["/spine-integrate", "/spine-gate", "spine status --diagnose"],
	};
	const chips = buildActionChips(snapshot);
	assert.equal(chips[0].label, "Integrate");
	assert.equal(chips[0].command, "spine integrate");
	assert.ok(chips[0].primary);
	assert.ok(chips.some((c) => c.label === "Gate" && !c.primary));
	assert.equal(alternativeActionLabel("spine batch dismiss"), "Dismiss");
});

test("needs_integrate banner ignores completed phase for badge color", () => {
	const snapshot = {
		diagnosis: "needs_integrate",
		headline: "Batch spine-2026 ready to integrate orch branch to main",
		suggestedCommand: "spine integrate",
		batch: { phase: "completed", batchId: "spine-2026" },
	};
	const banner = buildBannerModel(snapshot);
	assert.equal(banner.badgeClass, "badge-integrate");
	assert.equal(primaryActionLabel("needs_integrate"), "Integrate");
	assert.ok(bannerUsesDiagnosisNotPhase(snapshot));
});

test("needs_integrate without gate record shows default gate affordance", () => {
	const snapshot = {
		diagnosis: "needs_integrate",
		headline: "Batch spine-2026 ready to integrate orch branch to main",
		suggestedCommand: "spine integrate",
		defaultView: {
			diagnosis: "needs_integrate",
			headline: "Batch spine-2026 ready to integrate orch branch to main",
			suggestedCommand: "spine integrate",
			alternatives: [],
			gateApplicable: true,
			gate: {
				visible: true,
				status: "missing",
				kind: "integrate",
				summary: "Integrate gate not opened yet — wait for engine or run spine batch resume",
				pending: true,
			},
		},
	};
	assert.ok(shouldShowGateAffordance(snapshot));
	const affordance = buildGateAffordanceModel(snapshot);
	assert.equal(affordance?.status, "missing");
	assert.match(affordance?.summary ?? "", /not opened/i);
	const vm = buildDashboardViewModel(snapshot);
	assert.ok(vm.showGateAffordance);
	assert.equal(vm.gateAffordance?.status, "missing");
});

test("buildDashboardViewModel includes all §16.1 panels", () => {
	const snapshot = {
		diagnosis: "running",
		batchId: "b1",
		headline: "Batch b1 is running",
		suggestedCommand: "/spine-status --diagnose",
		macroPhase: "executing",
		macroPhaseLabel: "Executing",
		batch: {
			batchId: "b1",
			phase: "running",
			macroPhase: "executing",
			macroPhaseLabel: "Executing",
			succeededTasks: 1,
			failedTasks: 0,
			totalTasks: 2,
		},
		waves: { currentWaveIndex: 0, totalWaves: 2, waves: [{ index: 0, taskIds: ["TP-1"], status: "active" }] },
		lanes: [
			{
				laneId: "lane-1",
				status: "running",
				taskIds: ["TP-1"],
				heartbeatAgeSeconds: 3,
				worktree: ".worktrees/spine/lane-1",
			},
		],
		gate: { gateId: "g1", kind: "integrate", status: "open", summary: "awaiting approval" },
		journalTail: [{ eventId: "e1", type: "batch.started", timestamp: 1, summary: "started" }],
	};
	const vm = buildDashboardViewModel(snapshot);
	assert.equal(vm.batch?.batchId, "b1");
	assert.equal(vm.batch?.macroPhaseLabel, "Executing");
	assert.equal(vm.waves.macroPhaseLabel, "Executing");
	assert.equal(vm.waves.totalWaves, 2);
	assert.equal(vm.lanes.length, 1);
	assert.equal(vm.gate?.status, "open");
	assert.equal(vm.gateAffordance?.status, "open");
	assert.ok(vm.showGateAffordance);
	assert.equal(vm.journal.length, 1);
});

test("buildLaneTableModel exposes throughput columns for lanes", () => {
	const snapshot = {
		lanes: [
			{
				laneId: "lane-1",
				status: "completed",
				throughput: {
					activeElapsedMs: 90 * 60 * 1000,
					completedCount: 2,
					failedCount: 0,
					throughputTasksPerHour: 1.3,
				},
			},
		],
	};
	const rows = buildLaneTableModel(snapshot);
	assert.equal(rows[0].throughput.elapsedDisplay, "1h 30m");
	assert.equal(rows[0].throughput.doneDisplay, "2");
	assert.equal(rows[0].throughput.rateDisplay, "1.3 tasks/hr");
});

test("buildLaneTableSummaryModel aggregates when multiple lanes present", () => {
	const snapshot = {
		lanes: [
			{
				laneId: "lane-1",
				throughput: {
					activeElapsedMs: 60 * 60 * 1000,
					completedCount: 1,
					failedCount: 0,
					throughputTasksPerHour: 1,
				},
			},
			{
				laneId: "lane-2",
				throughput: {
					activeElapsedMs: 30 * 60 * 1000,
					completedCount: 1,
					failedCount: 0,
					throughputTasksPerHour: 2,
				},
			},
		],
		laneThroughputSummary: {
			activeElapsedMs: 90 * 60 * 1000,
			completedCount: 2,
			failedCount: 0,
			throughputTasksPerHour: 1.3,
		},
	};
	const summary = buildLaneTableSummaryModel(snapshot);
	assert.ok(summary);
	assert.equal(summary.doneDisplay, "2");
	assert.equal(summary.rateDisplay, "1.3 tasks/hr");
});

test("buildLaneTableSummaryModel is null for single lane", () => {
	assert.equal(
		buildLaneTableSummaryModel({
			lanes: [{ laneId: "lane-1", throughput: { completedCount: 1, activeElapsedMs: 1000 } }],
		}),
		null,
	);
});

test("lane-throughput-multi-lane fixture drives throughput column values", () => {
	const fixture = loadBatchStateFixture(THROUGHPUT_MULTI_LANE_FIXTURE);
	const journalEvents = journalForMultiLaneThroughputFixture();
	const now = THROUGHPUT_BASE_TS + 60 * 60 * 1000;
	const stallConfig = resolveStallConfig({});
	const currentWaveTaskIds = fixture.wavePlan[fixture.currentWaveIndex] ?? [];

	const laneRows = buildLaneRows({
		lanes: fixture.lanes,
		classifiedTasks: classifiedTasksFromFixture(fixture),
		stallConfig,
		currentWaveTaskIds,
		journalEvents,
		now,
	});
	const laneThroughputSummary = summarizeLaneThroughput(
		deriveLanesThroughput({
			lanes: fixture.lanes,
			journalEvents,
			now,
		}),
	);

	const vm = buildDashboardViewModel({
		lanes: laneRows,
		laneThroughputSummary,
	});

	assert.equal(vm.lanes.length, 2);

	const lane1 = vm.lanes.find((lane) => lane.laneId === "lane-1");
	const lane2 = vm.lanes.find((lane) => lane.laneId === "lane-2");
	assert.ok(lane1?.throughput);
	assert.ok(lane2?.throughput);

	assert.equal(lane1.throughput.elapsedDisplay, "1h");
	assert.equal(lane1.throughput.doneDisplay, "1");
	assert.equal(lane1.throughput.rateDisplay, "1.0 tasks/hr");

	assert.equal(lane2.throughput.elapsedDisplay, "30m");
	assert.equal(lane2.throughput.doneDisplay, "1");
	assert.equal(lane2.throughput.rateDisplay, "2.0 tasks/hr");

	assert.ok(vm.laneTableSummary);
	assert.equal(vm.laneTableSummary.elapsedDisplay, "1h 30m");
	assert.equal(vm.laneTableSummary.doneDisplay, "2");
	assert.equal(vm.laneTableSummary.rateDisplay, "1.3 tasks/hr");
});

test("lane-throughput-multi-lane fixture documents SP-327 throughput field contract", () => {
	const fixture = loadBatchStateFixture(THROUGHPUT_MULTI_LANE_FIXTURE);
	const throughputFields = ["elapsedDisplay", "doneDisplay", "rateDisplay"];
	const columnLabels = ["Elapsed", "Done", "Rate"];

	const vm = buildDashboardViewModel({
		lanes: buildLaneTableModel({
			lanes: fixture.lanes.map((lane) => ({
				laneId: lane.laneId,
				status: "completed",
				throughput: {
					activeElapsedMs: lane.laneNumber === 1 ? 60 * 60 * 1000 : 30 * 60 * 1000,
					completedCount: 1,
					failedCount: 0,
					throughputTasksPerHour: lane.laneNumber === 1 ? 1 : 2,
				},
			})),
		}),
		laneThroughputSummary: {
			activeElapsedMs: 90 * 60 * 1000,
			completedCount: 2,
			failedCount: 0,
			throughputTasksPerHour: 4 / 3,
		},
	});

	for (const field of throughputFields) {
		assert.ok(
			vm.lanes.every((lane) => field in lane.throughput),
			`missing throughput.${field} on lane row`,
		);
		assert.ok(
			vm.laneTableSummary && field in vm.laneTableSummary,
			`missing laneTableSummary.${field}`,
		);
	}

	const indexHtml = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf-8");
	for (const label of columnLabels) {
		assert.match(indexHtml, new RegExp(`<th scope="col">${label}</th>`));
	}
});

test("banner uses diagnosis badge class, not macro phase", () => {
	const snapshot = {
		diagnosis: "needs_integrate",
		headline: "Batch ready to integrate",
		suggestedCommand: "spine integrate",
		macroPhase: "integrating",
		macroPhaseLabel: "Integrating",
		batch: {
			batchId: "b1",
			phase: "completed",
			macroPhase: "integrating",
			macroPhaseLabel: "Integrating",
		},
	};
	const banner = buildBannerModel(snapshot);
	assert.equal(banner.badgeClass, "badge-integrate");
	assert.equal(banner.diagnosis, "needs_integrate");
	assert.notEqual(banner.badgeClass, "badge-running");
});

test("resolveStaticAsset serves dashboard public files and view.mjs", () => {
	const index = resolveStaticAsset("/");
	assert.ok(index);
	assert.ok(fs.existsSync(index.filePath));
	assert.match(fs.readFileSync(index.filePath, "utf-8"), /pi-spine dashboard/i);

	const view = resolveStaticAsset("/view.mjs");
	assert.ok(view);
	assert.ok(fs.existsSync(view.filePath));
	assert.match(fs.readFileSync(view.filePath, "utf-8"), /diagnosisBadgeClass/);

	const laneThroughput = resolveStaticAsset("/lane-throughput.mjs");
	assert.ok(laneThroughput);
	assert.ok(fs.existsSync(laneThroughput.filePath));
	assert.match(fs.readFileSync(laneThroughput.filePath, "utf-8"), /deriveLaneThroughputStats/);
});

test("dashboard server GET / returns HTML shell", async () => {
	const projectRoot = await initGitRepo("spine-dash-ui-");
	const server = createDashboardServer({ projectRoot });
	try {
		const { host, port } = await listenDashboardServer({ server, port: 0 });
		const body = await new Promise((resolve, reject) => {
			http
				.get(`http://${host}:${port}/`, (res) => {
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});
					res.on("end", () => resolve({ status: res.statusCode, data }));
				})
				.on("error", reject);
		});
		assert.equal(body.status, 200);
		assert.match(body.data, /diagnosis-banner/);
		assert.match(body.data, /banner-actions/);
		assert.match(body.data, /default-status-panels/);
		assert.match(body.data, /journal-heading/);
		assert.match(body.data, /journal-list/);
		assert.match(body.data, /<th scope="col">Phase<\/th>/);
		assert.match(body.data, /<th scope="col">Elapsed<\/th>/);
		assert.match(body.data, /<th scope="col">Done<\/th>/);
		assert.match(body.data, /<th scope="col">Rate<\/th>/);
		assert.match(body.data, /dashboard\.css/);
		assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "dashboard.css")));
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("running batch view model exposes journal for bottom panel", () => {
	const snapshot = {
		diagnosis: "running",
		batchId: "b1",
		headline: "Batch b1 is running",
		suggestedCommand: "spine status --diagnose",
		journalTail: [
			{ eventId: "e1", type: "batch.started", timestamp: "2026-06-13T00:00:00.000Z", summary: "started" },
			{ eventId: "e2", type: "lane.heartbeat", timestamp: "2026-06-13T00:00:01.000Z", summary: "heartbeat" },
		],
	};
	const vm = buildDashboardViewModel(snapshot);
	assert.ok(!vm.idle);
	assert.equal(vm.journal.length, 2);
	assert.equal(vm.journal[0].type, "batch.started");
});

test("idle snapshot has empty journal via idle flag", () => {
	const snapshot = {
		diagnosis: null,
		batchId: null,
		headline: "No active batch — ready to plan or start",
		journalTail: [],
	};
	const vm = buildDashboardViewModel(snapshot);
	assert.ok(vm.idle);
	assert.equal(vm.journal.length, 0);
});
