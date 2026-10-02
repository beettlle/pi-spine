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
import { batchStateLockPath, stealIfTokenMatches, withBatchStateLock } from "../../src/batch/batch-state-lock.mjs";
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
 * - `rmw-update`: N updateSpineBatchState cycles — each call is a complete
 *   atomic load+mutate+save under the lock (SP-791 / #301).
 * - `hold`: acquire the lock, touch a ready file, hold for holdMs, release.
 * - `steal-hold`: contend for a lock initially owned by a dead holder. Both
 *   children wait on a start barrier so they hit the stale lock head-to-head;
 *   each round acquires via `withBatchStateLock`, logs entry/exit timestamps
 *   to the events path (readyPath slot) around a brief hold, so the parent
 *   can prove critical sections never overlap even when both children break
 *   the same stale lock (SP-794 / #302). goPath is the barrier file.
 */
const CHILD_SCRIPT = String.raw`
import fs from "node:fs";
const [projectRoot, lockModuleUrl, stateIoUrl, mode, writerId, iterations, readyPath, holdMsRaw, goPath] =
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

if (mode === "steal-hold") {
	const count = Number(iterations);
	const holdMs = Number(holdMsRaw);
	const eventsPath = readyPath;
	fs.writeFileSync(eventsPath + ".ready", String(process.pid), "utf-8");
	// Start barrier: do not touch the lock until the parent says both
	// contenders are booted, so both break the dead holder head-to-head.
	const barrierDeadline = Date.now() + 30_000;
	while (!fs.existsSync(goPath)) {
		if (Date.now() > barrierDeadline) process.exit(3);
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
	}
	for (let i = 0; i < count; i++) {
		withBatchStateLock(projectRoot, () => {
			fs.appendFileSync(
				eventsPath,
				"enter " + writerId + " " + i + " " + Date.now() + "\n",
				"utf-8",
			);
			const end = Date.now() + holdMs;
			while (Date.now() < end) {
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
			}
			fs.appendFileSync(
				eventsPath,
				"exit " + writerId + " " + i + " " + Date.now() + "\n",
				"utf-8",
			);
		});
	}
	process.exit(0);
}

if (mode === "rmw-update") {
	const { updateSpineBatchState } = await import(stateIoUrl);
	const count = Number(iterations);
	for (let i = 0; i < count; i++) {
		// Each cycle is atomic on its own: load, mutate, and guarded save share
		// one lock hold inside updateSpineBatchState (SP-791).
		const result = updateSpineBatchState(
			projectRoot,
			(draft) => {
				draft.counters = draft.counters ?? {};
				draft.counters[writerId] = Number(draft.counters[writerId] ?? 0) + 1;
				return true;
			},
			{ bypassOwnerCheck: true },
		);
		if (!result.ok || !result.changed) {
			console.error("updateSpineBatchState failed:", JSON.stringify(result));
			process.exit(1);
		}
	}
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
			{ bypassOwnerCheck: true },
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
			assert.equal(
				markers.length,
				writers * iterations,
				`lost RMW updates under lock: got ${markers.length}/${writers * iterations} markers`,
			);
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

test(
	"concurrent updateSpineBatchState writers on different fields both survive (SP-791)",
	{ timeout: 90_000 },
	async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-concurrent-"));
		try {
			const scriptPath = writeChildScript(projectRoot);
			saveSpineBatchState(projectRoot, {
				batchId: "lock-update-test",
				phase: "running",
				counters: {},
			});

			// Two processes, 20 atomic RMW cycles each on a different field. Whole-file
			// snapshots without the lock would clobber each other's counters; both
			// must survive (#301).
			const iterations = 20;
			const results = await Promise.all([
				runChild(scriptPath, [
					projectRoot,
					LOCK_MODULE_URL,
					STATE_IO_MODULE_URL,
					"rmw-update",
					"alpha",
					String(iterations),
					"",
					"",
				]),
				runChild(scriptPath, [
					projectRoot,
					LOCK_MODULE_URL,
					STATE_IO_MODULE_URL,
					"rmw-update",
					"beta",
					String(iterations),
					"",
					"",
				]),
			]);
			for (const result of results) {
				assert.equal(result.code, 0, `child writer failed: ${result.stderr}`);
			}

			const loaded = loadSpineBatchState(projectRoot);
			assert.equal(loaded.parseError, null);
			assert.equal(loaded.raw?.counters?.alpha, iterations);
			assert.equal(loaded.raw?.counters?.beta, iterations);
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

test("held-lock Map is process-global via Symbol.for (coverage-safe re-entrancy)", () => {
	const key = Symbol.for("pi-spine.batchStateLock.heldByThisProcess");
	assert.ok(globalThis[key] instanceof Map);
});

test("nested lock across projectRoot realpath aliases keeps outer ownership", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-alias-"));
	try {
		const realRoot = fs.realpathSync(projectRoot);
		withBatchStateLock(projectRoot, () => {
			const lockPath = batchStateLockPath(projectRoot);
			const outerToken = JSON.parse(fs.readFileSync(lockPath, "utf-8")).token;
			assert.ok(outerToken);
			// Nested acquire via realpath form must re-enter — not steal/recreate.
			withBatchStateLock(realRoot, () => {
				const nested = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
				assert.equal(nested.token, outerToken);
			});
			const after = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
			assert.equal(after.token, outerToken);
		});
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("stale lock from a dead holder is broken", { timeout: 30_000 }, async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-stale-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		fs.mkdirSync(path.dirname(lockPath), { recursive: true });

		// Use a PID that is not alive (avoid suite-load recycle of a just-exited child).
		const deadPid = 2_000_000_000;
		try {
			process.kill(deadPid, 0);
			assert.fail(`expected pid ${deadPid} to be dead`);
		} catch (err) {
			assert.notEqual(/** @type {NodeJS.ErrnoException} */ (err).code, "EPERM");
		}
		fs.writeFileSync(
			lockPath,
			JSON.stringify({ pid: deadPid, startedAt: 1, token: "dead-orphan" }),
			{ flag: "wx" },
		);
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

test(
	"live holder is not stolen when lock startedAt is wall-clock (not process start)",
	{ timeout: 30_000 },
	async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-wallclock-"));
		try {
			const scriptPath = writeChildScript(projectRoot);
			const readyPath = path.join(projectRoot, "holder-ready");
			const holdMs = 800;
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

			const waitDeadline = Date.now() + 10_000;
			while (!fs.existsSync(readyPath)) {
				assert.ok(Date.now() < waitDeadline, "holder never acquired the lock");
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			// Simulate the pre-fix payload shape: startedAt = acquire wall clock.
			// That is newer than OS process starttime and must not age-steal.
			const lockPath = batchStateLockPath(projectRoot);
			const holderPayload = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
			fs.writeFileSync(
				lockPath,
				JSON.stringify({ ...holderPayload, startedAt: Date.now() }),
				"utf-8",
			);

			const startedAt = Date.now();
			const ran = withBatchStateLock(projectRoot, () => "acquired-after-wallclock-holder");
			const waitedMs = Date.now() - startedAt;
			assert.equal(ran, "acquired-after-wallclock-holder");
			assert.ok(
				waitedMs >= 100,
				`expected to wait for live holder despite wall-clock startedAt, waited only ${waitedMs}ms`,
			);

			const holderResult = await holder;
			assert.equal(holderResult.code, 0, `holder failed: ${holderResult.stderr}`);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	},
);

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

/**
 * Shared SP-794 contention runner: two children race to break the same
 * stale lock (start-barriered so they judge it head-to-head), then run
 * `roundsPerWriter` locked holds apiece with entry/exit timestamps. Asserts
 * both children finish, every critical section interval is logged, no two
 * intervals ever overlap, and no `.break.*` copies are stranded.
 *
 * @param {string} tmpPrefix
 * @param {() => { payload: string, label: string }} makeFixture writes the
 *   stale lock file at the canonical path and describes it.
 */
async function runTwoStealerContention(tmpPrefix, makeFixture) {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), tmpPrefix));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		const scriptPath = writeChildScript(projectRoot);
		const fixture = makeFixture();
		fs.writeFileSync(lockPath, fixture.payload, { flag: "wx" });

		const writers = 2;
		const roundsPerWriter = 10; // ≥ 20 total acquisitions across the steal race
		const holdMs = 50;
		const goPath = path.join(projectRoot, "steal-go");
		const children = [];
		for (let w = 0; w < writers; w++) {
			const eventsPath = path.join(projectRoot, `steal-events-w${w}`);
			children.push(
				runChild(scriptPath, [
					projectRoot,
					LOCK_MODULE_URL,
					STATE_IO_MODULE_URL,
					"steal-hold",
					`w${w}`,
					String(roundsPerWriter),
					eventsPath,
					String(holdMs),
					goPath,
				]),
			);
		}

		// Release the barrier only after both contenders are booted and primed.
		const readyDeadline = Date.now() + 10_000;
		for (let w = 0; w < writers; w++) {
			const readyPath = path.join(projectRoot, `steal-events-w${w}.ready`);
			while (!fs.existsSync(readyPath)) {
				assert.ok(Date.now() < readyDeadline, `stealer w${w} never booted`);
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
		}
		fs.writeFileSync(goPath, "go", "utf-8");

		const results = await Promise.all(children);
		for (const result of results) {
			assert.equal(result.code, 0, `stealer child failed: ${result.stderr}`);
		}

		// Reconstruct every critical-section interval from the per-writer logs.
		const intervals = [];
		for (let w = 0; w < writers; w++) {
			const lines = fs
				.readFileSync(path.join(projectRoot, `steal-events-w${w}`), "utf-8")
				.split("\n")
				.filter((line) => line.length > 0);
			assert.equal(lines.length, roundsPerWriter * 2);
			/** @type {number[]} */
			const pendingEnters = [];
			for (const line of lines) {
				const [kind, , roundRaw, tsRaw] = line.split(" ");
				const ts = Number(tsRaw);
				assert.ok(Number.isFinite(ts), `bad event line: ${line}`);
				if (kind === "enter") {
						pendingEnters[Number(roundRaw)] = ts;
				} else if (kind === "exit") {
						const enter = pendingEnters[Number(roundRaw)];
						assert.ok(Number.isFinite(enter), `exit without enter: ${line}`);
						intervals.push({ writer: w, round: Number(roundRaw), enter, exit: ts });
					} else {
						assert.fail(`unknown event kind in line: ${line}`);
					}
				}
		}
		assert.equal(intervals.length, writers * roundsPerWriter);

		// Exactly one acquisition at a time: sorted by entry, no interval may
		// start before the previous one ended (1ms wall-clock tolerance for
		// Date.now() granularity across processes).
		intervals.sort((a, b) => a.enter - b.enter || a.exit - b.exit);
		for (let i = 1; i < intervals.length; i++) {
			const prev = intervals[i - 1];
			const cur = intervals[i];
			assert.ok(
				cur.enter >= prev.exit - 1,
				`critical sections overlapped (${fixture.label}): ` +
					`w${prev.writer}#${prev.round} [${prev.enter},${prev.exit}] ` +
					`vs w${cur.writer}#${cur.round} [${cur.enter},${cur.exit}]`,
			);
		}

		// The steal removed exactly the judged lock — no renamed copies stranded,
		// and no lock remains after both writers finish.
		const leftovers = fs
			.readdirSync(path.dirname(lockPath))
			.filter((name) => name.includes(".break."));
		assert.deepEqual(leftovers, []);
		assert.equal(fs.existsSync(lockPath), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
}

test(
	"two concurrent breakers of a dead holder never overlap critical sections (SP-794)",
	{ timeout: 90_000 },
	async () => {
		// Dead-holder fixture: a PID that cannot be alive names the lock, so both
		// children's first acquisition attempts must break it — the exact race
		// where a bare unlink could remove the other waiter's fresh lock.
		await runTwoStealerContention("spine-state-lock-stealers-", () => {
			const deadPid = 2_000_000_000;
			try {
				process.kill(deadPid, 0);
				assert.fail(`expected pid ${deadPid} to be dead`);
			} catch (err) {
				assert.notEqual(/** @type {NodeJS.ErrnoException} */ (err).code, "EPERM");
			}
			return {
				label: "deadPid",
				payload: JSON.stringify({ pid: deadPid, startedAt: 1, token: "dead-orphan" }),
			};
		});
	},
);

test(
	"two concurrent breakers of a recycled-pid holder never overlap critical sections (SP-794)",
	{ timeout: 90_000 },
	async () => {
		// Recycled-PID fixture: this test process is a live foreign PID whose OS
		// starttime is far newer than the recorded startedAt, so each child's
		// break runs the `ps` probe (the widened judge→unlink window from #302)
		// before stealing.
		await runTwoStealerContention("spine-state-lock-stealers-recycled-", () => ({
			label: "pidRecycled",
			payload: JSON.stringify({
				pid: process.pid,
				startedAt: 1,
				token: "recycled-orphan",
			}),
		}));
	},
);

test("stealIfTokenMatches puts back a fresh lock acquired between judge and rename (SP-794)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-putback-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		// What the breaker judged stale earlier (old dead holder's raw payload).
		const stalePayload = JSON.stringify({ pid: 2_000_000_000, startedAt: 1, token: "stale-token" });
		// A different holder acquired after the judgment, before the rename.
		const freshPayload = JSON.stringify({ pid: 424_242, startedAt: 2, token: "fresh-token" });
		fs.writeFileSync(lockPath, freshPayload, { flag: "wx" });

		stealIfTokenMatches(lockPath, "stale-token", "unit-putback", stalePayload);

		// The fresh holder's lock survives at lockPath, byte for byte.
		const survived = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
		assert.equal(survived.token, "fresh-token");
		// No renamed copies left behind.
		const leftovers = fs
			.readdirSync(path.dirname(lockPath))
			.filter((name) => name.includes(".break."));
		assert.deepEqual(leftovers, []);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("stealIfTokenMatches removes the lock only when the token still matches", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-token-match-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);
		const payload = JSON.stringify({ pid: 2_000_000_000, startedAt: 1, token: "dead-orphan" });
		fs.writeFileSync(lockPath, payload, { flag: "wx" });

		stealIfTokenMatches(lockPath, "dead-orphan", "unit-steal", payload);

		assert.equal(fs.existsSync(lockPath), false);
		const leftovers = fs
			.readdirSync(path.dirname(lockPath))
			.filter((name) => name.includes(".break."));
		assert.deepEqual(leftovers, []);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("stealIfTokenMatches compares full content for tokenless corrupt payloads", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-lock-corrupt-compare-"));
	try {
		const lockPath = batchStateLockPath(projectRoot);

		// Same corrupt bytes as judged stale → stolen.
		fs.writeFileSync(lockPath, "not json at all", { flag: "wx" });
		stealIfTokenMatches(lockPath, "", "unit-corrupt-same", "not json at all");
		assert.equal(fs.existsSync(lockPath), false);

		// Different bytes (a new holder's payload, however malformed) → survives.
		fs.writeFileSync(lockPath, "different junk", { flag: "wx" });
		stealIfTokenMatches(lockPath, "", "unit-corrupt-diff", "not json at all");
		assert.equal(fs.readFileSync(lockPath, "utf-8"), "different junk");
		const leftovers = fs
			.readdirSync(path.dirname(lockPath))
			.filter((name) => name.includes(".break."));
		assert.deepEqual(leftovers, []);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
