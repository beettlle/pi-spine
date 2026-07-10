// @ts-nocheck
/**
 * Lane-commit dirty hygiene: coverage restore/clean, gitignored artifact
 * sanitization, and post-lane-commit porcelain resolution (SP-601 / #117).
 */

import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveWorktreeSetupHook } from "../config/worktree-setup-hook.mjs";
import { gitPorcelain } from "./lane-commit.mjs";
import { gitExec } from "./git-exec.mjs";
import {
	extractPorcelainPath,
	filterOutOfScopeCoveragePorcelain,
	isSymlinkOnlyDriftPorcelain,
	listOutOfScopeCoveragePaths,
	listOutOfScopeCoverageRoots,
	listPorcelainPaths,
	listTrackedPorcelainPaths,
	repairSetupHookSymlinkDrift,
} from "./lane-dirty-check-git.mjs";

/**
 * Path segments for gitignored build artifacts that npm test and similar tools
 * regenerate in lane worktrees (SP-471 / #95).
 */
export const GITIGNORED_ARTIFACT_MARKERS = [
	"/node_modules/",
	"node_modules/",
	"/coverage/",
	"coverage/",
	"/__pycache__/",
	"__pycache__/",
	"/graphify-out/",
	"graphify-out/",
	"/.review/",
	".review/",
	"/.spine/runtime/",
	".spine/runtime/",
];

/**
 * Restore tracked and remove untracked out-of-scope coverage before lane commit.
 *
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 * @param {{ projectRoot?: string, porcelain?: string }} [options]
 * @returns {{ restored: string[], cleanedRoots: string[] }}
 */
export function sanitizeOutOfScopeCoverageBeforeLaneCommit(
	worktreePath,
	fileScopePaths,
	{ projectRoot, porcelain } = {},
) {
	const identityRoot = projectRoot ?? worktreePath;
	const rawPorcelain = porcelain ?? "";
	const dirtyPaths = listPorcelainPaths(rawPorcelain);
	const { restored } = restoreOutOfScopeCoverageArtifacts(worktreePath, fileScopePaths, {
		projectRoot: identityRoot,
		dirtyPaths,
		porcelain: rawPorcelain,
	});

	const cleanedRoots = listOutOfScopeCoverageRoots(dirtyPaths, fileScopePaths);
	for (const root of cleanedRoots) {
		gitExec(worktreePath, ["clean", "-fd", "--", root], {
			projectRoot: identityRoot,
			throwOnError: false,
		});
	}

	return { restored, cleanedRoots };
}

/**
 * Restore tracked coverage artifacts that are outside task file scope.
 *
 * @param {string} worktreePath
 * @param {string[]} [fileScopePaths]
 * @param {{ projectRoot?: string, dirtyPaths?: string[], porcelain?: string }} [options]
 * @returns {{ restored: string[] }}
 */
export function restoreOutOfScopeCoverageArtifacts(
	worktreePath,
	fileScopePaths,
	{ projectRoot, dirtyPaths, porcelain } = {},
) {
	const identityRoot = projectRoot ?? worktreePath;
	const candidates = Array.isArray(dirtyPaths) ? dirtyPaths : [];
	const outOfScope = listOutOfScopeCoveragePaths(candidates, fileScopePaths);
	if (outOfScope.length === 0) {
		return { restored: [] };
	}

	const trackedPaths = listTrackedPorcelainPaths(porcelain ?? "");
	const toRestore = trackedPaths.size > 0
		? outOfScope.filter((filePath) => trackedPaths.has(filePath))
		: outOfScope;
	if (toRestore.length === 0) {
		return { restored: [] };
	}

	gitExec(
		worktreePath,
		["restore", "--source=HEAD", "--worktree", "--", ...toRestore],
		{ projectRoot: identityRoot },
	);
	return { restored: toRestore };
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
export function isGitignoredArtifactPath(filePath) {
	if (!filePath || typeof filePath !== "string") return false;
	const normalized = filePath.replace(/\\/g, "/");
	return GITIGNORED_ARTIFACT_MARKERS.some(
		(marker) =>
			normalized === marker.slice(0, -1) ||
			normalized.startsWith(marker) ||
			normalized.includes(marker),
	);
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function gitignoredArtifactRootForPath(filePath) {
	const normalized = filePath.replace(/\\/g, "/");
	for (const marker of ["/node_modules/", "/coverage/", "/__pycache__/", "/graphify-out/"]) {
		const markerIdx = normalized.indexOf(marker);
		if (markerIdx >= 0) {
			return normalized.slice(0, markerIdx + marker.length - 1);
		}
	}
	if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
		return "node_modules";
	}
	if (normalized === "coverage" || normalized.startsWith("coverage/")) {
		return "coverage";
	}
	if (normalized === "__pycache__" || normalized.startsWith("__pycache__/")) {
		return "__pycache__";
	}
	if (normalized === "graphify-out" || normalized.startsWith("graphify-out/")) {
		return "graphify-out";
	}
	if (normalized === ".review" || normalized.startsWith(".review/")) {
		return ".review";
	}
	if (normalized === ".spine/runtime" || normalized.startsWith(".spine/runtime/")) {
		return ".spine/runtime";
	}
	return null;
}

/**
 * @param {string[]} filePaths
 * @returns {string[]}
 */
export function listGitignoredArtifactRoots(filePaths) {
	const roots = new Set();
	for (const filePath of filePaths) {
		if (!isGitignoredArtifactPath(filePath)) continue;
		const root = gitignoredArtifactRootForPath(filePath);
		if (root) roots.add(root);
	}
	return [...roots].sort();
}

/**
 * @param {string} worktreePath
 * @returns {string[]}
 */
function listIgnoredUntrackedPaths(worktreePath) {
	let output = "";
	try {
		output = execFileSync("git", ["ls-files", "-o", "-i", "--exclude-standard"], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return [];
	}
	if (!output) return [];
	return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * Auto-clean worktree-only gitignored artifacts under known dirs before lane dirty gate.
 *
 * @param {string} worktreePath
 * @param {{ projectRoot?: string, porcelain?: string, enabled?: boolean }} [options]
 * @returns {{ cleanedRoots: string[] }}
 */
export function sanitizeGitignoredArtifactsBeforeLaneCommit(
	worktreePath,
	{ projectRoot, porcelain, enabled = true } = {},
) {
	if (!enabled) return { cleanedRoots: [] };

	const identityRoot = projectRoot ?? worktreePath;
	const rawPorcelain = typeof porcelain === "string" ? porcelain : "";
	const dirtyPaths = listPorcelainPaths(rawPorcelain);
	const ignoredUntrackedPaths = listIgnoredUntrackedPaths(worktreePath);
	const gitignoredCandidates = [...new Set([...dirtyPaths, ...ignoredUntrackedPaths])];
	if (gitignoredCandidates.length === 0) {
		return { cleanedRoots: [] };
	}

	const { worktreeOnly } = classifyGitignoredPaths(worktreePath, gitignoredCandidates);
	const artifactRoots = listGitignoredArtifactRoots(worktreeOnly);
	for (const root of artifactRoots) {
		gitExec(worktreePath, ["clean", "-fdX", "--", root], {
			projectRoot: identityRoot,
			throwOnError: false,
		});
	}

	return { cleanedRoots: artifactRoots };
}

export function classifyGitignoredPaths(worktreePath, gitignoredPaths) {
	if (!Array.isArray(gitignoredPaths) || gitignoredPaths.length === 0) {
		return { indexTracked: [], worktreeOnly: [] };
	}

	let indexedOutput = "";
	try {
		indexedOutput = execFileSync(
			"git",
			["ls-files", "--cached", "--", ...gitignoredPaths],
			{
				cwd: worktreePath,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
			},
		).trim();
	} catch {
		// If ls-files fails, treat all as worktree-only (safe fallback).
		return { indexTracked: [], worktreeOnly: [...gitignoredPaths] };
	}

	const indexedSet = new Set(
		indexedOutput ? indexedOutput.split("\n").map((l) => l.trim()).filter(Boolean) : [],
	);
	const indexTracked = [];
	const worktreeOnly = [];
	for (const p of gitignoredPaths) {
		if (indexedSet.has(p)) {
			indexTracked.push(p);
		} else {
			worktreeOnly.push(p);
		}
	}
	return { indexTracked, worktreeOnly };
}

/**
 * Build a remediation message appropriate for the gitignored path classification.
 *
 * @param {string[]} indexTracked
 * @param {string[]} worktreeOnly
 * @returns {string}
 */
export function formatGitignoredRemediationMessage(indexTracked, worktreeOnly) {
	const allPaths = [...indexTracked, ...worktreeOnly];
	const preview = allPaths.slice(0, 20).join(", ");
	const suffix = allPaths.length > 20 ? "…" : "";
	const prefix = `Lane worktree has gitignored dirty files only (${preview}${suffix})`;

	if (indexTracked.length > 0 && worktreeOnly.length > 0) {
		return (
			`${prefix} — ` +
			`remove index-tracked paths with git rm --cached on the task branch, ` +
			`then git clean -fdX to remove worktree-only artifacts before resume`
		);
	}
	if (indexTracked.length > 0) {
		return (
			`${prefix} — ` +
			`remove from the index with git rm --cached on the task branch before resume`
		);
	}
	return (
		`${prefix} — ` +
		`worktree-only artifacts (not in git index); clean with git clean -fdX before resume`
	);
}

/**
 * Resolve porcelain for post-lane-commit validation: restore ephemeral coverage, then filter.
 *
 * @param {string} worktreePath
 * @param {object} [options]
 * @param {string[]} [options.fileScopePaths]
 * @param {string[]} [options.ignorePatterns]
 * @param {string} [options.projectRoot]
 * @param {string} [options.porcelain]
 * @returns {string}
 */
export function resolvePostLaneCommitPorcelain(
	worktreePath,
	{ fileScopePaths, ignorePatterns = [], projectRoot, porcelain, config, batchId, laneNumber } = {},
) {
	const rawPorcelain = typeof porcelain === "string" ? porcelain : "";
	const dirtyPaths = listPorcelainPaths(rawPorcelain);
	const { restored } = restoreOutOfScopeCoverageArtifacts(worktreePath, fileScopePaths, {
		projectRoot,
		dirtyPaths,
		porcelain: rawPorcelain,
	});

	let effectivePorcelain = rawPorcelain;
	if (restored.length > 0) {
		const restoredSet = new Set(restored);
		const kept = [];
		for (const line of rawPorcelain.split("\n")) {
			if (!line.trim()) continue;
			const filePath = extractPorcelainPath(line);
			if (filePath && restoredSet.has(filePath)) continue;
			kept.push(line);
		}
		effectivePorcelain = kept.length === 0 ? "" : kept.join("\n");
	}

	let filtered = filterOutOfScopeCoveragePorcelain(effectivePorcelain, fileScopePaths, ignorePatterns);
	if (!filtered?.trim()) {
		return "";
	}

	if (isSymlinkOnlyDriftPorcelain(filtered)) {
		const identityRoot = projectRoot ?? worktreePath;
		const effectiveConfig = config ?? loadSpineConfig(identityRoot).config ?? {};
		if (resolveWorktreeSetupHook(identityRoot, effectiveConfig)) {
			repairSetupHookSymlinkDrift(worktreePath, {
				projectRoot: identityRoot,
				config: effectiveConfig,
				batchId,
				laneNumber,
			});
			const refreshedPorcelain = gitPorcelain(worktreePath);
			filtered = filterOutOfScopeCoveragePorcelain(
				refreshedPorcelain,
				fileScopePaths,
				ignorePatterns,
			);
			if (!filtered?.trim()) {
				return "";
			}
			if (isSymlinkOnlyDriftPorcelain(filtered)) {
				return "";
			}
		}
	}

	return filtered;
}
