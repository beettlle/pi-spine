/**
 * SP-435 — Sequence detached false-failure exit.
 * Verifies that the sequence runner does not exit with failure while the
 * detached engine PID is alive and the batch phase is running.
 * Also verifies that engine log tails are filtered to the current batch session.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readCurrentBatchLogTail } from "../../src/batch/detached-start.mjs";
import { waitForSequenceBatchTerminal } from "../../src/batch/sequence.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
	recordBatchEnginePid,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} batchId
 * @param {string} taskId
 * @param {object} [overrides]
 */
function makeBatchState(batchId, taskId, overrides = {}) {
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [{ taskId, laneNumber: 1, status: "pending" }],
		lanes: [{ laneNumber: 1, taskId }],
	});
	return Object.assign(state, overrides);
}

/**
 * Mark a batch state as completed with proper terminal fields.
 * @param {object} state
 */
function markStateCompleted(state) {
	state.phase = "completed";
	state.endedAt = Date.now();
	state.updatedAt = Date.now();
	if (Array.isArray(state.tasks)) {
		for (const t of state.tasks) t.status = "succeeded";
	}
	if (Array.isArray(state.segments)) {
		for (const s of state.segments) s.status = "succeeded";
	}
}

// --- readCurrentBatchLogTail tests ---

test("readCurrentBatchLogTail returns null for missing file", () => {
	assert.equal(readCurrentBatchLogTail("/tmp/no-such-file-sp435.log"), null);
});

test("readCurrentBatchLogTail filters to last batch session header", () => {
	const staleLines = [
		"--- detached batch engine 2026-07-01T17:30:41.000Z argv=batch start SP-001 --attached ---",
		"[spine] batch.started",
		"[spine] task.started SP-001",
		"Batch 20260701T173041 failed at worker launch — repair lane worktree git, then retry",
	];
	const currentLines = [
		"--- detached batch engine 2026-07-01T20:14:56.235Z argv=batch start SP-001 SP-002 --attached ---",
		"[spine] batch.started",
		"[spine] task.started SP-001",
		"[spine] task.started SP-002",
	];
	const logFile = path.join("/tmp", `sp435-log-filter-${Date.now()}.log`);
	fs.writeFileSync(logFile, [...staleLines, ...currentLines].join("\n") + "\n", "utf-8");

	try {
		const tail = readCurrentBatchLogTail(logFile);
		assert.ok(tail, "should return non-null tail");
		assert.ok(!tail.includes("20260701T173041"), "stale batch ID must not appear");
		assert.ok(tail.includes("2026-07-01T20:14:56"), "current session header must appear");
		assert.ok(tail.includes("[spine] task.started SP-002"), "current batch entries must appear");
	} finally {
		fs.unlinkSync(logFile);
	}
});

test("readCurrentBatchLogTail returns full content when no header exists", () => {
	const logFile = path.join("/tmp", `sp435-log-nohdr-${Date.now()}.log`);
	fs.writeFileSync(logFile, "some engine output\nanother line\n", "utf-8");
	try {
		const tail = readCurrentBatchLogTail(logFile);
		assert.ok(tail);
		assert.ok(tail.includes("some engine output"));
		assert.ok(tail.includes("another line"));
	} finally {
		fs.unlinkSync(logFile);
	}
});

test("readCurrentBatchLogTail respects lineCount limit", () => {
	const logFile = path.join("/tmp", `sp435-log-limit-${Date.now()}.log`);
	const lines = [
		"--- detached batch engine 2026-07-02T00:00:00.000Z argv=batch start SP-X --attached ---",
		"line-a",
		"line-b",
		"line-c",
		"line-d",
	];
	fs.writeFileSync(logFile, lines.join("\n") + "\n", "utf-8");
	try {
		const tail = readCurrentBatchLogTail(logFile, 2);
		assert.ok(tail);
		assert.ok(!tail.includes("line-a"), "earlier lines should be trimmed");
		assert.ok(tail.includes("line-c"));
		assert.ok(tail.includes("line-d"));
	} finally {
		fs.unlinkSync(logFile);
	}
});

// --- waitForSequenceBatchTerminal with alive engine PID ---

test("waitForSequenceBatchTerminal returns settled when batch completes before timeout", async () => {
	const projectRoot = await initGitRepo("sp435-poll-settled-");
	try {
		const state = makeBatchState("20260703T120000", "SP-999");
		markStateCompleted(state);
		saveSpineBatchState(projectRoot, state);

		const result = await waitForSequenceBatchTerminal({
			projectRoot,
			pollIntervalMs: 50,
			timeoutMs: 500,
			enginePid: null,
		});
		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("waitForSequenceBatchTerminal does not exit while engine PID is alive", async () => {
	const projectRoot = await initGitRepo("sp435-poll-alive-");
	try {
		const state = makeBatchState("20260703T130000", "SP-998");
		state.phase = "running";
		state.updatedAt = Date.now();
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		const startMs = Date.now();
		const resultPromise = waitForSequenceBatchTerminal({
			projectRoot,
			pollIntervalMs: 50,
			timeoutMs: 100,
			enginePid: process.pid,
		});

		setTimeout(() => {
			const updated = makeBatchState("20260703T130000", "SP-998");
			markStateCompleted(updated);
			saveSpineBatchState(projectRoot, updated, { bypassWriteGuard: true });
		}, 300);

		const result = await resultPromise;
		const elapsedMs = Date.now() - startMs;

		assert.equal(result.ok, true, `expected ok=true but got ${JSON.stringify(result)}`);
		assert.ok(
			elapsedMs >= 200,
			`should have polled past the 100ms timeout (elapsed=${elapsedMs}ms) because engine PID is alive`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("waitForSequenceBatchTerminal returns failure diagnosis even with alive engine", async () => {
	const projectRoot = await initGitRepo("sp435-poll-fail-");
	try {
		const state = makeBatchState("20260703T140000", "SP-997");
		state.phase = "aborted";
		state.endedAt = Date.now();
		state.updatedAt = Date.now();
		saveSpineBatchState(projectRoot, state);

		const result = await waitForSequenceBatchTerminal({
			projectRoot,
			pollIntervalMs: 50,
			timeoutMs: 500,
			enginePid: process.pid,
		});
		assert.equal(result.ok, false);
		assert.equal(result.halted, true);
		assert.equal(result.diagnosis, "aborted");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
