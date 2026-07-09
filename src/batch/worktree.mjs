// @ts-check
/**
 * Git worktree provisioning for pi-spine lanes (PRD §9.4).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { resolveWorktreeSetupHook } from "../config/worktree-setup-hook.mjs";
import {
	listStaleSpineWorktreeBatchIds,
	resolveInProgressSpineBatchId,
} from "../doctor/stale-worktrees.mjs";

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
	const from = fs.realpathSync.native?.(fromDir) ?? fs.realpathSync(fromDir);
	const to = fs.realpathSync.native?.(toPath) ?? fs.realpathSync(toPath);
	return path.relative(from, to).split(path.sep).join("/");
}

/**
 * @param {string} gitfilePath
 * @param {string} resolveDir
 */
function readGitfileAdminDir(gitfilePath, resolveDir) {
	const content = fs.readFileSync(gitfilePath, "utf-8").trim();
	const match = content.match(/^gitdir:\s*(.+)$/);
	if (!match) {
		throw new Error(`Invalid lane worktree gitfile: ${gitfilePath}`);
	}
	const rawGitdir = match[1].trim();
	return path.isAbsolute(rawGitdir) ? rawGitdir : path.resolve(resolveDir, rawGitdir);
}

/**
 * @param {string} projectRoot
 * @param {string} worktreePath
 */
export function findAdminDirForWorktree(projectRoot, worktreePath) {
	const laneGitFile = path.resolve(path.join(worktreePath, ".git"));
	const worktreesDir = path.join(projectRoot, ".git", "worktrees");
	if (!fs.existsSync(worktreesDir)) {
		throw new Error(`Missing git worktrees admin dir: ${worktreesDir}`);
	}

	for (const entry of fs.readdirSync(worktreesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const adminDir = path.join(worktreesDir, entry.name);
		const gitdirFile = path.join(adminDir, "gitdir");
		if (!fs.existsSync(gitdirFile)) continue;

		const content = fs.readFileSync(gitdirFile, "utf-8").trim();
		const absLaneGit = path.isAbsolute(content)
			? content
			: path.resolve(path.dirname(gitdirFile), content);
		const resolvedLaneGit = fs.realpathSync.native?.(absLaneGit) ?? fs.realpathSync(absLaneGit);
		const resolvedTarget = fs.realpathSync.native?.(laneGitFile) ?? fs.realpathSync(laneGitFile);
		if (resolvedLaneGit === resolvedTarget) {
			return adminDir;
		}
	}

	throw new Error(`No git worktree admin metadata found for ${worktreePath}`);
}

/**
 * Rewrite lane `.git` gitfile and admin `gitdir` to relative posix paths.
 * Uses the admin directory git assigned (e.g. lane-111), not lane-N alone.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 */
export function normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath }) {
	const laneGitFile = path.join(worktreePath, ".git");
	if (!fs.existsSync(laneGitFile)) {
		throw new Error(`Lane worktree .git file missing: ${laneGitFile}`);
	}

	let adminWtDir;
	try {
		adminWtDir = readGitfileAdminDir(laneGitFile, worktreePath);
		if (!fs.existsSync(adminWtDir)) {
			adminWtDir = findAdminDirForWorktree(projectRoot, worktreePath);
		}
	} catch {
		adminWtDir = findAdminDirForWorktree(projectRoot, worktreePath);
	}

	const laneGitdirRel = posixRelative(worktreePath, adminWtDir);
	fs.writeFileSync(laneGitFile, `gitdir: ${laneGitdirRel}\n`, "utf-8");

	const adminGitdirFile = path.join(adminWtDir, "gitdir");
	if (!fs.existsSync(adminGitdirFile)) {
		throw new Error(`Admin worktree gitdir missing: ${adminGitdirFile}`);
	}

	const laneGitTarget = path.resolve(worktreePath, ".git");
	const currentAdmin = fs.readFileSync(adminGitdirFile, "utf-8").trim();
	const absLaneGit = path.isAbsolute(currentAdmin)
		? currentAdmin
		: path.resolve(path.dirname(adminGitdirFile), currentAdmin);
	const resolvedLaneGit = fs.existsSync(absLaneGit) ? absLaneGit : laneGitTarget;
	const adminGitdirRel = posixRelative(path.dirname(adminGitdirFile), resolvedLaneGit);
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
export function repairLaneWorktreeGitMetadata({ projectRoot, worktreePath }) {
	normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath });
	assertLaneWorktreeGitHealthy(worktreePath);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function batchWorktreeDir(projectRoot, batchId) {
	return path.join(projectRoot, ".worktrees", `spine-${batchId}`);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 */
export function laneWorktreePath(projectRoot, batchId, laneNumber = 1) {
	return path.join(batchWorktreeDir(projectRoot, batchId), `lane-${laneNumber}`);
}

/**
 * @param {unknown} batchState
 */
export function maxLaneNumberFromBatchState(batchState) {
	const lanes = /** @type {{ lanes?: unknown }} */ (batchState)?.lanes;
	if (!Array.isArray(lanes) || lanes.length === 0) return 1;
	let max = 1;
	for (const lane of lanes) {
		if (!lane || typeof lane !== "object") continue;
		const laneNumber = Number(/** @type {{ laneNumber?: number }} */ (lane).laneNumber);
		if (Number.isFinite(laneNumber) && laneNumber > max) {
			max = laneNumber;
		}
	}
	return max;
}

/**
 * Remove `.worktrees/spine-<batchId>/` when it has no remaining entries.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {boolean} true when the batch shell dir was removed
 */
export function removeEmptyBatchWorktreeDir(projectRoot, batchId) {
	const batchDir = batchWorktreeDir(projectRoot, batchId);
	if (!fs.existsSync(batchDir)) return false;

	const entries = fs.readdirSync(batchDir);
	if (entries.length > 0) return false;

	fs.rmdirSync(batchDir);
	return true;
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
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} [params.laneNumber]
 * @param {string} params.orchBranch
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
	normalizeLaneWorktreeGitPaths({ projectRoot, worktreePath });

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
	removeEmptyBatchWorktreeDir(projectRoot, batchId);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 * @param {string} params.batchId
 * @param {number} [params.laneNumber]
 * @param {object} [params.config]
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

/**
 * Scan stale spine batch worktree dirs and empty shells eligible for cleanup.
 *
 * @param {string} projectRoot
 * @param {string|null} [activeBatchId]
 * @returns {{ batchIds: string[], emptyShells: string[], danglingWorktrees: string[] }}
 */
export function scanStaleWorktrees(projectRoot, activeBatchId = null) {
	const inProgressBatchId =
		activeBatchId === undefined ? resolveInProgressSpineBatchId(projectRoot) : activeBatchId;
	const batchIds = listStaleSpineWorktreeBatchIds(projectRoot, inProgressBatchId);

	/** @type {string[]} */
	const emptyShells = [];
	for (const batchId of batchIds) {
		const batchDir = batchWorktreeDir(projectRoot, batchId);
		if (!fs.existsSync(batchDir)) continue;
		const entries = fs.readdirSync(batchDir);
		if (entries.length === 0) {
			emptyShells.push(batchId);
		}
	}

	/** @type {string[]} */
	let danglingWorktrees = [];
	try {
		const pruneOutput = git(projectRoot, ["worktree", "prune", "--dry-run", "--verbose"]);
		danglingWorktrees = pruneOutput
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	} catch {
		danglingWorktrees = [];
	}

	return { batchIds, emptyShells, danglingWorktrees };
}

/**
 * Prune empty batch shells and git worktree admin metadata.
 *
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.dryRun]
 * @param {string|null} [options.activeBatchId]
 * @returns {{ removedShells: string[], prunedWorktrees: string[] }}
 */
export function pruneStaleWorktrees(projectRoot, { dryRun = false, activeBatchId = null } = {}) {
	const scan = scanStaleWorktrees(projectRoot, activeBatchId);
	/** @type {string[]} */
	const removedShells = [];

	for (const batchId of scan.emptyShells) {
		if (dryRun) {
			removedShells.push(batchId);
			continue;
		}
		if (removeEmptyBatchWorktreeDir(projectRoot, batchId)) {
			removedShells.push(batchId);
		}
	}

	/** @type {string[]} */
	let prunedWorktrees = [];
	if (dryRun) {
		prunedWorktrees = scan.danglingWorktrees;
	} else {
		try {
			const pruneOutput = git(projectRoot, ["worktree", "prune", "--verbose"]);
			prunedWorktrees = pruneOutput
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
		} catch {
			prunedWorktrees = [];
		}
	}

	return { removedShells, prunedWorktrees };
}
