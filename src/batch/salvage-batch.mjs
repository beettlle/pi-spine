// @ts-nocheck
/**
 * Operator salvage after batch abort/dismiss (FR-REL220-03, #158).
 * List mode only in SP-570; integrate mode is SP-571.
 */

import fs from "node:fs";
import readline from "node:readline/promises";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { archiveBatchStatePath } from "./lifecycle.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { checkIntegrateGate } from "./gate.mjs";
import { gitExec } from "./git-exec.mjs";
import { mergeOrchIntoBaseIsolated, syncPlumbingMergePathsToWorktree } from "./integrate-worktree.mjs";
import { journalPath, readJournalEvents, appendJournalEvent } from "./journal.mjs";
import { rebuildBatchStateFromJournal } from "./journal-rebuild.mjs";
import { loadBatchStateFile, parseBatchState } from "./reconcile.mjs";
import { resolveRulesManifestIntegrateDrift } from "./rules-manifest-drift.mjs";
import { laneTaskBranch } from "./worktree.mjs";

/** Exit reasons that block salvage even when a lane commit exists. */
export const NON_SALVAGEABLE_EXIT_REASONS = new Set([
	"contract_failed",
	"review_exhausted",
	"review_failed",
	"code_review_invalid_verdict",
	"final_review_invalid_verdict",
	"CONTRACT_FAIL",
]);

/**
 * @param {string|null|undefined} exitReason
 */
export function isNonSalvageableExitReason(exitReason) {
	if (!exitReason) return false;
	return NON_SALVAGEABLE_EXIT_REASONS.has(String(exitReason));
}

/**
 * @param {string} projectRoot
 * @param {string} baseBranch
 * @param {string} headRef
 */
function collectDiffStat(projectRoot, baseBranch, headRef) {
	try {
		return execFileSync("git", ["diff", "--stat", `${baseBranch}..${headRef}`], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return `(git diff --stat failed: ${message})`;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function branchExists(projectRoot, ref) {
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {object[]} journalEvents
 */
function laneCommittedTaskIds(journalEvents) {
	/** @type {Set<string>} */
	const committed = new Set();
	for (const event of journalEvents) {
		if (String(event?.type ?? "") !== "lane.committed") continue;
		const taskId = typeof event.taskId === "string" ? event.taskId : event.payload?.taskId;
		if (taskId) committed.add(String(taskId));
	}
	return committed;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function loadSalvageBatchSeed(projectRoot, batchId) {
	const archivePath = archiveBatchStatePath(projectRoot, batchId);
	if (fs.existsSync(archivePath)) {
		try {
			return JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		} catch {
			return null;
		}
	}

	const loaded = loadBatchStateFile(projectRoot);
	if (loaded.raw && String(loaded.raw.batchId ?? loaded.raw.id ?? "") === batchId) {
		return loaded.raw;
	}

	return null;
}

/**
 * @param {object[]} tasks
 */
function laneNumbersFromTasks(tasks) {
	/** @type {Set<number>} */
	const lanes = new Set();
	for (const task of tasks ?? []) {
		const laneNumber = Number(task?.laneNumber);
		if (Number.isFinite(laneNumber) && laneNumber > 0) lanes.add(laneNumber);
	}
	return lanes;
}

/**
 * @param {object} task
 * @param {Set<string>} committedTaskIds
 */
function isSalvageableTask(task, committedTaskIds) {
	const taskId = String(task?.taskId ?? "");
	if (!taskId) return false;
	if (!committedTaskIds.has(taskId)) return false;

	const status = String(task?.status ?? "").toLowerCase();
	if (status !== "succeeded" && status !== "skipped") return false;
	if (isNonSalvageableExitReason(task?.exitReason)) return false;
	return true;
}

/**
 * List lanes with salvageable commits after abort/dismiss (read-only).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function listSalvageableLanes(projectRoot, batchId) {
	const resolvedBatchId = String(batchId ?? "").trim();
	if (!resolvedBatchId) {
		return {
			ok: false,
			exitCode: 1,
			error: "batch_id_required",
			headline: "Batch id is required",
			suggestedCommand: "spine batch salvage --batch <batchId> --dry-run",
		};
	}

	const journalFile = journalPath(projectRoot, resolvedBatchId);
	if (!fs.existsSync(journalFile)) {
		return {
			ok: false,
			exitCode: 1,
			error: "journal_missing",
			headline: `No journal found for batch ${resolvedBatchId}`,
			suggestedCommand: "spine status --diagnose",
			batchId: resolvedBatchId,
		};
	}

	const journalEvents = readJournalEvents(projectRoot, resolvedBatchId);
	const seedState = loadSalvageBatchSeed(projectRoot, resolvedBatchId);
	const rebuilt = rebuildBatchStateFromJournal(seedState, journalEvents);
	const baseBranch = String(rebuilt.baseBranch ?? seedState?.baseBranch ?? "main");
	const committedTaskIds = laneCommittedTaskIds(journalEvents);

	/** @type {Map<number, { laneNumber: number, salvageableTasks: string[], excludedTasks: string[] }>} */
	const laneMap = new Map();

	for (const task of rebuilt.tasks ?? []) {
		const laneNumber = Number(task?.laneNumber);
		if (!Number.isFinite(laneNumber) || laneNumber <= 0) continue;

		if (!laneMap.has(laneNumber)) {
			laneMap.set(laneNumber, { laneNumber, salvageableTasks: [], excludedTasks: [] });
		}
		const laneEntry = laneMap.get(laneNumber);

		const taskId = String(task.taskId ?? "");
		const status = String(task.status ?? "").toLowerCase();
		const hasLaneCommit = committedTaskIds.has(taskId);

		if (hasLaneCommit && isNonSalvageableExitReason(task.exitReason)) {
			laneEntry.excludedTasks.push(taskId);
			continue;
		}

		if (isSalvageableTask(task, committedTaskIds)) {
			laneEntry.salvageableTasks.push(taskId);
		} else if (
			hasLaneCommit &&
			(status === "failed" || isNonSalvageableExitReason(task.exitReason))
		) {
			laneEntry.excludedTasks.push(taskId);
		}
	}

	for (const laneNumber of laneNumbersFromTasks(rebuilt.tasks)) {
		if (!laneMap.has(laneNumber)) {
			laneMap.set(laneNumber, { laneNumber, salvageableTasks: [], excludedTasks: [] });
		}
	}

	/** @type {object[]} */
	const lanes = [];
	for (const laneNumber of [...laneMap.keys()].sort((a, b) => a - b)) {
		const entry = laneMap.get(laneNumber);
		if (entry.salvageableTasks.length === 0) continue;

		const taskBranch = laneTaskBranch(resolvedBatchId, laneNumber);
		if (!branchExists(projectRoot, taskBranch)) continue;

		const commitsAhead = countCommitsAhead(projectRoot, baseBranch, taskBranch);
		if (commitsAhead <= 0) continue;

		lanes.push({
			laneNumber,
			taskBranch,
			commitsAhead,
			diffStat: collectDiffStat(projectRoot, baseBranch, taskBranch),
			salvageableTasks: [...entry.salvageableTasks],
			excludedTasks: [...entry.excludedTasks],
		});
	}

	return {
		ok: true,
		exitCode: 0,
		dryRun: true,
		batchId: resolvedBatchId,
		baseBranch,
		lanes,
		headline:
			lanes.length === 0
				? `No salvageable lane commits for batch ${resolvedBatchId}`
				: `${lanes.length} salvageable lane(s) for batch ${resolvedBatchId}`,
		suggestedCommand:
			lanes.length === 0
				? "spine status --diagnose"
				: "spine batch salvage --batch <batchId> --lane <n> --integrate",
	};
}

/**
 * @param {ReturnType<typeof listSalvageableLanes>} result
 * @param {{ json?: boolean }} [options]
 */
export function formatSalvageListOutput(result, options = {}) {
	if (options.json) {
		return `${JSON.stringify(result, null, 2)}\n`;
	}

	const lines = ["", result.ok ? "Salvage list (dry-run)" : "Salvage list failed", "", `  ${result.headline}`];

	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.batchId) {
		lines.push("", `  Batch: ${result.batchId}`);
	}
	if (result.baseBranch) {
		lines.push(`  Base: ${result.baseBranch}`);
	}

	if (result.ok && Array.isArray(result.lanes)) {
		for (const lane of result.lanes) {
			lines.push(
				"",
				`  Lane ${lane.laneNumber}: ${lane.taskBranch} (${lane.commitsAhead} commit(s) ahead)`,
				`    Tasks: ${lane.salvageableTasks.join(", ")}`,
			);
			if (lane.excludedTasks?.length) {
				lines.push(`    Excluded: ${lane.excludedTasks.join(", ")}`);
			}
			if (lane.diffStat) {
				for (const statLine of String(lane.diffStat).split("\n")) {
					lines.push(`    ${statLine}`);
				}
			}
		}
	}

	if (result.suggestedCommand) {
		lines.push("", `  → ${result.suggestedCommand}`);
	}

	lines.push("");
	return lines.join("\n");
}

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
