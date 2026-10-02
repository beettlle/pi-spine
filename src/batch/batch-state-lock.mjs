// @ts-nocheck
/**
 * Global inter-process lock for batch-state writers (SP-722 / GitHub #264).
 *
 * Serializes read-modify-write cycles on `.spine/batch-state.json`,
 * `.spine/batch-history.json`, and abort-signal writes across the engine,
 * supervisor, and CLI processes. Implemented as an exclusive lock file on
 * `.spine/runtime/batch-state.lock` (temp write + `linkSync` publish) with
 * PID-liveness stale breaking — the same primitive as the resume handoff
 * lock, but scoped to state/history writes rather than resume ownership.
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
import { setTimeout as sleepAsync } from "node:timers/promises";
import {
	ENGINE_STARTTIME_TOLERANCE_MS,
	isProcessAlive,
	probeProcessStartTimeMs,
} from "../process/liveness.mjs";

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
 * (PID-reuse detection). Reuse ENGINE_STARTTIME_TOLERANCE_MS so `ps lstart`
 * second granularity cannot false-trigger.
 */
const STARTTIME_TOLERANCE_MS = ENGINE_STARTTIME_TOLERANCE_MS;

/**
 * Re-entrancy + ownership tracking keyed by canonical lock path.
 * Value is the ownership token written into the lock file for this hold.
 * Stored on `globalThis` so dynamic `import()` of this module and the static
 * import from `state-io.mjs` always share one Map — under
 * `--experimental-test-coverage`, duplicate module instances otherwise split
 * re-entrancy tracking and `leakedSelf` unlinks the live lock mid-section
 * (release:check coverage flake — concurrent writers 99/100).
 * @type {Map<string, string>}
 */
const HELD_BY_PROCESS_KEY = Symbol.for("pi-spine.batchStateLock.heldByThisProcess");
const heldByThisProcess = (() => {
	const g = globalThis;
	if (!(g[HELD_BY_PROCESS_KEY] instanceof Map)) {
		g[HELD_BY_PROCESS_KEY] = new Map();
	}
	return /** @type {Map<string, string>} */ (g[HELD_BY_PROCESS_KEY]);
})();

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
 * @param {string} lockPath
 * @param {string} reason
 */
function logLockBreak(lockPath, reason) {
	if (process.env.SPINE_LOCK_STEAL_LOG !== "1") return;
	try {
		fs.appendFileSync(
			`${lockPath}.steals`,
			`${Date.now()} pid=${process.pid} ${reason}\n`,
			"utf-8",
		);
	} catch {
		/* ignore diagnostic I/O */
	}
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
 * Publish via temp file + `linkSync` so waiters never observe an empty/partial
 * lock from `wx` create-then-write (that race was parsed as "corrupt" and
 * unlinked mid-hold — concurrent RMW lost updates).
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
	// Never fall back to Date.now() for startedAt: wall-clock acquire time is
	// not process starttime. Under load, ESM import can lag spawn by >2s; a
	// later probe of the real starttime would look like PID reuse and steal
	// the live lock (release:check flake — concurrent writers lost updates).
	const payload = JSON.stringify({
		pid: process.pid,
		startedAt: processStartedAt,
		token,
	});
	const tmpPath = `${lockPath}.${process.pid}.${token}.tmp`;
	try {
		fs.writeFileSync(tmpPath, payload, { encoding: "utf-8" });
		try {
			fs.linkSync(tmpPath, lockPath);
			return true;
		} catch (err) {
			if (/** @type {NodeJS.ErrnoException} */ (err).code !== "EEXIST") {
				throw err;
			}
			return false;
		}
	} finally {
		try {
			fs.unlinkSync(tmpPath);
		} catch {
			/* tmp already removed or never created */
		}
	}
}

/**
 * Steal the lock by renaming it out of the acquisition path, but only when
 * the renamed file is still the exact lock that was judged stale (SP-794 /
 * GitHub #302 defect 1).
 *
 * A bare `unlinkSync` could remove a lock a different waiter had freshly
 * acquired after the staleness judgment: two concurrent breakers of the same
 * dead holder would both "win", each running the critical section while the
 * other holds it. `renameSync` is atomic, so at most one breaker ever moves a
 * given lock file; the token/content re-check guarantees the moved file is
 * the same one the breaker judged stale. Exported for direct unit testing of
 * the put-back branch, which cannot be scheduled deterministically through
 * `withBatchStateLock`.
 *
 * @param {string} lockPath
 * @param {string} staleToken ownership token observed when the lock was
 *   judged stale; empty for corrupt/invalid payloads that carry no token.
 * @param {string} reason diagnostic label for the steal log
 * @param {string | null} [staleContent] raw payload text observed when the
 *   lock was judged stale; compared in full when `staleToken` is empty.
 */
export function stealIfTokenMatches(lockPath, staleToken, reason, staleContent = null) {
	const stolenPath = `${lockPath}.break.${process.pid}.${newOwnershipToken()}`;
	try {
		fs.renameSync(lockPath, stolenPath);
	} catch {
		// ENOENT: another breaker or the holder's release already removed the
		// lock — nothing to steal. Any other FS error also leaves lockPath
		// untouched; treat it as a lost race so the acquire loop keeps its
		// wait-then-timeout behavior (the unlink-based break this replaces
		// swallowed its failures the same way).
		return;
	}
	// Below this point nothing throws: every op is wrapped so a live holder's
	// lock file is never stranded away from lockPath.

	/** @type {string | null} */
	let currentContent = null;
	try {
		currentContent = fs.readFileSync(stolenPath, "utf-8");
	} catch {
		currentContent = null;
	}
	let sameStaleLock = false;
	if (typeof staleToken === "string" && staleToken.length > 0) {
		try {
			const current = JSON.parse(currentContent ?? "");
			sameStaleLock =
				current != null &&
				typeof current === "object" &&
				String(/** @type {{ token?: unknown }} */ (current).token ?? "") === staleToken;
		} catch {
			sameStaleLock = false;
		}
	} else {
		// Corrupt/invalid payloads carry no trustworthy token — compare the
		// full file content instead.
		sameStaleLock = currentContent != null && currentContent === staleContent;
	}

	if (sameStaleLock) {
		logLockBreak(lockPath, reason);
		try {
			fs.unlinkSync(stolenPath);
		} catch {
			/* already removed */
		}
		return;
	}

	// The lock at lockPath was replaced between the staleness judgment and the
	// rename — a new holder now owns it. Put the file back; EEXIST means a
	// third process already acquired lockPath in the microscopic gap, which is
	// also fine. Either way the renamed copy is discarded.
	try {
		fs.linkSync(stolenPath, lockPath);
	} catch {
		/* EEXIST — someone else owns lockPath now; discard the copy below */
	} finally {
		try {
			fs.unlinkSync(stolenPath);
		} catch {
			/* already removed */
		}
	}
}

/**
 * Break the lock when the recorded holder cannot still own it: dead PID,
 * abandoned corrupt payload, same-process leak (no active holder), or a live
 * PID whose OS starttime is newer than the recorded start (PID recycled).
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
	/** @type {string | null} raw payload text, for content-compare steals. */
	let rawContent = null;
	let corrupt = false;
	try {
		rawContent = fs.readFileSync(lockPath, "utf-8");
		holder = JSON.parse(rawContent);
		if (!holder || typeof holder !== "object") corrupt = true;
	} catch {
		corrupt = true;
	}

	if (!fs.existsSync(lockPath)) {
		// Lock vanished between attempts — nothing to break.
		return;
	}

	if (corrupt) {
		// Do not unlink on the first corrupt read: a concurrent `wx` writer can
		// briefly expose an empty/partial file. Only clear leftovers that have
		// been unreadable for a while (abandoned junk), otherwise waiters poll.
		try {
			const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
			if (ageMs < 2_000) {
				return;
			}
		} catch {
			return;
		}
		stealIfTokenMatches(lockPath, "", "corrupt-stale", rawContent);
		return;
	}

	const holderPid = Number(holder?.pid);
	if (!Number.isFinite(holderPid) || holderPid <= 0) {
		stealIfTokenMatches(lockPath, "", "invalid-pid", rawContent);
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
		stealIfTokenMatches(
			lockPath,
			token,
			`leakedSelf token=${token} mapSize=${heldByThisProcess.size}`,
			rawContent,
		);
		return;
	}

	// Dead foreign PID: break immediately. Do NOT require a null `ps` probe —
	// under suite load the PID is often recycled by an unrelated live process,
	// and refusing to break left waiters stuck until timeout (stale-lock flake).
	if (holderPid !== process.pid && !isProcessAlive(holderPid)) {
		stealIfTokenMatches(
			lockPath,
			String(holder?.token ?? ""),
			`deadPid holder=${holderPid}`,
			rawContent,
		);
		return;
	}

	// Live foreign PID: steal only when OS starttime proves the PID was
	// recycled. Require liveStart *newer* than recorded start — wall-clock
	// startedAt (legacy) is newer than real process start and must not steal.
	// startedAt null (probe failed at acquire) → never steal from a live PID.
	if (holderPid === process.pid) return;
	if (isProcessAlive(holderPid)) {
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
		if (liveStart - expectedStart > STARTTIME_TOLERANCE_MS) {
			stealIfTokenMatches(
				lockPath,
				String(holder?.token ?? ""),
				`pidRecycled holder=${holderPid}`,
				rawContent,
			);
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

/**
 * Async twin of `withBatchStateLock` for event-loop callers (SP-797 / #302):
 * same acquire loop, stale breaking, token release, and re-entrancy, but the
 * contention wait yields via `node:timers/promises` instead of blocking the
 * thread — a CLI-held lock can no longer freeze engine heartbeats, pipe
 * draining, and stall timers. `fn` MUST stay synchronous: no `await` between
 * acquire and release, or the re-entrancy map breaks. Uncontended calls reach
 * `fn` before the first `await`. Waits >1 s log one `[spine]` stderr line.
 *
 * @param {string} projectRoot
 * @param {() => unknown} fn synchronous critical section
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<unknown>} `fn`'s return value
 */
export async function withBatchStateLockAsync(projectRoot, fn, options = {}) {
	const lockPath = batchStateLockPath(projectRoot);

	// Re-entrant pass-through: nested sync/async calls from this process run directly.
	if (heldByThisProcess.has(lockPath)) {
		return fn();
	}

	const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;
	const token = newOwnershipToken();
	const waitStartedAt = Date.now();

	for (;;) {
		if (tryCreateLockFile(lockPath, token)) break;
		breakStaleLock(lockPath);
		if (Date.now() >= deadline) {
			throw new Error(
				`Timed out acquiring batch-state lock (${path.relative(projectRoot, lockPath)}) ` +
					`after ${timeoutMs}ms — another spine process may be holding it`,
			);
		}
		await sleepAsync(POLL_INTERVAL_MS);
	}

	const waitedMs = Date.now() - waitStartedAt;
	heldByThisProcess.set(lockPath, token);
	try {
		return fn();
	} finally {
		// Token-gated unlink before map clear (see `withBatchStateLock`).
		try {
			releaseLockFile(lockPath, token);
		} finally {
			heldByThisProcess.delete(lockPath);
			if (waitedMs > 1_000) {
				const rel = path.relative(projectRoot, lockPath);
				try {
					process.stderr.write(`[spine] batch-state lock wait took ${waitedMs}ms (${rel}) — another spine process held it\n`);
				} catch {
					/* diagnostic only — never fail a state save on stderr */
				}
			}
		}
	}
}
