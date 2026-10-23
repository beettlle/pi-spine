/**
 * Advisory host-capacity preflight for stet-backed contract review. Local LLM
 * review competes with batch workers for RAM; the v2.28 release stalled when a
 * second stet session and a 16 GB model ran with swap nearly exhausted.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const PROBE_TIMEOUT_MS = 3000;
const BYTES_PER_MIB = 1024 * 1024;
export const SWAP_FREE_WARN_BYTES = 2 * 1024 * BYTES_PER_MIB;
/** Loaded local-model bytes above this share of physical RAM leave too little for lanes. */
export const LOADED_MODEL_RAM_SHARE_WARN = 0.5;

const STET_SESSION_PATTERN = "stet (start|run|rerun)( |$)";
const SPINE_BATCH_PATTERN = "spine(\\.mjs)? batch (start|resume)";

/**
 * @param {string} file
 * @param {string[]} args
 * @param {number|null} [emptyExitStatus] Exit status meaning "ran fine, no results".
 * @returns {string|null} stdout, or null when the probe is unavailable.
 */
function tryExec(file, args, emptyExitStatus = null) {
	try {
		return execFileSync(file, args, {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: PROBE_TIMEOUT_MS,
		});
	} catch (err) {
		const status = err && typeof err === "object" && "status" in err ? err.status : null;
		return emptyExitStatus !== null && status === emptyExitStatus ? "" : null;
	}
}

/** @param {string} pattern @returns {number[]|null} */
function pgrepPids(pattern) {
	const PGREP_NO_MATCH_STATUS = 1;
	const out = tryExec("pgrep", ["-f", pattern], PGREP_NO_MATCH_STATUS);
	if (out === null) return null;
	return out
		.split("\n")
		.map((line) => Number.parseInt(line, 10))
		.filter((pid) => Number.isInteger(pid) && pid !== process.pid);
}

/**
 * @param {string} text `sysctl vm.swapusage` output
 * @returns {number|null}
 */
export function parseDarwinSwapFreeBytes(text) {
	const match = /free\s*=\s*([\d.]+)M/.exec(text);
	return match ? Math.round(Number.parseFloat(match[1]) * BYTES_PER_MIB) : null;
}

/**
 * @param {string} text /proc/meminfo contents
 * @returns {number|null} null when the host has no swap configured.
 */
export function parseLinuxSwapFreeBytes(text) {
	const total = /^SwapTotal:\s+(\d+) kB/m.exec(text);
	const free = /^SwapFree:\s+(\d+) kB/m.exec(text);
	if (!total || !free || Number(total[1]) === 0) return null;
	return Number(free[1]) * 1024;
}

/** @returns {number|null} */
function probeSwapFreeBytes() {
	if (process.platform === "darwin") {
		const out = tryExec("sysctl", ["vm.swapusage"]);
		return out === null ? null : parseDarwinSwapFreeBytes(out);
	}
	if (process.platform === "linux") {
		try {
			return parseLinuxSwapFreeBytes(fs.readFileSync("/proc/meminfo", "utf-8"));
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * @param {string} text `lms ps --json` output
 * @returns {{ id: string, sizeBytes: number }[]|null}
 */
export function parseLmsLoadedModels(text) {
	try {
		const parsed = JSON.parse(text);
		if (!Array.isArray(parsed)) return null;
		return parsed
			.filter((m) => m && typeof m.sizeBytes === "number")
			.map((m) => ({ id: String(m.identifier ?? m.modelKey ?? "unknown"), sizeBytes: m.sizeBytes }));
	} catch {
		return null;
	}
}

/** @returns {{ id: string, sizeBytes: number }[]|null} */
function probeLoadedModels() {
	const out = tryExec("lms", ["ps", "--json"]);
	return out === null ? null : parseLmsLoadedModels(out);
}

export const DEFAULT_STET_CAPACITY_PROBES = {
	stetOnPath: () => tryExec("stet", ["--version"]) !== null,
	stetSessionPids: () => pgrepPids(STET_SESSION_PATTERN),
	spineBatchPids: () => pgrepPids(SPINE_BATCH_PATTERN),
	swapFreeBytes: probeSwapFreeBytes,
	loadedModels: probeLoadedModels,
	totalMemBytes: () => os.totalmem(),
};

/** @param {number} bytes */
const gib = (bytes) => `${(bytes / (1024 * BYTES_PER_MIB)).toFixed(1)} GiB`;

/**
 * @param {{ probes?: Partial<typeof DEFAULT_STET_CAPACITY_PROBES> }} [opts]
 */
export function buildStetCapacityDoctorCheck(opts = {}) {
	const probes = { ...DEFAULT_STET_CAPACITY_PROBES, ...opts.probes };
	const label = "stet review capacity";
	if (!probes.stetOnPath()) {
		return { label, ok: true, detail: "stet not on PATH (skipped)" };
	}

	/** @type {string[]} */
	const warnings = [];
	/** @type {string[]} */
	const unknown = [];

	const stetPids = probes.stetSessionPids();
	if (stetPids === null) unknown.push("stet processes");
	else if (stetPids.length > 0) warnings.push(`stet review already running (pid ${stetPids.join(", ")})`);

	const batchPids = probes.spineBatchPids();
	if (batchPids === null) unknown.push("spine batches");
	else if (batchPids.length > 0) warnings.push(`other spine batch running (pid ${batchPids.join(", ")})`);

	const swapFree = probes.swapFreeBytes();
	if (swapFree !== null && swapFree < SWAP_FREE_WARN_BYTES) {
		warnings.push(`swap nearly exhausted (${gib(swapFree)} free)`);
	}

	const models = probes.loadedModels();
	if (models === null) {
		unknown.push("LM Studio models");
	} else {
		const loadedBytes = models.reduce((sum, m) => sum + m.sizeBytes, 0);
		const totalMem = probes.totalMemBytes();
		if (loadedBytes > totalMem * LOADED_MODEL_RAM_SHARE_WARN) {
			const ids = models.map((m) => m.id).join(", ");
			warnings.push(`LM Studio models use ${gib(loadedBytes)} of ${gib(totalMem)} RAM (${ids})`);
		}
	}

	const unknownNote = unknown.length > 0 ? `; not probed: ${unknown.join(", ")}` : "";
	if (warnings.length === 0) {
		return { label, ok: true, detail: `host has headroom for stet review${unknownNote}` };
	}
	return {
		label,
		ok: true,
		warning: true,
		detail: `${warnings.join("; ")}${unknownNote}`,
		suggestedCommand: "lms unload --all  # or wait for the other stet/spine run to finish",
	};
}
