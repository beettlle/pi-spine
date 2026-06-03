import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	activitySignalsChanged,
	collectProgressSignals,
	computeStallDeadline,
	findLatestStepCompletedMs,
	progressSignalsChanged,
	resolveStallConfig,
} from "../../src/batch/heartbeat.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("resolveStallConfig applies lane overrides", () => {
	const cfg = resolveStallConfig({
		lanes: {
			stallTimeoutMinutes: 30,
			stallGraceAfterProgressMinutes: 10,
			heartbeatIntervalMinutes: 5,
		},
	});
	assert.equal(cfg.stallTimeoutMs, 30 * 60 * 1000);
	assert.equal(cfg.graceAfterProgressMs, 10 * 60 * 1000);
	assert.equal(cfg.heartbeatIntervalMs, 5 * 60 * 1000);
});

test("progressSignalsChanged detects STATUS mtime updates", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-"));
	const statusPath = path.join(dir, "STATUS.md");
	fs.writeFileSync(statusPath, "a", "utf-8");
	const first = collectProgressSignals({ worktreePath: dir, taskFolder: dir });
	assert.equal(progressSignalsChanged(null, first), true);
	fs.writeFileSync(statusPath, "ab", "utf-8");
	const second = collectProgressSignals({ worktreePath: dir, taskFolder: dir });
	assert.equal(progressSignalsChanged(first, second), true);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("computeStallDeadline extends past hard timeout after progress", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const lastProgressAt = 30 * 60 * 1000;
	const deadline = computeStallDeadline({ startedAt, lastProgressAt, stallConfig });
	assert.equal(deadline, lastProgressAt + stallConfig.graceAfterProgressMs);
});

test("stall false positive avoided when STATUS updates extend deadline (I-01)", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const hardDeadline = startedAt + stallConfig.stallTimeoutMs;
	const lastProgressAt = 35 * 60 * 1000;
	const deadline = computeStallDeadline({ startedAt, lastProgressAt, stallConfig });
	const now = 40 * 60 * 1000;
	assert.ok(now >= hardDeadline, "simulated worker silent past hard timeout");
	assert.ok(now < deadline, "STATUS/progress grace keeps worker alive");
});

test("findLatestStepCompletedMs returns newest matching task.step_completed", () => {
	const events = [
		{
			type: "task.step_completed",
			taskId: "TP-036",
			laneId: "lane-1",
			timestamp: "2026-06-02T10:00:00.000Z",
		},
		{
			type: "task.step_completed",
			taskId: "TP-036",
			laneId: "lane-1",
			timestamp: "2026-06-02T11:00:00.000Z",
		},
		{
			type: "task.step_completed",
			taskId: "TP-999",
			laneId: "lane-1",
			timestamp: "2026-06-02T12:00:00.000Z",
		},
	];
	const latest = findLatestStepCompletedMs(events, { laneNumber: 1, taskId: "TP-036" });
	assert.equal(latest, Date.parse("2026-06-02T11:00:00.000Z"));
});

test("progressSignalsChanged detects journal task.step_completed (silent tools)", () => {
	const projectRoot = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-step-"));
	const batchId = "20260602T140000";
	const taskFolder = path.join(projectRoot, "task");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "unchanged", "utf-8");

	const first = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder,
		journalContext: { projectRoot, batchId, laneNumber: 1, taskId: "TP-036" },
	});
	assert.equal(first.stepCompletedAtMs, null);

	appendJournalEvent(projectRoot, batchId, "task.step_completed", {
		taskId: "TP-036",
		laneNumber: 1,
		step: 1,
		checkboxesComplete: 1,
		checkboxesTotal: 2,
	});

	const second = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder,
		journalContext: { projectRoot, batchId, laneNumber: 1, taskId: "TP-036" },
	});
	assert.ok(second.stepCompletedAtMs);
	assert.equal(progressSignalsChanged(first, second), true);

	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const deadline = computeStallDeadline({
		startedAt,
		lastProgressAt: second.stepCompletedAtMs,
		stallConfig,
	});
	const now = 5 * 60 * 1000;
	assert.ok(now >= startedAt + stallConfig.stallTimeoutMs);
	assert.ok(now < deadline, "step_completed extends stall grace without STATUS/git changes");

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("activitySignalsChanged detects file-scope mtime updates (FR-WORK-10 / FR-STALL-02)", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-scope-"));
	const scopeFile = path.join(dir, "src", "touch.txt");
	fs.mkdirSync(path.dirname(scopeFile), { recursive: true });
	fs.writeFileSync(scopeFile, "a", "utf-8");
	const first = collectProgressSignals({
		worktreePath: dir,
		taskFolder: dir,
		fileScopePaths: ["src/touch.txt"],
	});
	fs.writeFileSync(scopeFile, "ab", "utf-8");
	const second = collectProgressSignals({
		worktreePath: dir,
		taskFolder: dir,
		fileScopePaths: ["src/touch.txt"],
	});
	assert.equal(activitySignalsChanged(first, second), true);
	assert.equal(progressSignalsChanged(first, second), false);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("startBatch records lane.heartbeat during stub worker delay", async () => {
	const projectRoot = await initGitRepo("spine-heartbeat-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevDelay = process.env.SPINE_WORKER_STUB_DELAY_MS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_DELAY_MS = "2500";
	try {
		const cfgPath = path.join(projectRoot, ".spine/spine-config.json");
		const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
		cfg.lanes = {
			...cfg.lanes,
			heartbeatIntervalMinutes: 0.02,
			stallTimeoutMinutes: 10,
			stallGraceAfterProgressMinutes: 5,
		};
		fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");

		const taskId = "TP-999";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Smoke\n\n## Mission\nSmoke.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`README.md\`\n\n## Steps\n### Step 0\n- [ ] one\n`,
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks/dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		const types = events.map((e) => e.type);
		assert.ok(types.includes("lane.heartbeat"), `journal types: ${types.join(", ")}`);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevDelay === undefined) delete process.env.SPINE_WORKER_STUB_DELAY_MS;
		else process.env.SPINE_WORKER_STUB_DELAY_MS = prevDelay;
		await destroyGitRepo(projectRoot);
	}
});
