/**
 * Worker progress reporter — journal task.step_completed (PRD §14.5, §18.4).
 */

import { appendJournalEvent } from "../batch/journal.mjs";

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {string} params.taskId
 * @param {number} [params.laneNumber]
 * @param {string} [params.laneId]
 * @param {number} params.step
 * @param {number} [params.checkboxesComplete]
 * @param {number} [params.checkboxesTotal]
 * @param {string} [params.correlationId]
 * @param {{ projectRoot: string, batchId: string, append?: Function }} [params.journal]
 */
export function reportTaskProgress({
	projectRoot,
	batchId,
	taskId,
	laneNumber,
	laneId,
	step,
	checkboxesComplete,
	checkboxesTotal,
	correlationId,
	journal,
}) {
	if (!projectRoot || !batchId) {
		return { ok: false, error: "batch context required (projectRoot and batchId)" };
	}
	if (!taskId) {
		return { ok: false, error: "taskId required" };
	}
	if (step == null || Number.isNaN(Number(step))) {
		return { ok: false, error: "step required" };
	}

	const append = journal?.append ?? appendJournalEvent;
	const root = journal?.projectRoot ?? projectRoot;
	const id = journal?.batchId ?? batchId;

	/** @type {Record<string, unknown>} */
	const options = {
		taskId,
		step: Number(step),
	};
	if (laneNumber != null) options.laneNumber = laneNumber;
	if (laneId) options.laneId = laneId;
	if (correlationId) options.correlationId = correlationId;
	if (checkboxesComplete != null) options.checkboxesComplete = Number(checkboxesComplete);
	if (checkboxesTotal != null) options.checkboxesTotal = Number(checkboxesTotal);

	const entry = append(root, id, "task.step_completed", options);
	return { ok: true, eventId: entry.eventId };
}
