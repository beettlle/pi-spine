import { loadBatchStateFile } from "../src/batch/reconcile.mjs";
import { generateBatchPostMortem } from "../src/batch/postmortem.mjs";
import { readJournalEvents, readJournalTail } from "../src/batch/journal.mjs";
import { reconcileBatch } from "../src/batch/reconcile.mjs";
import { formatStatusJson } from "../src/batch/status-json.mjs";

/**
 * Per-row matrix state lines (#230): one block per matrix task listing each
 * row's running/succeeded/failed state, plus concrete retry/cancel commands
 * for the failing rows. Rendered for both plain and --diagnose human output.
 *
 * @param {string[]} lines Output lines (mutated).
 * @param {object} result Reconciliation result from reconcileBatch.
 */
function appendMatrixRowSections(lines, result) {
	const matrixTasks = (result.signals?.tasks ?? []).filter(
		(task) => Array.isArray(task?.matrixRows) && task.matrixRows.length > 0,
	);
	if (matrixTasks.length === 0) return;

	for (const task of matrixTasks) {
		const failedRowIds = task.matrixRows
			.filter((row) => row && row.status === "failed")
			.map((row) => row.rowId)
			.filter(Boolean);
		lines.push("", `  Matrix rows (${task.taskId}):`);
		for (const row of task.matrixRows) {
			if (!row || typeof row !== "object") continue;
			const status = String(row.status ?? "pending");
			const exit = row.exitCode != null ? ` exit=${row.exitCode}` : "";
			const commit = typeof row.commitSha === "string" && row.commitSha ? ` @ ${row.commitSha.slice(0, 8)}` : "";
			lines.push(`    ${row.rowId}: ${status}${exit}${commit}`);
		}
		if (failedRowIds.length > 0) {
			lines.push(
				`    → Retry one failed row: spine batch retry '${task.taskId}[${failedRowIds[0]}]'`,
			);
		}
		const cancellable = task.matrixRows.some(
			(row) => row && row.status !== "succeeded" && row.status !== "canceled",
		);
		if (cancellable) {
			lines.push(
				`    → Cancel one row: spine batch skip '${task.taskId}[<rowId>]' (whole matrix: spine batch skip ${task.taskId})`,
			);
		}
	}
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {boolean} [options.diagnose]
 * @param {boolean} [options.verbose]
 * @param {boolean} [options.json]
 */
export function runSpineStatus(options) {
	const { projectRoot, diagnose = false, verbose = false, json = false } = options;
	const result = reconcileBatch({ projectRoot, verbose: verbose || diagnose });

	if (json) {
		return {
			exitCode: 0,
			output: formatStatusJson(result),
		};
	}

	const lines = ["", "Batch status", ""];

	if (result.batchId) {
		lines.push(`  Batch:     ${result.batchId}`);
	}
	if (result.phase) {
		lines.push(`  Phase:     ${result.phase}`);
	}
	if (result.diagnosis) {
		lines.push(`  Diagnosis: ${result.diagnosis}`);
	}
	if (result.macroPhase) {
		lines.push(`  Macro phase: ${result.macroPhaseLabel ?? result.macroPhase}`);
	}

	if (diagnose && result.headline != null) {
		// SBAR handoff layout (#278 / SP-745): Situation → Background → Assessment → Recommendation.
		lines.push("", `  Situation: ${result.headline}`);
		if (result.background?.length) {
			lines.push("", "  Background:");
			for (const fact of result.background) {
				lines.push(`    • ${fact}`);
			}
		}
		if (result.assessmentReason) {
			lines.push("", `  Assessment: ${result.diagnosis} — ${result.assessmentReason}`);
		}
		lines.push("");
		lines.push(`  Recommendation: ${result.suggestedCommand}`);
	} else {
		lines.push("", `  ${result.headline}`, "");
		lines.push(`  → ${result.suggestedCommand}`);
	}

	appendMatrixRowSections(lines, result);

	if (diagnose && result.mergeFailed) {
		lines.push("");
		lines.push(`  Merge failed: ${result.failedMerges} wave(s)`);
		if (result.failedWaveIndex != null) {
			lines.push(`  Failed wave: ${Number(result.failedWaveIndex) + 1} (index ${result.failedWaveIndex})`);
		}
		if (result.failedLane != null) {
			lines.push(`  Failed lane: ${result.failedLane}`);
		}
		if (result.lastError) {
			lines.push(`  Last error: ${result.lastError}`);
		}
	}

	if (result.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of result.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	if (diagnose && result.signals) {
		lines.push("", "  Signals:");
		lines.push(`    ${JSON.stringify(result.signals, null, 2).split("\n").join("\n    ")}`);
	}

	if (diagnose && result.signals?.journalHints?.length) {
		lines.push("", "  Journal hints (tail):");
		for (const hint of result.signals.journalHints) {
			lines.push(`    • ${hint.type} @ ${hint.timestamp}: ${hint.summary}`);
		}
	}

	if (verbose && result.signals?.segments?.length) {
		lines.push("", "  Segment frontier:");
		for (const segment of result.signals.segments) {
			lines.push(`    ${segment.segmentId}: ${segment.status} (${segment.classification})`);
		}
	}

	if (verbose && result.batchId) {
		const loaded = loadBatchStateFile(projectRoot, result.batchStatePath ?? null);
		if (loaded.raw) {
			const journalTail = readJournalTail(readJournalEvents(projectRoot, result.batchId));
			const postMortem = generateBatchPostMortem(loaded.raw, journalTail, result, projectRoot);
			lines.push("", "  Post-mortem:", "");
			for (const line of postMortem.split("\n")) {
				lines.push(line ? `    ${line}` : "");
			}
		}
	}

	lines.push("");
	return { exitCode: 0, output: lines.join("\n") };
}
