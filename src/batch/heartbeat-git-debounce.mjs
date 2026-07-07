// @ts-nocheck
/**
 * Git porcelain debounce for lane heartbeat progress signals (issue #98 P1).
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Per-lane file-scope mtime snapshot; reused when mtimes are unchanged.
 * @type {Map<string, { fileScopeMtimeMs: number | null, dirtyPaths: string[] }>}
 */
const _gitPorcelainDebounceByLane = new Map();

let _gitPorcelainCallCount = 0;

/**
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 */
function gitPorcelainDebounceKey(worktreePath, fileScopePaths) {
	const scopeKey = Array.isArray(fileScopePaths) ? fileScopePaths.join("\0") : "";
	return `${worktreePath}\0${scopeKey}`;
}

/** Clear git porcelain debounce cache. Useful for test isolation. */
export function clearGitPorcelainDebounceCache() {
	_gitPorcelainDebounceByLane.clear();
}

/** Reset git porcelain invocation counter (tests only). */
export function resetGitPorcelainCallCount() {
	_gitPorcelainCallCount = 0;
}

/** @returns {number} git status --porcelain invocations since last reset. */
export function getGitPorcelainCallCount() {
	return _gitPorcelainCallCount;
}

/**
 * Max mtime among existing file-scope paths (FR-WORK-10 activity signal).
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 */
export function resolveFileScopeMtimeMs(worktreePath, fileScopePaths) {
	if (!Array.isArray(fileScopePaths) || fileScopePaths.length === 0) return null;
	let max = null;
	for (const rel of fileScopePaths) {
		if (!rel || typeof rel !== "string") continue;
		const target = path.join(worktreePath, rel);
		if (!fs.existsSync(target)) continue;
		const stat = fs.statSync(target);
		if (!stat.isFile()) continue;
		max = max === null ? stat.mtimeMs : Math.max(max, stat.mtimeMs);
	}
	return max;
}

/**
 * Debounced wrapper around fresh scoped porcelain resolution.
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 * @param {string} [taskFolder]
 * @param {(worktreePath: string, fileScopePaths?: string[], taskFolder?: string) => string[]} resolveFresh
 */
export function resolveDebouncedScopedDirtyPaths(
	worktreePath,
	fileScopePaths,
	taskFolder,
	resolveFresh,
) {
	const fileScopeMtimeMs = resolveFileScopeMtimeMs(worktreePath, fileScopePaths);
	const debounceKey = gitPorcelainDebounceKey(worktreePath, fileScopePaths);
	const debounced = _gitPorcelainDebounceByLane.get(debounceKey);
	if (debounced && debounced.fileScopeMtimeMs === fileScopeMtimeMs) {
		return debounced.dirtyPaths;
	}
	_gitPorcelainCallCount += 1;
	const dirtyPaths = resolveFresh(worktreePath, fileScopePaths, taskFolder);
	_gitPorcelainDebounceByLane.set(debounceKey, { fileScopeMtimeMs, dirtyPaths });
	return dirtyPaths;
}
