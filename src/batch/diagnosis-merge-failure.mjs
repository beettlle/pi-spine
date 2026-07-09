// @ts-nocheck
/**
 * Wave merge failure diagnosis helpers (SP-338 / GitHub #29).
 */

import {
	isGitignoredArtifactPath,
	listGitignoredArtifactRoots,
} from "./lane-dirty-check.mjs";

const GITIGNORED_MERGE_FAILURE_CLASSES = new Set(["merge_failed_gitignored", "GitignoredDirtyWorktree"]);

/**
 * @param {object} [ctx]
 * @param {string|null} [ctx.exitReason]
 * @param {string|null} [ctx.failureClass]
 * @param {string|null} [ctx.lastError]
 * @param {object[]} [ctx.journalEvents]
 * @returns {boolean}
 */
export function inferMergeGitignoredFailure(ctx = {}) {
	const { exitReason, failureClass, lastError, journalEvents } = ctx;
	if (GITIGNORED_MERGE_FAILURE_CLASSES.has(exitReason ?? "")) return true;
	if (GITIGNORED_MERGE_FAILURE_CLASSES.has(failureClass ?? "")) return true;

	const haystackParts = [exitReason, failureClass, lastError];
	if (Array.isArray(journalEvents)) {
		for (const event of journalEvents) {
			if (event.type !== "batch.merge_failed" && event.type !== "task.failed") continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			haystackParts.push(
				payload.failureClass,
				payload.classification,
				payload.error,
				payload.output,
			);
		}
	}
	const haystack = haystackParts.filter(Boolean).join("\n").toLowerCase();
	return (
		haystack.includes("gitignored dirty files only") ||
		haystack.includes("merge_failed_gitignored") ||
		haystack.includes("gitignoreddirtyworktree") ||
		(haystack.includes("git add") && haystack.includes("ignored"))
	);
}

/**
 * @param {string|null|undefined} taskBranch
 * @param {string[]|null|undefined} gitignoredPaths
 */
export function buildGitignoredMergeRepairCommand(taskBranch, gitignoredPaths) {
	const branchHint = taskBranch ? `git checkout ${taskBranch}` : "git checkout <task-branch>";
	const stetRuntimeCleanRoots = new Set([".review", ".spine/runtime"]);
	if (Array.isArray(gitignoredPaths) && gitignoredPaths.length > 0) {
		const artifactRoots = listGitignoredArtifactRoots(gitignoredPaths);
		const stetRuntimeOnly =
			artifactRoots.length > 0 &&
			artifactRoots.every((root) => stetRuntimeCleanRoots.has(root)) &&
			gitignoredPaths.every((p) => isGitignoredArtifactPath(p));
		if (stetRuntimeOnly) {
			const cleanHint = `git clean -fdX -- ${artifactRoots.join(" ")}`;
			return `${branchHint} && ${cleanHint} && spine batch resume --force`;
		}
		const pathHint = `git rm -r --cached -- ${gitignoredPaths.slice(0, 5).join(" ")}`;
		return `${branchHint} && ${pathHint} && spine batch resume --force`;
	}
	const pathHint = "git rm -r --cached -- <gitignored-paths>";
	return `${branchHint} && ${pathHint} && spine batch resume --force`;
}

/**
 * @param {unknown[]} mergeResults
 * @param {string|null|undefined} lastError
 * @returns {{
 *   mergeFailed: boolean,
 *   failedMerges: number,
 *   failedWaveIndex: number | null,
 *   failedLane: number | null,
 *   lastError: string | null,
 * }}
 */
export function summarizeMergeFailures(mergeResults, lastError = null) {
	const results = Array.isArray(mergeResults) ? mergeResults : [];
	const failedEntries = results.filter(
		(entry) => String(entry?.status ?? "").toLowerCase() === "failed",
	);
	if (failedEntries.length === 0) {
		return {
			mergeFailed: false,
			failedMerges: 0,
			failedWaveIndex: null,
			failedLane: null,
			lastError: lastError ? String(lastError) : null,
		};
	}

	const latestFailed = failedEntries.reduce((latest, entry) => {
		const waveIndex = Number(entry?.waveIndex);
		if (!Number.isFinite(waveIndex)) return latest;
		if (!latest) return entry;
		return Number(latest.waveIndex) > waveIndex ? latest : entry;
	}, null);

	const failedWaveIndex = Number(latestFailed?.waveIndex);
	const failedLaneRaw = latestFailed?.failedLane;
	const failedLane =
		failedLaneRaw == null || failedLaneRaw === ""
			? null
			: Number(failedLaneRaw);
	const resolvedLastError =
		lastError ??
		latestFailed?.failureReason ??
		latestFailed?.error ??
		null;

	return {
		mergeFailed: true,
		failedMerges: failedEntries.length,
		failedWaveIndex: Number.isFinite(failedWaveIndex) ? failedWaveIndex : null,
		failedLane: Number.isFinite(failedLane) ? failedLane : null,
		lastError: resolvedLastError ? String(resolvedLastError) : null,
	};
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {number|null} [ctx.failedWaveIndex]
 * @param {number|null} [ctx.failedLane]
 * @param {string|null} [ctx.lastError]
 * @param {number} [ctx.succeededTasks]
 * @param {number} [ctx.totalTasks]
 */
export function buildMergeFailureHeadline(batchLabel, ctx = {}) {
	const waveNumber =
		ctx.failedWaveIndex == null ? "?" : String(Number(ctx.failedWaveIndex) + 1);
	const laneLabel =
		ctx.failedLane == null ? "unknown lane" : `lane-${ctx.failedLane}`;
	const progress =
		ctx.totalTasks != null && ctx.succeededTasks != null
			? ` (${ctx.succeededTasks}/${ctx.totalTasks} tasks succeeded)`
			: "";
	const errorSuffix = ctx.lastError ? `: ${ctx.lastError}` : "";
	return `${batchLabel} failed: wave ${waveNumber} merge conflict on ${laneLabel}${progress}${errorSuffix}`;
}
