// @ts-nocheck
/**
 * Shared worker tail prompt text for pi runners (SP-067).
 */

import fs from "node:fs";
import path from "node:path";
import { buildWorkerContextAsync } from "../config/worker-context.mjs";
import { taskIdFromFolderName } from "../tasks/packet/discover.mjs";

export function buildReviewLevelHint(reviewLevel) {
	if (reviewLevel <= 0) {
		return "";
	}
	let hint =
		"Reviews run in the batch engine after .DONE, not in the worker: do not call spine_review_step or spine review step from the worker. ";
	if (reviewLevel >= 2) {
		hint +=
			"At Review Level 2 the engine runs plan review, code review, and final review after .DONE. ";
	} else {
		hint += "At Review Level 1 the engine runs plan review and final review after .DONE. ";
	}
	hint +=
		"If the engine returns REVISE feedback, address it when resumed. After creating .DONE, exit immediately with no further tool calls or reviewer spawns. ";
	return hint;
}

export const WORKER_TOOLS_HINT =
	"Prefer spine_review_step, spine_report_progress, and spine_request_gate Pi tools over bash when available. ";

export function buildCommitBoundaryHint(taskIdHint) {
	return `Commit at step boundaries when you change files (feat(${taskIdHint}): complete Step N — {step title}). `;
}

export function buildDoneCheckpointHint(donePath) {
	return (
		`The batch engine auto-commits any remaining uncommitted work when you create ${donePath}, ` +
		"but uncommitted changes without .DONE fail the batch. " +
		`Create ${donePath} only when all completion criteria are met.`
	);
}

export async function buildWorkerTailPrompt({
	worktreePath,
	taskFolder,
	donePath,
	taskIdHint = taskIdFromFolder(taskFolder),
	reviewLevel = 0,
	includePromptInclude = false,
	includeAgentInclude = true,
	config = {},
	projectRoot = worktreePath || process.cwd(),
	taskFileScope = [],
	journal,
}) {
	const workerAgentPath = worktreePath
		? path.join(worktreePath, ".spine", "agents", "worker.md")
		: null;
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const agentAppend =
		includeAgentInclude && workerAgentPath && fs.existsSync(workerAgentPath)
			? `\n\n@${workerAgentPath}`
			: "";
	const promptInclude =
		includePromptInclude && fs.existsSync(promptPath) ? `\n\n@${promptPath}` : "";

	const context = await buildWorkerContextAsync({
		config,
		projectRoot,
		taskFileScope,
		journal,
	});

	return (
		`Complete this task in the worktree (${worktreePath || "."}). Follow PROMPT.md, keep STATUS.md current, and run the Contract testCommand from PROMPT.md; the full suite runs at post-integrate release:check. ` +
		WORKER_TOOLS_HINT +
		buildReviewLevelHint(reviewLevel) +
		buildCommitBoundaryHint(taskIdHint) +
		buildDoneCheckpointHint(donePath) +
		context.text +
		agentAppend +
		promptInclude
	);
}

export function taskIdFromFolder(taskFolder) {
	// Shared pattern (SP-785, #300); keeps the TASK-ID fallback for unparseable names.
	return taskIdFromFolderName(path.basename(taskFolder)) ?? "TASK-ID";
}
