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

/** Align classification with batch-state status (SP-516 / #166, SP-512). @param {Record<string, any>} classified */
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

/** @param {Record<string, any>} batch @param {string|null} tasksRoot @param {string} [projectRoot] */
export function classifyTasks(batch, tasksRoot, projectRoot = "") {
	return batch.tasks.map((/** @type {any} */ task) =>
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

/** @param {{ projectRoot: string, state: Record<string, any> }} params @returns {{ changed: boolean }} */
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
	const alignedById = new Map(classified.map((/** @type {any} */ task) => [String(task.taskId), task]));
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

/** @param {Record<string, any>} result @param {unknown} err @param {string} context */
function recordGitInspectionError(result, err, context) {
	const message = err instanceof Error ? err.message : String(err);
	const detail = `${context}: ${message}`;
	result.gitInspectionError = result.gitInspectionError
		? `${result.gitInspectionError}; ${detail}`
		: detail;
}

/**
 * Distinguish a failed git probe from a definitive git answer (#310, fail closed).
 *
 * Empirically (verified against node's execFileSync): a definitive "no" — missing
 * ref, not an ancestor, not a repository, missing object — exits 1 or 128 with a
 * numeric `status`; a timeout surfaces as `code: "ETIMEDOUT"` + `signal: SIGTERM`;
 * a missing binary is `code: "ENOENT"`. Only the latter classes are failures that
 * must surface as inspection errors; ordinary "no" answers stay silent so
 * reconcile does not cry git_unavailable on every repo without an orch branch.
 *
 * @param {unknown} err
 * @returns {boolean} true when the failure is fatal (must be recorded)
 */
function isFatalGitProbeFailure(err) {
	if (!(err instanceof Error)) return true;
	const e = /** @type {Record<string, any>} */ (err);
	if (typeof e.code === "string") return true; // ETIMEDOUT, ENOENT, EACCES, …
	if (e.signal) return true; // killed by signal — no definitive answer
	const status = typeof e.status === "number" ? e.status : undefined;
	return status !== 1 && status !== 128; // 1/128 = git ran and answered "no"
}

/**
 * Run one read-only git probe (fail closed, #310). Returns execFileSync output
 * (string when `capture`, truthy sentinel otherwise), or null when git answered
 * "definitively no" (exit 1/128) OR the probe failed fatally. Fatal failures are
 * recorded into `sink.gitInspectionError` via the existing pattern; callers keep
 * their conservative false/[] semantics.
 *
 * @param {Record<string, any>|null} sink result object carrying gitInspectionError
 * @param {string} context stable label recorded alongside the error
 * @param {string} projectRoot
 * @param {string[]} args git argv
 * @param {boolean} [capture] capture stdout as string instead of Buffer
 * @returns {string|Buffer|null}
 */
function probeGit(sink, context, projectRoot, args, capture = false) {
	try {
		return capture
			? execFileSync("git", args, {
					cwd: projectRoot,
					encoding: "utf-8",
					stdio: ["ignore", "pipe", "pipe"],
					timeout: 5000,
				})
			: execFileSync("git", args, {
					cwd: projectRoot,
					stdio: ["ignore", "pipe", "pipe"],
					timeout: 5000,
				});
	} catch (err) {
		if (isFatalGitProbeFailure(err) && sink) {
			recordGitInspectionError(sink, err, context);
		}
		return null;
	}
}

/** @param {string} projectRoot @param {Record<string, any>} [sink] */
function isInsideGitRepo(projectRoot, sink) {
	return probeGit(sink ?? null, "inside_work_tree", projectRoot, ["rev-parse", "--is-inside-work-tree"]) !== null;
}

/** @param {string} projectRoot @param {string} ref @param {Record<string, any>} [sink] */
function gitRefExists(projectRoot, ref, sink) {
	return probeGit(sink ?? null, `ref_exists(${ref})`, projectRoot, ["rev-parse", "--verify", ref]) !== null;
}

/** @param {string} projectRoot @param {string} ancestor @param {string} descendant @param {Record<string, any>} [sink] */
function gitIsAncestor(projectRoot, ancestor, descendant, sink) {
	return probeGit(sink ?? null, `is_ancestor(${ancestor}..${descendant})`, projectRoot, ["merge-base", "--is-ancestor", ancestor, descendant]) !== null;
}

/** @param {string} projectRoot @param {string} batchId @param {Record<string, any>} [sink] @returns {string[]} */
function listOrchBranches(projectRoot, batchId, sink) {
	const output = probeGit(sink ?? null, "list_orch_branches", projectRoot, ["branch", "-a", "--list", "*orch*"], true);
	if (typeof output !== "string") return [];

	return output
		.split(/\r?\n/)
		.map((line) => line.trim().replace(/^\*?\s+/, "").replace(/^remotes\/[^/]+\//, ""))
		.filter(Boolean)
		.filter((branch) => branch.includes(batchId));
}

/** @param {{ projectRoot: string, batchId: string, baseBranch: string, orchBranch: string|null }} ctx */
export function inspectGitState(ctx) {
	const { projectRoot, batchId, baseBranch, orchBranch } = ctx;
	const result = /** @type {Record<string, any>} */ ({
		inGitRepo: false,
		baseBranch,
		orchBranch,
		orchBranches: [],
		orchBranchExists: false,
		orchMergedToBase: false,
		mergedOrchBranch: null,
		orchCommitsAhead: null,
		gitInspectionError: null,
	});
	result.inGitRepo = isInsideGitRepo(projectRoot, result);

	if (!result.inGitRepo) return result;

	if (process.env.SPINE_TEST_GIT_INSPECTION_THROW) {
		result.gitInspectionError = `simulated: ${process.env.SPINE_TEST_GIT_INSPECTION_THROW}`;
		return result;
	}

	const candidates = new Set(listOrchBranches(projectRoot, batchId, result));
	if (orchBranch) candidates.add(orchBranch);
	// Generic orch branch naming convention only — never per-user patterns (#310).
	candidates.add(`orch/spine-${batchId}`);

	result.orchBranches = [...candidates].filter((branch) => !branch.includes("*"));

	for (const branch of result.orchBranches) {
		if (!gitRefExists(projectRoot, branch, result)) continue;
		result.orchBranchExists = true;
		if (gitIsAncestor(projectRoot, branch, baseBranch, result)) {
			result.orchMergedToBase = true;
			result.mergedOrchBranch = branch;
			break;
		}
	}

	const resolvedOrch = orchBranch && gitRefExists(projectRoot, orchBranch, result) ? orchBranch : result.mergedOrchBranch;
	if (resolvedOrch && gitRefExists(projectRoot, resolvedOrch, result) && !result.orchMergedToBase) {
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

/** @param {string} projectRoot @param {string} refA @param {string} refB @param {Record<string, any>} [sink] @returns {string[]} */
export function listGitChangedPaths(projectRoot, refA, refB, sink) {
	if (!refA || !refB || refA === refB) return [];
	const output = probeGit(sink ?? null, `changed_paths(${refA}..${refB})`, projectRoot, ["diff", "--name-only", `${refA}..${refB}`], true);
	if (typeof output !== "string") return [];
	return output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

/** Paths from human commits since snapshot, excluding orch ancestry.
 * @param {string} projectRoot @param {string|null} snapshot @param {string|null} humanHead @param {string|null} orchBranch @param {Record<string, any>} [sink] @returns {string[]}
 */
export function listHumanOnlyPaths(projectRoot, snapshot, humanHead, orchBranch, sink) {
	if (!snapshot || !humanHead || snapshot === humanHead) return [];
	const args = ["log", "--name-only", "--pretty=format:", `${snapshot}..${humanHead}`];
	if (orchBranch && gitRefExists(projectRoot, orchBranch, sink)) {
		args.push("--not", orchBranch);
	}
	const output = probeGit(sink ?? null, `human_only_paths(${snapshot}..${humanHead})`, projectRoot, args, true);
	if (typeof output !== "string") return [];
	return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

/**
 * Paths touched on both sides only overlap when their contents differ: the same
 * template sync landing on main and orch is not a divergence. One `git diff`
 * call covers every candidate; a definitive "no" answer narrows candidates,
 * while a fatal failure (timeout, crash) keeps all candidates (fail closed) and
 * is recorded into the inspection error (#310).
 *
 * @param {string} projectRoot @param {string} humanRef @param {string} orchRef @param {string[]} candidatePaths
 * @param {Record<string, any>} [sink]
 * @returns {string[]}
 */
function keepPathsWithDifferentContent(projectRoot, humanRef, orchRef, candidatePaths, sink) {
	if (candidatePaths.length === 0 || !orchRef) return candidatePaths;
	const output = probeGit(sink ?? null, `diff_content(${humanRef}..${orchRef})`, projectRoot, ["diff", "--name-only", humanRef, orchRef, "--", ...candidatePaths], true);
	if (typeof output !== "string") return candidatePaths;
	const differing = new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
	return candidatePaths.filter((filePath) => differing.has(filePath));
}

/** @param {string} projectRoot @param {string} ref @param {string} filePath @param {Record<string, any>} [sink] */
function pathExistsAtRef(projectRoot, ref, filePath, sink) {
	return probeGit(sink ?? null, `path_exists(${ref}:${filePath})`, projectRoot, ["cat-file", "-e", `${ref}:${filePath}`]) !== null;
}

/** @param {string} projectRoot @param {string} baseTip @param {string} snapshot @param {Record<string, any>} [sink] */
function humanCheckoutNeedsPathSync(projectRoot, baseTip, snapshot, sink) {
	const landPaths = listGitChangedPaths(projectRoot, snapshot, baseTip, sink);
	for (const filePath of landPaths) {
		if (!pathExistsAtRef(projectRoot, baseTip, filePath, sink)) continue;
		if (!fs.existsSync(path.join(projectRoot, filePath))) {
			return true;
		}
	}
	return false;
}

/** Human/base divergence or post-isolated-integrate sync (FR-WT-08 / #91).
 * @param {Record<string, any>} ctx
 */
export function inspectHumanBaseSync(ctx) {
	const { projectRoot, baseBranch, baseBranchHeadAtStart, orchBranch, git, journalEvents } = ctx;
	if (!git?.inGitRepo) return null;

	const snapshot = String(baseBranchHeadAtStart ?? "").trim();
	if (!snapshot) return null;

	let baseTip = probeGit(git, `rev_parse(${baseBranch})`, projectRoot, ["rev-parse", baseBranch], true);
	let humanHead = probeGit(git, "rev_parse(HEAD)", projectRoot, ["rev-parse", "HEAD"], true);
	if (typeof baseTip !== "string" || typeof humanHead !== "string") return null;
	baseTip = baseTip.trim();
	humanHead = humanHead.trim();

	const integrateCompleted = Array.isArray(journalEvents)
		? journalEvents.some((/** @type {any} */ event) => event.type === "integrate.completed")
		: false;
	const landSucceeded =
		git.orchMergedToBase ||
		integrateCompleted ||
		(baseTip !== snapshot && gitIsAncestor(projectRoot, snapshot, baseTip, git));

	const resolvedOrch =
		orchBranch && gitRefExists(projectRoot, orchBranch, git)
			? orchBranch
			: git.mergedOrchBranch && gitRefExists(projectRoot, git.mergedOrchBranch, git)
				? git.mergedOrchBranch
				: null;

	const branchResult = resolveCurrentGitBranch(projectRoot);
	if (branchResult.error) {
		recordGitInspectionError(git, new Error(branchResult.error), "current_branch");
	}
	const onBaseBranch = branchResult.branch === baseBranch;

	const humanSinceSnapshot =
		onBaseBranch &&
		gitIsAncestor(projectRoot, snapshot, humanHead, git) &&
		humanHead !== snapshot;
	const humanPaths = humanSinceSnapshot
		? listHumanOnlyPaths(projectRoot, snapshot, humanHead, resolvedOrch, git)
		: [];
	const landPaths = landSucceeded ? listGitChangedPaths(projectRoot, snapshot, baseTip, git) : [];
	const orchPaths =
		resolvedOrch && gitRefExists(projectRoot, resolvedOrch, git)
			? listGitChangedPaths(projectRoot, snapshot, resolvedOrch, git)
			: landPaths;
	const orchPathSet = new Set(orchPaths);
	const touchedByBoth = humanPaths.filter((filePath) => orchPathSet.has(filePath));
	const orchContentRef = resolvedOrch ?? baseTip;
	const overlapPaths = keepPathsWithDifferentContent(projectRoot, humanHead, orchContentRef, touchedByBoth, git);

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
		humanHead !== baseTip && onBaseBranch && gitIsAncestor(projectRoot, humanHead, baseTip, git);
	const needsPathSync =
		onBaseBranch && humanHead === baseTip && humanCheckoutNeedsPathSync(projectRoot, baseTip, snapshot, git);

	if (!needsCommitSync && !needsPathSync) {
		if (!onBaseBranch) {
			const mergeBase = probeGit(git, "merge_base", projectRoot, ["merge-base", humanHead, baseTip], true);
			if (
				typeof mergeBase === "string" &&
				mergeBase.trim() &&
				mergeBase.trim() !== baseTip &&
				gitIsAncestor(projectRoot, mergeBase.trim(), baseTip, git)
			) {
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
