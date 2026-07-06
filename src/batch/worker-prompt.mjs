// @ts-nocheck
/**
 * Shared worker tail prompt text for pi runners (SP-067).
 */

import fs from "node:fs";
import path from "node:path";
import { buildWorkerContextAsync } from "../config/worker-context.mjs";

export function buildReviewLevelHint(reviewLevel) {
	if (reviewLevel <= 0) {
		return "";
	}
	let hint =
		"When Review Level ≥ 1, run plan review only at step checkpoints: spine review step --step N --type plan (or spine_review_step with type=plan). ";
	if (reviewLevel >= 2) {
		hint +=
			"Do not run code or final review from inside the worker — the batch engine runs those after .DONE. ";
	} else {
		hint +=
			"Do not run final review from the worker — the batch engine runs final review after .DONE. ";
	}
	hint +=
		"On REVISE, fix feedback before continuing. On review spawn failure, stop with non-zero exit. After creating .DONE, exit immediately with no further tool calls or reviewer spawns. ";
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
	taskIdHint = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "TASK-ID",
	reviewLevel = 0,
	includePromptInclude = false,
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
		workerAgentPath && fs.existsSync(workerAgentPath) ? `\n\n@${workerAgentPath}` : "";
	const promptInclude =
		includePromptInclude && fs.existsSync(promptPath) ? `\n\n@${promptPath}` : "";

	const context = await buildWorkerContextAsync({
		config,
		projectRoot,
		taskFileScope,
		journal,
	});

	return (
		`Complete this task in the worktree (${worktreePath || "."}). Follow PROMPT.md, keep STATUS.md current, run npm test. ` +
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
	return path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "TASK-ID";
}
