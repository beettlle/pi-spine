import fs from "node:fs";
import path from "node:path";

/**
 * Canonical task-ID discovery patterns (single source of truth).
 * Closes #300: every discovery site (planner, preflight, worker runner)
 * derives its patterns from here so SP-1000+ is found, sorted numerically,
 * and non-task folders (`_explore`, `_authoring`, `_archive`) are excluded.
 */

/** Source pattern for a task ID (PREFIX-###, three or more digits), for embedding in larger regexes. */
export const TASK_ID_PATTERN_SOURCE = "[A-Z][A-Z0-9]*-\\d{3,}";

/** Task ID: PREFIX-### (e.g. TP-007, SP-1000). Keeps the planner's existing prefix rule. */
export const TASK_ID_RE = new RegExp(`^${TASK_ID_PATTERN_SOURCE}$`);

/** Folder name: PREFIX-###-slug (e.g. TP-007-taskplane-parsers). */
export const TASK_FOLDER_RE = new RegExp(
	`^(${TASK_ID_PATTERN_SOURCE})-([a-z0-9][a-z0-9-]*)$`,
);

/** Prefix + digits of a conforming task ID, for numeric comparison. */
const TASK_ID_PARTS_RE = /^([A-Z][A-Z0-9]*)-(\d{3,})$/;

/**
 * Extract the task ID from a folder name (PREFIX-###-slug or bare PREFIX-###).
 * Returns null when the name is not a task folder (e.g. `_explore`).
 *
 * @param {string} name Folder name or path segment
 * @returns {string | null}
 */
export function taskIdFromFolderName(name) {
	const base = String(name ?? "").split("/").pop() ?? "";
	const folder = TASK_FOLDER_RE.exec(base);
	if (folder) return folder[1];
	const bare = TASK_ID_RE.exec(base);
	return bare ? bare[0] : null;
}

/**
 * Compare two task IDs: prefix first, then digits numerically.
 * Non-conforming IDs sort after conforming ones, by string.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareTaskIds(a, b) {
	const pa = TASK_ID_PARTS_RE.exec(String(a ?? ""));
	const pb = TASK_ID_PARTS_RE.exec(String(b ?? ""));
	if (pa && pb) {
		if (pa[1] !== pb[1]) return pa[1].localeCompare(pb[1]);
		const da = Number(pa[2]);
		const db = Number(pb[2]);
		if (da !== db) return da - db;
		return 0;
	}
	if (pa) return -1;
	if (pb) return 1;
	return String(a ?? "").localeCompare(String(b ?? ""));
}

/**
 * Discover Taskplane task packets under `{tasksRoot}/{PREFIX-###-slug}/PROMPT.md`.
 * FR-TASK-01. Results sort numerically: SP-099 < SP-999 < SP-1000.
 *
 * @param {string} tasksRoot Absolute or relative path to tasks root (e.g. spine-tasks)
 * @returns {Array<{ taskId: string, slug: string, folderName: string, folderPath: string, promptPath: string }>}
 */
export function discoverTasks(tasksRoot) {
	const entries = fs.readdirSync(tasksRoot, { withFileTypes: true });
	const tasks = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const match = TASK_FOLDER_RE.exec(entry.name);
		if (!match) continue;

		const [, taskId, slug] = match;
		const folderPath = path.join(tasksRoot, entry.name);
		const promptPath = path.join(folderPath, "PROMPT.md");
		if (!fs.existsSync(promptPath)) continue;

		tasks.push({
			taskId,
			slug,
			folderName: entry.name,
			folderPath,
			promptPath,
		});
	}

	tasks.sort((a, b) => compareTaskIds(a.taskId, b.taskId));
	return tasks;
}
