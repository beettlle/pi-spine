/**
 * SP-440 — Supervisor spawn MVP tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	DEFAULT_SUPERVISOR_POLL_INTERVAL_MS,
	buildSupervisorNudgePayload,
	buildSupervisorObservationPayload,
	clearSupervisorState,
	isSupervisorMonitorTerminal,
	isSupervisorSpawnEnabled,
	killSupervisor,
	maybeSpawnSupervisorOnDetachedStart,
	readSupervisorState,
	resolveSupervisorModel,
	resolveSupervisorPollIntervalMs,
	runSupervisorMonitorLoop,
	shouldEmitSupervisorNudge,
	spawnDetachedSupervisor,
	SUPERVISOR_NUDGE_DIAGNOSES,
} from "../../src/batch/supervisor-spawn.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("isSupervisorSpawnEnabled defaults to false", () => {
	assert.equal(isSupervisorSpawnEnabled({}), false);
	assert.equal(isSupervisorSpawnEnabled({ agents: { supervisor: {} } }), false);
	assert.equal(
		isSupervisorSpawnEnabled({ agents: { supervisor: { enabled: true } } }),
		true,
	);
});

test("resolveSupervisorPollIntervalMs uses default and honors config", () => {
	assert.equal(resolveSupervisorPollIntervalMs({}), DEFAULT_SUPERVISOR_POLL_INTERVAL_MS);
	assert.equal(
		resolveSupervisorPollIntervalMs({ agents: { supervisor: { pollIntervalMs: 5000 } } }),
		5000,
	);
	assert.equal(
		resolveSupervisorPollIntervalMs({ agents: { supervisor: { pollIntervalMs: 100 } } }),
		DEFAULT_SUPERVISOR_POLL_INTERVAL_MS,
	);
});

test("resolveSupervisorModel returns inherit by default", () => {
	assert.equal(resolveSupervisorModel({}), "inherit");
	assert.equal(
		resolveSupervisorModel({ agents: { supervisor: { model: "google/gemini-flash-latest" } } }),
		"google/gemini-flash-latest",
	);
});

test("shouldEmitSupervisorNudge covers actionable diagnoses", () => {
	for (const diagnosis of SUPERVISOR_NUDGE_DIAGNOSES) {
		assert.equal(shouldEmitSupervisorNudge(diagnosis), true, diagnosis);
	}
	assert.equal(shouldEmitSupervisorNudge("running"), false);
	assert.equal(shouldEmitSupervisorNudge(null), false);
});

test("buildSupervisorObservationPayload shapes reconcile fields", () => {
	const payload = buildSupervisorObservationPayload({
		diagnosis: "running",
		macroPhase: "executing",
		macroPhaseLabel: "Executing",
		phase: "running",
		suggestedCommand: "spine status --diagnose",
		signals: {
			tasks: [
				{ status: "running" },
				{ status: "pending" },
				{ status: "succeeded" },
			],
		},
	});
	assert.equal(payload.diagnosis, "running");
	assert.equal(payload.macroPhase, "executing");
	assert.equal(payload.runningTaskCount, 1);
	assert.equal(payload.pendingTaskCount, 1);
	assert.equal(payload.suggestedCommand, "spine status --diagnose");
});

test("buildSupervisorNudgePayload includes headline and suggestedCommand", () => {
	const payload = buildSupervisorNudgePayload("needs_retry", { batchId: "20260705T120000" });
	assert.equal(payload.diagnosis, "needs_retry");
	assert.ok(payload.headline);
	assert.ok(payload.suggestedCommand);
});

test("isSupervisorMonitorTerminal detects terminal phases and diagnoses", () => {
	assert.equal(isSupervisorMonitorTerminal({ batchId: "x", phase: "completed" }), true);
	assert.equal(isSupervisorMonitorTerminal({ batchId: "x", phase: "failed" }), true);
	assert.equal(
		isSupervisorMonitorTerminal({ batchId: "x", phase: "running", diagnosis: "completed" }),
		true,
	);
	assert.equal(
		isSupervisorMonitorTerminal({ batchId: "x", phase: "running", diagnosis: "running" }),
		false,
	);
	assert.equal(isSupervisorMonitorTerminal({ batchId: null }), true);
});

test("spawnDetachedSupervisor does not spawn when disabled", async () => {
	const projectRoot = await initGitRepo("sp440-disabled-");
	try {
		const batchId = "20260705T100000";
		const result = spawnDetachedSupervisor({
			projectRoot,
			batchId,
			config: { agents: { supervisor: { enabled: false } } },
		});
		assert.equal(result.spawned, false);
		assert.equal(readSupervisorState(projectRoot, batchId), null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("enabled:true journals supervisor.started and supervisor.stopped on terminal", async () => {
	const projectRoot = await initGitRepo("sp440-enabled-");
	const batchId = "20260705T110000";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-440"]],
			tasks: [{ taskId: "SP-440", laneNumber: 1, status: "succeeded" }],
			lanes: [{ laneNumber: 1, taskId: "SP-440" }],
		});
		state.phase = "completed";
		state.endedAt = Date.now();
		saveSpineBatchState(projectRoot, state);

		const config = {
			agents: {
				supervisor: { enabled: true, pollIntervalMs: 10, model: "cursor/auto" },
			},
		};

		await runSupervisorMonitorLoop({
			projectRoot,
			batchId,
			config,
			supervisorPid: 4242,
		});

		const events = readJournalEvents(projectRoot, batchId);
		const types = events.map((event) => event.type);
		assert.ok(types.includes("supervisor.started"), types.join(", "));
		assert.ok(types.includes("supervisor.observation"), types.join(", "));
		assert.ok(types.includes("supervisor.stopped"), types.join(", "));

		const started = events.find((event) => event.type === "supervisor.started");
		assert.equal(started.payload.batchId, batchId);
		assert.equal(started.payload.model, "cursor/auto");
		assert.equal(started.payload.pid, 4242);

		const stopped = events.find((event) => event.type === "supervisor.stopped");
		assert.equal(stopped.payload.reason, "batch_terminal");
		assert.equal(readSupervisorState(projectRoot, batchId), null);
	} finally {
		clearSupervisorState(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("enabled:false produces no supervisor journal events via maybeSpawnSupervisorOnDetachedStart", async () => {
	const projectRoot = await initGitRepo("sp440-maybe-disabled-");
	const batchId = "20260705T120000";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-440"]],
			tasks: [{ taskId: "SP-440", laneNumber: 1, status: "running" }],
			lanes: [{ laneNumber: 1, taskId: "SP-440" }],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = maybeSpawnSupervisorOnDetachedStart({
			projectRoot,
			batchId,
			config: { agents: { supervisor: { enabled: false } } },
		});
		assert.equal(result.spawned, false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.some((event) => String(event.type).startsWith("supervisor.")),
			false,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("killSupervisor journals supervisor.stopped and clears state", async () => {
	const projectRoot = await initGitRepo("sp440-kill-");
	const batchId = "20260705T130000";
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "runtime", batchId, "journal", "events.jsonl"),
			"",
			"utf-8",
		);

		const { writeSupervisorState } = await import("../../src/batch/supervisor-spawn.mjs");
		// Use a non-existent PID so killSupervisor does not signal the test runner.
		writeSupervisorState(projectRoot, batchId, { pid: 999_999, model: "inherit" });

		const result = killSupervisor({ projectRoot, batchId, reason: "test_kill" });
		assert.equal(result.killed, true);
		assert.equal(readSupervisorState(projectRoot, batchId), null);

		const events = readJournalEvents(projectRoot, batchId);
		const stopped = events.find((event) => event.type === "supervisor.stopped");
		assert.ok(stopped);
		assert.equal(stopped.payload.reason, "test_kill");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spawnDetachedSupervisor spawns monitor child when enabled", async () => {
	const projectRoot = await initGitRepo("sp440-spawn-child-");
	const batchId = "20260705T140000";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-440"]],
			tasks: [{ taskId: "SP-440", laneNumber: 1, status: "running" }],
			lanes: [{ laneNumber: 1, taskId: "SP-440" }],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const result = spawnDetachedSupervisor({
			projectRoot,
			batchId,
			config: {
				agents: { supervisor: { enabled: true, pollIntervalMs: 50, model: "inherit" } },
			},
		});
		assert.equal(result.spawned, true);
		assert.ok(result.supervisorPid);

		const supervisorState = readSupervisorState(projectRoot, batchId);
		assert.equal(supervisorState.pid, result.supervisorPid);

		const deadline = Date.now() + 5_000;
		let sawStarted = false;
		while (Date.now() < deadline) {
			const events = readJournalEvents(projectRoot, batchId);
			if (events.some((event) => event.type === "supervisor.started")) {
				sawStarted = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		assert.equal(sawStarted, true);

		killSupervisor({ projectRoot, batchId, reason: "test_cleanup" });
	} finally {
		clearSupervisorState(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});
