// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadSpineConfig } from "../spine-config-load.mjs";
import { resolveTasksRootPath } from "../env-overrides.mjs";
import { validateWorktreeSetupHookConfig } from "../worktree-setup-hook.mjs";
import { discoverTasks } from "../../tasks/packet/discover.mjs";
import { NO_PENDING_TASKS_ERROR } from "../../planner/scope.mjs";
import { summarizePendingScope } from "../../planner/pending.mjs";
import { validatePrompt } from "../../tasks/packet/validate-prompt.mjs";

const DEPENDENCIES_SCHEMA_VERSION = 1;
const TASK_ID_PATTERN = /^[A-Z]{2,}-\d{3,}$/;

function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function resolveTasksRoot(projectRoot, configResult) {
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	if (!loaded.config) {
		return null;
	}
	return resolveTasksRootPath(projectRoot, loaded.config);
}

export function taskIdFromFolder(folderName) {
	const match = String(folderName).match(/^([A-Z]{2,}-\d{3,})/);
	return match?.[1] ?? null;
}

export function discoverTaskFolders(tasksRootPath) {
	if (!tasksRootPath || !fs.existsSync(tasksRootPath)) return [];

	return fs
		.readdirSync(tasksRootPath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => fs.existsSync(path.join(tasksRootPath, name, "PROMPT.md")))
		.sort();
}

export function discoverTaskIds(tasksRootPath) {
	return [...new Set(discoverTaskFolders(tasksRootPath).map(taskIdFromFolder).filter(Boolean))].sort();
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkTasksRoot(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);

	if (!tasksRootPath) {
		return makeCheck("tasks-root", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	if (!fs.existsSync(tasksRootPath)) {
		return makeCheck(
			"tasks-root",
			false,
			`tasks root missing: ${path.relative(ctx.projectRoot, tasksRootPath)}`,
			{
				suggestedCommand: `mkdir -p ${path.relative(ctx.projectRoot, tasksRootPath)}`,
			},
		);
	}

	const taskFolders = discoverTaskFolders(tasksRootPath);
	if (taskFolders.length === 0) {
		return makeCheck("tasks-root", false, "no discoverable task folders (PROMPT.md)", {
			details: { tasksRootPath: path.relative(ctx.projectRoot, tasksRootPath) },
			suggestedCommand: "spine init",
		});
	}

	return makeCheck(
		"tasks-root",
		true,
		`tasks root valid (${taskFolders.length} task folder(s))`,
		{
			details: {
				tasksRootPath: path.relative(ctx.projectRoot, tasksRootPath),
				taskFolders,
			},
		},
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkDependenciesJson(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);

	if (!tasksRootPath) {
		return makeCheck("dependencies-json", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	const depsPath = path.join(tasksRootPath, "dependencies.json");
	if (!fs.existsSync(depsPath)) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json missing: ${path.relative(ctx.projectRoot, depsPath)}`,
			{ suggestedCommand: "spine init" },
		);
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
	} catch (err) {
		return makeCheck("dependencies-json", false, `cannot parse dependencies.json: ${err.message}`, {
			suggestedCommand: "spine init",
		});
	}

	if (parsed.version !== DEPENDENCIES_SCHEMA_VERSION) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json version must be ${DEPENDENCIES_SCHEMA_VERSION} (found ${parsed.version ?? "missing"})`,
			{ suggestedCommand: "spine init" },
		);
	}

	if (typeof parsed.tasks !== "object" || parsed.tasks === null || Array.isArray(parsed.tasks)) {
		return makeCheck("dependencies-json", false, "dependencies.json tasks must be an object", {
			suggestedCommand: "spine init",
		});
	}

	const taskIds = Object.keys(parsed.tasks);
	const invalidIds = taskIds.filter((id) => !TASK_ID_PATTERN.test(id));
	if (invalidIds.length > 0) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json has invalid task IDs: ${invalidIds.slice(0, 5).join(", ")}`,
			{ details: { invalidIds }, suggestedCommand: "spine init --tasks-root taskplane-tasks" },
		);
	}

	const discovered = new Set(discoverTaskIds(tasksRootPath));
	const unknownIds = taskIds.filter((id) => !discovered.has(id));
	if (unknownIds.length > 0) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json references unknown task folders: ${unknownIds.slice(0, 5).join(", ")}`,
			{ details: { unknownIds }, suggestedCommand: "spine init --tasks-root taskplane-tasks" },
		);
	}

	return makeCheck(
		"dependencies-json",
		true,
		`dependencies.json valid (${taskIds.length} task(s))`,
		{ details: { path: path.relative(ctx.projectRoot, depsPath), taskIds } },
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkWorktreeSetupHook(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const config = configResult?.config;
	if (!config || configResult?.error) {
		return makeCheck("worktree-setup-hook", true, "worktree setup hook not configured");
	}

	const hookError = validateWorktreeSetupHookConfig(config, ctx.projectRoot);
	if (hookError) {
		return makeCheck("worktree-setup-hook", false, hookError.message, {
			suggestedCommand: hookError.suggestedCommand,
		});
	}

	if (!config.worktreeSetupHook) {
		return makeCheck("worktree-setup-hook", true, "worktree setup hook not configured");
	}

	return makeCheck("worktree-setup-hook", true, "worktree setup hook path valid");
}

/**
 * Read multiple UTF-8 text files concurrently in a child process (sync parent API).
 *
 * @param {string[]} filePaths
 * @returns {Map<string, string>}
 */
export function readUtf8FilesBatchSync(filePaths) {
	const uniquePaths = [...new Set(filePaths)];
	if (uniquePaths.length === 0) {
		return new Map();
	}

	const child = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`const paths = JSON.parse(process.argv[1]);
const fs = await import("node:fs/promises");
const entries = await Promise.all(
	paths.map(async (filePath) => [filePath, await fs.readFile(filePath, "utf-8")]),
);
process.stdout.write(JSON.stringify(entries));`,
			JSON.stringify(uniquePaths),
		],
		{
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		},
	);

	if (child.error) {
		throw child.error;
	}
	if (child.status !== 0) {
		throw new Error(child.stderr?.trim() || `batch read failed with status ${child.status}`);
	}

	/** @type {[string, string][]} */
	const entries = JSON.parse(child.stdout);
	return new Map(entries);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkTasksValidate(ctx) {
	const { projectRoot, configResult } = ctx;
	const config = configResult?.config;

	if (!config || configResult?.error) {
		return makeCheck("tasks-validate", false, "cannot validate tasks without spine config", {
			suggestedCommand: "spine init",
		});
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRootPath) {
		return makeCheck("tasks-validate", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
		if (pendingIds.length === 0) {
			return makeCheck(
				"tasks-validate",
				true,
				"no pending tasks (all discovered tasks have .DONE)",
			);
		}

		const selectedTaskIds = new Set(pendingIds);
		/** @type {string[]} */
		const failures = [];
		/** @type {Array<{ discoveredTask: (typeof discovered)[number], promptPath: string }>} */
		const pendingPrompts = [];

		for (const discoveredTask of discovered) {
			if (!selectedTaskIds.has(discoveredTask.taskId)) continue;
			pendingPrompts.push({
				discoveredTask,
				promptPath: path.join(discoveredTask.folderPath, "PROMPT.md"),
			});
		}

		const promptContents = readUtf8FilesBatchSync(
			pendingPrompts.map((entry) => entry.promptPath),
		);

		for (const { discoveredTask, promptPath } of pendingPrompts) {
			const promptMarkdown = promptContents.get(promptPath);
			const validation = validatePrompt(promptMarkdown, {
				taskId: discoveredTask.taskId,
				contract: config.contract,
			});
			if (!validation.ok) {
				failures.push(
					`${discoveredTask.taskId}: ${validation.errors[0] ?? "invalid PROMPT packet"}`,
				);
			}
		}

		if (failures.length === 0) {
			return makeCheck("tasks-validate", true, "pending task PROMPT packets valid");
		}

		return makeCheck("tasks-validate", false, failures[0], {
			suggestedCommand: "spine tasks validate pending",
			details: { failures },
		});
	} catch (err) {
		const message = err?.message ?? String(err);
		if (message === NO_PENDING_TASKS_ERROR) {
			return makeCheck(
				"tasks-validate",
				true,
				"no pending tasks (all discovered tasks have .DONE)",
			);
		}
		return makeCheck("tasks-validate", false, `tasks validate failed: ${message}`, {
			suggestedCommand: "spine tasks validate pending",
		});
	}
}
