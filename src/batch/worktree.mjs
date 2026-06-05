/**
 * Git worktree provisioning for pi-spine lanes (PRD §9.4).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { resolveWorktreeSetupHook } from "../config/worktree-setup-hook.mjs";

const WORKTREE_SETUP_HOOK_TIMEOUT_MS = 120_000;

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
 * @param {string} fromDir
 * @param {string} toPath
 */
function posixRelative(fromDir, toPath) {
	return path.relative(fromDir, toPath).split(path.sep).join("/");
}

/**
 * @param {string} projectRoot
 * @param {number} laneNumber
 */
function adminWorktreeDir(projectRoot, laneNumber) {
	return path.join(projectRoot, ".git", "worktrees", `lane-${laneNumber}`);
}

/**
 * Rewrite lane `.git` gitfile and admin `.git/worktrees/lane-N/gitdir` to relative posix paths.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 * @param {number} params.laneNumber
 */
export function normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath, laneNumber }) {
	const laneGitFile = path.join(worktreePath, ".git");
	const adminGitdirFile = path.join(adminWorktreeDir(projectRoot, laneNumber), "gitdir");
	const adminWtDir = adminWorktreeDir(projectRoot, laneNumber);

	if (!fs.existsSync(laneGitFile)) {
		throw new Error(`Lane worktree .git file missing: ${laneGitFile}`);
	}
	if (!fs.existsSync(adminGitdirFile)) {
		throw new Error(`Admin worktree gitdir missing: ${adminGitdirFile}`);
	}

	const laneGitdirRel = posixRelative(worktreePath, adminWtDir);
	const adminGitdirRel = posixRelative(path.join(projectRoot, ".git"), laneGitFile);

	fs.writeFileSync(laneGitFile, `gitdir: ${laneGitdirRel}\n`, "utf-8");
	fs.writeFileSync(adminGitdirFile, `${adminGitdirRel}\n`, "utf-8");
}

/**
 * @param {string} worktreePath
 */
export function assertLaneWorktreeGitHealthy(worktreePath) {
	try {
		git(worktreePath, ["rev-parse", "HEAD"]);
		git(worktreePath, ["status", "--porcelain"]);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Lane worktree git unhealthy (${worktreePath}): ${message}`);
	}
}

/**
 * Idempotent normalize + health assert for resume repair.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 * @param {number} params.laneNumber
 */
export function repairLaneWorktreeGitMetadata({ projectRoot, worktreePath, laneNumber }) {
	normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath, laneNumber });
	assertLaneWorktreeGitHealthy(worktreePath);
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
	normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath, laneNumber });

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

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} maxLaneNumber
 */
export function removeLaneWorktrees(projectRoot, batchId, maxLaneNumber) {
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		removeLaneWorktree(projectRoot, batchId, laneNumber);
	}
}

/**
 * @param {object} params
 */
export function runWorktreeSetupHook({
	projectRoot,
	worktreePath,
	batchId,
	laneNumber,
	config = {},
}) {
	const hookPath = resolveWorktreeSetupHook(projectRoot, config);
	if (!hookPath) {
		return { ok: true, skipped: true, durationMs: 0 };
	}

	const startedAt = Date.now();
	const result = spawnSync(hookPath, {
		cwd: worktreePath,
		env: {
			...process.env,
			SPINE_PROJECT_ROOT: projectRoot,
			SPINE_WORKTREE: worktreePath,
			SPINE_BATCH_ID: batchId,
			SPINE_LANE_NUMBER: String(laneNumber),
		},
		encoding: "utf-8",
		timeout: WORKTREE_SETUP_HOOK_TIMEOUT_MS,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const durationMs = Date.now() - startedAt;

	if (result.error) {
		throw new Error(`worktree setup hook failed: ${result.error.message}`);
	}

	const stdout = result.stdout ?? "";
	const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	const lastLine = lines.at(-1);
	if (!lastLine) {
		throw new Error("worktree setup hook produced no JSON on stdout");
	}

	let parsed;
	try {
		parsed = JSON.parse(lastLine);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`worktree setup hook returned invalid JSON: ${message}`);
	}

	if (parsed.ok !== true) {
		const message = typeof parsed.error === "string" && parsed.error.trim()
			? parsed.error.trim()
			: "hook returned ok: false";
		throw new Error(`worktree setup hook failed: ${message}`);
	}

	if (result.status !== 0) {
		throw new Error(`worktree setup hook exited with code ${result.status ?? "unknown"}`);
	}

	return { ok: true, durationMs };
}
