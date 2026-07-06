// @ts-nocheck
/**
 * Pre-landed fileScopeMustChange satisfaction (issue #56, SP-373).
 */

import path from "node:path";
import { execFileSync } from "node:child_process";
import micromatch from "micromatch";
import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";

/**
 * @param {string} file
 * @param {string} pattern
 */
function matchesPattern(file, pattern) {
	return micromatch.isMatch(file, pattern, { dot: true });
}

/**
 * @param {string} worktreePath
 * @param {string} relPath
 */
function gitFirstCommitTouchingPath(worktreePath, relPath) {
	try {
		const output = execFileSync("git", ["log", "--reverse", "--format=%H", "--", relPath], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		}).trim();
		return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
	} catch {
		return null;
	}
}

/**
 * @param {string} worktreePath
 * @param {string} refA
 * @param {string} refB
 * @param {string} [pathspec]
 */
function listPathsChangedBetweenRefs(worktreePath, refA, refB, pathspec = "") {
	try {
		const args = ["diff", "--name-only", `${refA}..${refB}`];
		if (pathspec) {
			args.push("--", pathspec);
		}
		const output = execFileSync("git", args, {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		});
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * @param {string} file
 * @param {string} pattern
 */
function matchesScopePattern(file, pattern) {
	if (pattern.endsWith("/")) {
		return file.startsWith(pattern);
	}
	return matchesPattern(file, pattern);
}

/**
 * @param {string} worktreePath
 * @param {string} sinceCommit
 * @param {string} baseRef
 * @param {string} pattern
 */
function listPathsChangedSinceCommit(worktreePath, sinceCommit, baseRef, pattern) {
	return listPathsChangedBetweenRefs(worktreePath, sinceCommit, baseRef, pattern);
}

/**
 * @param {string} worktreePath
 * @param {string[]} changedFiles
 * @param {object} [config]
 * @returns {string | null}
 */
export function resolvePromptRelPath(worktreePath, changedFiles, config = {}) {
	if (typeof config.promptRelPath === "string" && config.promptRelPath.trim()) {
		return config.promptRelPath.replace(/\\/g, "/");
	}
	if (typeof config.taskFolder === "string" && config.taskFolder.trim()) {
		const rel = path.relative(worktreePath, config.taskFolder).replace(/\\/g, "/");
		if (rel && !rel.startsWith("..")) {
			return `${rel}/PROMPT.md`;
		}
	}

	const tasksRoot = String(config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT).replace(/\\/g, "/");
	/** @type {Set<string>} */
	const taskDirs = new Set();
	for (const file of changedFiles) {
		const normalized = String(file).replace(/\\/g, "/");
		const match = normalized.match(new RegExp(`^${tasksRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/`));
		if (match?.[1]) {
			taskDirs.add(match[1]);
		}
	}
	if (taskDirs.size === 1) {
		return `${tasksRoot}/${[...taskDirs][0]}/PROMPT.md`;
	}
	return null;
}

/**
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string | null} promptRelPath
 * @param {string} baseRef
 */
export function isFileScopePatternPrelanded(worktreePath, pattern, promptRelPath, baseRef = "main") {
	if (!promptRelPath) {
		return false;
	}
	const introCommit = gitFirstCommitTouchingPath(worktreePath, promptRelPath);
	if (!introCommit) {
		return false;
	}
	const changedPaths = listPathsChangedSinceCommit(worktreePath, introCommit, baseRef, pattern);
	return changedPaths.some((filePath) => matchesPattern(filePath, pattern));
}

/**
 * @param {string[]} changedFiles
 * @param {string} [tasksRoot]
 */
export function hasSpineTaskDeliveryChanges(changedFiles, tasksRoot = DEFAULT_TASKS_ROOT) {
	const prefix = `${String(tasksRoot).replace(/\\/g, "/")}/`;
	return changedFiles.some((file) => String(file).replace(/\\/g, "/").startsWith(prefix));
}

/**
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string[]} changedFiles
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} config
 * @param {string} baseBranch
 * @param {{ testCommandOk: boolean }} delivery
 * @param {(worktreePath: string, artifactPath: string) => boolean} artifactExists
 */
export function isPrelandedFileScopeSatisfied(
	worktreePath,
	pattern,
	changedFiles,
	parsedContract,
	config,
	baseBranch,
	delivery,
	artifactExists,
) {
	const matchedInLane = changedFiles.some((file) => matchesPattern(file, pattern));
	if (matchedInLane) {
		return false;
	}
	const promptRelPath = resolvePromptRelPath(worktreePath, changedFiles, config);
	if (!isFileScopePatternPrelanded(worktreePath, pattern, promptRelPath, baseBranch)) {
		return false;
	}
	if (parsedContract.testCommand && !delivery.testCommandOk) {
		return false;
	}
	for (const artifactPath of parsedContract.artifactsMustExist ?? []) {
		if (!artifactExists(worktreePath, artifactPath)) {
			return false;
		}
	}
	return true;
}

/**
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string[]} changedFiles
 * @param {object} config
 * @param {string} baseBranch
 */
export function isStubPrelandedFileScopeSatisfied(worktreePath, pattern, changedFiles, config, baseBranch) {
	const tasksRoot = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	if (!hasSpineTaskDeliveryChanges(changedFiles, tasksRoot)) {
		return false;
	}
	return isFileScopePatternPrelanded(
		worktreePath,
		pattern,
		resolvePromptRelPath(worktreePath, changedFiles, config),
		baseBranch,
	);
}

/**
 * @param {string} worktreePath
 * @param {string} ref
 * @param {string} pattern
 */
function listPathsOnRef(worktreePath, ref, pattern) {
	try {
		const output = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", pattern], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		});
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * True when base branch already contains scope changes and the lane has no diff for the pattern
 * (issue #105 SP-014, SP-462).
 *
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string[]} changedFiles
 * @param {string} baseBranch
 */
export function isBaseScopeSatisfied(worktreePath, pattern, changedFiles, baseBranch, config = {}) {
	const matchedInLane = changedFiles.some((file) => matchesScopePattern(file, pattern));
	if (matchedInLane) {
		return false;
	}
	const tasksRoot = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	if (!hasSpineTaskDeliveryChanges(changedFiles, tasksRoot)) {
		return false;
	}
	const laneDiffVsBase = listPathsChangedBetweenRefs(worktreePath, baseBranch, "HEAD", pattern);
	if (laneDiffVsBase.some((filePath) => matchesScopePattern(filePath, pattern))) {
		return false;
	}
	const onBase = listPathsOnRef(worktreePath, baseBranch, pattern);
	return onBase.some((filePath) => matchesScopePattern(filePath, pattern));
}

/**
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string[]} changedFiles
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {string} baseBranch
 * @param {{ testCommandOk: boolean }} delivery
 * @param {(worktreePath: string, artifactPath: string) => boolean} artifactExists
 */
export function isBaseFileScopeSatisfied(
	worktreePath,
	pattern,
	changedFiles,
	parsedContract,
	baseBranch,
	delivery,
	artifactExists,
	config = {},
) {
	if (!isBaseScopeSatisfied(worktreePath, pattern, changedFiles, baseBranch, config)) {
		return false;
	}
	if (parsedContract.testCommand && !delivery.testCommandOk) {
		return false;
	}
	for (const artifactPath of parsedContract.artifactsMustExist ?? []) {
		if (!artifactExists(worktreePath, artifactPath)) {
			return false;
		}
	}
	return true;
}
