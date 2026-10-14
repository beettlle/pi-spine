// @ts-nocheck
/**
 * Merge-deletion materialization for the post-merge base sync (SP-830, #346).
 * Opt-in per call via `applyDeletions` on syncPlumbingMergePathsToWorktree;
 * the human `spine sync-base` flow does not opt in and keeps the skip (SP-784).
 * Deliberately does not import from integrate-worktree.mjs (no import cycle).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveGitCommitEnv } from "./git-commit-env.mjs";

/**
 * Mirror of the sync loop's timeout detection (execFileSync timeout kill).
 * @param {unknown} err
 * @returns {boolean}
 */
function isTimeoutError(err) {
	if (!err || typeof err !== "object") return false;
	return /** @type {any} */ (err).killed === true || /** @type {any} */ (err).code === "ETIMEDOUT";
}

/**
 * Remove from the checkout a path the merged tree deleted (SP-830). Untracks it
 * with `git rm --cached`. Regular files are only removed when their worktree
 * content matches the index (`git diff --quiet`): an unmodified stale entry is
 * the ref-move artifact integrate leaves behind, while a modified or deleted
 * file is operator work and is left alone. A `160000` gitlink directory is
 * always kept on disk — it may host a live nested worktree. Paths never present
 * at baseSha return `{ removed: false }` (caller keeps today's skip). Git
 * failures return `{ removed: false }`; timeouts are rethrown so the caller
 * reports `timedOut` like its other git calls.
 *
 * @param {string} projectRoot
 * @param {string} baseSha
 * @param {string} filePath
 * @param {{ timeoutMs?: number }} [options]
 * @returns {{ removed: boolean, gitlink?: boolean }}
 */
export function removeMergeDeletedPath(projectRoot, baseSha, filePath, { timeoutMs } = {}) {
	let entry = "";
	try {
		entry = execFileSync("git", ["ls-tree", baseSha, "--", filePath], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: timeoutMs,
			env: { ...process.env, ...resolveGitCommitEnv(projectRoot) },
		});
	} catch (err) {
		if (isTimeoutError(err)) throw err;
		return { removed: false };
	}
	if (!entry.trim()) return { removed: false };
	const gitlink = entry.startsWith("160000");
	if (!gitlink) {
		try {
			execFileSync("git", ["diff", "--quiet", "--", filePath], {
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: timeoutMs,
				env: { ...process.env, ...resolveGitCommitEnv(projectRoot) },
			});
		} catch (err) {
			if (isTimeoutError(err)) throw err;
			// exit 1: worktree differs from index — operator edit or local deletion.
			return { removed: false };
		}
	}
	try {
		execFileSync("git", ["rm", "-q", "--cached", "--ignore-unmatch", "--", filePath], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: timeoutMs,
			env: { ...process.env, ...resolveGitCommitEnv(projectRoot) },
		});
	} catch (err) {
		if (isTimeoutError(err)) throw err;
		return { removed: false };
	}
	if (!gitlink) fs.rmSync(path.join(projectRoot, filePath), { force: true });
	return { removed: true, gitlink };
}
