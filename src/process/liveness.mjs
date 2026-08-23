/**
 * Cross-platform process liveness checks (signal 0 / kill -0 equivalent),
 * plus engine liveness paired with process start time (SP-715 / #259).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

/**
 * Default tolerance (ms) when comparing a probed process start time with the
 * stored `engineStartedAt`. Absorbs `ps lstart` second-level granularity and
 * the delay between engine process spawn and `recordBatchEnginePid`.
 */
export const ENGINE_STARTTIME_TOLERANCE_MS = 60_000;

/**
 * @param {unknown} pid
 * @returns {boolean}
 */
export function isProcessAlive(pid) {
	const n = Number(pid);
	if (!Number.isFinite(n) || n <= 0) return false;
	try {
		process.kill(n, 0);
		return true;
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code === "EPERM") {
			return true;
		}
		return false;
	}
}

/** @type {number|null} */
let cachedClockTicksPerSecond = null;

/**
 * Clock ticks per second (sysconf _SC_CLK_TCK) for /proc starttime conversion.
 *
 * @returns {number}
 */
function clockTicksPerSecond() {
	if (cachedClockTicksPerSecond != null) return cachedClockTicksPerSecond;
	let hz = 100;
	try {
		const out = execFileSync("getconf", ["CLK_TCK"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const parsed = Number(out);
		if (Number.isFinite(parsed) && parsed > 0) hz = parsed;
	} catch {
		/* getconf unavailable — Linux default USER_HZ is 100 */
	}
	cachedClockTicksPerSecond = hz;
	return hz;
}

/**
 * Linux: absolute process start time from `/proc/<pid>/starttime` (field 22 of
 * stat, clock ticks since boot) combined with `btime` from /proc/stat.
 * The comm field (2) may contain spaces/parens, so fields are parsed after the
 * last ")".
 *
 * @param {number} pid
 * @returns {number|null} epoch ms
 */
function readLinuxProcessStartMs(pid) {
	const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf-8");
	const closeParen = stat.lastIndexOf(")");
	if (closeParen < 0) return null;
	const rest = stat.slice(closeParen + 1).trim().split(/\s+/);
	// rest[0] is field 3 (state); starttime is field 22 → index 19.
	const startTicks = Number(rest[19]);
	if (!Number.isFinite(startTicks) || startTicks < 0) return null;
	const procStat = fs.readFileSync("/proc/stat", "utf-8");
	const btimeLine = procStat.split("\n").find((line) => line.startsWith("btime "));
	if (!btimeLine) return null;
	const bootSeconds = Number(btimeLine.slice("btime ".length).trim());
	if (!Number.isFinite(bootSeconds) || bootSeconds <= 0) return null;
	return (bootSeconds + startTicks / clockTicksPerSecond()) * 1000;
}

/** @type {Record<string, number>} */
const PS_MONTH_INDEX = {
	Jan: 0,
	Feb: 1,
	Mar: 2,
	Apr: 3,
	May: 4,
	Jun: 5,
	Jul: 6,
	Aug: 7,
	Sep: 8,
	Oct: 9,
	Nov: 10,
	Dec: 11,
};

/**
 * Parse `ps -o lstart=` output ("Www Mmm dd hh:mm:ss yyyy") without relying on
 * Date.parse, whose acceptance of this shape is implementation-defined.
 *
 * @param {string} text
 * @returns {number|null} epoch ms (local time, matching ps output)
 */
function parsePsLstartMs(text) {
	const match = /^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/.exec(
		text.trim(),
	);
	if (!match) return null;
	const month = PS_MONTH_INDEX[match[1]];
	if (month == null) return null;
	const ms = new Date(
		Number(match[6]),
		month,
		Number(match[2]),
		Number(match[3]),
		Number(match[4]),
		Number(match[5]),
	).getTime();
	return Number.isFinite(ms) ? ms : null;
}

/**
 * macOS / generic Unix fallback: process start time via `ps -p <pid> -o lstart=`.
 *
 * @param {number} pid
 * @returns {number|null} epoch ms
 */
function readPsProcessStartMs(pid) {
	const out = execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
		encoding: "utf-8",
		env: { ...process.env, LC_ALL: "C" },
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
	if (!out) return null;
	return parsePsLstartMs(out);
}

/**
 * Best-effort absolute process start time (epoch ms) for a live pid.
 * Returns null when the platform or probe cannot provide one.
 *
 * @param {unknown} pid
 * @returns {number|null}
 */
export function probeProcessStartTimeMs(pid) {
	const n = Number(pid);
	if (!Number.isFinite(n) || n <= 0) return null;
	// Windows limitation (SP-715 / #259): no start-time probe here; callers fall
	// back to PID-only liveness, which can confuse a recycled PID for the engine.
	if (process.platform === "win32") return null;
	try {
		if (process.platform === "linux") {
			const fromProc = readLinuxProcessStartMs(n);
			if (fromProc != null) return fromProc;
		}
		return readPsProcessStartMs(n);
	} catch {
		return null;
	}
}

/**
 * Engine liveness paired with the stored `engineStartedAt` so a recycled PID
 * owned by an unrelated process is not mistaken for the batch engine
 * (SP-715 / #259).
 *
 * Fallbacks (all preserve the previous PID-only behavior):
 * - no `expectedStartedAt` recorded → PID-only
 * - Windows → PID-only (documented limitation: PID reuse is not detected)
 * - start-time probe unavailable → PID-only
 *
 * @param {unknown} pid
 * @param {unknown} expectedStartedAt epoch ms recorded by recordBatchEnginePid
 * @param {object} [options]
 * @param {(pid: unknown) => boolean} [options.isAlive] injectable liveness probe
 * @param {(pid: unknown) => number|null} [options.probeStartTimeMs] injectable start-time probe
 * @param {string} [options.platform] injectable platform override
 * @param {number} [options.toleranceMs] match tolerance (default ENGINE_STARTTIME_TOLERANCE_MS)
 * @returns {boolean}
 */
export function isEngineProcessAlive(pid, expectedStartedAt, options = {}) {
	const isAlive = options.isAlive ?? isProcessAlive;
	if (!isAlive(pid)) return false;

	const expected = Number(expectedStartedAt);
	if (!Number.isFinite(expected) || expected <= 0) return true;

	const platform = options.platform ?? process.platform;
	if (platform === "win32") return true;

	const probe = options.probeStartTimeMs ?? probeProcessStartTimeMs;
	/** @type {number|null} */
	let startedMs = null;
	try {
		startedMs = probe(pid);
	} catch {
		startedMs = null;
	}
	if (startedMs == null || !Number.isFinite(startedMs) || startedMs <= 0) return true;

	const tolerance = Number.isFinite(Number(options.toleranceMs))
		? Number(options.toleranceMs)
		: ENGINE_STARTTIME_TOLERANCE_MS;
	return Math.abs(startedMs - expected) <= tolerance;
}
