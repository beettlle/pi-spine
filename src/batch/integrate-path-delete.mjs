// @ts-nocheck
/**
 * Merge-deletion materialization for the post-merge base sync (SP-830).
 * Opted in per call via `applyDeletions` on syncPlumbingMergePathsToWorktree;
 * the human `spine sync-base` flow does not opt in (SP-784 skip behavior kept).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveGitCommitEnv } from "./git-commit-env.mjs";

/**
 * Untrack and remove a path that the merged tree deleted from projectRoot.
 * Best effort and never throws: a failed `git rm --cached` (timeout, pathspec
 * mismatch, or a worktree file with local edits — git refuses that case) makes
 * the helper return false so the caller keeps the pre-existing skip behavior.
 * `--cached` leaves the worktree file behind, so the leftover is rmSync'd.
 *
 * @param {string} projectRoot
 * @param {string} filePath
 * @param {{ timeoutMs?: number }} [options]
 * @returns {boolean} true when the path was untracked
 */
export function removeMergeDeletedPath(projectRoot, filePath, { timeoutMs } = {}) {
	try {
		execFileSync("git", ["rm", "--cached", "--quiet", "--", filePath], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: timeoutMs,
			env: { ...process.env, ...resolveGitCommitEnv(projectRoot) },
		});
	} catch {
		return false;
	}
	try {
		fs.rmSync(path.join(projectRoot, filePath), { force: true, maxRetries: 3 });
	} catch {
		// Worktree file already gone or momentarily locked; index removal is what matters.
	}
	return true;
}
