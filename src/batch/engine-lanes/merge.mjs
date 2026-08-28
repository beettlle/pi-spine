// @ts-nocheck
/**
 * Engine lane merge-phase wiring — lane→orch merges and rules-manifest conflict resolution.
 */

import { execFileSync } from "node:child_process";
import { gitAddFilteredPaths, filterGitignoredPaths, isGitignoredAddError } from "../git-helpers.mjs";
import { gitExec } from "../git-exec.mjs";
import {
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
	loadRulesManifest,
	fingerprintRulesManifest,
} from "../../config/cursor-rules/discover.mjs";
import { matchesContractPattern } from "../contract-verify.mjs";
import {
	formatAdoptionDocMergeFailure,
	formatPrdDocMergeFailure,
	isAdoptionDocPath,
	isPrdDocPath,
	tryResolveAdoptionDocMergeConflict,
	tryResolvePrdDocMergeConflict,
} from "../merge/adoption-doc-merge.mjs";
import { recordWaveMergeResult } from "../merge/wave-merge-state.mjs";
import { recordMergeBlocked } from "../lifecycle.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { countCommitsAhead, gitPorcelain } from "../lane-commit.mjs";
import { maybeFinalizeAfterWaveMerge } from "../post-merge-limbo.mjs";
import { saveSpineBatchState } from "../state.mjs";
import { loadTaskFileScopePaths } from "./queue.mjs";
import { laneTaskBranch } from "../worktree.mjs";
import { laneDoneMarkerCommittedOnBranch, normalizeTaskFolderRel } from "../journal-rebuild.mjs";

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
 */
function abortInProgressMerge(projectRoot) {
	try {
		execFileSync("git", ["merge", "--abort"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
	} catch {
		// best effort — leave checkout restoration to caller
	}
}

/**
 * @param {string} projectRoot
 */
function listUnmergedPaths(projectRoot) {
	const output = git(projectRoot, ["diff", "--name-only", "--diff-filter=U"], {
		throwOnError: false,
	});
	if (!output) return [];
	return output.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function readRulesManifestFromRef(projectRoot, ref) {
	const output = git(projectRoot, ["show", `${ref}:${RULES_MANIFEST_REL_PATH}`], {
		throwOnError: false,
	});
	if (output == null) {
		return { ok: false, error: `missing ${RULES_MANIFEST_REL_PATH} at ${ref}` };
	}
	return parseRulesManifestJson(output);
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function extractPorcelainPath(line) {
	if (!line.trim()) return null;
	let filePath = line.length > 2 && line[2] === " " ? line.slice(3) : line.slice(2);
	filePath = filePath.trim();
	if (!filePath) return null;
	if (filePath.includes(" -> ")) {
		return filePath.split(" -> ").pop()?.trim() ?? null;
	}
	return filePath;
}

/**
 * @param {string} projectRoot
 */
function listDirtyPaths(projectRoot) {
	const output = gitPorcelain(projectRoot);
	if (!output) return [];
	return output
		.split("\n")
		.map((line) => extractPorcelainPath(line))
		.filter((entry) => Boolean(entry));
}

export { resolveRulesManifestIntegrateDrift } from "../rules-manifest-drift.mjs";

/**
 * @param {string} projectRoot
 * @param {2 | 3} stage
 */
function readRulesManifestMergeStage(projectRoot, stage) {
	const output = git(projectRoot, ["show", `:${stage}:${RULES_MANIFEST_REL_PATH}`], {
		throwOnError: false,
	});
	if (output == null) {
		return { ok: false, error: `missing merge stage ${stage} for ${RULES_MANIFEST_REL_PATH}` };
	}
	return parseRulesManifestJson(output);
}

/**
 * @param {string} filePath
 * @param {string[]} laneFileScopePaths
 */
function pathInLaneFileScope(filePath, laneFileScopePaths) {
	if (!Array.isArray(laneFileScopePaths) || laneFileScopePaths.length === 0) {
		return false;
	}
	return laneFileScopePaths.some((pattern) => matchesContractPattern(filePath, pattern));
}

/**
 * @param {string} projectRoot
 * @param {string} mergeBase
 * @param {string} taskBranch
 * @returns {Set<string>}
 */
function listBranchChangedFiles(projectRoot, mergeBase, taskBranch) {
	const output = git(projectRoot, ["diff", "--name-only", `${mergeBase}..${taskBranch}`], {
		throwOnError: false,
	});
	if (!output) return new Set();
	return new Set(
		output
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean),
	);
}

/**
 * @param {string} projectRoot
 */
function resolveRulesManifestMergeConflict(projectRoot) {
	const oursResult = readRulesManifestMergeStage(projectRoot, 2);
	const theirsResult = readRulesManifestMergeStage(projectRoot, 3);
	if (!oursResult.ok || !theirsResult.ok) {
		return {
			ok: false,
			error: "unable to read rules-manifest merge stages",
		};
	}

	const resolved = resolveRulesManifestGeneratedAtMerge({
		ours: oursResult.manifest,
		theirs: theirsResult.manifest,
	});
	if (!resolved.ok) {
		return resolved;
	}

	writeRulesManifestAtomic(projectRoot, resolved.manifest);
	gitAddFilteredPaths(projectRoot, [RULES_MANIFEST_REL_PATH], { projectRoot });
	return {
		ok: true,
		autoResolved: true,
		generatedAt: resolved.manifest.generatedAt,
	};
}

/**
 * Prefer orch (merge --ours) for stale dependency artifacts outside lane file scope.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.filePath
 * @param {string[]} params.laneFileScopePaths
 * @param {Set<string>} params.laneChangedFiles
 */
function tryAutoResolveOutOfScopeMergeConflict({
	projectRoot,
	filePath,
	laneFileScopePaths,
	_laneChangedFiles,
}) {
	if (pathInLaneFileScope(filePath, laneFileScopePaths)) {
		return { ok: false, reason: "in_lane_file_scope" };
	}

	gitExec(projectRoot, ["checkout", "--ours", "--", filePath], { projectRoot });
	const { stageable, skipped } = filterGitignoredPaths(projectRoot, [filePath]);
	if (stageable.length > 0) {
		gitAddFilteredPaths(projectRoot, stageable, { projectRoot });
	} else if (skipped.includes(filePath)) {
		gitExec(projectRoot, ["rm", "--cached", "-f", "--", filePath], {
			projectRoot,
			throwOnError: false,
		});
	}
	return {
		ok: true,
		strategy: "prefer_orch_out_of_scope",
		skippedGitignoredPaths: skipped,
	};
}

/**
 * @param {object} state
 * @param {number} laneNumber
 * @param {string[]} waveTaskIds
 */
function collectLaneWaveFileScope(state, laneNumber, waveTaskIds) {
	/** @type {Set<string>} */
	const patterns = new Set();
	for (const taskId of waveTaskIds) {
		const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
		if (!task || task.laneNumber !== laneNumber) continue;
		const folder = task.taskFolder;
		if (!folder) continue;
		const scope = loadTaskFileScopePaths(folder);
		if (scope.ok) {
			for (const pattern of scope.fileScopePaths) {
				patterns.add(pattern);
			}
		}
	}
	return [...patterns];
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {string[]} [options.laneFileScopePaths]
 * @param {string} [options.taskBranch]
 * @param {string} [options.orchBranch]
 * @param {number} [options.waveIndex]
 */
export function tryAutoResolveMergeConflicts(projectRoot, options = {}) {
	const { laneFileScopePaths = [], taskBranch, orchBranch, waveIndex } = options;
	const unmerged = listUnmergedPaths(projectRoot);
	if (unmerged.length === 0) {
		const dirtyPaths = listDirtyPaths(projectRoot);
		const dirtyHint =
			dirtyPaths.length > 0
				? ` (dirty: ${dirtyPaths.join(", ")})`
				: "";
		return {
			ok: false,
			error: `merge failed without unmerged paths${dirtyHint}`,
		};
	}

	const canResolveOutOfScope =
		Array.isArray(laneFileScopePaths) &&
		laneFileScopePaths.length > 0 &&
		Boolean(taskBranch) &&
		Boolean(orchBranch);

	/** @type {Set<string>} */
	let laneChangedFiles = new Set();
	if (canResolveOutOfScope) {
		const mergeBase = git(projectRoot, ["merge-base", orchBranch, taskBranch], {
			throwOnError: false,
		});
		if (mergeBase) {
			laneChangedFiles = listBranchChangedFiles(projectRoot, mergeBase, taskBranch);
		}
	}

	/** @type {string[]} */
	const resolvedOutOfScope = [];
	/** @type {string[]} */
	const remaining = [];
	/** @type {string[]} */
	const skippedGitignoredPaths = [];

	/** @type {string[]} */
	const resolvedAutoMergeDocs = [];

	for (const filePath of unmerged) {
		if (filePath === RULES_MANIFEST_REL_PATH) {
			remaining.push(filePath);
			continue;
		}
		if (isAdoptionDocPath(filePath)) {
			const adoptionResult = tryResolveAdoptionDocMergeConflict({
				projectRoot,
				filePath,
				waveIndex,
			});
			if (adoptionResult.ok) {
				resolvedAutoMergeDocs.push(filePath);
			} else {
				remaining.push(filePath);
			}
			continue;
		}
		if (isPrdDocPath(filePath)) {
			const prdResult = tryResolvePrdDocMergeConflict({
				projectRoot,
				filePath,
				waveIndex,
			});
			if (prdResult.ok) {
				resolvedAutoMergeDocs.push(filePath);
			} else {
				remaining.push(filePath);
			}
			continue;
		}
		if (!canResolveOutOfScope) {
			remaining.push(filePath);
			continue;
		}
		const resolved = tryAutoResolveOutOfScopeMergeConflict({
			projectRoot,
			filePath,
			laneFileScopePaths,
			laneChangedFiles,
		});
		if (resolved.ok) {
			resolvedOutOfScope.push(filePath);
			if (Array.isArray(resolved.skippedGitignoredPaths) && resolved.skippedGitignoredPaths.length > 0) {
				skippedGitignoredPaths.push(...resolved.skippedGitignoredPaths);
			}
		} else {
			remaining.push(filePath);
		}
	}

	if (remaining.includes(RULES_MANIFEST_REL_PATH)) {
		const manifestResult = resolveRulesManifestMergeConflict(projectRoot);
		if (manifestResult.ok) {
			resolvedOutOfScope.push(RULES_MANIFEST_REL_PATH);
			const withoutManifest = remaining.filter((filePath) => filePath !== RULES_MANIFEST_REL_PATH);
			if (withoutManifest.length === 0) {
				return {
					...manifestResult,
					outOfScopePaths: resolvedOutOfScope,
					skippedGitignoredPaths,
				};
			}
			remaining.length = 0;
			remaining.push(...withoutManifest);
		}
	}

	if (remaining.length === 1 && remaining[0] === RULES_MANIFEST_REL_PATH) {
		const manifestResult = resolveRulesManifestMergeConflict(projectRoot);
		if (!manifestResult.ok) {
			return manifestResult;
		}
		return {
			...manifestResult,
			outOfScopePaths: resolvedOutOfScope,
			skippedGitignoredPaths,
		};
	}

	if (remaining.length === 0) {
		return {
			ok: true,
			autoResolved: true,
			outOfScopePaths: resolvedOutOfScope,
			adoptionDocPaths: resolvedAutoMergeDocs,
			skippedGitignoredPaths,
		};
	}

	const autoMergeRemaining = remaining.filter(
		(filePath) => isAdoptionDocPath(filePath) || isPrdDocPath(filePath),
	);
	if (autoMergeRemaining.length > 0) {
		const firstAutoMerge = autoMergeRemaining[0];
		const error = isPrdDocPath(firstAutoMerge)
			? formatPrdDocMergeFailure({ filePath: firstAutoMerge, waveIndex })
			: formatAdoptionDocMergeFailure({ filePath: firstAutoMerge, waveIndex });
		return {
			ok: false,
			failureClass: "MergeConflict",
			error,
			outOfScopePaths: resolvedOutOfScope,
			adoptionDocPaths: resolvedAutoMergeDocs,
		};
	}

	return {
		ok: false,
		failureClass: "MergeConflict",
		error:
			`merge conflict on ${remaining.join(", ")}; automatic resolution supports docs/adoption/*, ` +
			`docs/PRD.md, ${RULES_MANIFEST_REL_PATH}, and out-of-scope dependency drift ` +
			"(prefer orch when the lane did not commit the path)",
		outOfScopePaths: resolvedOutOfScope,
		adoptionDocPaths: resolvedAutoMergeDocs,
	};
}

/** @deprecated use tryAutoResolveMergeConflicts */
export function tryAutoResolveRulesManifestMergeConflict(projectRoot) {
	return tryAutoResolveMergeConflicts(projectRoot, {});
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function gitStrict(projectRoot, args) {
	return git(projectRoot, args);
}

/**
 * @param {object} params
 * @param {boolean} [params.requireLaneCommits] When true, task branch must be ahead of orch before merge (post lane auto-commit).
 */
/**
 * Clear generatedAt-only rules-manifest drift on the working tree before lane→orch merge.
 * Workers refresh the manifest during pi sessions; an uncommitted copy blocks `git merge`.
 *
 * @param {string} projectRoot
 */
function resolveRulesManifestPreMergeDrift(projectRoot) {
	const dirtyPaths = listDirtyPaths(projectRoot);
	if (dirtyPaths.length === 0) {
		return { ok: true, resolved: false };
	}
	if (dirtyPaths.length !== 1 || dirtyPaths[0] !== RULES_MANIFEST_REL_PATH) {
		return { ok: true, resolved: false };
	}

	const headRef = gitStrict(projectRoot, ["rev-parse", "HEAD"]);
	const headResult = readRulesManifestFromRef(projectRoot, headRef);
	const working = loadRulesManifest(projectRoot);
	if (!working) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: `${RULES_MANIFEST_REL_PATH} is dirty but unreadable`,
		};
	}
	if (!headResult.ok) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: `unable to read ${RULES_MANIFEST_REL_PATH} at HEAD`,
		};
	}

	if (fingerprintRulesManifest(working) !== fingerprintRulesManifest(headResult.manifest)) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error:
				`${RULES_MANIFEST_REL_PATH} has uncommitted content changes beyond generatedAt — commit or stash before merge`,
		};
	}

	gitExec(
		projectRoot,
		["restore", "--source=HEAD", "--staged", "--worktree", RULES_MANIFEST_REL_PATH],
		{ projectRoot },
	);
	return { ok: true, resolved: true, action: "restored_head_for_lane_merge" };
}

export function mergeLaneToOrch({
	projectRoot,
	baseBranch,
	orchBranch,
	taskBranch,
	batchId,
	requireLaneCommits = false,
	laneFileScopePaths = [],
	laneTaskFolders = [],
	waveIndex,
}) {
	const previous = gitStrict(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	let mergeInProgress = false;
	try {
		const drift = resolveRulesManifestPreMergeDrift(projectRoot);
		if (!drift.ok) {
			return {
				ok: false,
				failureClass: drift.failureClass ?? "DirtyWorktree",
				error: drift.error ?? "dirty worktree blocks lane merge",
			};
		}

		const orchHeadBefore = gitStrict(projectRoot, ["rev-parse", orchBranch]);
		const commitsAhead = countCommitsAhead(projectRoot, orchBranch, taskBranch);

		if (Array.isArray(laneTaskFolders) && laneTaskFolders.length > 0) {
			for (const taskFolderRel of laneTaskFolders) {
				if (laneDoneMarkerCommittedOnBranch(projectRoot, taskBranch, taskFolderRel)) {
					continue;
				}
				return {
					ok: false,
					failureClass: "DoneMarkerMissing",
					error:
						`Task branch ${taskBranch} lacks committed ${normalizeTaskFolderRel(projectRoot, taskFolderRel) ?? taskFolderRel}/.DONE. ` +
						"Worker must create .DONE on the lane branch before merge.",
				};
			}
		}

		if (requireLaneCommits && commitsAhead === 0) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Task branch ${taskBranch} has no commits ahead of ${orchBranch} after lane auto-commit. ` +
					`Worker may have created .DONE without persisting file changes to git.`,
			};
		}

		gitStrict(projectRoot, ["checkout", orchBranch]);
		try {
			gitStrict(projectRoot, [
				"merge",
				"--no-ff",
				taskBranch,
				"-m",
				`merge ${taskBranch} into ${orchBranch}`,
			]);
		} catch {
			mergeInProgress = true;
			const autoResolved = tryAutoResolveMergeConflicts(projectRoot, {
				laneFileScopePaths,
				taskBranch,
				orchBranch,
				waveIndex,
			});
			if (!autoResolved.ok) {
				abortInProgressMerge(projectRoot);
				return {
					ok: false,
					failureClass: autoResolved.failureClass ?? "MergeConflict",
					error: autoResolved.error ?? "merge conflict",
					outOfScopePaths: autoResolved.outOfScopePaths ?? [],
				};
			}
			if (
				Array.isArray(autoResolved.skippedGitignoredPaths) &&
				autoResolved.skippedGitignoredPaths.length > 0
			) {
				appendJournalEvent(projectRoot, batchId, "batch.merge_gitignored_skipped", {
					taskBranch,
					skippedPaths: autoResolved.skippedGitignoredPaths,
				});
			}
			gitStrict(projectRoot, ["commit", "--no-edit"]);
		}

		const mergeCommit = gitStrict(projectRoot, ["rev-parse", "HEAD"]);

		if (requireLaneCommits && mergeCommit === orchHeadBefore) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Merge into ${orchBranch} did not advance HEAD (still ${orchHeadBefore.slice(0, 7)}). ` +
					`Lane work was not integrated.`,
			};
		}

		return { ok: true, mergeCommit, commitsAhead };
	} catch (err) {
		if (mergeInProgress) {
			abortInProgressMerge(projectRoot);
		}
		if (isGitignoredAddError(err)) {
			return {
				ok: false,
				failureClass: "merge_failed_gitignored",
				error: err instanceof Error ? err.message : String(err),
			};
		}
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		try {
			gitStrict(projectRoot, ["checkout", previous || baseBranch]);
		} catch {
			gitStrict(projectRoot, ["checkout", baseBranch]);
		}
	}
}

/**
 * @param {object} params
 */
export function mergeWaveLanesToOrch({
	projectRoot,
	state,
	batchId,
	baseBranch,
	orchBranch,
	waveIndex,
	resumed = false,
}) {
	const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
	const needsReplanTask = (state.tasks ?? []).find(
		(entry) =>
			waveTaskIds.includes(entry?.taskId) && entry?.exitReason === "needs_replan",
	);
	if (needsReplanTask) {
		return {
			ok: false,
			error: `wave merge blocked: task ${needsReplanTask.taskId} has exitReason needs_replan`,
			blockedBy: needsReplanTask.taskId,
			exitReason: "needs_replan",
		};
	}

	const lanes = state.lanes ?? [];
	let lastMergeCommit = null;

	for (const lane of lanes) {
		const laneNumber = lane.laneNumber;
		const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
		const laneSucceeded = waveTaskIds.some((taskId) => {
			const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
			return task && task.laneNumber === laneNumber && task.status === "succeeded";
		});
		if (!laneSucceeded) continue;

		const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
		const laneFileScopePaths = collectLaneWaveFileScope(state, laneNumber, waveTaskIds);
		const laneTaskFolders = waveTaskIds
			.map((taskId) => {
				const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
				if (!task || task.laneNumber !== laneNumber || !task.taskFolder) return null;
				return task.taskFolder;
			})
			.filter(Boolean);
		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
			laneNumber,
			waveIndex,
			laneFileScopePaths,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: false,
			laneFileScopePaths,
			laneTaskFolders,
			waveIndex,
		});
		if (!merge.ok) {
			const failureReason = merge.error ?? "merge_failed";
			recordWaveMergeResult({
				state,
				waveIndex,
				status: "failed",
				failedLane: laneNumber,
				failureReason,
				failureClass: merge.failureClass ?? null,
			});
			if (Array.isArray(merge.skippedGitignoredPaths) && merge.skippedGitignoredPaths.length > 0) {
				appendJournalEvent(projectRoot, batchId, "batch.merge_gitignored_skipped", {
					laneNumber,
					waveIndex,
					taskBranch,
					skippedPaths: merge.skippedGitignoredPaths,
				});
			}
			if (merge.failureClass === "merge_failed_gitignored") {
				appendJournalEvent(projectRoot, batchId, "batch.merge_failed", {
					laneNumber,
					waveIndex,
					taskBranch,
					failureClass: merge.failureClass,
					error: failureReason,
				});
			}
			recordMergeBlocked({
				projectRoot,
				state,
				batchId,
				error: failureReason,
				waveIndex,
				laneNumber,
				failureClass: merge.failureClass ?? null,
			});
			return {
				ok: false,
				error: failureReason,
				laneNumber,
				failureClass: merge.failureClass ?? null,
			};
		}
		lastMergeCommit = merge.mergeCommit;
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
			laneNumber,
			waveIndex,
		});
	}

	recordWaveMergeResult({
		state,
		waveIndex,
		status: "succeeded",
		mergeCommit: lastMergeCommit,
	});
	saveSpineBatchState(projectRoot, state);

	const finalizeResult = maybeFinalizeAfterWaveMerge({
		projectRoot,
		state,
		batchId,
		orchBranch,
		waveIndex,
		resumed,
	});

	return {
		ok: true,
		mergeCommit: lastMergeCommit,
		finalized: finalizeResult != null,
		finalizeResult,
	};
}
