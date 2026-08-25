// @ts-nocheck
/**
 * Global inter-process lock for batch-state writers (SP-722 / GitHub #264).
 *
 * Serializes read-modify-write cycles on `.spine/batch-state.json`,
 * `.spine/batch-history.json`, and abort-signal writes across the engine,
 * supervisor, and CLI processes. Implemented as an exclusive `wx` create on
 * `.spine/runtime/batch-state.lock` with PID-liveness stale breaking — the
 * same primitive as the resume handoff lock, but scoped to state/history
 * writes rather than resume ownership.
 *
 * Lock ordering (deadlock avoidance):
 * 1. The per-batch resume handoff lock (`resume-handoff.lock`) MAY be held
 *    while acquiring this global lock (handoff → global is the only legal
 *    cross-lock order; see `attached-runner-reconcile.mjs`).
 * 2. A holder of this global lock MUST NOT acquire the resume handoff lock.
 * 3. Within this lock, batch-state writes happen before batch-history writes.
 * 4. No nested acquisition from the same process: `withBatchStateLock` is
 *    re-entrant per process — a nested call runs `fn` directly instead of
 *    re-acquiring, so wrappers may freely compose (e.g. abort wraps a
 *    section that internally calls `appendBatchHistoryEntry`).
 */

import fs from "node:fs";
import path from "node:path";
import { isProcessAlive } from "../process/liveness.mjs";

export const BATCH_STATE_LOCK_REL = path.join(".spine", "runtime", "batch-state.lock");

/**
 * Default bound on contention wait. Terminal lifecycle sections (complete /
 * dismiss / abort) can hold the lock across worktree cleanup, so this is
 * generous; normal state writes hold it for single-digit milliseconds.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Poll interval while another process holds the lock. */
const POLL_INTERVAL_MS = 25;

/**
 * A lock file older than this is broken regardless of recorded PID, guarding
 * against PID reuse masking a dead holder.
 */
const STALE_LOCK_MS = 60_000;

/**
 * Re-entrancy tracking: resolved lock paths currently held by this process.
 * Presence means the outermost `withBatchStateLock` call owns the file.
 * @type {Set<string>}
 */
const heldByThisProcess = new Set();

/**
 * @param {string} projectRoot
 */
export function batchStateLockPath(projectRoot) {
	return path.resolve(projectRoot, BATCH_STATE_LOCK_REL);
}

/**
 * Synchronous sleep for lock polling. All batch-state writers are sync, so
 * the wait must block the thread without yielding to the event loop.
 *
 * @param {number} ms
 */
function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Single exclusive-create attempt.
 *
 * @param {string} lockPath
 * @returns {boolean} true when the lock file was created by this call
 */
function tryCreateLockFile(lockPath) {
	const payload = JSON.stringify({ pid: process.pid, startedAt: Date.now() });
	try {
		fs.writeFileSync(lockPath, payload, { encoding: "utf-8", flag: "wx" });
		return true;
	} catch (err) {
		if (/** @type {NodeJS.ErrnoException} */ (err).code !== "EEXIST") {
			throw err;
		}
		return false;
	}
}

/**
 * Break the lock when the recorded holder cannot still own it: dead PID,
 * corrupt payload, a leaked file from this same process (no active holder),
 * or a lock older than the stale TTL (PID-reuse guard).
 *
 * @param {string} lockPath
 */
function breakStaleLock(lockPath) {
	/** @type {{ pid?: number, startedAt?: number } | null} */
	let holder = null;
	let corrupt = false;
	try {
		holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
		if (!holder || typeof holder !== "object") corrupt = true;
	} catch {
		corrupt = true;
	}

	let ageMs = 0;
	try {
		ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
	} catch {
		// Lock vanished between attempts — nothing to break.
		return;
	}

	const holderPid = Number(holder?.pid);
	const deadHolder =
		Number.isFinite(holderPid) &&
		holderPid > 0 &&
		holderPid !== process.pid &&
		!isProcessAlive(holderPid);
	const leakedSelf = holderPid === process.pid && !heldByThisProcess.has(lockPath);
	const expired = ageMs > STALE_LOCK_MS;

	if (corrupt || deadHolder || leakedSelf || expired) {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			// Another contender may have won the unlink — safe to ignore.
		}
	}
}

/**
 * Run `fn` while holding the global batch-state lock.
 *
 * @param {string} projectRoot
 * @param {() => unknown} fn
 * @param {{ timeoutMs?: number }} [options]
 * @returns {unknown} `fn`'s return value
 */
export function withBatchStateLock(projectRoot, fn, options = {}) {
	const lockPath = batchStateLockPath(projectRoot);

	// Re-entrant pass-through: same-process nesting must not self-deadlock.
	if (heldByThisProcess.has(lockPath)) {
		return fn();
	}

	fs.mkdirSync(path.dirname(lockPath), { recursive: true });
	const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		if (tryCreateLockFile(lockPath)) break;
		breakStaleLock(lockPath);
		if (Date.now() >= deadline) {
			throw new Error(
				`Timed out acquiring batch-state lock (${path.relative(projectRoot, lockPath)}) ` +
					`after ${timeoutMs}ms — another spine process may be holding it`,
			);
		}
		sleepSync(POLL_INTERVAL_MS);
	}

	heldByThisProcess.add(lockPath);
	try {
		return fn();
	} finally {
		heldByThisProcess.delete(lockPath);
		try {
			const holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
			if (Number(holder?.pid) === process.pid) {
				fs.unlinkSync(lockPath);
			}
		} catch {
			// Release races (lock already broken/replaced) are safe to ignore.
		}
	}
}
