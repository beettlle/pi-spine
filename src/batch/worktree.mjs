/**
 * Git worktree provisioning for pi-spine lanes (PRD §9.4).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return execFileSync("git", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 */
export function laneWorktreePath(projectRoot, batchId, laneNumber = 1) {
	return path.join(projectRoot, ".worktrees", `spine-${batchId}`, `lane-${laneNumber}`);
}

/**
 * @param {string} batchId
 * @param {number} [laneNumber]
 */
export function laneTaskBranch(batchId, laneNumber = 1) {
	return `task/spine-lane-${laneNumber}-${batchId}`;
}

/**
 * @param {string} projectRoot
 * @param {string} baseBranch
 * @param {string} orchBranch
 */
export function ensureOrchBranch(projectRoot, baseBranch, orchBranch) {
	try {
		git(projectRoot, ["rev-parse", "--verify", orchBranch]);
		return;
	} catch {
		git(projectRoot, ["branch", orchBranch, baseBranch]);
	}
}

/**
 * @param {object} params
 */
export function provisionLaneWorktree({
	projectRoot,
	batchId,
	laneNumber = 1,
	orchBranch,
}) {
	const worktreePath = laneWorktreePath(projectRoot, batchId, laneNumber);
	const taskBranch = laneTaskBranch(batchId, laneNumber);

	if (fs.existsSync(worktreePath)) {
		throw new Error(`Worktree already exists: ${worktreePath}`);
	}

	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	git(projectRoot, ["worktree", "add", "-b", taskBranch, worktreePath, orchBranch]);

	return { worktreePath, taskBranch, orchBranch };
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} [laneNumber]
 */
export function removeLaneWorktree(projectRoot, batchId, laneNumber = 1) {
	const worktreePath = laneWorktreePath(projectRoot, batchId, laneNumber);
	if (!fs.existsSync(worktreePath)) return;

	try {
		git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
	} catch {
		fs.rmSync(worktreePath, { recursive: true, force: true, maxRetries: 3 });
	}
}
