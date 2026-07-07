// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../spine-config-load.mjs";
import { buildPlan } from "../../planner/index.mjs";
import { formatPlanHuman } from "../../planner/format-plan.mjs";
import { RULES_MANIFEST_REL_PATH } from "../cursor-rules/discover.mjs";
import { discoverTasks } from "../../tasks/packet/discover.mjs";
import { NO_PENDING_TASKS_ERROR } from "../../planner/scope.mjs";
import { summarizePendingScope } from "../../planner/pending.mjs";
import { collectStaleFileScopeMustChangeWarnings } from "../../tasks/packet/validate-prompt.mjs";
import { parseContract, parsePrompt } from "../../tasks/packet/parse-prompt.mjs";
import { readUtf8FilesBatchSync, resolveTasksRoot } from "./discovery.mjs";

/** High-risk paths that together block lane→orch auto-resolution (issue #37). */
export const PRD_REL_PATH = "docs/PRD.md";
export const ORCH_MULTI_FILE_MERGE_RISK_PATHS = Object.freeze([
	PRD_REL_PATH,
	RULES_MANIFEST_REL_PATH,
]);

function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * @param {{ title?: string | null, missionText?: string, folderName?: string }} task
 */
export function isMergeOriginMainTask(task) {
	const haystack = `${task.title ?? ""}\n${task.missionText ?? ""}\n${task.folderName ?? ""}`.toLowerCase();
	if (/merge[-_\s]+origin[-_\s]+main/.test(haystack)) {
		return true;
	}
	return haystack.includes("origin/main") && /\bmerge\b/.test(haystack);
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function gitRefExists(projectRoot, ref) {
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], {
			cwd: projectRoot,
			stdio: ["ignore", "ignore", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 */
function resolveOriginMainRef(projectRoot) {
	for (const ref of ["origin/main", "refs/remotes/origin/main"]) {
		if (gitRefExists(projectRoot, ref)) {
			return ref;
		}
	}
	return null;
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 * @param {string} filePath
 */
function pathExistsAtRef(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: "ignore",
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} refA
 * @param {string} refB
 * @param {string} filePath
 */
function refsDifferOnPath(projectRoot, refA, refB, filePath) {
	const aExists = pathExistsAtRef(projectRoot, refA, filePath);
	const bExists = pathExistsAtRef(projectRoot, refB, filePath);
	if (!aExists && !bExists) {
		return false;
	}
	if (aExists !== bExists) {
		return true;
	}
	try {
		execFileSync("git", ["diff", "--quiet", refA, refB, "--", filePath], {
			cwd: projectRoot,
			stdio: "ignore",
			timeout: 5000,
		});
		return false;
	} catch {
		return true;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} headRef
 * @param {string} originMainRef
 */
export function listDivergentOrchMergeRiskPaths(projectRoot, headRef, originMainRef) {
	return ORCH_MULTI_FILE_MERGE_RISK_PATHS.filter((filePath) =>
		refsDifferOnPath(projectRoot, headRef, originMainRef, filePath),
	);
}

/**
 * Predict multi-file lane→orch merge conflicts when a pending task merges origin/main.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function predictOrchMergeConflictRisk(ctx) {
	const { projectRoot, configResult } = ctx;
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	const tasksRootPath = resolveTasksRoot(projectRoot, loaded);
	if (!tasksRootPath) {
		return { risky: false, reason: "no_tasks_root" };
	}

	const originMainRef = resolveOriginMainRef(projectRoot);
	if (!originMainRef) {
		return { risky: false, reason: "no_origin_main" };
	}

	const headRef = "HEAD";
	if (!gitRefExists(projectRoot, headRef)) {
		return { risky: false, reason: "no_head" };
	}

	const divergentPaths = listDivergentOrchMergeRiskPaths(projectRoot, headRef, originMainRef);
	const hasPrdDivergence = divergentPaths.includes(PRD_REL_PATH);
	const hasManifestDivergence = divergentPaths.includes(RULES_MANIFEST_REL_PATH);
	if (!hasPrdDivergence || !hasManifestDivergence) {
		return {
			risky: false,
			reason: "paths_not_divergent",
			divergentPaths,
			originMainRef,
			headRef,
		};
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
		/** @type {string[]} */
		const mergeOriginTaskIds = [];

		for (const discoveredTask of discovered) {
			if (!pendingIds.includes(discoveredTask.taskId)) continue;
			const promptMarkdown = fs.readFileSync(
				path.join(discoveredTask.folderPath, "PROMPT.md"),
				"utf-8",
			);
			const parsed = parsePrompt(promptMarkdown);
			if (
				isMergeOriginMainTask({
					title: parsed.title,
					missionText: parsed.sections.Mission ?? "",
					folderName: path.basename(discoveredTask.folderPath),
				})
			) {
				mergeOriginTaskIds.push(discoveredTask.taskId);
			}
		}

		if (mergeOriginTaskIds.length === 0) {
			return {
				risky: false,
				reason: "no_merge_origin_main_task",
				divergentPaths,
				originMainRef,
				headRef,
			};
		}

		return {
			risky: true,
			mergeOriginTaskIds,
			divergentPaths,
			originMainRef,
			headRef,
		};
	} catch (err) {
		return {
			risky: false,
			reason: "error",
			message: err?.message ?? String(err),
		};
	}
}

/**
 * Warn when pending merge-origin-main tasks predict PRD + rules-manifest orch merge conflicts.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkOrchMergeConflictWarn(ctx) {
	const risk = predictOrchMergeConflictRisk(ctx);
	if (!risk.risky) {
		const skipMessage =
			risk.reason === "no_merge_origin_main_task"
				? "no pending merge-origin-main tasks"
				: risk.reason === "no_origin_main"
					? "orch merge conflict check skipped (origin/main unavailable)"
					: "no predictable multi-file orch merge conflicts";
		return makeCheck("orch-merge-conflict", true, skipMessage);
	}

	const taskPreview = risk.mergeOriginTaskIds.slice(0, 5).join(", ");
	const pathList = risk.divergentPaths.join(", ");
	return makeCheck(
		"orch-merge-conflict",
		true,
		`pending merge-origin-main task(s) (${taskPreview}) with ${pathList} divergent between HEAD and ${risk.originMainRef} — wave merge may fail on multi-file conflicts`,
		{
			warning: true,
			details: risk,
			suggestedCommand:
				"merge origin/main into main before batch or resolve docs/PRD.md + rules-manifest drift manually",
		},
	);
}

function formatOrchMergeConflictPlanWarning(risk) {
	const taskPreview = risk.mergeOriginTaskIds.slice(0, 5).join(", ");
	const pathList = risk.divergentPaths.join(", ");
	return [
		"⚠️ Orch merge risk: pending merge-origin-main task(s)",
		`(${taskPreview}) with ${pathList} divergent between HEAD and ${risk.originMainRef}.`,
		"Wave merge may fail when automatic resolution cannot handle PRD + manifest together.",
	].join(" ");
}

/**
 * List pending tasks whose fileScopeMustChange paths already changed on main since PROMPT intro.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function listPrelandedFileScopeStaleTasks(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);
	if (!tasksRootPath) {
		return [];
	}

	const discovered = discoverTasks(tasksRootPath);
	const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
	/** @type {Array<{ taskId: string, warnings: string[] }>} */
	const staleTasks = [];
	/** @type {Array<{ discoveredTask: (typeof discovered)[number], promptPath: string }>} */
	const pendingPrompts = [];

	for (const discoveredTask of discovered) {
		if (!pendingIds.includes(discoveredTask.taskId)) continue;
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
		const parsedContract = parseContract(promptMarkdown);
		const promptRelPath = path.relative(ctx.projectRoot, promptPath);
		const warnings = collectStaleFileScopeMustChangeWarnings(
			ctx.projectRoot,
			parsedContract,
			promptRelPath,
		);
		if (warnings.length > 0) {
			staleTasks.push({ taskId: discoveredTask.taskId, warnings });
		}
	}

	return staleTasks;
}

/**
 * Warn when pending tasks have fileScopeMustChange paths already changed on main (issue #56).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkPrelandedFileScopeWarn(ctx) {
	try {
		const staleTasks = listPrelandedFileScopeStaleTasks(ctx);
		if (staleTasks.length === 0) {
			return makeCheck(
				"prelanded-file-scope",
				true,
				"no pending tasks with stale fileScopeMustChange vs main",
			);
		}

		const preview = staleTasks.map((entry) => entry.taskId).slice(0, 5).join(", ");
		const suffix = staleTasks.length > 5 ? ` (+${staleTasks.length - 5} more)` : "";
		return makeCheck(
			"prelanded-file-scope",
			true,
			`${staleTasks.length} pending task(s) with fileScopeMustChange already changed on main (${preview}${suffix})`,
			{
				warning: true,
				details: { staleTasks },
				suggestedCommand:
					"spine tasks validate pending --warnings-only; amend PROMPT ## Contract before batch start",
			},
		);
	} catch (err) {
		const message = err?.message ?? String(err);
		return makeCheck(
			"prelanded-file-scope",
			true,
			`prelanded file-scope check skipped: ${message}`,
		);
	}
}

function formatPrelandedFileScopePlanWarning(staleTasks) {
	const preview = staleTasks.map((entry) => entry.taskId).slice(0, 5).join(", ");
	return [
		"⚠️ Pre-landed contract risk: pending task(s)",
		`(${preview}) have fileScopeMustChange paths already changed on main.`,
		"Amend PROMPT ## Contract before batch start or expect contract rework loops.",
	].join(" ");
}

/**
 * @param {object} ctx
 */
export function runPreflightPlanCheck(ctx) {
	const { projectRoot, configResult } = ctx;
	const config = configResult?.config;

	if (!config || configResult?.error) {
		const msg = configResult?.error?.message ?? 'spine-config.json not initialized';
		return {
			status: "error",
			message: `Cannot build plan: ${msg}`,
		};
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRootPath) {
		return {
			status: "error",
			message: "Cannot build plan: tasksRoot not configured",
		};
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds, excludedCount } = summarizePendingScope(discovered, tasksRootPath);
		const orchMergeRisk = predictOrchMergeConflictRisk(ctx);
		const prelandedFileScopeTasks = listPrelandedFileScopeStaleTasks(ctx);
		if (pendingIds.length === 0) {
			const maxParallel = config.lanes?.maxParallel ?? 1;
			const lines = [
				"Spine plan — pending",
				`0 task(s) · 0 wave(s) · maxParallel ${maxParallel}`,
				`${excludedCount} excluded (.DONE on disk)`,
			];
			if (orchMergeRisk.risky) {
				lines.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
			}
			if (prelandedFileScopeTasks.length > 0) {
				lines.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
			}
			return {
				status: "ok",
				message: lines.join("\n"),
				details: {
					waves: 0,
					pendingCount: 0,
					excludedCount,
					orchMergeConflictRisk: orchMergeRisk,
					prelandedFileScopeTasks,
				},
			};
		}

		const plan = buildPlan({ scope: "pending", config, tasksRoot: tasksRootPath });
		const waveCount = plan.waves?.length ?? 0;
		const planText = formatPlanHuman(plan).trimEnd();
		const planWarnings = [];
		if (orchMergeRisk.risky) {
			planWarnings.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
		}
		if (prelandedFileScopeTasks.length > 0) {
			planWarnings.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
		}
		return {
			status: "ok",
			message:
				planWarnings.length > 0
					? `${planText}\n\n${planWarnings.join("\n\n")}`
					: planText,
			details: { waves: waveCount, orchMergeConflictRisk: orchMergeRisk, prelandedFileScopeTasks },
		};
	} catch (err) {
		const msg = err?.message ?? String(err);
		if (msg === NO_PENDING_TASKS_ERROR) {
			const maxParallel = config.lanes?.maxParallel ?? 1;
			const orchMergeRisk = predictOrchMergeConflictRisk(ctx);
			const prelandedFileScopeTasks = listPrelandedFileScopeStaleTasks(ctx);
			const lines = [
				"Spine plan — pending",
				`0 task(s) · 0 wave(s) · maxParallel ${maxParallel}`,
				"All discovered tasks have .DONE on disk",
			];
			if (orchMergeRisk.risky) {
				lines.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
			}
			if (prelandedFileScopeTasks.length > 0) {
				lines.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
			}
			return {
				status: "ok",
				message: lines.join("\n"),
				details: {
					waves: 0,
					pendingCount: 0,
					orchMergeConflictRisk: orchMergeRisk,
					prelandedFileScopeTasks,
				},
			};
		}
		return {
			status: "error",
			message: `Failed to build plan: ${msg}`,
		};
	}
}
