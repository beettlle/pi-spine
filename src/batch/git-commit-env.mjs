/**
 * Resolve git author/committer identity for lane worktree commits without mutating git config.
 */

import { execFileSync } from "node:child_process";

const FALLBACK_NAME = "pi-spine";
const FALLBACK_EMAIL = "pi-spine@localhost";

/**
 * @param {string} repoPath
 * @param {string} key
 */
function readGitConfig(repoPath, key) {
	try {
		return execFileSync("git", ["config", "--get", key], {
			cwd: repoPath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return "";
	}
}

/**
 * @param {string} [projectRoot]
 * @returns {Record<string, string>}
 */
export function resolveGitCommitEnv(projectRoot) {
	const name =
		process.env.SPINE_GIT_USER_NAME?.trim() ||
		(projectRoot ? readGitConfig(projectRoot, "user.name") : "") ||
		FALLBACK_NAME;
	const email =
		process.env.SPINE_GIT_USER_EMAIL?.trim() ||
		(projectRoot ? readGitConfig(projectRoot, "user.email") : "") ||
		FALLBACK_EMAIL;

	return {
		GIT_AUTHOR_NAME: name,
		GIT_AUTHOR_EMAIL: email,
		GIT_COMMITTER_NAME: name,
		GIT_COMMITTER_EMAIL: email,
	};
}
