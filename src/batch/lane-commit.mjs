/**
 * Auto-commit lane worktree before merge (TP-015, FR-WORK-02/03).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * @param {string} worktreePath
 * @param {string[]} args
 */
function git(worktreePath, args) {
	return execFileSync("git", args, {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
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
 * Drop porcelain lines whose path matches any ignore pattern (basename or full path).
 *
 * @param {string} porcelain
 * @param {string[]} ignorePatterns
 */
export function filterPorcelain(porcelain, ignorePatterns) {
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
		const ignored = ignorePatterns.some((pattern) => pathMatchesIgnorePattern(filePath, pattern));
		if (!ignored) kept.push(line);
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
	}).trim();
	return Number.parseInt(count, 10) || 0;
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
 * @returns {{ ok: true, committed: boolean, commitSha?: string } | { ok: false, error: string, failureClass: string }}
 */
export function commitLaneWorktree({ worktreePath, taskBranch, taskId, batchId, taskFolder }) {
	try {
		const porcelain = gitPorcelain(worktreePath);
		if (!porcelain) {
			return { ok: true, committed: false };
		}

		const donePath = path.join(taskFolder, ".DONE");
		if (!fs.existsSync(donePath)) {
			return {
				ok: false,
				error: `Lane worktree has uncommitted changes but ${path.basename(taskFolder)}/.DONE is missing — worker did not finish cleanly`,
				failureClass: "DirtyWorktree",
			};
		}

		git(worktreePath, ["checkout", taskBranch]);
		git(worktreePath, ["add", "-A"]);
		const message = `feat(${taskId}): batch ${batchId} worker completion`;
		git(worktreePath, ["commit", "-m", message]);
		const commitSha = git(worktreePath, ["rev-parse", "HEAD"]);
		return { ok: true, committed: true, commitSha };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: `Failed to commit lane worktree: ${message}`,
			failureClass: "DirtyWorktree",
		};
	}
}
