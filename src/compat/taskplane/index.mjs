/**
 * Taskplane-compatible task packet parsers (FR-TASK-01–05).
 *
 * Usage (planner / preflight — see TP-008):
 *
 * ```js
 * import {
 *   discoverTasks,
 *   loadDependenciesJson,
 *   loadTaskPacket,
 *   mergeTaskDeps,
 * } from "./src/compat/taskplane/index.mjs";
 *
 * const tasksRoot = "taskplane-tasks";
 * const depsJson = loadDependenciesJson(tasksRoot);
 *
 * for (const discovered of discoverTasks(tasksRoot)) {
 *   const packet = loadTaskPacket(discovered.folderPath);
 *   const mergedDeps = mergeTaskDeps(
 *     { taskId: packet.prompt.taskId, prompt: packet.prompt },
 *     depsJson,
 *   );
 *   // packet.prompt.fileScope, packet.prompt.steps, mergedDeps → planner
 * }
 * ```
 *
 * Conformance: PRD §13, Taskplane reference task/status format docs.
 */

import fs from "node:fs";
import path from "node:path";

import { validatePrompt } from "./parse-prompt.mjs";
import { parseStatus } from "./parse-status.mjs";

export { discoverTasks, TASK_FOLDER_RE } from "./discover.mjs";
export {
	parsePrompt,
	parsePromptDependencies,
	validatePrompt,
	TASK_HEADING_RE,
} from "./parse-prompt.mjs";
export { parseStatus, getStepProgress, listIncompleteSteps } from "./parse-status.mjs";
export { mergeDeps, mergeTaskDeps, loadDependenciesJson } from "./merge-deps.mjs";

/**
 * Load PROMPT.md and STATUS.md for a task folder.
 *
 * @param {string} taskFolderPath Path to `{PREFIX-###-slug}/`
 */
export function loadTaskPacket(taskFolderPath) {
	const promptPath = path.join(taskFolderPath, "PROMPT.md");
	const promptMarkdown = fs.readFileSync(promptPath, "utf-8");
	const validation = validatePrompt(promptMarkdown);
	const prompt = validation.prompt;

	const statusPath = path.join(taskFolderPath, "STATUS.md");
	let status = null;
	if (fs.existsSync(statusPath)) {
		status = parseStatus(fs.readFileSync(statusPath, "utf-8"));
	}

	return {
		promptPath,
		statusPath: fs.existsSync(statusPath) ? statusPath : null,
		prompt,
		status,
		validation,
	};
}
