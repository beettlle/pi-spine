// @ts-nocheck
/**
 * Salvage list (dry-run) after batch abort/dismiss (FR-REL220-03, #158).
 * Extracted from salvage-batch.mjs (SP-591); integrate lives in salvage-batch-integrate.mjs (SP-605).
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { archiveBatchStatePath } from "./lifecycle.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { journalPath, readJournalEvents } from "./journal.mjs";
import { rebuildBatchStateFromJournal } from "./journal-rebuild.mjs";
import { loadBatchStateFile } from "./reconcile.mjs";
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
 * Journal rebuild may drop seed done* flags; merge them for salvage discovery (#196).
 *
 * @param {object} rebuiltTask
 * @param {object[]|undefined} seedTasks
 */
function enrichTaskWithSeedEvidence(rebuiltTask, seedTasks) {
	const taskId = String(rebuiltTask?.taskId ?? "");
	if (!taskId || !Array.isArray(seedTasks)) return rebuiltTask;
	const seed = seedTasks.find((task) => String(task?.taskId ?? "") === taskId);
	if (!seed) return rebuiltTask;
	return {
		...rebuiltTask,
		doneInLane: rebuiltTask?.doneInLane === true || seed.doneInLane === true,
		doneFileFound: rebuiltTask?.doneFileFound === true || seed.doneFileFound === true,
		doneOnMain: rebuiltTask?.doneOnMain === true || seed.doneOnMain === true,
		classification:
			rebuiltTask?.classification ??
			seed.classification ??
			undefined,
	};
}

/**
 * Terminal-success / lane `.DONE` evidence — journal `lane.committed` is optional (#196 / FR-REL232-02).
 * Git commits-ahead on the lane task branch remains the hard gate in `listSalvageableLanes`.
 *
 * @param {object} task
 */
function isTerminalSuccessTask(task) {
	const status = String(task?.status ?? "").toLowerCase();
	if (status === "succeeded" || status === "skipped") return true;
	if (task?.doneInLane === true || task?.doneFileFound === true || task?.doneOnMain === true) {
		return true;
	}
	return String(task?.classification ?? "").toLowerCase() === "terminal-success";
}

/**
 * @param {object} task
 */
function isSalvageableTask(task) {
	const taskId = String(task?.taskId ?? "");
	if (!taskId) return false;
	if (isNonSalvageableExitReason(task?.exitReason)) return false;
	return isTerminalSuccessTask(task);
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
	const seedTasks = seedState?.tasks;

	/** @type {Map<number, { laneNumber: number, salvageableTasks: string[], excludedTasks: string[] }>} */
	const laneMap = new Map();

	for (const rawTask of rebuilt.tasks ?? []) {
		const task = enrichTaskWithSeedEvidence(rawTask, seedTasks);
		const laneNumber = Number(task?.laneNumber);
		if (!Number.isFinite(laneNumber) || laneNumber <= 0) continue;

		if (!laneMap.has(laneNumber)) {
			laneMap.set(laneNumber, { laneNumber, salvageableTasks: [], excludedTasks: [] });
		}
		const laneEntry = laneMap.get(laneNumber);

		const taskId = String(task.taskId ?? "");
		const status = String(task.status ?? "").toLowerCase();
		const hasLaneCommit = committedTaskIds.has(taskId);

		// Exclude non-salvageable exit reasons even when journal lacks lane.committed (#196).
		if (isNonSalvageableExitReason(task.exitReason)) {
			laneEntry.excludedTasks.push(taskId);
			continue;
		}

		if (isSalvageableTask(task)) {
			laneEntry.salvageableTasks.push(taskId);
		} else if (hasLaneCommit && status === "failed") {
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
