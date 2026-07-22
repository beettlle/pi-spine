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
 * @param {{ rm?: (path: string, options: object) => Promise<void> }} [options]
 */
export async function destroyGitRepo(projectRoot, options = {}) {
	const rmImpl = options.rm ?? rm;
	// macOS Spotlight / antivirus scanners may keep .git/{refs,objects}/pack handles
	// open briefly while fs.rm is running, causing ENOTEMPTY even after bounded retries.
	// If the directory still cannot be removed after maxRetries, swallow the residual
	// ENOTEMPTY so a successful test run is not turned red. The OS tmp cleaner will
	// reclaim the leftover directory later.
	try {
		await rmImpl(projectRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code === "ENOTEMPTY") {
			return;
		}
		throw err;
	}
}
