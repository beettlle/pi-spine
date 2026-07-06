// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

import { parsePromptDependencies } from "./parse-prompt.mjs";

/**
 * Merge PROMPT dependencies with dependencies.json entry.
 * FR-TASK-05: union; when both sources define different ID sets, JSON wins.
 *
 * @param {string} taskId
 * @param {string[]} promptDeps
 * @param {{ tasks?: Record<string, string[]> }} dependenciesJson
 * @returns {string[]}
 */
export function mergeDeps(taskId, promptDeps, dependenciesJson) {
	const jsonDeps = dependenciesJson?.tasks?.[taskId];
	if (jsonDeps === undefined) {
		return [...promptDeps];
	}

	const promptSet = new Set(promptDeps);
	const jsonSet = new Set(jsonDeps);

	if (promptSet.size === 0) {
		return [...jsonDeps];
	}

	if (jsonSet.size === 0) {
		return [...promptDeps];
	}

	const sameSet =
		promptSet.size === jsonSet.size && [...promptSet].every((id) => jsonSet.has(id));

	if (sameSet) {
		return uniqueOrdered([...promptDeps, ...jsonDeps]);
	}

	return [...jsonDeps];
}

/**
 * @param {{ dependenciesSection?: string, prompt?: { dependencies: string[] }, taskId: string }} task
 * @param {{ tasks?: Record<string, string[]> }} dependenciesJson
 */
export function mergeTaskDeps(task, dependenciesJson) {
	const promptDeps =
		task.prompt?.dependencies ??
		(task.dependenciesSection
			? parsePromptDependencies(task.dependenciesSection)
			: []);
	return mergeDeps(task.taskId, promptDeps, dependenciesJson);
}

/**
 * @param {string} tasksRoot
 */
export function loadDependenciesJson(tasksRoot) {
	const filePath = path.join(tasksRoot, "dependencies.json");
	if (!fs.existsSync(filePath)) {
		return { tasks: {} };
	}
	const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	return {
		version: raw.version,
		tasks: raw.tasks ?? {},
	};
}

function uniqueOrdered(ids) {
	const seen = new Set();
	const result = [];
	for (const id of ids) {
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(id);
	}
	return result;
}
