/**
 * Git exec helpers with commit identity env for spine batch operations.
 */

import { execFileSync } from "node:child_process";
import { resolveGitCommitEnv } from "./git-commit-env.mjs";

const GIT_EXEC_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ throwOnError?: boolean; projectRoot?: string; maxBuffer?: number }} [options]
 */
export function gitExec(cwd, args, { throwOnError = true, projectRoot, maxBuffer = GIT_EXEC_MAX_BUFFER } = {}) {
	const identityRoot = projectRoot ?? cwd;
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			maxBuffer,
			env: { ...process.env, ...resolveGitCommitEnv(identityRoot) },
		}).trim();
	} catch (err) {
		if (throwOnError) throw err;
		return null;
	}
}
