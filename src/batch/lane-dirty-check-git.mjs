// @ts-nocheck
/**
 * Lane dirty-check git porcelain parsing, symlink drift, and path-in-scope helpers.
 * SP-583 extraction from lane-dirty-check.mjs; gitignored remediation stays in parent (SP-601).
 */

import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveWorktreeSetupHook } from "../config/worktree-setup-hook.mjs";
import { filterPorcelain } from "./lane-commit.mjs";
import { runWorktreeSetupHook } from "./worktree.mjs";

/**
 * Path segments that identify generated coverage report artifacts.
 * Matches extension/coverage, root coverage dirs, and nested coverage paths.
 */
export const COVERAGE_ARTIFACT_MARKERS = ["/coverage/", "coverage/"];

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isCoverageArtifactPath(filePath) {
	if (!filePath || typeof filePath !== "string") return false;
	const normalized = filePath.replace(/\\/g, "/");
	return COVERAGE_ARTIFACT_MARKERS.some(
		(marker) =>
			normalized === marker.slice(0, -1) ||
			normalized.startsWith(marker) ||
			normalized.includes(marker),
	);
}

/**
 * @param {string} filePath
 * @param {string[]} [fileScopePaths]
 * @returns {boolean}
 */
export function isPathInFileScope(filePath, fileScopePaths) {
	if (!filePath || !Array.isArray(fileScopePaths) || fileScopePaths.length === 0) {
		return false;
	}

	const normalizedPath = filePath.replace(/\\/g, "/");
	const scopePrefixes = [];
	for (const rel of fileScopePaths) {
		if (!rel || typeof rel !== "string") continue;
		const normalized = rel.replace(/\\/g, "/");
		scopePrefixes.push(normalized.endsWith("/") ? normalized : `${normalized}/`);
		scopePrefixes.push(normalized);
	}

	return scopePrefixes.some(
		(prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix),
	);
}

/**
 * @param {string} line
 * @returns {string | null}
 */
export function extractPorcelainPath(line) {
	if (!line.trim()) return null;
	let filePath = line.length > 2 && line[2] === " " ? line.slice(3) : line.slice(2);
	filePath = filePath.trim();
	if (!filePath) return null;
	if (filePath.includes(" -> ")) {
		return filePath.split(" -> ").pop()?.trim() ?? null;
	}
	return filePath;
}

/**
 * @param {string} porcelain
 * @returns {string[]}
 */
export function listPorcelainPaths(porcelain) {
	if (!porcelain?.trim()) return [];
	return porcelain
		.split("\n")
		.map((line) => extractPorcelainPath(line))
		.filter((entry) => Boolean(entry));
}

/**
 * @param {string[]} dirtyPaths
 * @param {string[]} [fileScopePaths]
 * @returns {string[]}
 */
export function listOutOfScopeCoveragePaths(dirtyPaths, fileScopePaths) {
	if (!Array.isArray(dirtyPaths) || dirtyPaths.length === 0) return [];
	return dirtyPaths.filter(
		(filePath) => isCoverageArtifactPath(filePath) && !isPathInFileScope(filePath, fileScopePaths),
	);
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function coverageRootForPath(filePath) {
	const normalized = filePath.replace(/\\/g, "/");
	const markerIdx = normalized.indexOf("/coverage/");
	if (markerIdx >= 0) {
		return normalized.slice(0, markerIdx + "/coverage".length);
	}
	if (normalized === "coverage" || normalized.startsWith("coverage/")) {
		return "coverage";
	}
	return null;
}

/**
 * @param {string[]} filePaths
 * @param {string[]} [fileScopePaths]
 * @returns {string[]}
 */
export function listOutOfScopeCoverageRoots(filePaths, fileScopePaths) {
	const roots = new Set();
	for (const filePath of filePaths) {
		if (!isCoverageArtifactPath(filePath) || isPathInFileScope(filePath, fileScopePaths)) {
			continue;
		}
		const root = coverageRootForPath(filePath);
		if (root && !isPathInFileScope(root, fileScopePaths)) {
			roots.add(root);
		}
	}
	return [...roots].sort();
}

/**
 * @param {string} porcelain
 * @returns {Set<string>}
 */
export function listTrackedPorcelainPaths(porcelain) {
	const tracked = new Set();
	if (!porcelain?.trim()) return tracked;
	for (const line of porcelain.split("\n")) {
		if (!line.trim()) continue;
		const status = line.slice(0, 2);
		if (status === "??" || status === "!!") continue;
		const filePath = extractPorcelainPath(line);
		if (filePath) tracked.add(filePath);
	}
	return tracked;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isSymlinkDeletionPorcelainLine(line) {
	if (!line?.trim() || line.length < 3) return false;
	const indexStatus = line[0];
	const worktreeStatus = line[1];
	const disallowed = new Set(["M", "A", "R", "C", "U"]);
	if (disallowed.has(indexStatus) || disallowed.has(worktreeStatus)) {
		return false;
	}
	return indexStatus === "D" || worktreeStatus === "D";
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isWorktreeDeletionPorcelainLine(line) {
	return isSymlinkDeletionPorcelainLine(line) && line[1] === "D";
}

/**
 * True when every porcelain line is a symlink/hook deletion (` D`, `D `, or `DD`).
 *
 * @param {string} porcelain
 * @returns {boolean}
 */
export function isSymlinkOnlyDriftPorcelain(porcelain) {
	if (!porcelain?.trim()) return false;
	for (const line of porcelain.split("\n")) {
		if (!line.trim()) continue;
		if (!isSymlinkDeletionPorcelainLine(line)) return false;
	}
	return true;
}

/**
 * @param {string} worktreePath
 * @returns {{ batchId: string, laneNumber: number } | null}
 */
export function parseLaneWorktreeIdentity(worktreePath) {
	const normalized = worktreePath.replace(/\\/g, "/");
	const match = normalized.match(/\/\.worktrees\/spine-([^/]+)\/lane-(\d+)\/?$/);
	if (!match) return null;
	return { batchId: match[1], laneNumber: Number(match[2]) };
}

/**
 * @param {string} porcelain
 * @returns {string}
 */
export function filterSetupHookSymlinkDriftPorcelain(porcelain) {
	if (!porcelain?.trim() || !isSymlinkOnlyDriftPorcelain(porcelain)) {
		return porcelain ?? "";
	}
	return "";
}

/**
 * Re-run worktreeSetupHook to recreate hook-managed symlinks after drift.
 *
 * @param {string} worktreePath
 * @param {{ projectRoot: string, config?: object, batchId?: string, laneNumber?: number }} options
 * @returns {{ repaired: boolean, reason?: string }}
 */
export function repairSetupHookSymlinkDrift(worktreePath, { projectRoot, config, batchId, laneNumber }) {
	const effectiveConfig = config ?? loadSpineConfig(projectRoot).config ?? {};
	const hookPath = resolveWorktreeSetupHook(projectRoot, effectiveConfig);
	if (!hookPath) {
		return { repaired: false, reason: "no_hook" };
	}

	const identity = parseLaneWorktreeIdentity(worktreePath);
	const effectiveBatchId = batchId ?? identity?.batchId ?? "unknown";
	const effectiveLaneNumber = laneNumber ?? identity?.laneNumber ?? 1;

	try {
		runWorktreeSetupHook({
			projectRoot,
			worktreePath,
			batchId: effectiveBatchId,
			laneNumber: effectiveLaneNumber,
			config: effectiveConfig,
		});
		return { repaired: true };
	} catch {
		return { repaired: false, reason: "hook_failed" };
	}
}

/**
 * Repair or ignore symlink-only deletions from worktreeSetupHook paths (#87 / SP-429).
 *
 * @param {string} worktreePath
 * @param {string} porcelain
 * @param {{ projectRoot?: string, config?: object, batchId?: string, laneNumber?: number }} [options]
 * @returns {string}
 */
export function resolveSetupHookSymlinkDriftPorcelain(
	worktreePath,
	porcelain,
	{ projectRoot, config, batchId, laneNumber } = {},
) {
	if (!porcelain?.trim() || !isSymlinkOnlyDriftPorcelain(porcelain)) {
		return porcelain ?? "";
	}

	const identityRoot = projectRoot ?? worktreePath;
	const effectiveConfig = config ?? loadSpineConfig(identityRoot).config ?? {};
	if (!resolveWorktreeSetupHook(identityRoot, effectiveConfig)) {
		return porcelain;
	}

	const repair = repairSetupHookSymlinkDrift(worktreePath, {
		projectRoot: identityRoot,
		config: effectiveConfig,
		batchId,
		laneNumber,
	});
	if (repair.repaired) {
		return porcelain;
	}

	return filterSetupHookSymlinkDriftPorcelain(porcelain);
}

/**
 * Drop out-of-scope coverage artifact lines from porcelain after ignore patterns.
 *
 * @param {string} porcelain
 * @param {string[]} [fileScopePaths]
 * @param {string[]} [ignorePatterns]
 * @returns {string}
 */
export function filterOutOfScopeCoveragePorcelain(porcelain, fileScopePaths, ignorePatterns = []) {
	const afterIgnore = filterPorcelain(porcelain, ignorePatterns);
	if (!afterIgnore?.trim()) return "";

	const kept = [];
	for (const line of afterIgnore.split("\n")) {
		if (!line.trim()) continue;
		const filePath = extractPorcelainPath(line);
		if (filePath && isCoverageArtifactPath(filePath) && !isPathInFileScope(filePath, fileScopePaths)) {
			continue;
		}
		kept.push(line);
	}
	return kept.length === 0 ? "" : kept.join("\n");
}
