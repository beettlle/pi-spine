/**
 * SP-797 — async engine lock wait (GitHub #302 defect 2).
 *
 * Proves `withBatchStateLockAsync` waits for a contended lock without
 * blocking the event loop: a heartbeat-style `setInterval` keeps firing while
 * a child process holds the lock, the engine-side write lands after the
 * holder releases, and a nested synchronous `withBatchStateLock` inside the
 * async hold runs directly (per-process re-entrancy).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	batchStateLockPath,
	withBatchStateLock,
	withBatchStateLockAsync,
} from "../../src/batch/batch-state-lock.mjs";

const LOCK_MODULE_URL = new URL("../../src/batch/batch-state-lock.mjs", import.meta.url).href;

/**
 * Child script: acquire the lock with the SYNCHRONOUS `withBatchStateLock`
 * (CLI-style holder), touch a ready file, hold for holdMs, release. This is
 * the contending CLI process the engine must wait on without freezing.
 */
const CHILD_SCRIPT = String.raw`
import fs from "node:fs";
const [projectRoot, lockModuleUrl, readyPath, holdMsRaw] = process.argv.slice(2);
const { withBatchStateLock } = await import(lockModuleUrl);
withBatchStateLock(projectRoot, () => {
	fs.writeFileSync(readyPath, String(process.pid), "utf-8");
	const end = Date.now() + Number(holdMsRaw);
	while (Date.now() < end) {
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
	}
});
process.exit(0);
`;

/**
 * Spawn the lock-holder child and resolve with its exit details.
 *
 * @param {string} scriptPath
 * @param {string[]} args
 * @returns {Promise<{ code: number|null, stderr: string }>}
 */
function runChild(scriptPath, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [scriptPath, ...args], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve({ code, stderr }));
	});
}

test(
	"event loop keeps running while awaiting a contended lock",
	{ timeout: 30_000 },
	async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-async-"));
		try {
			const scriptPath = path.join(projectRoot, "lock-holder-child.mjs");
			fs.writeFileSync(scriptPath, CHILD_SCRIPT, "utf-8");
			const readyPath = path.join(projectRoot, "holder-ready");
			const holdMs = 500;
			const holder = runChild(scriptPath, [
				projectRoot,
				LOCK_MODULE_URL,
				readyPath,
				String(holdMs),
			]);

			// Wait until the holder actually owns the lock before contending.
			const waitDeadline = Date.now() + 10_000;
			while (!fs.existsSync(readyPath)) {
				assert.ok(Date.now() < waitDeadline, "holder never acquired the lock");
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Heartbeat-style timer: with the sync lock this counter would freeze
			// at 0 for the whole wait (Atomics.wait blocks the thread); the async
			// wait must let it keep firing.
			let ticks = 0;
			const heartbeat = setInterval(() => {
				ticks += 1;
			}, 25);
			const markerPath = path.join(projectRoot, "engine-write.txt");
			try {
				const result = await withBatchStateLockAsync(projectRoot, () => {
					fs.writeFileSync(markerPath, "engine-write-landed", "utf-8");
					return "engine-acquired";
				});
				assert.equal(result, "engine-acquired");
			} finally {
				clearInterval(heartbeat);
			}

			// ~500ms hold / 25ms interval ≈ 20 ticks; require a conservative
			// floor so suite-load jitter cannot flake the assertion.
			assert.ok(
				ticks >= 5,
				`event loop froze during async lock wait — heartbeat fired only ${ticks} time(s)`,
			);
			// The critical section ran after the holder released.
			assert.equal(fs.readFileSync(markerPath, "utf-8"), "engine-write-landed");
			// Lock released after the section.
			assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);

			const holderResult = await holder;
			assert.equal(holderResult.code, 0, `holder failed: ${holderResult.stderr}`);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	},
);

test("nested sync withBatchStateLock inside async hold runs directly (re-entrancy)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-async-reentry-"));
	try {
		const markerPath = path.join(projectRoot, "nested.txt");
		const result = await withBatchStateLockAsync(projectRoot, () =>
			// Mirrors `saveSpineBatchState` re-entering under `saveEngineBatchState`:
			// the same-process hold must pass through instead of self-deadlocking.
			withBatchStateLock(projectRoot, () => {
				fs.writeFileSync(markerPath, "nested-ran", "utf-8");
				return "nested-result";
			}),
		);
		assert.equal(result, "nested-result");
		assert.equal(fs.readFileSync(markerPath, "utf-8"), "nested-ran");
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("nested withBatchStateLockAsync inside async hold runs directly (re-entrancy)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-async-reentry2-"));
	try {
		const inner = await withBatchStateLockAsync(projectRoot, () =>
			withBatchStateLockAsync(projectRoot, () => "inner-result"),
		);
		assert.equal(await inner, "inner-result");
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("uncontended fast path runs fn without waiting", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-async-fast-"));
	try {
		const startedAt = Date.now();
		const result = await withBatchStateLockAsync(projectRoot, () => "fast");
		assert.equal(result, "fast");
		assert.ok(Date.now() - startedAt < 500, "uncontended acquire should not poll");
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
