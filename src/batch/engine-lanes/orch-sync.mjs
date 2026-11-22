/**
 * Orch→lane sync when satisfied deps share File Scope (FR-REL231-03 / #191).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveTasksRootPath } from "../../config/env-overrides.mjs";
import { discoverTasks, loadDependenciesJson } from "../../tasks/packet/index.mjs";
import { loadTaskFileScopePaths } from "./queue.mjs";
import { syncLaneWorktreeFromOrch } from "../worktree.mjs";
import { gitExec } from "../git-exec.mjs";

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} config
 */
function resolveBatchTasksRoot(projectRoot, config) {
	return resolveTasksRootPath(projectRoot, config) ?? path.join(projectRoot, "spine-tasks");
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {Array<Record<string, any>>} [stateTasks]
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
 * @param {Record<string, any>} params.state
 * @param {string} params.taskId
 * @param {string[]} params.fileScopePaths
 * @param {Record<string, any>} [params.config]
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
	/** @type {{ tasks?: Record<string, string[]> }} */
	const depsIndex = loadDependenciesJson(tasksRoot);
	const deps = depsIndex.tasks?.[taskId] ?? [];
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
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.taskId
 * @param {string[]} params.fileScopePaths
 * @param {string} params.worktreePath
 * @param {Record<string, any>} [params.config]
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

/**
 * Packet files refreshed from the base tasks root into the lane worktree on
 * whole-task retry (#378). PROMPT.md carries the Contract the next worker run
 * is parsed and verified against. STATUS.md stays lane-owned (worker progress
 * + resume state) and is never overwritten by retry.
 */
const PACKET_REFRESH_FILES = ["PROMPT.md"];

/**
 * Resolve the base packet folder for a task. Prefers `state.tasks[].taskFolder`
 * (absolute as authored by `discoverTasks`; relative values resolve against
 * `projectRoot`, since cwd may differ), then falls back to discovering the
 * task in the tasks root.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.tasksRoot
 * @param {Array<Record<string, any>>} params.stateTasks
 * @param {string} params.taskId
 * @returns {string | null}
 */
function resolveBasePacketFolder({ projectRoot, tasksRoot, stateTasks, taskId }) {
	const fromState = stateTasks.find((entry) => entry?.taskId === taskId)?.taskFolder;
	if (typeof fromState === "string" && fromState.trim()) {
		const candidate = path.isAbsolute(fromState) ? fromState : path.join(projectRoot, fromState);
		if (fs.existsSync(candidate)) return candidate;
	}
	if (!fs.existsSync(tasksRoot)) return null;
	const match = discoverTasks(tasksRoot).find((entry) => entry.taskId === taskId);
	return match?.folderPath ?? null;
}

/**
 * Refresh operator-edited packet files from the base tasks root into the lane
 * worktree before a retried task re-runs (#378). `retryTask` resets batch
 * state, but the lane worktree keeps the packet copy the failed run saw — an
 * operator fix on base would never reach the next worker run (which reads
 * `PROMPT.md` from `taskFolderInWorktree`), so `contract_failed` repeats.
 *
 * Best-effort by design: any missing path (no base packet, no lane worktree,
 * no lane packet folder) skips the refresh without failing the retry. When a
 * file does change, it is copied and committed with a pathspec limited to the
 * packet file, so uncommitted lane product work from the failed run stays
 * untouched.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.taskId
 * @param {Record<string, any>} [params.task] Live task entry (for laneNumber).
 * @param {Record<string, any>} [params.config]
 * @returns {{ ok: boolean, refreshed: Array<{ file: string, committed: boolean, commitSha: string | null }>, skipped: string | null, error: string | null }}
 */
export function refreshTaskPacketFromBase({ projectRoot, state, taskId, task, config = {} }) {
	try {
		const tasksRoot = resolveBatchTasksRoot(projectRoot, config);
		const stateTasks = Array.isArray(state?.tasks) ? state.tasks : [];
		const baseFolder = resolveBasePacketFolder({ projectRoot, tasksRoot, stateTasks, taskId });
		if (!baseFolder) {
			return { ok: true, refreshed: [], skipped: "base_packet_missing", error: null };
		}
		const taskFolderRel = path.relative(projectRoot, baseFolder);
		if (!taskFolderRel || taskFolderRel.startsWith("..") || path.isAbsolute(taskFolderRel)) {
			return { ok: true, refreshed: [], skipped: "base_packet_outside_project", error: null };
		}

		const laneNumber = Number(task?.laneNumber ?? 1);
		const worktreePath = (Array.isArray(state?.lanes) ? state.lanes : []).find(
			(entry) => Number(entry?.laneNumber ?? -1) === laneNumber,
		)?.worktreePath;
		if (!worktreePath || !fs.existsSync(worktreePath)) {
			return { ok: true, refreshed: [], skipped: "lane_worktree_missing", error: null };
		}
		const lanePacketFolder = path.join(worktreePath, taskFolderRel);
		if (!fs.existsSync(lanePacketFolder)) {
			return { ok: true, refreshed: [], skipped: "lane_packet_missing", error: null };
		}

		/** @type {Array<{ file: string, committed: boolean, commitSha: string | null }>} */
		const refreshed = [];
		for (const file of PACKET_REFRESH_FILES) {
			const baseFilePath = path.join(baseFolder, file);
			const laneFilePath = path.join(lanePacketFolder, file);
			if (!fs.existsSync(baseFilePath) || !fs.existsSync(laneFilePath)) continue;
			const baseContent = fs.readFileSync(baseFilePath, "utf-8");
			if (fs.readFileSync(laneFilePath, "utf-8") === baseContent) continue;

			fs.writeFileSync(laneFilePath, baseContent, "utf-8");
			const rel = `${taskFolderRel.replace(/\\/g, "/")}/${file}`;
			gitExec(worktreePath, ["add", "--", rel], { projectRoot });
			const committed =
				gitExec(
					worktreePath,
					["commit", "-m", `sync packet from base before retry (${taskId})`, "--", rel],
					{ throwOnError: false, projectRoot },
				) !== null;
			const commitSha = committed
				? gitExec(worktreePath, ["rev-parse", "HEAD"], { projectRoot })
				: null;
			refreshed.push({ file, committed, commitSha });
		}
		return { ok: true, refreshed, skipped: null, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, refreshed: [], skipped: null, error: message };
	}
}
