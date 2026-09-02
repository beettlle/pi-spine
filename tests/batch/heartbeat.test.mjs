import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	activitySignalsChanged,
	buildHeartbeatPayloadFields,
	collectProgressSignals,
	computeStallDeadline,
	findLatestStepCompletedMs,
	isStaticNullProgressSnapshot,
	progressSignalsChanged,
	recordLaneHeartbeat,
	resolveHeartbeatKind,
	resolveStallConfig,
	shouldEmitCheckpointWarning,
} from "../../src/batch/heartbeat.mjs";
import { createWorkerPollState, pollWorkerUntilSettled } from "../../src/batch/worker-heartbeat.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

test("resolveHeartbeatKind marks launching as worker_alive only", () => {
	assert.equal(
		resolveHeartbeatKind({
			workerPhase: "launching",
			checkpointChanged: true,
			activityChanged: true,
		}),
		"worker_alive",
	);
	assert.equal(
		resolveHeartbeatKind({
			workerPhase: "pi",
			checkpointChanged: true,
		}),
		"checkpoint",
	);
	assert.equal(
		resolveHeartbeatKind({
			workerPhase: "pi",
			activityChanged: true,
		}),
		"file_scope_activity",
	);
});

test("shouldEmitCheckpointWarning skips launching phase", () => {
	const stallConfig = resolveStallConfig({
		lanes: { checkpointWarningMinutes: 1 },
	});
	const signals = { dirtyPaths: ["src/a.mjs"], fileScopeMtimeMs: Date.now() };
	assert.equal(
		shouldEmitCheckpointWarning({
			now: 120_000,
			lastCheckpointAt: 0,
			signals,
			stallConfig,
			activitySinceCheckpoint: true,
			workerPhase: "launching",
		}),
		false,
	);
	assert.equal(
		shouldEmitCheckpointWarning({
			now: 120_000,
			lastCheckpointAt: 0,
			signals,
			stallConfig,
			activitySinceCheckpoint: true,
			workerPhase: "pi",
		}),
		true,
	);
});

test("buildHeartbeatPayloadFields omits stale checkpoint signals during launching", () => {
	const signals = {
		statusMtimeMs: 123,
		lastCommitAtMs: 456,
		fileScopeMtimeMs: 789,
		dirtyPaths: ["src/a.mjs"],
	};
	const launching = buildHeartbeatPayloadFields(signals, "launching", "worker_alive");
	assert.equal(launching.statusMtimeMs, null);
	assert.equal(launching.lastCommitAtMs, null);
	assert.equal(launching.fileScopeMtimeMs, null);
	assert.equal(launching.dirtyPathCount, 0);

	const checkpoint = buildHeartbeatPayloadFields(signals, "pi", "checkpoint");
	assert.equal(checkpoint.statusMtimeMs, 123);
	assert.equal(checkpoint.dirtyPathCount, 1);
});

test("recordLaneHeartbeat journals kind and phase", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hb-kind-"));
	const batchId = "20260603T120000";
	const signals = collectProgressSignals({
		worktreePath: projectRoot,
		taskFolder: projectRoot,
	});
	recordLaneHeartbeat({
		projectRoot,
		batchId,
		laneNumber: 2,
		taskId: "SP-084",
		signals,
		correlationId: "corr-1",
		workerPhase: "launching",
		heartbeatKind: "worker_alive",
	});
	const events = readJournalEvents(projectRoot, batchId);
	const heartbeat = events.find((event) => event.type === "lane.heartbeat");
	assert.ok(heartbeat);
	assert.equal(heartbeat.payload.heartbeatKind, "worker_alive");
	assert.equal(heartbeat.payload.workerPhase, "launching");
	assert.equal(heartbeat.payload.statusMtimeMs, null);
	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("runWorker launching heartbeat does not journal stale STATUS mtime on fast-fail retry", async () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hb-retry-"));
	const batchId = "20260603T130000";
	const taskId = "TP-084";
	const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-retry`);
	fs.mkdirSync(taskFolder, { recursive: true });
	const staleStatusMtime = Date.now() - 60 * 60 * 1000;
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "stale from prior attempt", "utf-8");
	fs.utimesSync(path.join(taskFolder, "STATUS.md"), staleStatusMtime / 1000, staleStatusMtime / 1000);
	fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
	const launchScript = path.join(projectRoot, "scripts/spine-worker-launch.sh");
	fs.writeFileSync(
		launchScript,
		"#!/bin/sh\nsleep 2\nexec \"$@\"\n",
		{ encoding: "utf-8", mode: 0o755 },
	);
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n## Review Level: 0\n\n## Mission\nFail fast.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`README.md\`\n\n## Steps\n### Step 0\n- [ ] one\n`,
		"utf-8",
	);

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = taskId;
	try {
		const result = await runWorker({
			worktreePath: projectRoot,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 2,
			taskId,
			config: {
				lanes: {
					heartbeatIntervalMinutes: 0.001,
					stallTimeoutMinutes: 10,
					stallGraceAfterProgressMinutes: 5,
				},
				development: { workerLaunchScript: "scripts/spine-worker-launch.sh" },
			},
		});
		assert.equal(result.ok, false);

		const events = readJournalEvents(projectRoot, batchId);
		const heartbeats = events.filter((event) => event.type === "lane.heartbeat");
		const launchingHeartbeats = heartbeats.filter(
			(event) => event.payload.workerPhase === "launching",
		);
		assert.ok(launchingHeartbeats.length > 0, "expected launching heartbeat before fast fail");
		for (const heartbeat of launchingHeartbeats) {
			assert.equal(heartbeat.payload.heartbeatKind, "worker_alive");
			assert.equal(heartbeat.payload.statusMtimeMs, null);
		}
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("isStaticNullProgressSnapshot detects all-null/zero progress snapshots (#272)", () => {
	assert.equal(isStaticNullProgressSnapshot(null), true);
	assert.equal(isStaticNullProgressSnapshot(undefined), true);
	assert.equal(
		isStaticNullProgressSnapshot({
			statusMtimeMs: null,
			lastCommitAtMs: null,
			fileScopeMtimeMs: null,
			dirtyPaths: [],
		}),
		true,
	);
	assert.equal(
		isStaticNullProgressSnapshot({
			statusMtimeMs: 123,
			lastCommitAtMs: null,
			fileScopeMtimeMs: null,
			dirtyPaths: [],
		}),
		false,
	);
	assert.equal(
		isStaticNullProgressSnapshot({
			statusMtimeMs: null,
			lastCommitAtMs: 456,
			fileScopeMtimeMs: null,
			dirtyPaths: [],
		}),
		false,
	);
	assert.equal(
		isStaticNullProgressSnapshot({
			statusMtimeMs: null,
			lastCommitAtMs: null,
			fileScopeMtimeMs: 789,
			dirtyPaths: [],
		}),
		false,
	);
	assert.equal(
		isStaticNullProgressSnapshot({
			statusMtimeMs: null,
			lastCommitAtMs: null,
			fileScopeMtimeMs: null,
			dirtyPaths: ["src/a.mjs"],
		}),
		false,
	);
});

/**
 * Static-poll stall fixtures share tiny test budgets and a fast poll tick; the
 * default 30s poll interval would make the loop iterate only once per stall.
 */
function stallTestStallConfig() {
	return {
		...resolveStallConfig({
			lanes: {
				stallTimeoutMinutes: 0.05, // 3s hard stall budget
				stallGraceAfterProgressMinutes: 0.01,
				heartbeatIntervalMinutes: 0.001, // heartbeat every ~60ms
			},
		}),
		pollIntervalMs: 25,
	};
}

/**
 * Build a SIGSTOP-style hung-worker proxy: the child never exits on its own
 * (0% CPU, no writes, no session transcript — the #272 observable), and only
 * the engine's terminate path (kill → childDone resolution) ends it.
 */
function hungWorkerChild() {
	let releaseChildDone = () => {};
	const childDone = new Promise((resolve) => {
		releaseChildDone = () => resolve({ exitCode: 137, output: "" });
	});
	const workerChild = {
		pid: 0,
		exitCode: null,
		kill: () => releaseChildDone(),
	};
	return { workerChild, childDone };
}

test("static-null worker_alive heartbeats do not refresh stall anchor; stall fires past budget (#272)", { timeout: 30_000 }, async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-stall-"));
	const batchId = "20260830T090000";
	// Empty worktree/task folder: no git commits, no STATUS.md, no file-scope
	// files — every poll yields the static-null snapshot from #272's journal.
	const { workerChild, childDone } = hungWorkerChild();
	const startedAt = Date.now();
	const pollState = createWorkerPollState(startedAt, "pi");
	let failureInput = null;
	try {
		const result = await pollWorkerUntilSettled({
			donePath: path.join(dir, ".DONE"),
			workerChild,
			childDone,
			stallConfig: stallTestStallConfig(),
			startedAt,
			pollState,
			worktreePath: dir,
			taskFolder: dir,
			projectRoot: dir,
			batchId,
			laneNumber: 1,
			taskId: "SP-737",
			laneCorrelationId: "corr-stall",
			useStub: true,
			workerBackend: "stub",
			childPastPreflight: true,
			buildFailureResult: (input) => {
				failureInput = input;
				return { classification: input.classification };
			},
			workerMode: "stub",
		});

		assert.equal(result.kind, "failure");
		assert.equal(result.result.classification, "stall_timeout");
		assert.equal(failureInput?.classification, "stall_timeout");
		assert.ok(failureInput?.stallDeadline, "failure carries stall deadline");
		assert.equal(failureInput?.signals?.statusMtimeMs ?? null, null);
		assert.equal(failureInput?.signals?.lastCommitAtMs ?? null, null);
		assert.equal(failureInput?.signals?.fileScopeMtimeMs ?? null, null);
		assert.equal(failureInput?.signals?.dirtyPaths?.length ?? 0, 0);

		const events = readJournalEvents(dir, batchId);
		const heartbeats = events.filter((event) => event.type === "lane.heartbeat");
		assert.ok(
			heartbeats.length >= 2,
			`expected repeated healthy heartbeats before stall, got ${heartbeats.length}`,
		);
		for (const heartbeat of heartbeats) {
			assert.equal(heartbeat.payload.heartbeatKind, "worker_alive");
			assert.equal(heartbeat.payload.workerPhase, "pi");
			assert.equal(heartbeat.payload.statusMtimeMs, null);
			assert.equal(heartbeat.payload.dirtyPathCount, 0);
		}
		const stallWarningIndex = events.findIndex((event) => event.type === "lane.stall_warning");
		assert.ok(stallWarningIndex >= 0, "lane.stall_warning journaled past budget");
		const lastHeartbeatIndex = events.map((event) => event.type).lastIndexOf("lane.heartbeat");
		assert.ok(
			stallWarningIndex > lastHeartbeatIndex,
			"stall warning follows the healthy heartbeat stream",
		);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("static non-null snapshots still slide stall anchor on worker_alive (SP-341 kept)", { timeout: 30_000 }, async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-slide-"));
	const batchId = "20260830T091000";
	// Non-null but static progress: STATUS.md exists with a fixed mtime — a worker
	// mid-step between checkpoints keeps its liveness grace (SP-341). Only the
	// all-null static-null case must lose the anchor slide (#272).
	fs.writeFileSync(path.join(dir, "STATUS.md"), "step 1", "utf-8");
	const { workerChild, childDone } = hungWorkerChild();
	const startedAt = Date.now();
	const pollState = createWorkerPollState(startedAt, "pi");
	// Worker finishes at ~4.5s — 1.5s past the 3s hard budget it would have hit if
	// the fix overreached and stopped sliding on every static worker_alive stream.
	const exitTimer = setTimeout(() => {
		workerChild.exitCode = 0;
	}, 4_500);
	try {
		const result = await pollWorkerUntilSettled({
			donePath: path.join(dir, ".DONE"),
			workerChild,
			childDone,
			stallConfig: stallTestStallConfig(),
			startedAt,
			pollState,
			worktreePath: dir,
			taskFolder: dir,
			projectRoot: dir,
			batchId,
			laneNumber: 1,
			taskId: "SP-737",
			laneCorrelationId: "corr-slide",
			useStub: true,
			workerBackend: "stub",
			childPastPreflight: true,
			buildFailureResult: (input) => ({ classification: input.classification }),
			workerMode: "stub",
		});

		assert.equal(result.kind, "settled");
		const events = readJournalEvents(dir, batchId);
		assert.equal(
			events.some((event) => event.type === "lane.stall_warning"),
			false,
			"no stall warning while a real checkpoint signal exists",
		);
		const aliveHeartbeats = events.filter(
			(event) =>
				event.type === "lane.heartbeat" && event.payload.heartbeatKind === "worker_alive",
		);
		assert.ok(aliveHeartbeats.length >= 2, "worker_alive heartbeats keep sliding the anchor");
	} finally {
		clearTimeout(exitTimer);
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

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
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-"));
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
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hb-step-"));
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
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-scope-"));
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
			minimalValidPromptMarkdown(taskId, { fileScope: "README.md", mission: "Smoke." }),
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
