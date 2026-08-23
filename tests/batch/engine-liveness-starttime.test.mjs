import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	evaluateBatchStateWriteGuard,
	readBatchEngineStartedAt,
} from "../../src/batch/state-guards.mjs";
import {
	ENGINE_STARTTIME_TOLERANCE_MS,
	isEngineProcessAlive,
	probeProcessStartTimeMs,
} from "../../src/process/liveness.mjs";

const DEAD_PID = 999_999_999;
const NOW = Date.now();

const aliveTrue = () => true;
const aliveFalse = () => false;

test("dead pid is not alive regardless of start time", () => {
	assert.equal(isEngineProcessAlive(DEAD_PID, NOW), false);
	assert.equal(
		isEngineProcessAlive(DEAD_PID, NOW, {
			isAlive: aliveFalse,
			probeStartTimeMs: () => NOW,
		}),
		false,
	);
});

test("matching start time returns alive", () => {
	assert.equal(
		isEngineProcessAlive(1234, NOW, {
			isAlive: aliveTrue,
			probeStartTimeMs: () => NOW - 2_000,
		}),
		true,
	);
});

test("PID-reuse mismatch (process started after engineStartedAt) returns not-alive", () => {
	assert.equal(
		isEngineProcessAlive(1234, NOW, {
			isAlive: aliveTrue,
			probeStartTimeMs: () => NOW + 10 * 60_000,
		}),
		false,
	);
});

test("PID-reuse mismatch (process started long before engineStartedAt) returns not-alive", () => {
	assert.equal(
		isEngineProcessAlive(1234, NOW, {
			isAlive: aliveTrue,
			probeStartTimeMs: () => NOW - 10 * 60_000,
		}),
		false,
	);
});

test("missing engineStartedAt falls back to PID-only liveness", () => {
	for (const expected of [null, undefined, 0, -5, "not-a-number"]) {
		assert.equal(
			isEngineProcessAlive(1234, expected, {
				isAlive: aliveTrue,
				probeStartTimeMs: () => NOW + 10 * 60_000,
			}),
			true,
		);
	}
});

test("Windows falls back to PID-only even when start time mismatches (documented limitation)", () => {
	assert.equal(
		isEngineProcessAlive(1234, NOW, {
			isAlive: aliveTrue,
			platform: "win32",
			probeStartTimeMs: () => NOW + 10 * 60_000,
		}),
		true,
	);
});

test("unavailable or failing start-time probe falls back to PID-only", () => {
	assert.equal(
		isEngineProcessAlive(1234, NOW, { isAlive: aliveTrue, probeStartTimeMs: () => null }),
		true,
	);
	assert.equal(
		isEngineProcessAlive(1234, NOW, {
			isAlive: aliveTrue,
			probeStartTimeMs: () => {
				throw new Error("probe failed");
			},
		}),
		true,
	);
});

test("custom toleranceMs is respected", () => {
	const options = { isAlive: aliveTrue, toleranceMs: 1_000 };
	assert.equal(
		isEngineProcessAlive(1234, NOW, { ...options, probeStartTimeMs: () => NOW - 500 }),
		true,
	);
	assert.equal(
		isEngineProcessAlive(1234, NOW, { ...options, probeStartTimeMs: () => NOW - 5_000 }),
		false,
	);
});

test("real probe: current process matches a fresh engineStartedAt, rejects a far-future one", () => {
	const probed = probeProcessStartTimeMs(process.pid);
	assert.ok(probed != null && probed > 0, "expected a start-time probe for own pid");
	assert.ok(probed <= Date.now());
	assert.equal(isEngineProcessAlive(process.pid, Date.now()), true);
	assert.equal(
		isEngineProcessAlive(process.pid, Date.now() + ENGINE_STARTTIME_TOLERANCE_MS + 60_000),
		false,
	);
});

test("readBatchEngineStartedAt reads resilience, top-level fallback, and rejects junk", () => {
	assert.equal(readBatchEngineStartedAt({ resilience: { engineStartedAt: 123 } }), 123);
	assert.equal(readBatchEngineStartedAt({ engineStartedAt: 456 }), 456);
	assert.equal(
		readBatchEngineStartedAt({ resilience: { engineStartedAt: -1 }, engineStartedAt: 456 }),
		456,
	);
	assert.equal(readBatchEngineStartedAt({ resilience: {} }), null);
	assert.equal(readBatchEngineStartedAt(null), null);
	assert.equal(readBatchEngineStartedAt("nope"), null);
});

/**
 * @param {object} onDiskState
 */
function makeProjectWithOnDiskState(onDiskState) {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-engine-liveness-guard-"));
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(onDiskState),
	);
	return projectRoot;
}

test("write guard blocks a live engine whose start time matches (same batchId on disk)", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = makeProjectWithOnDiskState({
		batchId: "20260823T000000",
		phase: "running",
		resilience: { enginePid: owner.pid, engineStartedAt: Date.now() },
	});
	try {
		const verdict = evaluateBatchStateWriteGuard(projectRoot, {
			batchId: "20260823T000000",
			phase: "running",
		});
		assert.deepEqual(verdict, { allowed: false, reason: "stale_engine_pid" });
	} finally {
		owner.kill("SIGKILL");
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("write guard does not block on PID reuse: pid alive but start time mismatched (#259)", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = makeProjectWithOnDiskState({
		batchId: "20260823T000000",
		phase: "running",
		resilience: {
			enginePid: owner.pid,
			// Recorded far in the future so the real probe of this pid mismatches,
			// simulating a recycled PID now owned by an unrelated process.
			engineStartedAt: Date.now() + ENGINE_STARTTIME_TOLERANCE_MS + 60_000,
		},
	});
	try {
		const verdict = evaluateBatchStateWriteGuard(projectRoot, {
			batchId: "20260823T000000",
			phase: "running",
		});
		assert.deepEqual(verdict, { allowed: true });
	} finally {
		owner.kill("SIGKILL");
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});
