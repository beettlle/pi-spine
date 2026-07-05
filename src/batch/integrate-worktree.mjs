/**
 * Isolated orch→base integrate (FR-WT-08 / #91 slice 1).
 * Never checks out baseBranch in the human projectRoot worktree.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";
import { resolveGitCommitEnv } from "./git-commit-env.mjs";
import { tryAutoResolveRulesManifestMergeConflict } from "./engine-lanes/merge.mjs";
import { appendJournalEvent } from "./journal.mjs";

export const DEFAULT_SYNC_TIMEOUT_MS = 60_000;

/**
 * Record base branch tip at batch start for isolated integrate (FR-WT-08 / #91).
 *
 * @param {string} projectRoot
 * @param {object} state
 */
export function recordBatchBaseSnapshot(projectRoot, state) {
	const batchId = String(state?.batchId ?? "");
	const baseBranch = String(state?.baseBranch ?? "");
	if (!batchId || !baseBranch) {
		return state;
	}

	let baseBranchHeadAtStart = "";
	try {
		baseBranchHeadAtStart = gitExec(projectRoot, ["rev-parse", baseBranch], { projectRoot });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Cannot record base snapshot for ${baseBranch}: ${message}`);
	}

	const integrateWorktreePath = path.relative(
		projectRoot,
		resolveIntegrateWorktreePath(projectRoot, batchId),
	);

	state.baseBranchHeadAtStart = baseBranchHeadAtStart;
	state.integrateWorktreePath = integrateWorktreePath;

	appendJournalEvent(projectRoot, batchId, "batch.base_snapshot", {
		baseBranch,
		baseBranchHeadAtStart,
		integrateWorktreePath,
	});

	return state;
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {{ throwOnError?: boolean }} [options]
 */
function git(projectRoot, args, { throwOnError = true } = {}) {
	return gitExec(projectRoot, args, { throwOnError, projectRoot });
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function resolveIntegrateWorktreePath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "worktrees", `integrate-${batchId}`);
}

/**
 * @param {string} projectRoot
 * @param {string} branch
 */
export function isBranchCheckedOutInWorktree(projectRoot, branch) {
	const current = git(projectRoot, ["branch", "--show-current"], { throwOnError: false });
	return current === branch;
}

/**
 * @param {string} projectRoot
 * @param {string} worktreePath
 */
function removeIntegrateWorktree(projectRoot, worktreePath) {
	if (!fs.existsSync(worktreePath)) return;
	try {
		git(projectRoot, ["worktree", "remove", "--force", worktreePath], { throwOnError: false });
	} catch {
		// best-effort cleanup
	}
	try {
		fs.rmSync(worktreePath, { recursive: true, force: true, maxRetries: 3 });
	} catch {
		// admin metadata may already be gone
	}
}

/**
 * @param {string} projectRoot
 * @param {string} worktreePath
 * @param {string} baseBranch
 */
function provisionIntegrateWorktree(projectRoot, worktreePath, baseBranch) {
	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	removeIntegrateWorktree(projectRoot, worktreePath);
	git(projectRoot, ["worktree", "add", worktreePath, baseBranch]);
}

/**
 * @param {string} output
 */
function mergeTreeOutputHasConflict(output) {
	return /CONFLICT/i.test(output);
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.mergeMessage
 */
function plumbingMergeOrchIntoBase({ projectRoot, baseBranch, orchBranch, mergeMessage }) {
	const baseSha = git(projectRoot, ["rev-parse", baseBranch]);
	const orchSha = git(projectRoot, ["rev-parse", orchBranch]);

	let mergeTreeOutput = "";
	let treeSha = "";
	try {
		mergeTreeOutput = execFileSync(
			"git",
			["merge-tree", "--write-tree", baseBranch, orchBranch],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			},
		).trim();
		treeSha = mergeTreeOutput.split("\n").pop()?.trim() ?? "";
	} catch (err) {
		const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout ?? "") : "";
		const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "";
		mergeTreeOutput = `${stdout}\n${stderr}`.trim();
		if (mergeTreeOutputHasConflict(mergeTreeOutput)) {
			return {
				ok: false,
				failureClass: "MergeConflict",
				error: mergeTreeOutput.split("\n").slice(-3).join(" ") || "merge conflict",
			};
		}
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			failureClass: "IntegrateFailed",
			error: message,
		};
	}

	if (!treeSha || mergeTreeOutputHasConflict(mergeTreeOutput)) {
		return {
			ok: false,
			failureClass: "MergeConflict",
			error: mergeTreeOutput || `merge conflict integrating ${orchBranch} into ${baseBranch}`,
		};
	}

	const mergeCommit = git(
		projectRoot,
		["commit-tree", treeSha, "-p", baseSha, "-p", orchSha, "-m", mergeMessage],
	);
	git(projectRoot, ["update-ref", `refs/heads/${baseBranch}`, mergeCommit]);

	return { ok: true, mergeCommit, mode: "plumbing" };
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isTimeoutError(err) {
	if (!err || typeof err !== "object") return false;
	return /** @type {any} */ (err).killed === true || /** @type {any} */ (err).code === "ETIMEDOUT";
}

/**
 * Git exec with per-subprocess timeout. Uses execFileSync directly to bypass
 * gitExec which does not support timeout passthrough (#114).
 *
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ timeoutMs?: number }} [options]
 * @returns {string}
 */
function gitWithTimeout(cwd, args, { timeoutMs } = {}) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: timeoutMs,
		env: { ...process.env, ...resolveGitCommitEnv(cwd) },
	}).trim();
}

/**
 * @param {string} message
 */
function debugSyncLog(message) {
	if (process.env.DEBUG || process.env.SPINE_DEBUG) {
		process.stderr.write(`${message}\n`);
	}
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isPathspecMismatchError(err) {
	const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "";
	const message = err instanceof Error ? err.message : String(err);
	return /pathspec.*did not match/i.test(`${message}\n${stderr}`);
}

/**
 * @param {string} cwd
 * @param {string} treeRef
 * @param {string} filePath
 * @param {{ timeoutMs?: number }} [options]
 * @returns {boolean}
 */
function pathExistsInTree(cwd, treeRef, filePath, { timeoutMs } = {}) {
	try {
		gitWithTimeout(cwd, ["cat-file", "-e", `${treeRef}:${filePath}`], { timeoutMs });
		return true;
	} catch (err) {
		if (isTimeoutError(err)) {
			throw err;
		}
		return false;
	}
}

/**
 * Materialize paths introduced/changed by a plumbing merge without resetting human edits.
 * Returns a result object so callers can detect timeout and emit integrate.failed.
 *
 * @param {string} projectRoot
 * @param {string} baseSha
 * @param {string} mergeCommit
 * @param {{ timeoutMs?: number }} [options]
 * @returns {{ ok: boolean, timedOut?: boolean, error?: string, processedPaths?: number, totalPaths?: number }}
 */
export function syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit, { timeoutMs = DEFAULT_SYNC_TIMEOUT_MS } = {}) {
	const envTimeoutMs = process.env.SPINE_SYNC_TIMEOUT_MS
		? Number(process.env.SPINE_SYNC_TIMEOUT_MS)
		: null;
	const effectiveTimeout = envTimeoutMs != null && envTimeoutMs > 0 ? envTimeoutMs : timeoutMs;

	let output = "";
	try {
		output = gitWithTimeout(
			projectRoot,
			["diff-tree", "--no-commit-id", "--name-only", "-r", mergeCommit, baseSha],
			{ timeoutMs: effectiveTimeout },
		);
	} catch (err) {
		if (isTimeoutError(err)) {
			return { ok: false, timedOut: true, error: `git diff-tree timed out after ${effectiveTimeout}ms` };
		}
		return { ok: false, timedOut: false, error: err instanceof Error ? err.message : String(err) };
	}

	const paths = output.split("\n").map((line) => line.trim()).filter(Boolean);
	let processedCount = 0;

	for (const filePath of paths) {
		let existsInMerge = false;
		try {
			existsInMerge = pathExistsInTree(projectRoot, mergeCommit, filePath, {
				timeoutMs: effectiveTimeout,
			});
		} catch (err) {
			if (isTimeoutError(err)) {
				return {
					ok: false,
					timedOut: true,
					error: `git cat-file timed out for ${filePath} after ${effectiveTimeout}ms`,
					processedPaths: processedCount,
					totalPaths: paths.length,
				};
			}
			existsInMerge = false;
		}

		if (!existsInMerge) {
			debugSyncLog(
				`syncPlumbingMergePathsToWorktree: skip ${filePath} — not present in merge commit ${mergeCommit}`,
			);
			continue;
		}

		try {
			gitWithTimeout(
				projectRoot,
				["restore", "--source", mergeCommit, "--staged", "--worktree", "--", filePath],
				{ timeoutMs: effectiveTimeout },
			);
		} catch (err) {
			if (isTimeoutError(err)) {
				return {
					ok: false,
					timedOut: true,
					error: `git restore timed out for ${filePath} after ${effectiveTimeout}ms`,
					processedPaths: processedCount,
					totalPaths: paths.length,
				};
			}
			if (isPathspecMismatchError(err)) {
				debugSyncLog(
					`syncPlumbingMergePathsToWorktree: skip ${filePath} — pathspec did not match merge commit`,
				);
				continue;
			}
			debugSyncLog(
				`syncPlumbingMergePathsToWorktree: skip ${filePath} — ${err instanceof Error ? err.message : String(err)}`,
			);
			continue;
		}
		processedCount++;
	}

	return { ok: true, processedPaths: processedCount, totalPaths: paths.length };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.mergeMessage
 */
function mergeInIntegrateWorktree({ projectRoot, worktreePath, baseBranch, orchBranch, mergeMessage }) {
	try {
		git(worktreePath, ["merge", "--no-ff", orchBranch, "-m", mergeMessage]);
	} catch {
		const autoResolved = tryAutoResolveRulesManifestMergeConflict(worktreePath);
		if (!autoResolved.ok) {
			try {
				execFileSync("git", ["merge", "--abort"], {
					cwd: worktreePath,
					stdio: ["ignore", "pipe", "pipe"],
				});
			} catch {
				// best-effort abort
			}
			return {
				ok: false,
				failureClass: autoResolved.failureClass ?? "MergeConflict",
				error: autoResolved.error ?? "merge conflict",
			};
		}
		git(worktreePath, ["commit", "--no-edit"]);
	}

	const mergeCommit = git(worktreePath, ["rev-parse", "HEAD"]);
	const baseSha = git(projectRoot, ["rev-parse", baseBranch]);
	if (mergeCommit !== baseSha) {
		git(projectRoot, ["update-ref", `refs/heads/${baseBranch}`, mergeCommit]);
	}

	return { ok: true, mergeCommit, mode: "worktree" };
}

/**
 * Merge orch → base without checking out baseBranch in projectRoot.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.batchId
 */
export function mergeOrchIntoBaseIsolated({ projectRoot, baseBranch, orchBranch, batchId }) {
	const mergeMessage = `integrate ${orchBranch} into ${baseBranch}`;
	const worktreePath = resolveIntegrateWorktreePath(projectRoot, batchId);

	if (isBranchCheckedOutInWorktree(projectRoot, baseBranch)) {
		return plumbingMergeOrchIntoBase({ projectRoot, baseBranch, orchBranch, mergeMessage });
	}

	provisionIntegrateWorktree(projectRoot, worktreePath, baseBranch);
	try {
		return mergeInIntegrateWorktree({
			projectRoot,
			worktreePath,
			baseBranch,
			orchBranch,
			mergeMessage,
		});
	} finally {
		removeIntegrateWorktree(projectRoot, worktreePath);
	}
}
