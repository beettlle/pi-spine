// @ts-nocheck
/**
 * Orch→lane sync when satisfied deps share File Scope (FR-REL231-03 / #191).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveTasksRootPath } from "../../config/env-overrides.mjs";
import { discoverTasks, loadDependenciesJson } from "../../tasks/packet/index.mjs";
import { loadTaskFileScopePaths } from "./queue.mjs";
import { syncLaneWorktreeFromOrch } from "../worktree.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [config]
 */
function resolveBatchTasksRoot(projectRoot, config) {
	return resolveTasksRootPath(projectRoot, config) ?? path.join(projectRoot, "spine-tasks");
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {object[]} [stateTasks]
 */
function resolveTaskFolderPath(tasksRoot, taskId, stateTasks = []) {
	const fromState = stateTasks.find((entry) => entry?.taskId === taskId)?.taskFolder;
	if (typeof fromState === "string" && fromState.trim() && fs.existsSync(fromState)) {
		return fromState;
	}
	if (!fs.existsSync(tasksRoot)) return null;
	const match = discoverTasks(tasksRoot).find((entry) => entry.taskId === taskId);
	return match?.folderPath ?? null;
}

/**
 * Satisfied deps that share at least one File Scope path with the current task.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.taskId
 * @param {string[]} params.fileScopePaths
 * @param {object} [params.config]
 * @returns {Array<{ depId: string, overlap: string[] }>}
 */
export function collectSharedScopeSatisfiedDeps({
	projectRoot,
	state,
	taskId,
	fileScopePaths,
	config = {},
}) {
	if (!Array.isArray(fileScopePaths) || fileScopePaths.length === 0) return [];

	const tasksRoot = resolveBatchTasksRoot(projectRoot, config);
	const deps = loadDependenciesJson(tasksRoot).tasks?.[taskId] ?? [];
	if (!Array.isArray(deps) || deps.length === 0) return [];

	const scopeSet = new Set(fileScopePaths);
	const stateTasks = Array.isArray(state?.tasks) ? state.tasks : [];
	/** @type {Array<{ depId: string, overlap: string[] }>} */
	const shared = [];

	for (const depId of deps) {
		const depTask = stateTasks.find((entry) => entry?.taskId === depId);
		if (!depTask || depTask.status !== "succeeded") continue;

		const depFolder = resolveTaskFolderPath(tasksRoot, depId, stateTasks);
		if (!depFolder) continue;

		const scopeResult = loadTaskFileScopePaths(depFolder);
		if (!scopeResult.ok) continue;

		const overlap = (scopeResult.fileScopePaths ?? []).filter((filePath) =>
			scopeSet.has(filePath),
		);
		if (overlap.length > 0) {
			shared.push({ depId, overlap });
		}
	}

	return shared;
}

/**
 * @param {object} params
 * @returns {{ ok: true, synced: boolean, skipped?: boolean, sharedDeps: Array<{ depId: string, overlap: string[] }>, headSha?: string } | { ok: false, error: string, sharedDeps: Array<{ depId: string, overlap: string[] }> }}
 */
export function ensureLaneSyncedForSharedScopeDeps({
	projectRoot,
	state,
	taskId,
	fileScopePaths,
	worktreePath,
	config = {},
}) {
	const sharedDeps = collectSharedScopeSatisfiedDeps({
		projectRoot,
		state,
		taskId,
		fileScopePaths,
		config,
	});
	if (sharedDeps.length === 0) {
		return { ok: true, synced: false, skipped: true, sharedDeps };
	}

	try {
		const result = syncLaneWorktreeFromOrch({
			worktreePath,
			orchBranch: state?.orchBranch,
			projectRoot,
		});
		return {
			ok: true,
			synced: !result.skipped,
			skipped: result.skipped,
			sharedDeps,
			headSha: result.headSha,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message, sharedDeps };
	}
}
