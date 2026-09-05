/**
 * Row-scoped matrix operations (SP-752 / #230).
 *
 * Split out of `retry.mjs` to keep that module under the Phase 23 500 LOC cap.
 * Shared phase/load helpers live in `retry.mjs` and are imported from there
 * (one-way dependency — `retry.mjs` never imports this module).
 */

import {
	countPendingSegments,
	recordTaskTransition,
	resetTaskForRetry,
	validateBatchState,
} from "./state.mjs";
import { unblockBatchAfterRetry, loadMutableBatch, guardPhaseForMutation, findTask } from "./retry.mjs";

/**
 * Parse a matrix row identity token `SP-X[rowId]` / `TP-X[rowId]`.
 * Plain task ids and malformed brackets return null (CLI falls back to whole-task retry/skip).
 *
 * @param {unknown} raw
 * @returns {{ taskId: string, rowId: string } | null}
 */
export function parseMatrixRowRef(raw) {
	if (typeof raw !== "string" || raw.length === 0) return null;
	// Exact match: one pair of brackets, non-empty row id, no nested brackets.
	const match = /^([A-Za-z]+-\d+)\[([^\[\]]+)\]$/.exec(raw);
	if (!match) return null;
	return { taskId: match[1], rowId: match[2] };
}

/**
 * Row-scoped matrix retry (#230): `spine batch retry SP-X[rowId]` resets one
 * `failed` row for re-execution without touching sibling rows — succeeded rows
 * are never re-executed (their worktrees carry over), other failed rows stay
 * failed until retried individually. The parent task re-enters the sweep so
 * resume re-runs exactly the rows marked `pending`.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId Parent matrix task id.
 * @param {string} params.rowId Row id inside `task.matrixRows`.
 */
export function retryTaskRow({ projectRoot, taskId, rowId }) {
	const loadedBatch = loadMutableBatch(projectRoot);
	if (!loadedBatch.ok) return loadedBatch.result;
	const state = loadedBatch.state;
	const phase = String(state.phase ?? "");

	const guard = guardPhaseForMutation({ phase, operation: "retry" });
	if (!guard.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: guard.error,
			output: guard.output,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	const task = findTask(state, taskId);
	if (!task) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found in batch ${state.batchId}.\n`,
			batchId: state.batchId,
		};
	}

	const rows = Array.isArray(task.matrixRows) ? task.matrixRows : [];
	if (rows.length === 0) {
		return {
			ok: false,
			exitCode: 1,
			error: "not_a_matrix_task",
			output: `Task ${taskId} has no matrix rows — retry the whole task with \`spine batch retry ${taskId}\`.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	const row = rows.find((entry) => entry && typeof entry === "object" && entry.rowId === rowId);
	if (!row) {
		return {
			ok: false,
			exitCode: 1,
			error: "row_not_found",
			output: `Row ${taskId}[${rowId}] not found. Matrix rows: ${rows
				.map((entry) => entry?.rowId)
				.join(", ")}\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	if (row.status !== "failed") {
		const reason =
			row.status === "succeeded"
				? "already succeeded — succeeded rows are never re-executed"
				: row.status === "canceled"
					? "was canceled — re-run the whole task to restore it"
					: `is ${row.status ?? "pending"} — only failed rows can be retried`;
		return {
			ok: false,
			exitCode: 1,
			error: "row_not_retryable",
			output: `Row ${taskId}[${rowId}] ${reason}.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	// Parent/task/segment reset is identical to a whole-task retry; the only
	// difference is which matrix rows re-enter the sweep as `pending`.
	const reset = resetTaskForRetry(state, taskId);
	if (!reset) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found.\n`,
			batchId: state.batchId,
		};
	}
	row.status = "pending";
	row.exitCode = null;

	const unblocked = unblockBatchAfterRetry(state);
	if (!unblocked) {
		state.phase = "failed";
		state.endedAt = null;
		state.lastError = null;
	}

	state.resilience = state.resilience ?? {};
	state.resilience.retryCountByScope = state.resilience.retryCountByScope ?? {};
	const rowScope = `${taskId}[${rowId}]`;
	state.resilience.retryCountByScope[rowScope] = (state.resilience.retryCountByScope[rowScope] ?? 0) + 1;

	const pendingSegments = countPendingSegments(state, taskId);
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.retry_requested",
		journalPayload: {
			taskId,
			rowId,
			previousClassification: reset.previousClassification,
			pendingSegments,
			retriedRowIds: [rowId],
		},
	});

	if (unblocked) {
		recordTaskTransition({
			projectRoot,
			state,
			journalType: "batch.retry_unblocked",
			journalPayload: {
				taskId,
				rowId,
				pendingSegments,
				fromPhase: phase,
			},
		});
	}

	const resumeHint = unblocked ? "spine batch resume" : "spine batch resume --force";

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		taskId,
		rowId,
		pendingSegments,
		unblocked,
		output: `Row ${taskId}[${rowId}] reset for retry (pendingSegments=${pendingSegments}); sibling rows keep their status.\n  → ${resumeHint}\n`,
	};
}

/**
 * Row-scoped matrix cancel (#230): `spine batch skip SP-X[rowId]` marks one row
 * `canceled`. Canceled rows do not execute on resume and are excluded from the
 * parent aggregation (the all-rows-must-succeed default now covers only the
 * remaining rows). Cancel the whole matrix with `spine batch skip SP-X`.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskId Parent matrix task id.
 * @param {string} params.rowId Row id inside `task.matrixRows`.
 */
export function skipTaskRow({ projectRoot, taskId, rowId }) {
	const loadedBatch = loadMutableBatch(projectRoot);
	if (!loadedBatch.ok) return loadedBatch.result;
	const state = loadedBatch.state;
	const phase = String(state.phase ?? "");

	const guard = guardPhaseForMutation({ phase, operation: "skip" });
	if (!guard.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: guard.error,
			output: guard.output,
			batchId: state.batchId,
			phase,
		};
	}

	const validation = validateBatchState(state);
	if (!validation.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: "invalid_batch_state",
			output: `Batch state validation failed:\n  ${validation.errors.join("\n  ")}\n`,
			batchId: state.batchId,
		};
	}

	const task = findTask(state, taskId);
	if (!task) {
		return {
			ok: false,
			exitCode: 1,
			error: "task_not_found",
			output: `Task ${taskId} not found in batch ${state.batchId}.\n`,
			batchId: state.batchId,
		};
	}

	const rows = Array.isArray(task.matrixRows) ? task.matrixRows : [];
	if (rows.length === 0) {
		return {
			ok: false,
			exitCode: 1,
			error: "not_a_matrix_task",
			output: `Task ${taskId} has no matrix rows — skip the whole task with \`spine batch skip ${taskId}\`.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	const row = rows.find((entry) => entry && typeof entry === "object" && entry.rowId === rowId);
	if (!row) {
		return {
			ok: false,
			exitCode: 1,
			error: "row_not_found",
			output: `Row ${taskId}[${rowId}] not found. Matrix rows: ${rows
				.map((entry) => entry?.rowId)
				.join(", ")}\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	const previousStatus = String(row.status ?? "pending");
	if (previousStatus === "succeeded") {
		return {
			ok: false,
			exitCode: 1,
			error: "row_not_cancellable",
			output: `Row ${taskId}[${rowId}] already succeeded — cannot cancel a succeeded row.\n`,
			batchId: state.batchId,
			taskId,
		};
	}
	if (previousStatus === "canceled") {
		return {
			ok: false,
			exitCode: 1,
			error: "row_not_cancellable",
			output: `Row ${taskId}[${rowId}] is already canceled.\n`,
			batchId: state.batchId,
			taskId,
		};
	}

	row.status = "canceled";
	row.exitCode = null;
	row.endedAt = Date.now();

	recordTaskTransition({
		projectRoot,
		state,
		journalType: "matrix.row_skipped",
		journalPayload: {
			taskId,
			rowId,
			previousStatus,
		},
	});

	const resumeHint = phase === "failed" ? "spine batch resume --force" : "spine batch resume";
	let output = `Row ${taskId}[${rowId}] canceled (was ${previousStatus}). It will not execute on resume and is excluded from matrix aggregation.\n`;
	const allResolved = rows.every(
		(entry) => entry && typeof entry === "object" && (entry.status === "succeeded" || entry.status === "canceled"),
	);
	if (allResolved) {
		output += `  All rows are now succeeded or canceled — retry the task to land carried-over rows.\n  → spine batch retry ${taskId}\n`;
	}
	output += `  → ${resumeHint}\n`;

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		taskId,
		rowId,
		output,
	};
}
