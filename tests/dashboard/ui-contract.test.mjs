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
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PUBLIC_DIR = path.join(process.cwd(), "src/dashboard/public");

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
		batch: {
			batchId: "b1",
			phase: "running",
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
	assert.equal(vm.waves.totalWaves, 2);
	assert.equal(vm.lanes.length, 1);
	assert.equal(vm.gate?.status, "open");
	assert.equal(vm.gateAffordance?.status, "open");
	assert.ok(vm.showGateAffordance);
	assert.equal(vm.journal.length, 1);
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
		assert.match(body.data, /dashboard\.css/);
		assert.ok(fs.existsSync(path.join(PUBLIC_DIR, "dashboard.css")));
	} finally {
		await new Promise((resolve) => server.close(resolve));
		await destroyGitRepo(projectRoot);
	}
});
