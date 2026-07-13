// @ts-nocheck
/**
 * Auto-commit lane worktree before merge (TP-015, FR-WORK-02/03).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { filterGitignoredPaths, gitAddFilteredPaths } from "./git-helpers.mjs";
import { classifyGitignoredPaths, formatGitignoredRemediationMessage } from "./lane-dirty-check.mjs";
import { gitExec } from "./git-exec.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import {
	hasReleaseCriticalContract,
	shouldEnforceStubContractAtLaneCommit,
	verifyStubFileScopeMustChange,
} from "./contract-verify.mjs";
import { DEFAULT_WORKTREE_SETUP_IGNORE_PATHS } from "../config/spine-config-load.mjs";

/**
 * @param {string} worktreePath
 * @param {string[]} args
 * @param {string} [projectRoot]
 */
function git(worktreePath, args, projectRoot) {
	return gitExec(worktreePath, args, { projectRoot: projectRoot ?? worktreePath });
}

/**
 * @param {string} worktreePath
 */
export function gitPorcelain(worktreePath) {
	if (process.env.SPINE_TEST_GIT_PORCELAIN_THROW === "after_commit") {
		process.env.SPINE_TEST_GIT_PORCELAIN_THROW = "throw";
		return "";
	}
	if (process.env.SPINE_TEST_GIT_PORCELAIN_THROW === "throw") {
		throw new Error("git status failure: not a git repository");
	}

	return execFileSync("git", ["status", "--porcelain"], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	}).trim();
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function extractPorcelainPath(line) {
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
 * @param {string} filePath
 * @param {string} pattern
 */
function pathMatchesIgnorePattern(filePath, pattern) {
	if (!pattern || typeof pattern !== "string") return false;
	const normalizedPattern = pattern.replace(/\\/g, "/");
	const normalizedPath = filePath.replace(/\\/g, "/");
	if (normalizedPath === normalizedPattern) return true;
	return path.posix.basename(normalizedPath) === normalizedPattern;
}

/**
 * Local fileScope check (avoid importing lane-dirty-check-git — circular via filterPorcelain).
 *
 * @param {string} filePath
 * @param {string[]} [fileScopePaths]
 */
function isPathInFileScope(filePath, fileScopePaths) {
	if (!filePath || !Array.isArray(fileScopePaths) || fileScopePaths.length === 0) {
		return false;
	}
	const normalizedPath = filePath.replace(/\\/g, "/");
	for (const rel of fileScopePaths) {
		if (!rel || typeof rel !== "string") continue;
		const normalized = rel.replace(/\\/g, "/");
		const prefix = normalized.endsWith("/") ? normalized : `${normalized}/`;
		if (normalizedPath === normalized || normalizedPath.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/**
 * Hook ignore path unless task fileScope explicitly lists it (SP-640 / #200).
 *
 * @param {string} filePath
 * @param {string[]} ignorePatterns
 * @param {string[]} [fileScopePaths]
 */
function shouldSkipHookIgnorePath(filePath, ignorePatterns, fileScopePaths) {
	if (!Array.isArray(ignorePatterns) || ignorePatterns.length === 0) return false;
	if (isPathInFileScope(filePath, fileScopePaths)) return false;
	return ignorePatterns.some((pattern) => pathMatchesIgnorePattern(filePath, pattern));
}

/**
 * Drop porcelain lines whose path matches any ignore pattern (basename or full path).
 * Paths listed in `fileScopePaths` are kept even when they match ignore patterns.
 *
 * @param {string} porcelain
 * @param {string[]} ignorePatterns
 * @param {string[]} [fileScopePaths]
 */
export function filterPorcelain(porcelain, ignorePatterns, fileScopePaths = []) {
	if (!porcelain?.trim()) return "";
	if (!Array.isArray(ignorePatterns) || ignorePatterns.length === 0) {
		return porcelain;
	}

	const kept = [];
	for (const line of porcelain.split("\n")) {
		if (!line.trim()) continue;
		const filePath = extractPorcelainPath(line);
		if (!filePath) {
			kept.push(line);
			continue;
		}
		if (shouldSkipHookIgnorePath(filePath, ignorePatterns, fileScopePaths)) continue;
		kept.push(line);
	}
	return kept.length === 0 ? "" : kept.join("\n");
}

/**
 * Commits on `headRef` not reachable from `baseRef`.
 *
 * @param {string} projectRoot
 * @param {string} baseRef
 * @param {string} headRef
 */
export function countCommitsAhead(projectRoot, baseRef, headRef) {
	const count = execFileSync("git", ["rev-list", "--count", `${baseRef}..${headRef}`], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	}).trim();
	return Number.parseInt(count, 10) || 0;
}

/**
 * @param {string} worktreePath
 */
function listIgnoredUntrackedPaths(worktreePath) {
	const output = execFileSync("git", ["ls-files", "-o", "-i", "--exclude-standard"], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		maxBuffer: 10 * 1024 * 1024,
	}).trim();
	if (!output) return [];
	return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * @param {string} porcelain
 * @returns {string[]}
 */
function listPorcelainPaths(porcelain) {
	if (!porcelain?.trim()) return [];
	return porcelain
		.split("\n")
		.map((line) => extractPorcelainPath(line))
		.filter((entry) => Boolean(entry));
}

/**
 * Stage and commit uncommitted lane work when the worker left a `.DONE` marker.
 *
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskBranch
 * @param {string} params.taskId
 * @param {string} params.batchId
 * @param {string} params.taskFolder Absolute path to task folder (for `.DONE` check)
 * @param {string} [params.projectRoot] Main repo root for git identity resolution
 * @param {string} [params.baseBranch] Base branch for stub contract diff (default main)
 * @param {string[]} [params.ignorePatterns] Hook paths to skip (default includes `.venv`)
 * @param {string[]} [params.fileScopePaths] Task fileScope — paths here are never skipped
 * @returns {{ ok: true, committed: boolean, commitSha?: string, skippedGitignoredPaths?: string[], skippedIgnorePaths?: string[] } | { ok: false, error: string, failureClass: string, gitignoredPaths?: string[] }}
 */
export function commitLaneWorktree({
	worktreePath,
	taskBranch,
	taskId,
	batchId,
	taskFolder,
	projectRoot,
	baseBranch = "main",
	ignorePatterns,
	fileScopePaths = [],
}) {
	const identityRoot = projectRoot ?? worktreePath;
	const effectiveIgnorePatterns = Array.isArray(ignorePatterns)
		? ignorePatterns
		: [...DEFAULT_WORKTREE_SETUP_IGNORE_PATHS];
	try {
		const porcelain = gitPorcelain(worktreePath);
		const dirtyPaths = listPorcelainPaths(porcelain);
		const skippedIgnorePaths = dirtyPaths.filter((filePath) =>
			shouldSkipHookIgnorePath(filePath, effectiveIgnorePatterns, fileScopePaths),
		);
		const stageCandidatePaths = dirtyPaths.filter(
			(filePath) => !shouldSkipHookIgnorePath(filePath, effectiveIgnorePatterns, fileScopePaths),
		);
		const ignoredUntrackedPaths = listIgnoredUntrackedPaths(worktreePath);
		// Only-hook-noise dirty (e.g. untracked `.venv` symlink) is not a DirtyWorktree failure.
		if (stageCandidatePaths.length === 0 && ignoredUntrackedPaths.length === 0) {
			return {
				ok: true,
				committed: false,
				skippedIgnorePaths,
			};
		}

		const donePath = path.join(taskFolder, ".DONE");
		if (!fs.existsSync(donePath)) {
			return {
				ok: false,
				error: `Lane worktree has uncommitted changes but ${path.basename(taskFolder)}/.DONE is missing — worker did not finish cleanly`,
				failureClass: "DirtyWorktree",
			};
		}

		if (shouldEnforceStubContractAtLaneCommit(donePath)) {
			const promptPath = path.join(taskFolder, "PROMPT.md");
			const parsedContract = fs.existsSync(promptPath)
				? parseContract(fs.readFileSync(promptPath, "utf-8"))
				: { fileScopeMustChange: [] };
			if (hasReleaseCriticalContract(parsedContract)) {
				const scopeCheck = verifyStubFileScopeMustChange(
					worktreePath,
					parsedContract,
					baseBranch,
					stageCandidatePaths,
				);
				if (!scopeCheck.ok) {
					return {
						ok: false,
						error: `Stub worker completed without required file-scope changes: ${scopeCheck.failures.join("; ")}`,
						failureClass: "stub",
					};
				}
			}
		}

		const { stageable, skipped: gitignoredDirtyPaths } = filterGitignoredPaths(
			worktreePath,
			stageCandidatePaths,
		);
		const gitignoredPaths = [...new Set([...gitignoredDirtyPaths, ...ignoredUntrackedPaths])];
		if (stageable.length === 0 && gitignoredPaths.length > 0) {
			const { indexTracked, worktreeOnly } = classifyGitignoredPaths(worktreePath, gitignoredPaths);
			return {
				ok: false,
				error: formatGitignoredRemediationMessage(indexTracked, worktreeOnly),
				failureClass: "GitignoredDirtyWorktree",
				gitignoredPaths,
			};
		}

		if (stageable.length === 0) {
			return {
				ok: true,
				committed: false,
				skippedIgnorePaths,
				skippedGitignoredPaths: gitignoredPaths,
			};
		}

		const currentBranch = git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"], identityRoot);
		if (currentBranch !== taskBranch) {
			git(worktreePath, ["checkout", taskBranch], identityRoot);
		}
		const addResult = gitAddFilteredPaths(worktreePath, stageable, { projectRoot: identityRoot });
		const message = `feat(${taskId}): batch ${batchId} worker completion`;
		git(worktreePath, ["commit", "-m", message], identityRoot);
		const commitSha = git(worktreePath, ["rev-parse", "HEAD"], identityRoot);
		return {
			ok: true,
			committed: true,
			commitSha,
			skippedGitignoredPaths: [...addResult.skipped, ...gitignoredPaths],
			skippedIgnorePaths,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: `Failed to commit lane worktree: ${message}`,
			failureClass: "DirtyWorktree",
		};
	}
}
