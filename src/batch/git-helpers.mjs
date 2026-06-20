/**
 * Shared git path helpers for spine batch merge and lane commit.
 */

import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} paths
 * @returns {{ stageable: string[], skipped: string[] }}
 */
export function filterGitignoredPaths(projectRoot, paths) {
	const normalized = [...new Set(paths.filter(Boolean))];
	if (normalized.length === 0) {
		return { stageable: [], skipped: [] };
	}

	/** @type {Set<string>} */
	let ignoredSet = new Set();
	try {
		const output = execFileSync("git", ["check-ignore", "--no-index", "--stdin"], {
			cwd: projectRoot,
			input: `${normalized.join("\n")}\n`,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		for (const line of output.split("\n")) {
			const trimmed = line.trim();
			if (trimmed) ignoredSet.add(trimmed);
		}
	} catch (err) {
		const execErr = /** @type {NodeJS.ErrnoException & { status?: number }} */ (err);
		if (execErr.status === 1) {
			return { stageable: normalized, skipped: [] };
		}
		throw err;
	}

	/** @type {string[]} */
	const stageable = [];
	/** @type {string[]} */
	const skipped = [];
	for (const filePath of normalized) {
		if (ignoredSet.has(filePath)) {
			skipped.push(filePath);
		} else {
			stageable.push(filePath);
		}
	}
	return { stageable, skipped };
}

/**
 * Stage paths while skipping gitignored entries. Never throws solely because a path is ignored.
 *
 * @param {string} cwd
 * @param {string[]} paths
 * @param {{ projectRoot?: string, throwOnError?: boolean }} [options]
 * @returns {{ added: string[], skipped: string[] }}
 */
export function gitAddFilteredPaths(cwd, paths, { projectRoot, throwOnError = true } = {}) {
	const identityRoot = projectRoot ?? cwd;
	const { stageable, skipped } = filterGitignoredPaths(cwd, paths);
	if (stageable.length > 0) {
		try {
			gitExec(cwd, ["add", "--", ...stageable], { projectRoot: identityRoot, throwOnError });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (
				throwOnError &&
				skipped.length === 0 &&
				(message.includes("ignored") || message.includes("check-ignore"))
			) {
				const gitignoredErr = new Error(message);
				gitignoredErr.name = "MergeGitignoredAddError";
				throw gitignoredErr;
			}
			throw err;
		}
	}
	return { added: stageable, skipped };
}

/**
 * @param {unknown} err
 */
export function isGitignoredAddError(err) {
	if (!(err instanceof Error)) return false;
	if (err.name === "MergeGitignoredAddError") return true;
	const message = err.message.toLowerCase();
	return (
		message.includes("ignored by one of your .gitignore files") ||
		(message.includes("git add") && message.includes("ignored"))
	);
}
