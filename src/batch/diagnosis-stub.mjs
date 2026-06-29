/**
 * Stub worker completion diagnosis helpers (SP-349 / GitHub #33, #40).
 */

import fs from "node:fs";
import path from "node:path";
import { isLegacyStubDoneMarker } from "./contract-verify.mjs";
import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";

export const STUB_EXIT_REASONS = new Set(["stub"]);

/**
 * Surface `exitReason: stub` when legacy `.DONE` contains `Task: stub` on M/L implementation tasks.
 *
 * @param {string} promptMarkdown
 * @param {string} doneContent
 * @returns {string|null}
 */
export function inferStubExitReasonFromDoneMarker(promptMarkdown, doneContent) {
	if (!isLegacyStubDoneMarker(doneContent)) {
		return null;
	}
	const parsed = parsePrompt(promptMarkdown);
	if (parsed.size !== "M" && parsed.size !== "L") {
		return null;
	}
	return "stub";
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {string|null} [taskFolder]
 * @returns {string|null}
 */
function resolveTaskFolder(tasksRoot, taskId, taskFolder = null) {
	if (taskFolder) {
		const direct = path.join(tasksRoot, taskFolder);
		if (fs.existsSync(direct)) return direct;
	}
	if (!tasksRoot || !fs.existsSync(tasksRoot)) return null;
	const match = fs
		.readdirSync(tasksRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${taskId}-`))
		.map((entry) => path.join(tasksRoot, entry.name))[0];
	return match ?? null;
}

/**
 * Read on-disk PROMPT/.DONE for a task and infer stub exitReason when applicable.
 *
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {string|null} [taskFolder]
 * @returns {string|null}
 */
export function inferStubExitReasonForTask(tasksRoot, taskId, taskFolder = null) {
	const folderPath = resolveTaskFolder(tasksRoot, taskId, taskFolder);
	if (!folderPath) return null;
	const donePath = path.join(folderPath, ".DONE");
	const promptPath = path.join(folderPath, "PROMPT.md");
	if (!fs.existsSync(donePath) || !fs.existsSync(promptPath)) return null;
	return inferStubExitReasonFromDoneMarker(
		fs.readFileSync(promptPath, "utf-8"),
		fs.readFileSync(donePath, "utf-8"),
	);
}

/**
 * Find a succeeded task whose legacy `.DONE` marks stub completion on M/L work.
 *
 * @param {string|null} tasksRoot
 * @param {Array<{ taskId: string, classification?: string, taskFolder?: string|null }>} tasks
 * @returns {string|null}
 */
export function findStubMarkedSucceededTask(tasksRoot, tasks) {
	if (!tasksRoot || !Array.isArray(tasks)) return null;
	for (const task of tasks) {
		if (task.classification !== "terminal-success") continue;
		const stubReason = inferStubExitReasonForTask(
			tasksRoot,
			task.taskId,
			task.taskFolder ?? null,
		);
		if (stubReason) return task.taskId;
	}
	return null;
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 */
export function buildStubFailureHeadline(batchLabel, ctx = {}) {
	return ctx.failedTaskId
		? `${batchLabel} task ${ctx.failedTaskId} stub-completed without file-scope changes`
		: `${batchLabel} stub worker completed without file-scope changes`;
}

/**
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 */
export function buildStubFailureSuggestedCommand(ctx = {}) {
	return ctx.failedTaskId
		? `unset SPINE_WORKER_STUB && spine batch retry ${ctx.failedTaskId}`
		: "unset SPINE_WORKER_STUB && spine batch resume";
}
