/**
 * SP-631 — gate posture approval streak counters (FR-REL250-09 / #123).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import test from "node:test";
import {
	GATE_POSTURE_STREAK_REL,
	GATE_POSTURE_STREAK_VERSION,
	gatePostureStreakPath,
	getCategoryStreak,
	getKindStreak,
	incrementCategoryStreak,
	incrementKindStreak,
	loadGatePostureStreaks,
	readCategoryStreakThreshold,
	resetAllStreaks,
	resetCategoryStreak,
	resetKindStreak,
	streakMeetsThreshold,
	withGatePostureStreakLock,
} from "../../src/batch/gate-posture-streak.mjs";
import { batchStateLockPath } from "../../src/batch/batch-state-lock.mjs";
import { probeProcessStartTimeMs } from "../../src/process/liveness.mjs";
import {
	loadGateRecord,
	maybeAutoApproveIntegrateGate,
	openIntegrateGate,
} from "../../src/batch/gate.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { GATE_CATEGORIES } from "../../src/batch/gate-posture-defaults.mjs";

/**
 * @returns {Promise<string>}
 */
async function tempRoot() {
	return mkdtemp(path.join(os.tmpdir(), "spine-streak-"));
}

/**
 * @param {string} root
 */
async function cleanup(root) {
	await rm(root, { recursive: true, force: true });
}

/** Completed batch fixture for opening an integrate gate (same shape as the
 * SP-824 failure tests). */
function completedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "TP-012", status: "succeeded", taskFolder: "TP-012", doneFileFound: true }],
	};
}

/** Land a commit on the orch branch so the gate has something to integrate. */
function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("gatePostureStreakPath resolves under .spine/runtime/gate-posture", () => {
	const root = "/tmp/project";
	assert.equal(
		gatePostureStreakPath(root),
		path.join(root, GATE_POSTURE_STREAK_REL),
	);
	assert.ok(GATE_POSTURE_STREAK_REL.includes(path.join(".spine", "runtime")));
});

test("loadGatePostureStreaks returns zeros when file is missing", async () => {
	const root = await tempRoot();
	try {
		const state = loadGatePostureStreaks(root);
		assert.equal(state.version, GATE_POSTURE_STREAK_VERSION);
		for (const category of GATE_CATEGORIES) {
			assert.equal(state.categories[category], 0);
		}
		assert.deepEqual(state.kinds, {});
		assert.equal(getCategoryStreak(root, "write"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("incrementCategoryStreak persists consecutive approvals atomically", async () => {
	const root = await tempRoot();
	try {
		assert.equal(incrementCategoryStreak(root, "write"), 1);
		assert.equal(incrementCategoryStreak(root, "write"), 2);
		assert.equal(incrementCategoryStreak(root, "write"), 3);
		assert.equal(getCategoryStreak(root, "write"), 3);
		assert.equal(getCategoryStreak(root, "read"), 0);

		const filePath = gatePostureStreakPath(root);
		assert.ok(fs.existsSync(filePath));
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		assert.equal(raw.version, GATE_POSTURE_STREAK_VERSION);
		assert.equal(raw.categories.write, 3);
		assert.ok(typeof raw.updatedAt === "string");
	} finally {
		await cleanup(root);
	}
});

test("incrementKindStreak tracks per gate kind independently", async () => {
	const root = await tempRoot();
	try {
		assert.equal(incrementKindStreak(root, "integrate"), 1);
		assert.equal(incrementKindStreak(root, "integrate"), 2);
		assert.equal(incrementKindStreak(root, "release"), 1);
		assert.equal(getKindStreak(root, "integrate"), 2);
		assert.equal(getKindStreak(root, "release"), 1);
		assert.equal(getCategoryStreak(root, "execute"), 0);
	} finally {
		await cleanup(root);
	}
});

test("resetCategoryStreak clears count on reject / manual break", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "network");
		incrementCategoryStreak(root, "network");
		incrementCategoryStreak(root, "write");
		assert.equal(resetCategoryStreak(root, "network"), 0);
		assert.equal(getCategoryStreak(root, "network"), 0);
		assert.equal(getCategoryStreak(root, "write"), 1);
	} finally {
		await cleanup(root);
	}
});

test("resetKindStreak clears kind count on reject / manual break", async () => {
	const root = await tempRoot();
	try {
		incrementKindStreak(root, "integrate");
		incrementKindStreak(root, "integrate");
		assert.equal(resetKindStreak(root, "integrate"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("resetAllStreaks clears categories and kinds", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "execute");
		incrementKindStreak(root, "integrate");
		const cleared = resetAllStreaks(root);
		assert.equal(cleared.categories.execute, 0);
		assert.deepEqual(cleared.kinds, {});
		assert.equal(getCategoryStreak(root, "execute"), 0);
		assert.equal(getKindStreak(root, "integrate"), 0);
	} finally {
		await cleanup(root);
	}
});

test("streakMeetsThreshold reads autoApproveAfterN correctly", () => {
	assert.equal(streakMeetsThreshold(0, 0), true);
	assert.equal(streakMeetsThreshold(2, 3), false);
	assert.equal(streakMeetsThreshold(3, 3), true);
	assert.equal(streakMeetsThreshold(5, 3), true);
	assert.equal(streakMeetsThreshold(10, null), false);
	assert.equal(streakMeetsThreshold(10, undefined), false);
	assert.equal(streakMeetsThreshold(10, -1), false);
	assert.equal(streakMeetsThreshold(-1, 3), false);
	assert.equal(streakMeetsThreshold(1.5, 3), false);
});

test("readCategoryStreakThreshold combines load and threshold check", async () => {
	const root = await tempRoot();
	try {
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 0,
			meetsThreshold: false,
		});
		incrementCategoryStreak(root, "write");
		incrementCategoryStreak(root, "write");
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 2,
			meetsThreshold: false,
		});
		incrementCategoryStreak(root, "write");
		assert.deepEqual(readCategoryStreakThreshold(root, "write", 3), {
			count: 3,
			meetsThreshold: true,
		});
		assert.deepEqual(readCategoryStreakThreshold(root, "read", 0), {
			count: 0,
			meetsThreshold: true,
		});
	} finally {
		await cleanup(root);
	}
});

test("corrupt streak file fails closed to zero counts", async () => {
	const root = await tempRoot();
	try {
		const filePath = gatePostureStreakPath(root);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, "{not-json", "utf-8");
		assert.equal(getCategoryStreak(root, "write"), 0);
		assert.equal(readCategoryStreakThreshold(root, "write", 3).meetsThreshold, false);
	} finally {
		await cleanup(root);
	}
});

test("category streaks survive reload and do not leak across categories", async () => {
	const root = await tempRoot();
	try {
		incrementCategoryStreak(root, "write");
		incrementCategoryStreak(root, "execute");
		incrementCategoryStreak(root, "execute");
		const reloaded = loadGatePostureStreaks(root);
		assert.equal(reloaded.categories.write, 1);
		assert.equal(reloaded.categories.execute, 2);
		assert.equal(reloaded.categories.network, 0);
	} finally {
		await cleanup(root);
	}
});

// ---------------------------------------------------------------------------
// SP-868 / #314 — streak RMW serialization
//
// The streak store is project-wide JSON written from separate processes (CLI,
// engine, supervisor). Without a lock, two concurrent RMW cycles read the same
// prev count and the last whole-file writer wins — a lost reset leaves a stale
// high streak that unlocks auto-approve early. These tests reuse the
// batch-state-lock child-writer pattern: real multi-process contention plus a
// deterministic hold-and-observe case and a foreign-holder timeout case.
// ---------------------------------------------------------------------------

const STREAK_MODULE_URL = new URL("../../src/batch/gate-posture-streak.mjs", import.meta.url).href;
const LOCK_MODULE_URL = new URL("../../src/batch/batch-state-lock.mjs", import.meta.url).href;

/**
 * Child-writer script source. Modes:
 * - `rmw`: N incrementCategoryStreak cycles (each acquires + releases the
 *   streak lock).
 * - `hold-write`: acquire the batch-state lock, write a conflicting streak
 *   value through the unlocked load/save pair while still holding it, publish
 *   readiness, hold for holdMs, release. Proves the parent's locked RMW
 *   observes the holder's write instead of clobbering it.
 */
const CHILD_SCRIPT = String.raw`
import fs from "node:fs";
const [projectRoot, streakModuleUrl, lockModuleUrl, mode, iterationsRaw, holdMsRaw, readyPath] =
	process.argv.slice(2);
const streak = await import(streakModuleUrl);
const { withBatchStateLock } = await import(lockModuleUrl);

if (mode === "rmw") {
	const iterations = Number(iterationsRaw);
	for (let i = 0; i < iterations; i++) {
		streak.incrementCategoryStreak(projectRoot, "write");
	}
	process.exit(0);
}

if (mode === "hold-write") {
	const holdMs = Number(holdMsRaw);
	const writtenValue = Number(iterationsRaw);
	withBatchStateLock(projectRoot, () => {
		const state = streak.loadGatePostureStreaks(projectRoot);
		state.categories.write = writtenValue;
		streak.saveGatePostureStreaks(projectRoot, state);
		fs.writeFileSync(readyPath, String(process.pid), "utf-8");
		const end = Date.now() + holdMs;
		while (Date.now() < end) {
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
		}
	});
	process.exit(0);
}

process.exit(2);
`;

/**
 * Spawn a child-writer process and resolve with its exit details.
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

/**
 * Poll until a file exists (child readiness barrier).
 * @param {string} filePath
 * @param {number} [timeoutMs]
 */
async function awaitFile(filePath, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (!fs.existsSync(filePath)) {
		if (Date.now() > deadline) {
			throw new Error(`child readiness file never appeared: ${filePath}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

test(
	"concurrent multi-process increments lose no updates under the streak lock (SP-868)",
	{ timeout: 60_000 },
	async () => {
		const root = await tempRoot();
		try {
			const scriptPath = path.join(root, "streak-lock-writer-child.mjs");
			fs.writeFileSync(scriptPath, CHILD_SCRIPT, "utf-8");

			const writers = 3;
			const iterations = 10;
			const children = [];
			for (let w = 0; w < writers; w++) {
				children.push(
					runChild(scriptPath, [root, STREAK_MODULE_URL, LOCK_MODULE_URL, "rmw", String(iterations), "0", ""]),
				);
			}
			const results = await Promise.all(children);
			for (const result of results) {
				assert.equal(result.code, 0, `child writer failed: ${result.stderr}`);
			}

			// Without the lock, concurrent RMW cycles lose increments.
			assert.equal(getCategoryStreak(root, "write"), writers * iterations);
			// Lock file is released after all writers finish.
			assert.equal(fs.existsSync(batchStateLockPath(root)), false);
		} finally {
			await cleanup(root);
		}
	},
);

test(
	"locked RMW waits for an external holder and applies on top of its write (no lost update, SP-868)",
	{ timeout: 30_000 },
	async () => {
		const root = await tempRoot();
		try {
			const scriptPath = path.join(root, "streak-lock-holder-child.mjs");
			fs.writeFileSync(scriptPath, CHILD_SCRIPT, "utf-8");
			const readyPath = path.join(root, "holder-ready");

			// Holder acquires the lock, writes 7 while still holding it, signals
			// readiness, holds, then releases.
			const childPromise = runChild(scriptPath, [
				root,
				STREAK_MODULE_URL,
				LOCK_MODULE_URL,
				"hold-write",
				"7",
				"250",
				readyPath,
			]);
			await awaitFile(readyPath);
			assert.equal(getCategoryStreak(root, "write"), 7, "holder write is durable before release");

			// Locked RMW must wait for release and increment the holder's value —
			// without the lock this read would race and clobber 7 with prev+1 of a
			// stale read.
			const next = incrementCategoryStreak(root, "write");
			assert.equal(next, 8);
			assert.equal(getCategoryStreak(root, "write"), 8);
			assert.equal(fs.existsSync(batchStateLockPath(root)), false, "lock released after RMW");

			const child = await childPromise;
			assert.equal(child.code, 0, `holder child failed: ${child.stderr}`);
		} finally {
			await cleanup(root);
		}
	},
);

test(
	"withGatePostureStreakLock times out against a live foreign holder instead of racing (SP-868)",
	{ timeout: 30_000 },
	async () => {
		const root = await tempRoot();
		try {
			// Craft a lock owned by a live foreign process: the test runner (ppid)
			// with its real OS starttime so stale-breaking never steals from it.
			const lockPath = batchStateLockPath(root);
			let startedAt = Date.now();
			try {
				startedAt = probeProcessStartTimeMs(process.ppid);
			} catch {
				// Wall-clock fallback is NEWER than any real process start, so the
				// PID-recycle check (liveStart - expectedStart > tolerance) can never
				// fire — the holder stays unstealable, same as a successful probe.
			}
			fs.writeFileSync(
				lockPath,
				JSON.stringify({ pid: process.ppid, startedAt, token: "foreign-holder" }),
				"utf-8",
			);

			assert.throws(
				() =>
					withGatePostureStreakLock(
						root,
						() => incrementCategoryStreak(root, "write"),
						{ timeoutMs: 150 },
					),
				/Timed out acquiring batch-state lock/,
			);

			// The failed acquirer must not have touched the streak store or the
			// foreign holder's lock file.
			assert.equal(getCategoryStreak(root, "write"), 0);
			assert.equal(fs.existsSync(lockPath), true);
		} finally {
			fs.rmSync(batchStateLockPath(root), { force: true });
			await cleanup(root);
		}
	},
);

test("auto-approve decision holds the streak lock through read, approve, and increment (SP-868)", async () => {
	const projectRoot = await initGitRepo("spine-gate-streak-lock-auto-");
	try {
		const config = {
			gates: {
				integrateCategory: "write",
				postures: {
					write: { posture: "permissive", autoApproveAfterN: 1 },
				},
			},
		};

		// Streak 1 meets the threshold; the decision must be made while the
		// streak lock is held so a concurrent locked reset cannot interleave.
		assert.equal(incrementCategoryStreak(projectRoot, "write"), 1);

		const batchId = "20261118T120001";
		createOrchWithWork(projectRoot, "orch/spine-gate-streak-lock-auto-a");
		openIntegrateGate({
			projectRoot,
			batchId,
			batchState: completedFixture(batchId, "orch/spine-gate-streak-lock-auto-a"),
			config,
		});

		// Proof stub: when the auto-approve path commits its increment, the
		// streak lock must still be held by this process.
		const proof = { lockHeldDuringIncrement: null };
		const result = maybeAutoApproveIntegrateGate({
			projectRoot,
			batchId,
			config,
			streakIo: {
				incrementCategoryStreak(streakRoot, category) {
					proof.lockHeldDuringIncrement = fs.existsSync(batchStateLockPath(streakRoot));
					return incrementCategoryStreak(streakRoot, category);
				},
			},
		});

		assert.equal(result.approved, true);
		assert.equal(proof.lockHeldDuringIncrement, true, "increment ran inside the streak lock hold");
		assert.equal(loadGateRecord(projectRoot, batchId).status, "approved");
		assert.equal(getCategoryStreak(projectRoot, "write"), 2);
		assert.equal(fs.existsSync(batchStateLockPath(projectRoot)), false, "lock released after decision");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
