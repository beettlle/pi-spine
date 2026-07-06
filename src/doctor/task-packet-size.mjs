/**
 * Doctor warnings for oversized task packets (SP-086).
 */

import fs from "node:fs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { loadTaskPacket } from "../tasks/packet/index.mjs";
import { parseSizeLineFromMarkdown } from "../tasks/packet/size-line.mjs";

const MAX_IMPLEMENTATION_STEPS = 4;
const MAX_FILE_SCOPE_ENTRIES = 8;

/**
 * @param {string} folderPath
 */
function isPendingTask(folderPath) {
	return !fs.existsSync(`${folderPath}/.DONE`);
}

/**
 * @param {object} prompt
 */
function countImplementationSteps(prompt) {
	return (prompt.steps ?? []).filter(
		(step) => !/testing|verification|documentation|delivery/i.test(step.title),
	).length;
}

/**
 * @param {object} params
 * @param {string} params.tasksRoot
 */
export function collectTaskPacketSizeIssues({ tasksRoot }) {
	if (!tasksRoot || !fs.existsSync(tasksRoot)) {
		return [];
	}

	/** @type {string[]} */
	const issues = [];
	for (const discovered of discoverTasks(tasksRoot)) {
		if (!isPendingTask(discovered.folderPath)) continue;

		const promptMarkdown = fs.readFileSync(discovered.promptPath, "utf-8");
		const size = parseSizeLineFromMarkdown(promptMarkdown);

		const packet = loadTaskPacket(discovered.folderPath);
		if (!packet.validation?.ok) {
			if (size === "XL") {
				issues.push(`${discovered.taskId}: Size XL — must split into multiple tasks`);
			}
			for (const err of packet.validation?.errors ?? []) {
				if (/Size XL/i.test(err)) {
					issues.push(`${discovered.taskId}: ${err}`);
				}
			}
			continue;
		}

		const prompt = packet.prompt;
		const implSteps = countImplementationSteps(prompt);
		const fileScopeCount = prompt.fileScope?.length ?? 0;

		if (size === "XL") {
			issues.push(`${discovered.taskId}: Size XL — must split into multiple tasks`);
		} else if (size === "L") {
			issues.push(`${discovered.taskId}: Size L — prefer splitting into S/M deliverables`);
		}

		if (implSteps > MAX_IMPLEMENTATION_STEPS) {
			issues.push(
				`${discovered.taskId}: ${implSteps} implementation steps (max ${MAX_IMPLEMENTATION_STEPS}) — split task`,
			);
		}

		if (fileScopeCount > MAX_FILE_SCOPE_ENTRIES) {
			issues.push(
				`${discovered.taskId}: ${fileScopeCount} file-scope entries (max ${MAX_FILE_SCOPE_ENTRIES}) — narrow scope or split`,
			);
		}
	}

	return issues;
}

/**
 * @param {object} params
 * @param {string} params.tasksRoot
 */
export function buildTaskPacketSizeDoctorCheck({ tasksRoot }) {
	const issues = collectTaskPacketSizeIssues({ tasksRoot });
	return {
		label: "task packet sizing (pending tasks)",
		ok: true,
		warning: issues.length > 0,
		detail:
			issues.length === 0 ? "no oversized pending packets" : issues.slice(0, 5).join("; "),
		suggestedCommand:
			issues.length > 0 ? "Review skills/create-spine-tasks — split oversized tasks" : undefined,
		issueCount: issues.length,
		issues,
	};
}
