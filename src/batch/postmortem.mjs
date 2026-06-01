/**
 * Honest batch post-mortem (NFR-OBS-03, GAP-POST-01).
 */

import fs from "node:fs";
import path from "node:path";
import { buildTaskScorecard } from "./evidence.mjs";
import { loadGateRecord, formatGateSummary } from "./gate.mjs";
import { readJournalEvents, readJournalTail, summarizeJournalEvent } from "./journal.mjs";
import { reconcileBatch } from "./reconcile.mjs";

const FAILURE_DIAGNOSES = new Set(["failed", "needs_retry"]);
const FALSE_SUCCESS_PATTERN = /ran smoothly|completed successfully/i;

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function postMortemPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "post-mortem.md");
}

/**
 * @param {string} batchId
 */
export function postMortemRelPath(batchId) {
	return path.join(".spine", "runtime", batchId, "post-mortem.md");
}

/**
 * @param {object|null|undefined} batchState
 */
export function countTaskOutcomes(batchState) {
	const tasks = Array.isArray(batchState?.tasks) ? batchState.tasks : [];
	let succeeded = 0;
	let failed = 0;
	let skipped = 0;
	let other = 0;

	for (const task of tasks) {
		const status = String(task.status ?? "").toLowerCase();
		if (status === "succeeded" || status === "completed" || status === "done") {
			succeeded += 1;
		} else if (status === "failed") {
			failed += 1;
		} else if (status === "skipped") {
			skipped += 1;
		} else {
			other += 1;
		}
	}

	return {
		succeeded: Number(batchState?.succeededTasks ?? succeeded) || succeeded,
		failed: Number(batchState?.failedTasks ?? failed) || failed,
		skipped: Number(batchState?.skippedTasks ?? skipped) || skipped,
		other,
		total: Number(batchState?.totalTasks ?? tasks.length) || tasks.length,
	};
}

/**
 * @param {object|null|undefined} batchState
 * @param {import("./reconcile.mjs").ReconciliationResult|null|undefined} reconciliation
 * @returns {string[]}
 */
export function listFailedTaskIds(batchState, reconciliation) {
	const classified = reconciliation?.signals?.tasks;
	if (Array.isArray(classified) && classified.length > 0) {
		return classified
			.filter((task) => task.classification === "terminal-failure")
			.map((task) => task.taskId)
			.filter(Boolean);
	}

	const tasks = Array.isArray(batchState?.tasks) ? batchState.tasks : [];
	return tasks
		.filter((task) => String(task.status ?? "").toLowerCase() === "failed")
		.map((task) => task.taskId)
		.filter(Boolean);
}

/**
 * @param {import("./reconcile.mjs").ReconciliationResult|null|undefined} reconciliation
 * @param {object|null|undefined} batchState
 */
export function buildPostMortemHeadline(reconciliation, batchState) {
	const failedTasks = Number(batchState?.failedTasks ?? 0);
	const diagnosis = reconciliation?.diagnosis ?? null;
	const failedIds = listFailedTaskIds(batchState, reconciliation);
	const hasFailures =
		failedTasks > 0 || FAILURE_DIAGNOSES.has(diagnosis ?? "") || failedIds.length > 0;

	if (hasFailures) {
		const batchLabel = batchState?.batchId ?? batchState?.id ?? reconciliation?.batchId ?? "Batch";
		if (failedIds.length === 1) {
			return `${batchLabel} has failed task ${failedIds[0]} — retry before resume`;
		}
		if (failedIds.length > 1) {
			return `${batchLabel} has ${failedIds.length} failed tasks (${failedIds.join(", ")})`;
		}
		if (reconciliation?.headline && !FALSE_SUCCESS_PATTERN.test(reconciliation.headline)) {
			return reconciliation.headline;
		}
		return `${batchLabel} has ${failedTasks || failedIds.length || 1} failed task(s)`;
	}

	if (reconciliation?.headline) return reconciliation.headline;

	const batchLabel = batchState?.batchId ?? batchState?.id ?? "Batch";
	return `${batchLabel} — see diagnosis below`;
}

/**
 * @param {object|null|undefined} batchState
 * @param {import("./reconcile.mjs").ReconciliationResult|null|undefined} reconciliation
 */
export function describeMergeStatus(batchState, reconciliation) {
	const mergeResults = Array.isArray(batchState?.mergeResults) ? batchState.mergeResults : [];
	if (mergeResults.length === 0) {
		if (reconciliation?.signals?.mergeResultsEmpty === false) {
			return "merge results recorded (see batch state)";
		}
		return "not started (no merge results yet)";
	}

	const succeeded = mergeResults.filter((row) => String(row.status ?? "").toLowerCase() === "succeeded").length;
	const failed = mergeResults.filter((row) => String(row.status ?? "").toLowerCase() === "failed").length;
	const other = mergeResults.length - succeeded - failed;

	const parts = [`${mergeResults.length} wave(s)`];
	if (succeeded) parts.push(`${succeeded} succeeded`);
	if (failed) parts.push(`${failed} failed`);
	if (other) parts.push(`${other} other`);
	return parts.join("; ");
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} batchId
 */
export function describeGateStatus(projectRoot, batchId) {
	if (!batchId) return "no batch id";
	const gate = loadGateRecord(projectRoot, batchId);
	if (!gate) return "not opened";
	return formatGateSummary(gate);
}

/**
 * @param {object[]} journalTail
 * @param {import("./reconcile.mjs").ReconciliationResult|null|undefined} reconciliation
 */
export function describeIntegrateStatus(journalTail, reconciliation) {
	const integrateEvent = [...journalTail]
		.reverse()
		.find((event) => String(event.type ?? "").startsWith("integrate."));

	if (integrateEvent?.type === "integrate.completed") {
		return "completed (journal)";
	}
	if (integrateEvent?.type === "integrate.failed") {
		return `failed (journal): ${summarizeJournalEvent(integrateEvent)}`;
	}
	if (integrateEvent?.type === "integrate.started") {
		return "in progress (journal)";
	}

	const git = reconciliation?.signals?.git;
	if (git?.orchMergedToBase) {
		return `orch merged to ${git.baseBranch ?? "base"} (${git.mergedOrchBranch ?? git.orchBranch ?? "orch"})`;
	}
	if (git?.orchBranchExists) {
		const ahead = git.orchCommitsAhead;
		if (ahead != null) return `orch branch ahead of base (${ahead} commit(s)) — integrate pending`;
		return "orch branch exists — integrate pending";
	}
	return "no orch branch detected";
}

/**
 * @param {object|null|undefined} batchState
 * @param {object[]} journalTail
 * @param {import("./reconcile.mjs").ReconciliationResult|null|undefined} reconciliation
 * @param {string} [projectRoot]
 */
export function generateBatchPostMortem(batchState, journalTail = [], reconciliation = null, projectRoot = "") {
	const batchId = batchState?.batchId ?? batchState?.id ?? reconciliation?.batchId ?? "—";
	const diagnosis = reconciliation?.diagnosis ?? "—";
	const phase = batchState?.phase ?? reconciliation?.phase ?? "—";
	const outcomes = countTaskOutcomes(batchState);
	const failedIds = listFailedTaskIds(batchState, reconciliation);
	const headline = buildPostMortemHeadline(reconciliation, batchState);
	const suggested = reconciliation?.suggestedCommand ?? "spine status --diagnose";
	const alternatives = reconciliation?.alternatives ?? [];

	const lines = [
		"# Batch post-mortem",
		"",
		`| Field | Value |`,
		`|-------|-------|`,
		`| Batch ID | ${batchId} |`,
		`| Diagnosis | ${diagnosis} |`,
		`| Phase | ${phase} |`,
		`| Base branch | ${batchState?.baseBranch ?? "—"} |`,
		`| Orch branch | ${batchState?.orchBranch ?? "—"} |`,
		"",
		"## Headline",
		"",
		headline,
		"",
		"## Task outcomes",
		"",
		`| Succeeded | Failed | Skipped | Total |`,
		`|-----------|--------|---------|-------|`,
		`| ${outcomes.succeeded} | ${outcomes.failed} | ${outcomes.skipped} | ${outcomes.total} |`,
		"",
	];

	if (failedIds.length > 0) {
		lines.push("### Failed task IDs", "");
		for (const taskId of failedIds) {
			lines.push(`- ${taskId}`);
		}
		lines.push("");
	}

	lines.push("## Recovery", "", `**Suggested:** \`${suggested}\``, "");
	if (alternatives.length > 0) {
		lines.push("**Alternatives:**", "");
		for (const alt of alternatives) {
			lines.push(`- \`${alt}\``);
		}
		lines.push("");
	}

	if (failedIds.length > 0) {
		const primaryFailed = failedIds[0];
		lines.push(
			`For mixed-outcome batches (incident I-05), retry failed tasks before resume: \`/spine-retry-task ${primaryFailed}\` then \`/spine-resume --force\`.`,
			"",
		);
	}

	lines.push(
		"## Merge / gate / integrate",
		"",
		`- **Merge:** ${describeMergeStatus(batchState, reconciliation)}`,
		`- **Gate:** ${projectRoot ? describeGateStatus(projectRoot, String(batchId)) : "unknown (no project root)"}`,
		`- **Integrate:** ${describeIntegrateStatus(journalTail, reconciliation)}`,
		"",
	);

	if (journalTail.length > 0) {
		lines.push("## Journal (recent)", "");
		const recent = journalTail.slice(-8);
		for (const event of recent) {
			lines.push(`- \`${event.type}\` @ ${event.timestamp}: ${summarizeJournalEvent(event)}`);
		}
		lines.push("");
	}

	const scorecard = buildTaskScorecard(batchState).replace(/^# Batch evidence summary\n\n/, "");
	lines.push("## Task scorecard", "", scorecard.trimEnd(), "", "_Generated by pi-spine (TP-022, NFR-OBS-03)._", "");

	return `${lines.join("\n")}\n`;
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {object} ctx.batchState
 * @param {import("./reconcile.mjs").ReconciliationResult} [ctx.reconciliation]
 * @param {object[]} [ctx.journalTail]
 */
export function writeBatchPostMortem(ctx) {
	const { projectRoot, batchState } = ctx;
	const batchId = String(batchState?.batchId ?? batchState?.id ?? "");
	const reconciliation =
		ctx.reconciliation ??
		reconcileBatch({ projectRoot, batchState, verbose: true });
	const journalTail =
		ctx.journalTail ??
		readJournalTail(readJournalEvents(projectRoot, batchId));

	const markdown = generateBatchPostMortem(
		batchState,
		journalTail,
		reconciliation,
		projectRoot,
	);
	const filePath = postMortemPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, markdown, "utf-8");

	return postMortemRelPath(batchId);
}
