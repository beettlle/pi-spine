/**
 * SP-722 — global inter-process lock for batch-state writers (GitHub #264).
 *
 * Proves concurrent multi-process writers lose no updates when RMW cycles run
 * under `withBatchStateLock`, and that `appendBatchHistoryEntry` /
 * `saveSpineBatchState` are serialized by the same lock.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { batchStateLockPath, withBatchStateLock } from "../../src/batch/batch-state-lock.mjs";
import {
	appendBatchHistoryEntry,
	batchHistoryPath,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state-io.mjs";
import { abortSignalPath, readAbortSignal, writeAbortSignal } from "../../src/batch/abort.mjs";

const LOCK_MODULE_URL = new URL("../../src/batch/batch-state-lock.mjs", import.meta.url).href;
const STATE_IO_MODULE_URL = new URL("../../src/batch/state-io.mjs", import.meta.url).href;

/**
 * Child-writer script source. Modes:
 * - `rmw`: N locked read-modify-write cycles on batch-state plus one history
 *   append per cycle.
 * - `hold`: acquire the lock, touch a ready file, hold for holdMs, release.
 */
const CHILD_SCRIPT = String.raw`
import fs from "node:fs";
const [projectRoot, lockModuleUrl, stateIoUrl, mode, writerId, iterations, readyPath, holdMsRaw] =
	process.argv.slice(2);
const { withBatchStateLock } = await import(lockModuleUrl);

if (mode === "hold") {
	withBatchStateLock(projectRoot, () => {
		fs.writeFileSync(readyPath, String(process.pid), "utf-8");
		const holdMs = Number(holdMsRaw);
		const end = Date.now() + holdMs;
		while (Date.now() < end) {
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
		}
	});
	process.exit(0);
}

const { loadSpineBatchState, saveSpineBatchState, appendBatchHistoryEntry } = await import(
	stateIoUrl
);
const count = Number(iterations);
for (let i = 0; i < count; i++) {
	// State RMW and history append share one critical section (#264 AC).
	withBatchStateLock(projectRoot, () => {
		const loaded = loadSpineBatchState(projectRoot);
		if (loaded.parseError) {
			throw new Error("batch-state parseError under lock: " + loaded.parseError);
		}
		const prev = loaded.raw ?? { batchId: "lock-test", phase: "running" };
		const markers = Array.isArray(prev.lockTestMarkers) ? prev.lockTestMarkers.slice() : [];
		markers.push(writerId + ":" + i);
		saveSpineBatchState(
			projectRoot,
			{ ...prev, lockTestMarkers: markers },
			{ bypassWriteGuard: true },
		);
		appendBatchHistoryEntry(projectRoot, {
			batchId: "lock-test",
			action: "lock-test",
			writerId,
			seq: i,
		});
	});
}
process.exit(0);
`;

/**
 * Spawn a child-writer process and resolve with its exit details.
 *
 * @param {string} scriptPath
 * @param {string[]} args
 * @returns {Promise<{ code: number|null, stderr: string }>}
 */
function runChild(scriptPath, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [scriptPath, ...args], { stdio: ["ignore", "ignore", "pipe"] });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve({ code, stderr }));
	});
}

/** Write the shared child-writer script into a temp dir. */
function writeChildScript(projectRoot) {
	const scriptPath = path.join(projectRoot, "lock-writer-child.mjs");
	fs.writeFileSync(scriptPath, CHILD_SCRIPT, "utf-8");
	return scriptPath;
}

test(
	"concurrent multi-process writers lose no state updates or history entries",
	{ timeout: 90_000 },
	async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-concurrent-"));
		try {
			const scriptPath = writeChildScript(projectRoot);
			saveSpineBatchState(projectRoot, { batchId: "lock-test", phase: "running" });

			const writers = 4;
			const iterations = 25;
			const children = [];
			for (let w = 0; w < writers; w++) {
				children.push(
					runChild(scriptPath, [
						projectRoot,
						LOCK_MODULE_URL,
						STATE_IO_MODULE_URL,
						"rmw",
						`w${w}`,
						String(iterations),
						"",
						"",
					]),
				);
			}
			const results = await Promise.all(children);
			for (const result of results) {
				assert.equal(result.code, 0, `child writer failed: ${result.stderr}`);
			}

			// No lost updates: every locked RMW cycle pushed exactly one marker.
			const loaded = loadSpineBatchState(projectRoot);
			assert.equal(
				loaded.parseError,
				null,
				`batch-state must remain valid after concurrent writers; got: ${loaded.parseError}`,
			);
			const markers = loaded.raw?.lockTestMarkers ?? [];
			assert.equal(markers.length, writers * iterations);
			assert.equal(new Set(markers).size, writers * iterations);

			// History appends from all processes survive.
			const history = JSON.parse(fs.readFileSync(batchHistoryPath(projectRoot), "utf-8"));
			assert.equal(history.length, writers * iterations);
			const historyKeys = new Set(history.map((entry) => `${entry.writerId}:${entry.seq}`));
			assert.equal(historyKeys.size, writers * iterations);

			// Lock file is released after all writers finish.
			assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	},
);

test("withBatchStateLock is re-entrant within the same process", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-reentrant-"));
	try {
		const result = withBatchStateLock(projectRoot, () => {
			// Nested save + append compose through the lock without self-deadlock.
			saveSpineBatchState(projectRoot, { batchId: "lock-test", phase: "running" });
			appendBatchHistoryEntry(projectRoot, { batchId: "lock-test", action: "nested" });
			return withBatchStateLock(projectRoot, () => "inner-result");
		});
		assert.equal(result, "inner-result");
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);

		const history = JSON.parse(fs.readFileSync(batchHistoryPath(projectRoot), "utf-8"));
		assert.equal(history.length, 1);
		assert.equal(history[0].action, "nested");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("stale lock from a dead holder is broken", { timeout: 30_000 }, async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-stale-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		fs.mkdirSync(path.dirname(lockPath), { recursive: true });

		// A child takes the lock file with its own PID and exits without releasing.
		const orphan = spawn(
			process.execPath,
			["-e", `require("node:fs").writeFileSync(${JSON.stringify(lockPath)}, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), { flag: "wx" })`],
		);
		await new Promise((resolve) => orphan.once("exit", resolve));
		assert.equal(fs.existsSync(lockPath), true);

		const startedAt = Date.now();
		const ran = withBatchStateLock(projectRoot, () => "acquired");
		assert.equal(ran, "acquired");
		// Stale break is immediate — nowhere near the 30s acquisition timeout.
		assert.ok(Date.now() - startedAt < 10_000);
		assert.equal(fs.existsSync(lockPath), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("corrupt lock payload is broken and reacquired", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-corrupt-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		fs.mkdirSync(path.dirname(lockPath), { recursive: true });
		fs.writeFileSync(lockPath, "not json at all", "utf-8");

		const ran = withBatchStateLock(projectRoot, () => "acquired");
		assert.equal(ran, "acquired");
		assert.equal(fs.existsSync(lockPath), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("acquisition waits for a live holder and proceeds after release", { timeout: 30_000 }, async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-wait-"));
	try {
		const scriptPath = writeChildScript(projectRoot);
		const readyPath = path.join(projectRoot, "holder-ready");
		const holdMs = 500;
		const holder = runChild(scriptPath, [
			projectRoot,
			LOCK_MODULE_URL,
			STATE_IO_MODULE_URL,
			"hold",
			"holder",
			"0",
			readyPath,
			String(holdMs),
		]);

		// Wait until the holder actually owns the lock before contending.
		const waitDeadline = Date.now() + 10_000;
		while (!fs.existsSync(readyPath)) {
			assert.ok(Date.now() < waitDeadline, "holder never acquired the lock");
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		const startedAt = Date.now();
		const ran = withBatchStateLock(projectRoot, () => "acquired-after-holder");
		const waitedMs = Date.now() - startedAt;
		assert.equal(ran, "acquired-after-holder");
		// The contender must have blocked for a meaningful share of the hold.
		assert.ok(waitedMs >= 100, `expected to wait for holder, waited only ${waitedMs}ms`);

		const holderResult = await holder;
		assert.equal(holderResult.code, 0, `holder failed: ${holderResult.stderr}`);
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("writeAbortSignal round-trips atomically under the lock", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-abort-"));
	try {
		const batchId = "20260825T000000-abc1";
		const signalPath = writeAbortSignal(projectRoot, batchId, {
			hard: false,
			reason: "operator",
			requestedAt: new Date().toISOString(),
		});
		assert.equal(signalPath, abortSignalPath(projectRoot, batchId));

		const signal = readAbortSignal(projectRoot, batchId);
		assert.equal(signal.hard, false);
		assert.equal(signal.reason, "operator");

		// Atomic write leaves no temp artifacts next to the signal.
		const leftovers = fs
			.readdirSync(path.dirname(signalPath))
			.filter((name) => name.endsWith(".tmp"));
		assert.deepEqual(leftovers, []);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
