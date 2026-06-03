import fs from "node:fs";
import path from "node:path";

/** Folder name: PREFIX-###-slug (e.g. TP-007-taskplane-parsers). */
export const TASK_FOLDER_RE = /^([A-Z][A-Z0-9]*-\d{3})-([a-z0-9][a-z0-9-]*)$/;

/**
 * Discover Taskplane task packets under `{tasksRoot}/{PREFIX-###-slug}/PROMPT.md`.
 * FR-TASK-01.
 *
 * @param {string} tasksRoot Absolute or relative path to tasks root (e.g. taskplane-tasks)
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

	tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
	return tasks;
}
