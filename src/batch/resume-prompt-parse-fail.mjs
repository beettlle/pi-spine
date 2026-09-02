// @ts-nocheck
/**
 * Single-lane resume prompt-parse failure path.
 * Extracted from resume.mjs to keep that module under the 500 LOC cap.
 */

import { appendJournalEvent } from "./journal.mjs";
import { saveSpineBatchState, updateSegmentForTask } from "./state.mjs";

/**
 * Persist prompt-parse failure for a resumed single-lane task and return the
 * resumeBatch-shaped error result.
 *
 * @param {{
 *   projectRoot: string,
 *   state: object,
 *   batchId: string,
 *   task: object,
 *   taskId: string,
 *   scopeResult: { error?: string, errors?: unknown, promptPath?: string },
 *   releaseResumeLock?: (() => void) | null,
 *   laneCorrelationId: string,
 * }} params
 */
export function failResumePromptParse({
	projectRoot,
	state,
	batchId,
	task,
	taskId,
	scopeResult,
	releaseResumeLock,
	laneCorrelationId,
}) {
	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = "prompt_parse_failed";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "failed");
	state.failedTasks = 1;
	state.succeededTasks = 0;
	state.endedAt = Date.now();
	state.lastError = scopeResult.error?.slice(0, 500) ?? "prompt parse failed";
	state.phase = "failed";
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.prompt_parse_failed", {
		taskId,
		laneNumber: 1,
		laneId: "lane-1",
		correlationId: laneCorrelationId,
		error: scopeResult.error,
		errors: scopeResult.errors,
		promptPath: scopeResult.promptPath,
		resumed: true,
	});
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber: 1,
		laneId: "lane-1",
		correlationId: laneCorrelationId,
		classification: "prompt_parse_failed",
		exitCode: 1,
		output: scopeResult.error,
		resumed: true,
	});
	releaseResumeLock?.();
	return {
		ok: false,
		exitCode: 1,
		batchId,
		taskId,
		error: "prompt_parse_failed",
		output: scopeResult.error,
	};
}
