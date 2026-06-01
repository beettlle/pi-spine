/**
 * Append-only orchestration journal (FR-JRN, PRD §11).
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
export function journalPath(projectRoot, batchId) {
	return path.join(projectRoot, ".spine", "runtime", batchId, "journal", "events.jsonl");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} type
 * @param {Record<string, unknown>} [payload]
 */
export function appendJournalEvent(projectRoot, batchId, type, payload = {}) {
	const filePath = journalPath(projectRoot, batchId);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const entry = {
		type,
		batchId,
		timestamp: Date.now(),
		...payload,
	};
	fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf-8");
	return entry;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {object[]}
 */
export function readJournalEvents(projectRoot, batchId) {
	const filePath = journalPath(projectRoot, batchId);
	if (!fs.existsSync(filePath)) return [];

	return fs
		.readFileSync(filePath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}
