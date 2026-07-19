import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	alternativeActionLabel,
	bannerUsesDiagnosisNotPhase,
	buildActionChips,
	buildBannerModel,
	buildDashboardViewModel,
	buildGateAffordanceModel,
	buildJournalLaneFilterOptions,
	buildJournalModel,
	buildLaneDetailModel,
	buildLaneTableModel,
	buildLaneTableSummaryModel,
	buildTailActivityModel,
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
import {
	buildDashboardSnapshot,
	buildLaneRecentEvents,
	buildLaneRows,
	enrichLaneRowsWithRunningTaskTitle,
	lanesHaveActiveTasks,
	resolveLaneWorkerLog,
	resolveRunningTaskTitles,
	resolveTailActivityFromJournal,
	resolveTailActivityLabel,
} from "../../src/dashboard/snapshot.mjs";
import {
	deriveLanesThroughput,
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

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
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

test("buildLaneTableModel exposes heartbeatDisplay for launching lanes", () => {
	const rows = buildLaneTableModel({
		lanes: [
			{
				laneId: "lane-1",
				status: "running",
				workerPhase: "launching",
				heartbeatAgeSeconds: 12,
			},
		],
	});
	assert.equal(rows[0].heartbeatDisplay, "launching");
});

test("dashboard.js uses heartbeatDisplay without double-formatting", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	assert.match(dashboardJs, /function displayHeartbeat\(lane\)/);
	assert.doesNotMatch(dashboardJs, /formatHeartbeat\(lane\.heartbeatDisplay/);
	assert.match(dashboardJs, /displayHeartbeat\(lane\)/);
});

test("dashboard.js uses terminal outcome for completed lane styling, not cumulative failedCount", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	const renderLanesMatch = dashboardJs.match(
		/function renderLanes[\s\S]*?(?=\n\/\*\* @param \{ReturnType<typeof buildDashboardViewModel>\["journal"\]\})/,
	);
	assert.ok(renderLanesMatch, "renderLanes function found");
	const renderLanesSource = renderLanesMatch[0];
	assert.match(renderLanesSource, /lane\.status === "completed"/);
	assert.match(renderLanesSource, /lane\.activityPhase === "failed"/);
	assert.doesNotMatch(renderLanesSource, /failedCount > 0 \|\| lane\.activityPhase === "failed"/);
});

test("retry-then-succeed completed lane keeps failedCount metric but terminal activity is not failed", () => {
	const journalEvents = [
		{
			type: "task.started",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:00:00.000Z",
		},
		{
			type: "task.failed",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:05:00.000Z",
		},
		{
			type: "task.started",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:10:00.000Z",
		},
		{
			type: "task.failed",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:15:00.000Z",
		},
		{
			type: "task.started",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:20:00.000Z",
		},
		{
			type: "task.completed",
			laneId: "lane-1",
			taskId: "SP-547",
			payload: { laneNumber: 1 },
			timestamp: "2026-07-08T10:30:00.000Z",
		},
	];
	const lanes = [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-547"], lastHeartbeatAt: Date.now() }];
	const classifiedTasks = [
		{
			taskId: "SP-547",
			laneNumber: 1,
			status: "succeeded",
			classification: "terminal-success",
		},
	];
	const stallConfig = resolveStallConfig({});
	const rows = buildLaneRows({
		lanes,
		classifiedTasks,
		stallConfig,
		currentWaveTaskIds: [],
		journalEvents,
	});
	assert.equal(rows.length, 1);
	assert.equal(rows[0].status, "completed");
	assert.equal(rows[0].activityPhase, "idle");
	assert.ok((rows[0].throughput?.failedCount ?? 0) >= 2);
});

test("buildBannerModel uses finalizing badge and macro phase during tail state", () => {
	const snapshot = {
		diagnosis: "running",
		headline: "Batch 20260701T031142 tasks done — merging lane branches…",
		suggestedCommand: "/spine-status --diagnose",
		macroPhase: "merging",
		macroPhaseLabel: "Merging",
		phase: "running",
		batch: {
			batchId: "20260701T031142",
			phase: "running",
			macroPhase: "merging",
			macroPhaseLabel: "Merging",
			succeededTasks: 2,
			failedTasks: 0,
			totalTasks: 2,
		},
		reconciliation: {
			signals: {
				phase: "running",
				hasRunningTasks: false,
				hasPendingTasks: false,
				allTasksTerminalSuccess: true,
				mergeResultsEmpty: true,
			},
		},
		lanes: [
			{ laneId: "lane-1", runningTaskId: null, queuedTaskIds: [] },
			{ laneId: "lane-2", runningTaskId: null, queuedTaskIds: [] },
		],
	};
	const banner = buildBannerModel(snapshot);
	assert.equal(banner.badgeClass, "badge-finalizing");
	assert.equal(banner.badgeLabel, "Merging");
	assert.equal(banner.subline, "Merging");
	assert.equal(banner.tailState, true);
	assert.notEqual(banner.badgeClass, "badge-running");
	assert.match(banner.headline, /merging/i);
	assert.ok(bannerUsesDiagnosisNotPhase(snapshot));
});

test("buildBannerModel reflects gating macro phase during post-merge tail", () => {
	const snapshot = {
		diagnosis: "running",
		headline: "Batch b1 finalizing land loop — opening integrate gate…",
		suggestedCommand: "/spine-status --diagnose",
		macroPhase: "gating",
		macroPhaseLabel: "Gating",
		batch: {
			batchId: "b1",
			phase: "running",
			succeededTasks: 2,
			failedTasks: 0,
			totalTasks: 2,
		},
		reconciliation: {
			signals: {
				phase: "running",
				hasRunningTasks: false,
				hasPendingTasks: false,
				allTasksTerminalSuccess: true,
				postMergeLimbo: true,
			},
		},
		lanes: [{ laneId: "lane-1", runningTaskId: null, queuedTaskIds: [] }],
	};
	const banner = buildBannerModel(snapshot);
	assert.equal(banner.badgeLabel, "Gating");
	assert.equal(banner.badgeClass, "badge-finalizing");
	assert.match(banner.headline, /gate/i);
});

test("buildBannerModel keeps running badge when workers are active", () => {
	const snapshot = {
		diagnosis: "running",
		headline: "Batch b1 is running",
		macroPhase: "executing",
		macroPhaseLabel: "Executing",
		batch: { phase: "running", succeededTasks: 1, totalTasks: 2 },
		reconciliation: {
			signals: { hasRunningTasks: true, hasPendingTasks: false, phase: "running" },
		},
		lanes: [{ laneId: "lane-1", runningTaskId: "TP-1", queuedTaskIds: [] }],
	};
	const banner = buildBannerModel(snapshot);
	assert.equal(banner.badgeClass, "badge-running");
	assert.equal(banner.badgeLabel, "running");
	assert.equal(banner.tailState, false);
	assert.ok(bannerUsesDiagnosisNotPhase(snapshot));
});

test("resolveTailActivityLabel prefers recent journal over macro phase during tail", () => {
	const lanes = [
		{ laneId: "lane-1", runningTaskId: null, queuedTaskIds: [] },
		{ laneId: "lane-2", runningTaskId: null, queuedTaskIds: [] },
	];
	const reconciliation = {
		diagnosis: "running",
		signals: {
			phase: "running",
			hasRunningTasks: false,
			hasPendingTasks: false,
			allTasksTerminalSuccess: true,
		},
	};
	const batch = {
		phase: "running",
		succeededTasks: 2,
		failedTasks: 0,
		totalTasks: 2,
	};
	const journalEvents = [
		{ type: "batch.merge_started", timestamp: "1" },
		{ type: "gate.opened", timestamp: "2" },
	];

	assert.equal(
		resolveTailActivityLabel({
			reconciliation,
			batch,
			lanes,
			macroPhase: "merging",
			macroPhaseLabel: "Merging",
			journalEvents,
		}),
		"Integrate gate opened — awaiting approval",
	);
	assert.equal(resolveTailActivityFromJournal(journalEvents), "Integrate gate opened — awaiting approval");
	assert.equal(lanesHaveActiveTasks(lanes), false);
});

test("buildTailActivityModel exposes lane table subline when lanes are idle during tail", () => {
	const snapshot = {
		diagnosis: "running",
		tailActivityLabel: "Merging lane branches…",
		lanes: [
			{ laneId: "lane-1", runningTaskId: null, queuedTaskIds: [] },
			{ laneId: "lane-2", runningTaskId: null, queuedTaskIds: [] },
		],
	};
	const tail = buildTailActivityModel(snapshot);
	assert.equal(tail.tailActivityLabel, "Merging lane branches…");
	assert.equal(tail.visible, true);

	const vm = buildDashboardViewModel(snapshot);
	assert.equal(vm.tailActivity?.tailActivityLabel, "Merging lane branches…");
	assert.equal(vm.tailActivity?.visible, true);
});

test("resolveTailActivityLabel returns null when running task is active", () => {
	const lanes = [{ laneId: "lane-1", runningTaskId: "TP-1", queuedTaskIds: [] }];
	assert.equal(
		resolveTailActivityLabel({
			reconciliation: { diagnosis: "running", signals: { hasRunningTasks: true } },
			batch: { phase: "running", totalTasks: 2, succeededTasks: 1, failedTasks: 0 },
			lanes,
			macroPhase: "executing",
			macroPhaseLabel: "Executing",
			journalEvents: [],
		}),
		null,
	);
});

test("dashboard.js renders lane table tail activity footer row", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	assert.match(dashboardJs, /lane-table-tail-activity/);
	assert.match(dashboardJs, /tailActivity\.tailActivityLabel/);
	assert.match(dashboardJs, /vm\.tailActivity/);
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

	const runningTailState = resolveStaticAsset("/running-tail-state.mjs");
	assert.ok(runningTailState);
	assert.ok(fs.existsSync(runningTailState.filePath));
	assert.match(fs.readFileSync(runningTailState.filePath, "utf-8"), /isRunningWithoutActiveWorkers/);
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

test("buildLaneDetailModel exposes recent events and log tail", () => {
	const detail = buildLaneDetailModel({
		recentEvents: [
			{
				eventId: "e1",
				type: "lane.heartbeat",
				timestamp: "2026-06-13T00:00:01.000Z",
				summary: "heartbeat",
			},
		],
		logTail: ["line one", "line two"],
		workerLogRef: ".spine/runtime/b1/lanes/lane-1/worker-live-TP-1.log",
	});
	assert.equal(detail.recentEvents.length, 1);
	assert.equal(detail.logTail.length, 2);
	assert.match(detail.workerLogRef ?? "", /worker-live-TP-1\.log/);
});

test("buildLaneTableModel includes lane detail on each row", () => {
	const rows = buildLaneTableModel({
		lanes: [
			{
				laneId: "lane-1",
				laneNumber: 1,
				status: "running",
				recentEvents: [{ eventId: "e1", type: "task.started", timestamp: 1, summary: "started" }],
				logTail: ["worker output"],
				workerLogRef: ".spine/runtime/b1/lanes/lane-1/worker-live-TP-1.log",
			},
		],
	});
	assert.ok(rows[0].detail);
	assert.equal(rows[0].detail.recentEvents.length, 1);
	assert.equal(rows[0].detail.logTail.length, 1);
});

test("buildLaneRecentEvents returns last five lane-scoped journal entries", () => {
	const events = [
		{ type: "batch.started", timestamp: "1" },
		{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "2" },
		{ type: "lane.heartbeat", laneId: "lane-2", timestamp: "3" },
		{ type: "task.started", laneId: "lane-1", payload: { laneNumber: 1 }, timestamp: "4" },
		{ type: "lane.progress_snapshot", laneId: "lane-1", timestamp: "5" },
		{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "6" },
		{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "7" },
		{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "8" },
		{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "9" },
	];
	const recent = buildLaneRecentEvents(1, events, 5);
	assert.equal(recent.length, 5);
	assert.ok(recent.every((entry) => entry.type !== "batch.started"));
	assert.equal(recent.at(-1)?.timestamp, "9");
});

test("buildJournalModel filters by lane id", () => {
	const snapshot = {
		journalTail: [
			{ eventId: "e1", type: "batch.started", timestamp: 1, laneId: null, summary: "started" },
			{ eventId: "e2", type: "lane.heartbeat", timestamp: 2, laneId: "lane-1", summary: "hb1" },
			{ eventId: "e3", type: "lane.heartbeat", timestamp: 3, laneId: "lane-2", summary: "hb2" },
		],
	};
	const filtered = buildJournalModel(snapshot, { laneFilter: "lane-1" });
	assert.equal(filtered.length, 1);
	assert.equal(filtered[0].laneId, "lane-1");
});

test("buildJournalLaneFilterOptions lists lane ids", () => {
	const options = buildJournalLaneFilterOptions({
		lanes: [
			{ laneId: "lane-1", laneNumber: 1 },
			{ laneId: "lane-2", laneNumber: 2 },
		],
	});
	assert.deepEqual(options.map((entry) => entry.laneId), ["lane-1", "lane-2"]);
});

test("buildLaneRows attaches recentEvents and logTail from snapshot inputs", async () => {
	const projectRoot = await initGitRepo("spine-dash-lane-detail-");
	try {
		const batchId = "batch-lane-detail";
		const laneDir = path.join(projectRoot, ".spine", "runtime", batchId, "lanes", "lane-1");
		fs.mkdirSync(laneDir, { recursive: true });
		const logPath = path.join(laneDir, "worker-live-TP-1.log");
		fs.writeFileSync(logPath, Array.from({ length: 12 }, (_, i) => `line-${i + 1}`).join("\n"), "utf-8");

		const journalEvents = [
			{ type: "batch.started", timestamp: "1" },
			{ type: "lane.heartbeat", laneId: "lane-1", timestamp: "2" },
			{ type: "task.started", laneId: "lane-1", taskId: "TP-1", timestamp: "3" },
		];
		const stallConfig = resolveStallConfig({});
		const rows = buildLaneRows({
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["TP-1"], lastHeartbeatAt: Date.now() }],
			classifiedTasks: [
				{
					taskId: "TP-1",
					laneNumber: 1,
					status: "running",
					classification: "running",
				},
			],
			stallConfig,
			currentWaveTaskIds: ["TP-1"],
			journalEvents,
			projectRoot,
			batchId,
		});
		assert.equal(rows[0].recentEvents.length, 2);
		assert.equal(rows[0].logTail.length, 10);
		assert.equal(rows[0].logTail[0], "line-3");
		assert.equal(rows[0].logTail.at(-1), "line-12");
		assert.match(rows[0].workerLogRef ?? "", /worker-live-TP-1\.log/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveLaneWorkerLog prefers live log over terminal output", async () => {
	const projectRoot = await initGitRepo("spine-dash-log-pref-");
	try {
		const batchId = "batch-log-pref";
		const laneDir = path.join(projectRoot, ".spine", "runtime", batchId, "lanes", "lane-1");
		fs.mkdirSync(laneDir, { recursive: true });
		fs.writeFileSync(path.join(laneDir, "worker-output-TP-1.log"), "terminal\n", "utf-8");
		fs.writeFileSync(path.join(laneDir, "worker-live-TP-1.log"), "live\n", "utf-8");
		const resolved = resolveLaneWorkerLog(projectRoot, batchId, 1, ["TP-1"], ["TP-1"]);
		assert.ok(resolved);
		assert.match(resolved.path, /worker-live-TP-1\.log$/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dashboard.js builds gate status without innerHTML", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	const renderGatePanelMatch = dashboardJs.match(/function renderGatePanel[\s\S]*?(?=\nfunction |\n\/\*\* @param)/);
	assert.ok(renderGatePanelMatch, "renderGatePanel function found");
	const renderGatePanelSource = renderGatePanelMatch[0];
	assert.doesNotMatch(renderGatePanelSource, /\.innerHTML/);
	assert.match(renderGatePanelSource, /textContent/);
	assert.match(renderGatePanelSource, /createElement\("span"\)/);
	assert.match(renderGatePanelSource, /gate-status-approved/);
	assert.match(renderGatePanelSource, /gate-status-rejected/);
	assert.match(renderGatePanelSource, /gate-status-pending/);
});

test("dashboard.js uses textContent for gate status badge and kind label", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	const renderGatePanelMatch = dashboardJs.match(/function renderGatePanel[\s\S]*?(?=\nfunction |\n\/\*\* @param)/);
	assert.ok(renderGatePanelMatch);
	const renderGatePanelSource = renderGatePanelMatch[0];
	assert.match(renderGatePanelSource, /badge\.textContent = gateAffordance\.status/);
	assert.match(renderGatePanelSource, /createTextNode\(gateAffordance\.kind \?\? "integrate"\)/);
});

test("dashboard HTML exposes lane detail and journal lane filter hooks", () => {
	const indexHtml = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf-8");
	assert.match(indexHtml, /id="journal-lane-filter"/);
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	assert.match(dashboardJs, /renderLaneDetailPanel/);
	assert.match(dashboardJs, /lane-row-expanded/);
	assert.match(dashboardJs, /journalLaneFilterState/);
	const dashboardCss = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.css"), "utf-8");
	assert.match(dashboardCss, /\.lane-detail-panel/);
});

test("dashboard server HTML includes journal lane filter", async () => {
	const projectRoot = await initGitRepo("spine-dash-lane-filter-");
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
		assert.match(body.data, /journal-lane-filter/);
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});

test("snapshot payload attaches running task title parsed from PROMPT.md (#214)", async () => {
	const projectRoot = await initGitRepo("spine-dash-title-");
	try {
		const base = loadBatchStateFixture("running-batch.json");
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

		// PROMPT.md for the running task TP-002 carries the title (PRD §13.4 em dash).
		const promptDir = path.join(projectRoot, "spine-tasks", "TP-002-beta");
		fs.mkdirSync(promptDir, { recursive: true });
		fs.writeFileSync(
			path.join(promptDir, "PROMPT.md"),
			"# Task: TP-002 — Show running task title in dashboard\n\n## Mission\nRender it.\n",
			"utf-8",
		);

		const snapshot = buildDashboardSnapshot(projectRoot);
		const lane1 = snapshot.lanes.find((lane) => lane.laneId === "lane-1");
		assert.equal(lane1?.runningTaskId, "TP-002");
		assert.equal(lane1?.runningTaskTitle, "Show running task title in dashboard");
		// Lane without a resolvable title degrades gracefully to null.
		const lane2 = snapshot.lanes.find((lane) => lane.laneId === "lane-2");
		assert.equal(lane2?.runningTaskTitle, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveRunningTaskTitles degrades to null when PROMPT.md is unresolvable", () => {
	// Missing tasks root / missing folder / unparseable all yield null, never throw.
	const titles = resolveRunningTaskTitles("/nonexistent-sp665-root", "spine-tasks", [
		{ taskId: "SP-999", taskFolder: "SP-999-missing" },
	]);
	assert.equal(titles.get("SP-999"), null);
	// taskFolder null against a missing tasks root exercises the readdir catch path.
	const scanned = resolveRunningTaskTitles("/nonexistent-sp665-root", "spine-tasks", [
		{ taskId: "SP-000", taskFolder: null },
	]);
	assert.equal(scanned.get("SP-000"), null);
	assert.equal(resolveRunningTaskTitles("/tmp", null, [{ taskId: "X-1" }]).size, 0);

	const lanes = enrichLaneRowsWithRunningTaskTitle(
		[
			{ laneId: "lane-1", runningTaskId: "SP-999" },
			{ laneId: "lane-2", runningTaskId: null },
		],
		titles,
	);
	assert.equal(lanes[0].runningTaskTitle, null);
	assert.equal(lanes[1].runningTaskTitle, null);
});

test("resolveRunningTaskTitles scans tasks root when batch state omits taskFolder", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sp665-scan-"));
	try {
		const folder = path.join(tasksRoot, "SP-424-scan-fallback");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			"# Task: SP-424 — Title resolved via directory scan\n\n## Mission\nScan.\n",
			"utf-8",
		);
		// taskFolder null triggers the `${taskId}-*` fallback scan.
		const titles = resolveRunningTaskTitles(path.dirname(tasksRoot), path.basename(tasksRoot), [
			{ taskId: "SP-424", taskFolder: null },
		]);
		assert.equal(titles.get("SP-424"), "Title resolved via directory scan");
	} finally {
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});

test("dashboard.js running cell renders task id and title with em dash", () => {
	const dashboardJs = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.js"), "utf-8");
	assert.match(dashboardJs, /function formatRunningCell\(taskId, title\)/);
	assert.match(dashboardJs, /`▶ \$\{taskId\} — \$\{title\}`/);
	assert.match(dashboardJs, /function runningCellAriaLabel\(taskId, title\)/);
	assert.match(dashboardJs, /Running task \$\{taskId\} — \$\{title\}/);
	assert.match(dashboardJs, /runningTitleById/);
	assert.match(dashboardJs, /rawLane\.runningTaskTitle/);
});

test("dashboard.css wraps long running-cell titles instead of overflowing", () => {
	const dashboardCss = fs.readFileSync(path.join(PUBLIC_DIR, "dashboard.css"), "utf-8");
	assert.match(dashboardCss, /td\.col-running/);
	assert.match(dashboardCss, /overflow-wrap/);
});
