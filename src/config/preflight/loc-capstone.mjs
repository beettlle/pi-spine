// @ts-nocheck
/**
 * LOC-capstone / empty-grandfather readiness (FR-REL231-04 / #192).
 *
 * Blocks scheduling when a pending task would empty PHASE23_GRANDFATHERED_OVER_500
 * while batch-loc-policy would still fail after that change.
 */
import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "../spine-config-load.mjs";
import { discoverTasks } from "../../tasks/packet/discover.mjs";
import { summarizePendingScope } from "../../planner/pending.mjs";
import { parsePrompt } from "../../tasks/packet/parse-prompt.mjs";
import { readUtf8FilesBatchSync, resolveTasksRoot } from "./discovery.mjs";

export const BATCH_MODULE_LOC_LIMIT = 500;
export const VERIFY_MJS_REL = "bin/spine-cli/verify.mjs";

function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * Count lines in each `src/batch/*.mjs` module (same basis as batch-loc-policy).
 *
 * @param {string} projectRoot
 * @returns {Array<{ relPath: string, lines: number }>}
 */
export function listBatchModuleLineCounts(projectRoot) {
	const batchDir = path.join(projectRoot, "src/batch");
	if (!fs.existsSync(batchDir)) return [];

	return fs
		.readdirSync(batchDir)
		.filter((name) => name.endsWith(".mjs"))
		.map((name) => {
			const relPath = path.posix.join("src/batch", name);
			const absPath = path.join(batchDir, name);
			const lines = fs.readFileSync(absPath, "utf-8").split(/\r?\n/).length;
			return { relPath, lines };
		})
		.sort((left, right) => left.relPath.localeCompare(right.relPath));
}

/**
 * Evaluate batch-loc-policy without mutating the grandfather list.
 *
 * @param {string} projectRoot
 * @param {{ grandfathered?: string[] }} [options]
 * @returns {{ ok: boolean, overLimit: Array<{ relPath: string, lines: number }>, ungrandfathered: Array<{ relPath: string, lines: number }> }}
 */
export function evaluateBatchLocPolicy(projectRoot, options = {}) {
	const grandfathered = options.grandfathered ?? [];
	const grandfatheredSet = new Set(grandfathered);
	const modules = listBatchModuleLineCounts(projectRoot);
	const overLimit = modules.filter((entry) => entry.lines > BATCH_MODULE_LOC_LIMIT);
	const ungrandfathered = overLimit.filter((entry) => !grandfatheredSet.has(entry.relPath));
	return {
		ok: ungrandfathered.length === 0,
		overLimit,
		ungrandfathered,
	};
}

/**
 * Simulate emptying PHASE23_GRANDFATHERED_OVER_500 (evaluate with empty allow-list).
 *
 * @param {string} projectRoot
 */
export function evaluateBatchLocPolicyAfterEmptyGrandfather(projectRoot) {
	return evaluateBatchLocPolicy(projectRoot, { grandfathered: [] });
}

/**
 * @param {{ title?: string | null, missionText?: string, fileScope?: string[], folderName?: string }} task
 */
export function isLocCapstoneEmptyGrandfatherMission(task) {
	const title = task.title ?? "";
	const missionText = task.missionText ?? "";
	const folderName = task.folderName ?? "";
	const fileScope = Array.isArray(task.fileScope) ? task.fileScope : [];
	const haystack = `${title}\n${missionText}\n${folderName}`;

	// Readiness / blocker packets mention emptying but must not self-trigger.
	if (/\breadiness\b/i.test(haystack) && /\b(block|gate|must not)\b/i.test(haystack)) {
		return false;
	}

	if (/grandfather[-_]list[-_]empty|empty[-_]grandfather/i.test(folderName)) {
		return true;
	}

	if (/\bempty\s+PHASE23_GRANDFATHERED_OVER_500\b/i.test(haystack)) {
		return true;
	}

	if (/remove\s+all\s+entries\s+from[\s`*]*PHASE23_GRANDFATHERED_OVER_500/i.test(haystack)) {
		return true;
	}

	if (/set\s+[`'*]?PHASE23_GRANDFATHERED_OVER_500[`'*]?\s+to\s+[`'*]?\[\s*\]/i.test(haystack)) {
		return true;
	}

	const touchesVerify = fileScope.some(
		(entry) =>
			entry === VERIFY_MJS_REL ||
			entry.endsWith(`/${VERIFY_MJS_REL}`) ||
			entry.includes("bin/spine-cli/verify.mjs"),
	);
	if (
		touchesVerify &&
		/PHASE23_GRANDFATHERED_OVER_500/.test(haystack) &&
		/\b(empty(?:ing)?|clear(?:ing)?)\b/i.test(haystack) &&
		!/\bmust not\b/i.test(haystack)
	) {
		return true;
	}

	return false;
}

/**
 * Format over-limit modules for operator-facing errors.
 *
 * @param {Array<{ relPath: string, lines: number }>} modules
 */
export function formatOverLimitModules(modules) {
	return modules.map((entry) => `${entry.relPath} (${entry.lines})`).join(", ");
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 * @returns {Array<{ taskId: string, title: string | null, folderName: string }>}
 */
export function listPendingLocCapstoneTasks(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);
	if (!tasksRootPath) {
		return [];
	}

	const discovered = discoverTasks(tasksRootPath);
	const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
	const pendingIdSet = new Set(pendingIds);
	/** @type {Array<{ discoveredTask: (typeof discovered)[number], promptPath: string }>} */
	const pendingPrompts = [];

	for (const discoveredTask of discovered) {
		if (!pendingIdSet.has(discoveredTask.taskId)) continue;
		pendingPrompts.push({
			discoveredTask,
			promptPath: path.join(discoveredTask.folderPath, "PROMPT.md"),
		});
	}

	const promptContents = readUtf8FilesBatchSync(
		pendingPrompts.map((entry) => entry.promptPath),
	);

	/** @type {Array<{ taskId: string, title: string | null, folderName: string }>} */
	const matches = [];
	for (const { discoveredTask, promptPath } of pendingPrompts) {
		const markdown = promptContents.get(promptPath) ?? "";
		const prompt = parsePrompt(markdown);
		const missionText = prompt.sections?.Mission ?? "";
		if (
			!isLocCapstoneEmptyGrandfatherMission({
				title: prompt.title,
				missionText,
				fileScope: prompt.fileScope,
				folderName: path.basename(discoveredTask.folderPath),
			})
		) {
			continue;
		}
		matches.push({
			taskId: discoveredTask.taskId,
			title: prompt.title,
			folderName: path.basename(discoveredTask.folderPath),
		});
	}

	return matches;
}

/**
 * Fail closed when a pending LOC-capstone would empty the grandfather list
 * while any src/batch/*.mjs still exceeds the LOC limit.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkLocCapstoneReadiness(ctx) {
	try {
		const capstoneTasks = listPendingLocCapstoneTasks(ctx);
		if (capstoneTasks.length === 0) {
			return makeCheck(
				"loc-capstone-readiness",
				true,
				"no pending empty-grandfather / LOC-capstone tasks",
			);
		}

		const policy = evaluateBatchLocPolicyAfterEmptyGrandfather(ctx.projectRoot);
		const taskPreview = capstoneTasks.map((task) => task.taskId).join(", ");
		if (policy.ok) {
			return makeCheck(
				"loc-capstone-readiness",
				true,
				`LOC-capstone ready (${taskPreview}): batch-loc-policy would pass with empty grandfather`,
				{ details: { taskIds: capstoneTasks.map((task) => task.taskId) } },
			);
		}

		const moduleList = formatOverLimitModules(policy.ungrandfathered);
		return makeCheck(
			"loc-capstone-readiness",
			false,
			`LOC-capstone not ready (${taskPreview}): emptying PHASE23_GRANDFATHERED_OVER_500 would fail batch-loc-policy — still over ${BATCH_MODULE_LOC_LIMIT} LOC: ${moduleList}`,
			{
				details: {
					taskIds: capstoneTasks.map((task) => task.taskId),
					overLimitModules: policy.ungrandfathered,
				},
				suggestedCommand:
					"Split remaining src/batch/*.mjs modules to ≤500 LOC before scheduling the empty-grandfather / LOC-capstone task",
			},
		);
	} catch (err) {
		const message = err?.message ?? String(err);
		return makeCheck(
			"loc-capstone-readiness",
			false,
			`LOC-capstone readiness check failed closed: ${message}`,
			{ suggestedCommand: "spine preflight" },
		);
	}
}

/**
 * Planner-time assert: throw when selected tasks include a blocked LOC-capstone.
 *
 * @param {object} args
 * @param {string} args.projectRoot
 * @param {Array<{ taskId: string, title?: string | null, fileScope?: string[], missionText?: string, folderName?: string }>} args.tasks
 */
export function assertLocCapstoneReadinessForPlan({ projectRoot, tasks }) {
	const capstoneTasks = tasks.filter((task) =>
		isLocCapstoneEmptyGrandfatherMission({
			title: task.title,
			missionText: task.missionText ?? "",
			fileScope: task.fileScope,
			folderName: task.folderName ?? task.taskId,
		}),
	);
	if (capstoneTasks.length === 0) {
		return;
	}

	const policy = evaluateBatchLocPolicyAfterEmptyGrandfather(projectRoot);
	if (policy.ok) {
		return;
	}

	const taskPreview = capstoneTasks.map((task) => task.taskId).join(", ");
	const moduleList = formatOverLimitModules(policy.ungrandfathered);
	throw new Error(
		`LOC-capstone not ready (${taskPreview}): emptying PHASE23_GRANDFATHERED_OVER_500 would fail batch-loc-policy — still over ${BATCH_MODULE_LOC_LIMIT} LOC: ${moduleList}`,
	);
}
