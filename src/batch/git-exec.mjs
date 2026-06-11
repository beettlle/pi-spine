/**
 * Git exec helpers with commit identity env for spine batch operations.
 */

import { execFileSync } from "node:child_process";
import { resolveGitCommitEnv } from "./git-commit-env.mjs";

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ throwOnError?: boolean; projectRoot?: string }} [options]
 */
export function gitExec(cwd, args, { throwOnError = true, projectRoot } = {}) {
	const identityRoot = projectRoot ?? cwd;
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, ...resolveGitCommitEnv(identityRoot) },
		}).trim();
	} catch (err) {
		if (throwOnError) throw err;
		return null;
	}
}
