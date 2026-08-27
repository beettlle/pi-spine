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

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isProcessAlive, probeProcessStartTimeMs } from "../process/liveness.mjs";

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
 * Tolerance when comparing recorded process starttime to a live probe
 * (PID-reuse detection). Matches ENGINE_STARTTIME_TOLERANCE_MS spirit.
 */
const STARTTIME_TOLERANCE_MS = 2_000;

/**
 * Re-entrancy + ownership tracking keyed by canonical lock path.
 * Value is the ownership token written into the lock file for this hold.
 * @type {Map<string, string>}
 */
const heldByThisProcess = new Map();

/**
 * Resolve a stable absolute lock path. Create `.spine/runtime` first, then
 * `realpath` that directory so `/var` vs `/private/var` (macOS) cannot split
 * the re-entrancy Map across two keys for the same inode. Nested
 * `withBatchStateLock` (e.g. saveSpineBatchState under an outer hold) must
 * see the same key or `leakedSelf` will unlink the live lock mid-section.
 *
 * @param {string} projectRoot
 */
export function batchStateLockPath(projectRoot) {
	const runtimeDir = path.resolve(projectRoot, ".spine", "runtime");
	fs.mkdirSync(runtimeDir, { recursive: true });
	let canonicalRuntime = runtimeDir;
	try {
		canonicalRuntime = fs.realpathSync(runtimeDir);
	} catch {
		canonicalRuntime = runtimeDir;
	}
	return path.join(canonicalRuntime, path.basename(BATCH_STATE_LOCK_REL));
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
 * @returns {string}
 */
function newOwnershipToken() {
	return crypto.randomBytes(16).toString("hex");
}

/**
 * Single exclusive-create attempt.
 *
 * @param {string} lockPath
 * @param {string} token
 * @returns {boolean} true when the lock file was created by this call
 */
function tryCreateLockFile(lockPath, token) {
	/** @type {number|null} */
	let processStartedAt = null;
	try {
		processStartedAt = probeProcessStartTimeMs(process.pid);
	} catch {
		processStartedAt = null;
	}
	const payload = JSON.stringify({
		pid: process.pid,
		// Process starttime (not lock-acquire wall clock) for PID-reuse checks.
		startedAt: processStartedAt ?? Date.now(),
		token,
	});
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
 * or a live PID whose OS starttime no longer matches (PID recycled).
 *
 * Never steals from a live holder on age alone — suite-load CPU starvation
 * can keep a critical section alive for minutes without making the lock stale
 * (release-check flake under full-suite load).
 *
 * @param {string} lockPath
 */
function breakStaleLock(lockPath) {
	/** @type {{ pid?: number, startedAt?: number, token?: string } | null} */
	let holder = null;
	let corrupt = false;
	try {
		holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
		if (!holder || typeof holder !== "object") corrupt = true;
	} catch {
		corrupt = true;
	}

	if (!fs.existsSync(lockPath)) {
		// Lock vanished between attempts — nothing to break.
		return;
	}

	if (corrupt) {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			/* raced unlink */
		}
		return;
	}

	const holderPid = Number(holder?.pid);
	if (!Number.isFinite(holderPid) || holderPid <= 0) {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			/* raced unlink */
		}
		return;
	}

	// Same-process "leak" only when we are not in an active hold. Prefer the
	// ownership token over path-string equality so `/var` vs `/private/var`
	// aliases cannot falsely clear a live outer hold during nested acquire.
	if (holderPid === process.pid) {
		const token = String(holder?.token ?? "");
		const stillHeldByToken =
			token.length > 0 && [...heldByThisProcess.values()].includes(token);
		const stillHeldByPath = heldByThisProcess.has(lockPath);
		if (stillHeldByToken || stillHeldByPath) {
			return;
		}
		try {
			fs.unlinkSync(lockPath);
		} catch {
			/* raced unlink */
		}
		return;
	}

	if (holderPid !== process.pid && !isProcessAlive(holderPid)) {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			/* raced unlink */
		}
		return;
	}

	// Live foreign PID: only break when OS starttime proves the PID was recycled.
	if (holderPid !== process.pid) {
		const expectedStart = Number(holder?.startedAt);
		if (!Number.isFinite(expectedStart) || expectedStart <= 0) return;
		/** @type {number|null} */
		let liveStart = null;
		try {
			liveStart = probeProcessStartTimeMs(holderPid);
		} catch {
			liveStart = null;
		}
		if (liveStart == null || !Number.isFinite(liveStart) || liveStart <= 0) return;
		if (Math.abs(liveStart - expectedStart) > STARTTIME_TOLERANCE_MS) {
			try {
				fs.unlinkSync(lockPath);
			} catch {
				/* raced unlink */
			}
		}
	}
}

/**
 * Release the lock file only when our ownership token still matches.
 *
 * @param {string} lockPath
 * @param {string} token
 */
function releaseLockFile(lockPath, token) {
	try {
		const holder = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
		if (String(holder?.token ?? "") === token) {
			fs.unlinkSync(lockPath);
		}
	} catch {
		// Release races (lock already broken/replaced) are safe to ignore.
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
	// batchStateLockPath mkdir+realpath so nested calls share one Map key.
	const lockPath = batchStateLockPath(projectRoot);

	// Re-entrant pass-through: same-process nesting must not self-deadlock.
	if (heldByThisProcess.has(lockPath)) {
		return fn();
	}

	const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;
	const token = newOwnershipToken();

	for (;;) {
		if (tryCreateLockFile(lockPath, token)) break;
		breakStaleLock(lockPath);
		if (Date.now() >= deadline) {
			throw new Error(
				`Timed out acquiring batch-state lock (${path.relative(projectRoot, lockPath)}) ` +
					`after ${timeoutMs}ms — another spine process may be holding it`,
			);
		}
		sleepSync(POLL_INTERVAL_MS);
	}

	heldByThisProcess.set(lockPath, token);
	try {
		return fn();
	} finally {
		// Unlink (token-gated) before clearing the re-entrancy map so a
		// same-process contender cannot treat this file as leakedSelf and
		// steal it while we still intend to release.
		try {
			releaseLockFile(lockPath, token);
		} finally {
			heldByThisProcess.delete(lockPath);
		}
	}
}
