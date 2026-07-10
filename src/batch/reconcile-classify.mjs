// @ts-nocheck
/** Task classification and git inspection for batch reconciliation (SP-578). */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import { resolveCurrentGitBranch } from "../config/spine-preflight-lib.mjs";
import { classifyTaskDoneSemantics } from "./diagnosis.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { parseBatchState } from "./batch-state-io.mjs";
import { saveSpineBatchState } from "./state.mjs";

/** @param {string} projectRoot @param {ReturnType<typeof loadSpineConfig>} [configResult] */
export function resolveTasksRoot(projectRoot, configResult) {
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	if (!loaded.config) {
		return null;
	}
	return resolveTasksRootPath(projectRoot, loaded.config);
}

/** Align classification with batch-state status (SP-516 / #166, SP-512). @param {object} classified */
export function alignTaskClassificationWithStatus(classified) {
	const status = String(classified.status ?? "").toLowerCase();
	let classification = classified.classification;

	if (status === "succeeded" || status === "skipped") {
		classification = "terminal-success";
	} else if (status === "failed") {
		classification = "terminal-failure";
	} else if (status === "running") {
		if (classified.doneOnMain || classified.doneInLane || classified.doneFileFound) {
			classification = "terminal-success";
		} else {
			classification = "running";
		}
	} else {
		classification = "pending";
	}

	return { ...classified, classification };
}

/** @param {object} batch @param {string|null} tasksRoot @param {string} [projectRoot] */
export function classifyTasks(batch, tasksRoot, projectRoot = "") {
	return batch.tasks.map((task) =>
		alignTaskClassificationWithStatus(
			classifyTaskDoneSemantics(task, {
				tasksRoot,
				projectRoot,
				batchId: batch.batchId,
				lanes: batch.lanes,
			}),
		),
	);
}

/** @param {{ projectRoot: string, state: object }} params @returns {{ changed: boolean }} */
export function syncPersistedClassifications({ projectRoot, state }) {
	if (!state || typeof state !== "object") {
		return { changed: false };
	}

	const batch = parseBatchState(state, "");
	if (!batch) {
		return { changed: false };
	}

	const tasksRoot = resolveTasksRoot(projectRoot);
	const classified = classifyTasks(batch, tasksRoot, projectRoot);
	const alignedById = new Map(classified.map((task) => [String(task.taskId), task]));
	let changed = false;

	for (const task of state.tasks ?? []) {
		if (!task?.taskId) continue;
		const aligned = alignedById.get(String(task.taskId));
		if (!aligned) continue;

		const status = String(task.status ?? "").toLowerCase();
		if (status === "succeeded" || status === "skipped") {
			if ("classification" in task) {
				delete task.classification;
				changed = true;
			}
			continue;
		}

		if (!("classification" in task)) continue;

		const persisted = String(task.classification ?? "");
		if (persisted === aligned.classification) continue;

		if (status === "failed" || status === "pending") {
			delete task.classification;
			changed = true;
		}
	}

	for (const segment of state.segments ?? []) {
		if (!segment?.taskId || !("classification" in segment)) continue;
		const aligned = alignedById.get(String(segment.taskId));
		if (!aligned) continue;
		const segmentStatus = String(segment.status ?? "").toLowerCase();
		if (segmentStatus === "failed" || segmentStatus === "pending") {
			delete segment.classification;
			changed = true;
		}
	}

	if (changed) {
		saveSpineBatchState(projectRoot, state);
	}

	return { changed };
}

function isInsideGitRepo(projectRoot) {
	try {
		execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

function gitRefExists(projectRoot, ref) {
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

function gitIsAncestor(projectRoot, ancestor, descendant) {
	try {
		execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

function recordGitInspectionError(result, err, context) {
	const message = err instanceof Error ? err.message : String(err);
	const detail = `${context}: ${message}`;
	result.gitInspectionError = result.gitInspectionError
		? `${result.gitInspectionError}; ${detail}`
		: detail;
}

function listOrchBranches(projectRoot, batchId) {
	try {
		const output = execFileSync("git", ["branch", "-a", "--list", "*orch*"], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		});

		return output
			.split(/\r?\n/)
			.map((line) => line.trim().replace(/^\*?\s+/, "").replace(/^remotes\/[^/]+\//, ""))
			.filter(Boolean)
			.filter((branch) => branch.includes(batchId));
	} catch {
		return [];
	}
}

/** @param {{ projectRoot: string, batchId: string, baseBranch: string, orchBranch: string|null }} ctx */
export function inspectGitState(ctx) {
	const { projectRoot, batchId, baseBranch, orchBranch } = ctx;
	const result = {
		inGitRepo: isInsideGitRepo(projectRoot),
		baseBranch,
		orchBranch,
		orchBranches: [],
		orchBranchExists: false,
		orchMergedToBase: false,
		mergedOrchBranch: null,
		orchCommitsAhead: null,
		gitInspectionError: null,
	};

	if (!result.inGitRepo) return result;

	if (process.env.SPINE_TEST_GIT_INSPECTION_THROW) {
		result.gitInspectionError = `simulated: ${process.env.SPINE_TEST_GIT_INSPECTION_THROW}`;
		return result;
	}

	const candidates = new Set(listOrchBranches(projectRoot, batchId));
	if (orchBranch) candidates.add(orchBranch);
	candidates.add(`orch/cdelgado-${batchId}`);
	candidates.add(`orch/spine-*-${batchId}`.replace("*", "operator"));

	result.orchBranches = [...candidates].filter((branch) => !branch.includes("*"));

	for (const branch of result.orchBranches) {
		if (!gitRefExists(projectRoot, branch)) continue;
		result.orchBranchExists = true;
		if (gitIsAncestor(projectRoot, branch, baseBranch)) {
			result.orchMergedToBase = true;
			result.mergedOrchBranch = branch;
			break;
		}
	}

	const resolvedOrch = orchBranch && gitRefExists(projectRoot, orchBranch) ? orchBranch : result.mergedOrchBranch;
	if (resolvedOrch && gitRefExists(projectRoot, resolvedOrch) && !result.orchMergedToBase) {
		try {
			result.orchCommitsAhead = countCommitsAhead(projectRoot, baseBranch, resolvedOrch);
		} catch (err) {
			result.orchCommitsAhead = null;
			recordGitInspectionError(result, err, "count_commits_ahead");
		}
	}

	if (!result.orchMergedToBase) {
		try {
			const merged = execFileSync("git", ["branch", "--merged", baseBranch], {
				cwd: projectRoot,
				encoding: "utf-8",
				timeout: 5000,
			});
			const mergedOrch = merged
				.split(/\r?\n/)
				.map((line) => line.trim().replace(/^\*?\s+/, ""))
				.filter((branch) => branch.includes("orch") && branch.includes(batchId));
			if (mergedOrch.length > 0) {
				result.orchMergedToBase = true;
				result.mergedOrchBranch = mergedOrch[0];
				result.orchBranchExists = true;
			}
		} catch (err) {
			recordGitInspectionError(result, err, "list_merged_branches");
		}
	}

	return result;
}

/** @param {string} projectRoot @param {string} refA @param {string} refB @returns {string[]} */
export function listGitChangedPaths(projectRoot, refA, refB) {
	if (!refA || !refB || refA === refB) return [];
	try {
		const output = execFileSync("git", ["diff", "--name-only", `${refA}..${refB}`], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/** Paths from human commits since snapshot, excluding orch ancestry. */
export function listHumanOnlyPaths(projectRoot, snapshot, humanHead, orchBranch) {
	if (!snapshot || !humanHead || snapshot === humanHead) return [];
	const args = ["log", "--name-only", "--pretty=format:", `${snapshot}..${humanHead}`];
	if (orchBranch && gitRefExists(projectRoot, orchBranch)) {
		args.push("--not", orchBranch);
	}
	try {
		const output = execFileSync("git", args, {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
	} catch {
		return [];
	}
}

function pathExistsAtRef(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

function humanCheckoutNeedsPathSync(projectRoot, baseTip, snapshot) {
	const landPaths = listGitChangedPaths(projectRoot, snapshot, baseTip);
	for (const filePath of landPaths) {
		if (!pathExistsAtRef(projectRoot, baseTip, filePath)) continue;
		if (!fs.existsSync(path.join(projectRoot, filePath))) {
			return true;
		}
	}
	return false;
}

/** Human/base divergence or post-isolated-integrate sync (FR-WT-08 / #91). */
export function inspectHumanBaseSync(ctx) {
	const { projectRoot, baseBranch, baseBranchHeadAtStart, orchBranch, git, journalEvents } = ctx;
	if (!git?.inGitRepo) return null;

	const snapshot = String(baseBranchHeadAtStart ?? "").trim();
	if (!snapshot) return null;

	let baseTip = "";
	let humanHead = "";
	try {
		baseTip = execFileSync("git", ["rev-parse", baseBranch], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
		humanHead = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
	} catch {
		return null;
	}

	const integrateCompleted = Array.isArray(journalEvents)
		? journalEvents.some((event) => event.type === "integrate.completed")
		: false;
	const landSucceeded =
		git.orchMergedToBase ||
		integrateCompleted ||
		(baseTip !== snapshot && gitIsAncestor(projectRoot, snapshot, baseTip));

	const resolvedOrch =
		orchBranch && gitRefExists(projectRoot, orchBranch)
			? orchBranch
			: git.mergedOrchBranch && gitRefExists(projectRoot, git.mergedOrchBranch)
				? git.mergedOrchBranch
				: null;

	const branchResult = resolveCurrentGitBranch(projectRoot);
	const onBaseBranch = branchResult.branch === baseBranch;

	const humanSinceSnapshot =
		onBaseBranch &&
		gitIsAncestor(projectRoot, snapshot, humanHead) &&
		humanHead !== snapshot;
	const humanPaths = humanSinceSnapshot
		? listHumanOnlyPaths(projectRoot, snapshot, humanHead, resolvedOrch)
		: [];
	const landPaths = landSucceeded ? listGitChangedPaths(projectRoot, snapshot, baseTip) : [];
	const orchPaths =
		resolvedOrch && gitRefExists(projectRoot, resolvedOrch)
			? listGitChangedPaths(projectRoot, snapshot, resolvedOrch)
			: landPaths;
	const overlapPaths = humanPaths.filter((filePath) => orchPaths.includes(filePath));

	if (overlapPaths.length > 0) {
		return {
			diagnosis: "human_base_diverged",
			headline: onBaseBranch
				? `Human commits on ${baseBranch} overlap orch land (${overlapPaths.length} path(s))`
				: `Human commits overlap orch land (${overlapPaths.length} path(s))`,
			overlapPaths,
			humanHead,
			baseTip,
			orchBranch: resolvedOrch,
			preIntegrate: !landSucceeded,
		};
	}

	if (!landSucceeded) return null;

	const needsCommitSync =
		humanHead !== baseTip && onBaseBranch && gitIsAncestor(projectRoot, humanHead, baseTip);
	const needsPathSync =
		onBaseBranch && humanHead === baseTip && humanCheckoutNeedsPathSync(projectRoot, baseTip, snapshot);

	if (!needsCommitSync && !needsPathSync) {
		if (!onBaseBranch) {
			const mergeBase = (() => {
				try {
					return execFileSync("git", ["merge-base", humanHead, baseTip], {
						cwd: projectRoot,
						encoding: "utf-8",
						timeout: 5000,
					}).trim();
				} catch {
					return "";
				}
			})();
			if (mergeBase && mergeBase !== baseTip && gitIsAncestor(projectRoot, mergeBase, baseTip)) {
				return {
					diagnosis: "integrate_isolated_ok",
					headline: `${baseBranch} advanced during batch; feature branch needs sync`,
					humanHead,
					baseTip,
					orchBranch: resolvedOrch,
				};
			}
		}
		return null;
	}

	return {
		diagnosis: "integrate_isolated_ok",
		headline: needsPathSync
			? `Isolated integrate landed on ${baseBranch}; working tree needs path sync`
			: `Isolated integrate landed on ${baseBranch}; checkout needs sync`,
		humanHead,
		baseTip,
		orchBranch: resolvedOrch,
	};
}
