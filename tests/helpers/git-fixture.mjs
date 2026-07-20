/**
 * Shared git-backed temp repo fixtures for batch and preflight tests.
 * All reconcile/preflight fixtures must use initGitRepo so baseBranch "main" exists.
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInit } from "../../bin/spine-init.mjs";

/**
 * @param {string} projectRoot
 */
export function configureGitIdentity(projectRoot) {
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} [prefix]
 * @param {{ tasksRoot?: string }} [options]
 * @returns {Promise<string>} projectRoot
 */
export async function initGitRepo(prefix = "spine-test-", options = {}) {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	runInit(projectRoot, ["--tasks-root", options.tasksRoot ?? "spine-tasks"]);
	configureGitIdentity(projectRoot);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["branch", "-M", "main"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

/**
 * @param {string} projectRoot
 */
export async function destroyGitRepo(projectRoot) {
	// Full-suite parallel git fixtures often hit ENOTEMPTY on .git/{refs,objects}
	// (Spotlight/AV). Retries absorb races; leftover tmp dirs are non-fatal.
	try {
		await rm(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code === "ENOTEMPTY") {
			return;
		}
		throw err;
	}
}
