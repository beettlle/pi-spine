/**
 * Orch integratability checks shared by integrate and lifecycle (avoids import cycles).
 */

import { countCommitsAhead } from "./lane-commit.mjs";

/**
 * Validates orch branch state before `spine batch complete` (FR-BATCH-16).
 *
 * @param {string} projectRoot
 * @param {object} ctx
 * @param {string} ctx.baseBranch
 * @param {string|null} ctx.orchBranch
 * @param {boolean} ctx.mergeResultsEmpty
 * @param {boolean} ctx.orchMergedToBase
 */
export function assertOrchIntegratable(projectRoot, ctx) {
	const { baseBranch, orchBranch, mergeResultsEmpty, orchMergedToBase } = ctx;

	if (orchMergedToBase) {
		return { ok: true, reason: "orch_merged_to_base" };
	}

	if (mergeResultsEmpty) {
		return { ok: true, reason: "no_merge_claimed" };
	}

	if (!orchBranch) {
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error: "Batch mergeResults claim success but no orch branch is recorded",
			suggestedCommand: "spine status --diagnose",
		};
	}

	let commitsAhead = 0;
	try {
		commitsAhead = countCommitsAhead(projectRoot, baseBranch, orchBranch);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error: `Cannot compare ${orchBranch} to ${baseBranch}: ${message}`,
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (commitsAhead === 0) {
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error:
				`Orch branch ${orchBranch} has no commits ahead of ${baseBranch} but mergeResults claim success. ` +
				`Re-run the batch or land lane work on the orch branch before completing.`,
			suggestedCommand: "spine status --diagnose",
		};
	}

	return {
		ok: false,
		failureClass: "NeedsIntegrate",
		error:
			`Orch branch ${orchBranch} is ${commitsAhead} commit(s) ahead of ${baseBranch} — run integrate before completing the batch record.`,
		suggestedCommand: "spine integrate",
		commitsAhead,
	};
}
