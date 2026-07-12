// @ts-nocheck
/**
 * Salvage integrate after batch abort/dismiss (FR-REL220-04, #158).
 * Extracted from salvage-batch.mjs (SP-605); list API lives in salvage-batch-list.mjs.
 */

import readline from "node:readline/promises";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { checkIntegrateGate } from "./gate.mjs";
import { gitExec } from "./git-exec.mjs";
import { mergeOrchIntoBaseIsolated, syncPlumbingMergePathsToWorktree } from "./integrate-worktree.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { resolveRulesManifestIntegrateDrift } from "./rules-manifest-drift.mjs";
import { laneTaskBranch } from "./worktree.mjs";
import { listSalvageableLanes } from "./salvage-batch-list.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return gitExec(projectRoot, args, { projectRoot });
}

/**
 * Default interactive confirmation for salvage integrate.
 *
 * @param {object} summary
 */
export async function confirmSalvageIntegrate(summary) {
	if (process.stdin.isTTY !== true) {
		return false;
	}

	const lines = [
		"",
		`Salvage integrate lane ${summary.laneNumber}: ${summary.taskBranch} → ${summary.baseBranch}`,
		`  Commits ahead: ${summary.commitsAhead}`,
		`  Salvageable tasks: ${summary.salvageableTasks.join(", ") || "(none)"}`,
	];
	if (summary.excludedTasks?.length) {
		lines.push(`  Excluded tasks: ${summary.excludedTasks.join(", ")}`);
	}
	if (summary.diffStat) {
		lines.push("  Diff:");
		for (const statLine of String(summary.diffStat).split("\n")) {
			lines.push(`    ${statLine}`);
		}
	}
	lines.push("", "Proceed with salvage integrate? [y/N] ");
	process.stdout.write(lines.join("\n"));

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = String(await rl.question("")).trim().toLowerCase();
		return answer === "y" || answer === "yes";
	} finally {
		rl.close();
	}
}

/**
 * Integrate salvageable lane commits into base after batch abort/dismiss (FR-REL220-04, #158).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number|string} laneNumber
 * @param {object} [options]
 * @param {boolean} [options.yes]
 * @param {boolean} [options.forceIntegrate]
 * @param {(summary: object) => Promise<boolean>} [options.confirmFn]
 */
export async function integrateSalvageableLane(projectRoot, batchId, laneNumber, options = {}) {
	const resolvedBatchId = String(batchId ?? "").trim();
	const laneNum = Number(laneNumber);
	const yes = Boolean(options.yes);
	const forceIntegrate = Boolean(options.forceIntegrate);
	const confirmFn = options.confirmFn ?? confirmSalvageIntegrate;

	if (!resolvedBatchId) {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_id_required",
			headline: "Batch id is required",
			suggestedCommand: "spine batch salvage --batch <batchId> --lane <n> --integrate",
		};
	}

	if (!Number.isFinite(laneNum) || laneNum <= 0) {
		return {
			ok: false,
			exitCode: 1,
			error: "lane_number_invalid",
			headline: "Lane number must be a positive integer",
			suggestedCommand: `spine batch salvage --batch ${resolvedBatchId} --dry-run`,
			batchId: resolvedBatchId,
		};
	}

	const listResult = listSalvageableLanes(projectRoot, resolvedBatchId);
	if (!listResult.ok) {
		return { ...listResult, integrate: true };
	}

	const lane = (listResult.lanes ?? []).find((entry) => entry.laneNumber === laneNum);
	if (!lane) {
		return {
			ok: false,
			exitCode: 1,
			error: "lane_not_salvageable",
			headline: `Lane ${laneNum} has no salvageable commits for batch ${resolvedBatchId}`,
			suggestedCommand: `spine batch salvage --batch ${resolvedBatchId} --dry-run`,
			batchId: resolvedBatchId,
			laneNumber: laneNum,
		};
	}

	const baseBranch = String(listResult.baseBranch ?? "main");
	const taskBranch = String(lane.taskBranch ?? laneTaskBranch(resolvedBatchId, laneNum));

	let commitsAhead = lane.commitsAhead;
	try {
		commitsAhead = countCommitsAhead(projectRoot, baseBranch, taskBranch);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			exitCode: 1,
			error: message,
			headline: `Cannot salvage integrate — ${message}`,
			suggestedCommand: "spine status --diagnose",
			batchId: resolvedBatchId,
			laneNumber: laneNum,
		};
	}

	if (commitsAhead <= 0) {
		return {
			ok: true,
			exitCode: 0,
			alreadyMerged: true,
			batchId: resolvedBatchId,
			laneNumber: laneNum,
			baseBranch,
			taskBranch,
			salvageableTasks: lane.salvageableTasks,
			excludedTasks: lane.excludedTasks,
			headline: `Lane ${laneNum} already merged into ${baseBranch}`,
			suggestedCommand: "spine status --diagnose",
		};
	}

	const configResult = loadSpineConfig(projectRoot);
	const gateCheck = checkIntegrateGate({
		projectRoot,
		batchId: resolvedBatchId,
		config: configResult.config ?? null,
		forceIntegrate,
	});

	if (!gateCheck.ok) {
		appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrate_failed", {
			laneNumber: laneNum,
			taskBranch,
			baseBranch,
			gateBlocked: true,
			gateStatus: gateCheck.gate?.status ?? "missing",
			error: gateCheck.error ?? gateCheck.headline,
		});

		return {
			ok: false,
			exitCode: gateCheck.exitCode ?? 2,
			failureClass: gateCheck.failureClass ?? "GateBlocked",
			error: gateCheck.error,
			headline: gateCheck.headline ?? "Salvage integrate blocked by gate",
			suggestedCommand: gateCheck.suggestedCommand ?? "spine gate approve",
			alternatives: gateCheck.alternatives ?? ["/spine-gate approve"],
			batchId: resolvedBatchId,
			laneNumber: laneNum,
			gate: gateCheck.gate ?? null,
		};
	}

	if (!yes) {
		if (process.stdin.isTTY !== true) {
			return {
				ok: false,
				exitCode: 1,
				error: "confirmation_required",
				headline: "Non-interactive mode requires --yes to salvage integrate",
				suggestedCommand: `spine batch salvage --batch ${resolvedBatchId} --lane ${laneNum} --integrate --yes`,
				batchId: resolvedBatchId,
				laneNumber: laneNum,
				baseBranch,
				taskBranch,
				commitsAhead,
				salvageableTasks: lane.salvageableTasks,
				excludedTasks: lane.excludedTasks,
			};
		}

		const confirmed = await confirmFn({
			laneNumber: laneNum,
			taskBranch,
			baseBranch,
			commitsAhead,
			salvageableTasks: lane.salvageableTasks,
			excludedTasks: lane.excludedTasks,
			diffStat: lane.diffStat,
		});

		if (!confirmed) {
			return {
				ok: false,
				exitCode: 1,
				error: "confirmation_declined",
				cancelled: true,
				headline: "Salvage integrate cancelled",
				suggestedCommand: `spine batch salvage --batch ${resolvedBatchId} --lane ${laneNum} --integrate --yes`,
				batchId: resolvedBatchId,
				laneNumber: laneNum,
			};
		}
	}

	const drift = resolveRulesManifestIntegrateDrift({
		projectRoot,
		baseBranch,
		orchBranch: taskBranch,
		isolatedMerge: true,
	});
	if (!drift.ok) {
		appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrate_failed", {
			laneNumber: laneNum,
			taskBranch,
			baseBranch,
			error: drift.error,
			failureClass: drift.failureClass ?? "DirtyWorktree",
		});
		return {
			ok: false,
			exitCode: 1,
			error: drift.error,
			failureClass: drift.failureClass ?? "DirtyWorktree",
			headline: drift.error ?? "Salvage integrate refused — dirty rules-manifest",
			suggestedCommand: "spine status --diagnose",
			batchId: resolvedBatchId,
			laneNumber: laneNum,
		};
	}

	appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrate_started", {
		laneNumber: laneNum,
		taskBranch,
		baseBranch,
		commitsAhead,
		salvageableTasks: lane.salvageableTasks,
		excludedTasks: lane.excludedTasks,
		gateRequired: gateCheck.required ?? false,
		gateForced: gateCheck.forced ?? false,
	});

	const mergeResult = mergeOrchIntoBaseIsolated({
		projectRoot,
		baseBranch,
		orchBranch: taskBranch,
		batchId: resolvedBatchId,
	});

	if (!mergeResult.ok) {
		const conflict = mergeResult.failureClass === "MergeConflict";
		appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrate_failed", {
			laneNumber: laneNum,
			taskBranch,
			baseBranch,
			error: String(mergeResult.error ?? "merge failed").slice(0, 500),
			conflict,
			failureClass: mergeResult.failureClass ?? "IntegrateFailed",
		});

		return {
			ok: false,
			exitCode: 1,
			error: mergeResult.error,
			failureClass: mergeResult.failureClass ?? (conflict ? "MergeConflict" : "IntegrateFailed"),
			headline: conflict
				? `Merge conflict salvaging ${taskBranch} into ${baseBranch} — resolve manually`
				: `Salvage integrate failed: ${mergeResult.error ?? "merge failed"}`,
			suggestedCommand: "spine status --diagnose",
			batchId: resolvedBatchId,
			laneNumber: laneNum,
			alternatives: ["/spine-gate"],
		};
	}

	const mergeCommit = mergeResult.mergeCommit;
	/** @type {{ ok: boolean, timedOut?: boolean, error?: string } | null} */
	let syncResult = null;
	if (mergeResult.mode === "plumbing") {
		const baseSha = git(projectRoot, ["rev-parse", `${mergeCommit}^1`]);
		syncResult = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);
	}

	if (syncResult && !syncResult.ok) {
		appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrate_failed", {
			laneNumber: laneNum,
			taskBranch,
			baseBranch,
			timeout: Boolean(syncResult.timedOut),
			error: (syncResult.error ?? "sync failed").slice(0, 500),
			mergeCommitLanded: true,
			mergeCommit,
		});

		return {
			ok: false,
			exitCode: 1,
			error: syncResult.error ?? "post-merge sync failed",
			failureClass: syncResult.timedOut ? "IntegrateTimeout" : "IntegrateFailed",
			headline: syncResult.timedOut
				? `Salvage integrate sync timed out after merge landed — ${taskBranch} into ${baseBranch}`
				: `Salvage integrate post-merge sync failed — ${syncResult.error}`,
			suggestedCommand: "spine status --diagnose",
			batchId: resolvedBatchId,
			laneNumber: laneNum,
			mergeCommitLanded: true,
		};
	}

	appendJournalEvent(projectRoot, resolvedBatchId, "batch.salvage_integrated", {
		laneNumber: laneNum,
		taskBranch,
		baseBranch,
		mergeCommit,
		commitsAhead,
		salvageableTasks: lane.salvageableTasks,
		excludedTasks: lane.excludedTasks,
	});

	return {
		ok: true,
		exitCode: 0,
		batchId: resolvedBatchId,
		laneNumber: laneNum,
		baseBranch,
		taskBranch,
		mergeCommit,
		commitsAhead,
		salvageableTasks: lane.salvageableTasks,
		excludedTasks: lane.excludedTasks,
		headline: `Salvaged lane ${laneNum} (${taskBranch}) into ${baseBranch}`,
		suggestedCommand: "spine status --diagnose",
	};
}

/**
 * @param {Awaited<ReturnType<typeof integrateSalvageableLane>>} result
 * @param {{ json?: boolean }} [options]
 */
export function formatSalvageIntegrateOutput(result, options = {}) {
	if (options.json) {
		return `${JSON.stringify(result, null, 2)}\n`;
	}

	const lines = [
		"",
		result.ok ? "Salvage integrate" : result.cancelled ? "Salvage integrate cancelled" : "Salvage integrate failed",
		"",
		`  ${result.headline}`,
	];

	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.batchId) {
		lines.push("", `  Batch: ${result.batchId}`);
	}
	if (result.laneNumber != null) {
		lines.push(`  Lane: ${result.laneNumber}`);
	}
	if (result.baseBranch && result.taskBranch) {
		lines.push(`  Merge: ${result.taskBranch} → ${result.baseBranch}`);
	}
	if (result.salvageableTasks?.length) {
		lines.push(`  Tasks: ${result.salvageableTasks.join(", ")}`);
	}
	if (result.excludedTasks?.length) {
		lines.push(`  Excluded: ${result.excludedTasks.join(", ")}`);
	}
	if (result.mergeCommit) {
		lines.push(`  Merge commit: ${result.mergeCommit}`);
	}

	if (result.suggestedCommand) {
		lines.push("", `  → ${result.suggestedCommand}`);
	}

	if (result.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of result.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}
