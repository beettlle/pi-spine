/**
 * Engine lane merge-phase wiring — lane→orch merges and rules-manifest conflict resolution.
 */

import { execFileSync } from "node:child_process";
import { gitExec } from "../git-exec.mjs";
import {
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
	loadRulesManifest,
	fingerprintRulesManifest,
} from "../../config/cursor-rules/discover.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { countCommitsAhead, gitPorcelain } from "../lane-commit.mjs";
import { saveSpineBatchState } from "../state.mjs";
import { laneTaskBranch } from "../worktree.mjs";

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

/**
 * Before orch→main integrate, auto-resolve uncommitted generatedAt-only drift on rules-manifest.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 */
export function resolveRulesManifestIntegrateDrift({ projectRoot, baseBranch, orchBranch }) {
	const dirtyPaths = listDirtyPaths(projectRoot);
	if (dirtyPaths.length === 0) {
		return { ok: true, resolved: false };
	}
	if (dirtyPaths.length !== 1 || dirtyPaths[0] !== RULES_MANIFEST_REL_PATH) {
		return { ok: true, resolved: false };
	}

	const working = loadRulesManifest(projectRoot);
	if (!working) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: `${RULES_MANIFEST_REL_PATH} is dirty but unreadable`,
		};
	}

	const headResult = readRulesManifestFromRef(projectRoot, baseBranch);
	const orchResult = readRulesManifestFromRef(projectRoot, orchBranch);
	if (!headResult.ok || !orchResult.ok) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: "unable to read rules-manifest from base or orch branch",
		};
	}

	if (fingerprintRulesManifest(working) !== fingerprintRulesManifest(headResult.manifest)) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error:
				`${RULES_MANIFEST_REL_PATH} has uncommitted content changes beyond generatedAt — commit or stash before integrate`,
		};
	}

	if (fingerprintRulesManifest(headResult.manifest) !== fingerprintRulesManifest(orchResult.manifest)) {
		const contentMerge = resolveRulesManifestGeneratedAtMerge({
			ours: headResult.manifest,
			theirs: orchResult.manifest,
		});
		if (!contentMerge.ok) {
			return contentMerge;
		}
	}

	gitExec(
		projectRoot,
		["restore", "--source=HEAD", "--staged", "--worktree", RULES_MANIFEST_REL_PATH],
		{ projectRoot },
	);
	return {
		ok: true,
		resolved: true,
		action: "restored_head_for_merge",
	};
}

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
 * @param {string} projectRoot
 */
export function tryAutoResolveRulesManifestMergeConflict(projectRoot) {
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
	if (unmerged.length !== 1 || unmerged[0] !== RULES_MANIFEST_REL_PATH) {
		return {
			ok: false,
			failureClass: "MergeConflict",
			error:
				`merge conflict on ${unmerged.join(", ")}; automatic resolution only supports ${RULES_MANIFEST_REL_PATH}`,
		};
	}

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
	gitExec(projectRoot, ["add", RULES_MANIFEST_REL_PATH], { projectRoot });
	return {
		ok: true,
		autoResolved: true,
		generatedAt: resolved.manifest.generatedAt,
	};
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
			const autoResolved = tryAutoResolveRulesManifestMergeConflict(projectRoot);
			if (!autoResolved.ok) {
				abortInProgressMerge(projectRoot);
				return {
					ok: false,
					failureClass: autoResolved.failureClass ?? "MergeConflict",
					error: autoResolved.error ?? "merge conflict",
				};
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
export async function mergeWaveLanesToOrch({
	projectRoot,
	state,
	batchId,
	baseBranch,
	orchBranch,
	waveIndex,
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
		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
			laneNumber,
			waveIndex,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: false,
		});
		if (!merge.ok) {
			return { ok: false, error: merge.error ?? "merge_failed", laneNumber };
		}
		lastMergeCommit = merge.mergeCommit;
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
			laneNumber,
			waveIndex,
		});
	}

	state.mergeResults.push({
		waveIndex,
		status: "succeeded",
		failedLane: null,
		failureReason: null,
		mergeCommit: lastMergeCommit,
	});
	saveSpineBatchState(projectRoot, state);

	return { ok: true, mergeCommit: lastMergeCommit };
}
