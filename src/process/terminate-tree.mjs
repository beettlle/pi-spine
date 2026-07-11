/**
 * Process-tree terminate — reap a PID and its descendants (SP-609 / #194).
 *
 * Killing only the tracked workerPid leaves nested `pi` grandchildren alive.
 * List children before signaling the parent so reparenting to init cannot hide them.
 */

import { spawnSync } from "node:child_process";

/** Hard cap on BFS depth when walking the process tree. */
const MAX_TREE_DEPTH = 32;

/** Hard cap on total descendant PIDs collected. */
const MAX_DESCENDANTS = 256;

/**
 * @param {unknown} pid
 * @returns {number[]}
 */
export function listDirectChildPids(pid) {
	const parent = Number(pid);
	if (!Number.isFinite(parent) || parent <= 0) return [];
	if (process.platform === "win32") {
		return listDirectChildPidsWindows(parent);
	}
	const result = spawnSync("pgrep", ["-P", String(parent)], {
		encoding: "utf-8",
		timeout: 5_000,
	});
	if (result.status !== 0 && result.status !== 1) {
		return [];
	}
	const stdout = result.stdout ?? "";
	return stdout
		.split(/\s+/)
		.map((line) => Number(line.trim()))
		.filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * @param {number} parent
 * @returns {number[]}
 */
function listDirectChildPidsWindows(parent) {
	const result = spawnSync(
		"wmic",
		["process", "where", `ParentProcessId=${parent}`, "get", "ProcessId", "/value"],
		{ encoding: "utf-8", timeout: 5_000, windowsHide: true },
	);
	if (result.error || (result.status !== 0 && result.status !== 1)) {
		return [];
	}
	const stdout = result.stdout ?? "";
	/** @type {number[]} */
	const children = [];
	for (const match of stdout.matchAll(/ProcessId=(\d+)/g)) {
		const n = Number(match[1]);
		if (Number.isFinite(n) && n > 0) children.push(n);
	}
	return children;
}

/**
 * Breadth-first descendant PIDs (excludes the root). Bounded depth and count.
 *
 * @param {unknown} pid
 * @returns {number[]}
 */
export function listDescendantPids(pid) {
	const root = Number(pid);
	if (!Number.isFinite(root) || root <= 0) return [];
	/** @type {number[]} */
	const descendants = [];
	/** @type {Set<number>} */
	const seen = new Set([root]);
	/** @type {Array<{ pid: number, depth: number }>} */
	const queue = [{ pid: root, depth: 0 }];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) break;
		if (current.depth >= MAX_TREE_DEPTH) continue;
		if (descendants.length >= MAX_DESCENDANTS) break;
		for (const child of listDirectChildPids(current.pid)) {
			if (seen.has(child)) continue;
			seen.add(child);
			descendants.push(child);
			if (descendants.length >= MAX_DESCENDANTS) break;
			queue.push({ pid: child, depth: current.depth + 1 });
		}
	}
	return descendants;
}

/**
 * @param {number} pid
 * @param {NodeJS.Signals} signal
 * @returns {boolean} true when the signal was delivered
 */
function tryKill(pid, signal) {
	try {
		process.kill(pid, signal);
		return true;
	} catch {
		return false;
	}
}

/**
 * Terminate a process and its descendants.
 *
 * On Unix, also attempts process-group kill (`-pid`) when the target is a
 * group leader. On Windows, prefers `taskkill /T` then falls back to tree walk.
 *
 * @param {unknown} pid
 * @param {{ signal?: NodeJS.Signals }} [options]
 * @returns {{ rootPid: number, signal: NodeJS.Signals, descendantPids: number[], signaled: number[] }}
 */
export function terminateProcessTree(pid, { signal = "SIGKILL" } = {}) {
	const rootPid = Number(pid);
	/** @type {number[]} */
	const signaled = [];
	if (!Number.isFinite(rootPid) || rootPid <= 0) {
		return { rootPid: 0, signal, descendantPids: [], signaled };
	}

	if (process.platform === "win32") {
		const taskkill = spawnSync(
			"taskkill",
			["/PID", String(rootPid), "/T", "/F"],
			{ encoding: "utf-8", timeout: 10_000, windowsHide: true },
		);
		if (taskkill.status === 0) {
			return { rootPid, signal, descendantPids: [], signaled: [rootPid] };
		}
	}

	const descendantPids = listDescendantPids(rootPid);

	// Deepest-first so parents do not reparent before children are signaled.
	for (let i = descendantPids.length - 1; i >= 0; i -= 1) {
		const childPid = descendantPids[i];
		if (tryKill(childPid, signal)) signaled.push(childPid);
	}

	if (process.platform !== "win32") {
		// Negative PID = process group; succeeds when root is the group leader.
		tryKill(-rootPid, signal);
	}

	if (tryKill(rootPid, signal)) signaled.push(rootPid);

	return { rootPid, signal, descendantPids, signaled };
}
