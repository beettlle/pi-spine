/**
 * Shared worker tail prompt text for pi runners (SP-067).
 */

import fs from "node:fs";
import path from "node:path";
import { buildWorkerContext } from "../config/worker-context.mjs";

export function buildReviewLevelHint(reviewLevel) {
	return reviewLevel > 0
		? "When Review Level > 0, after each step run: spine review step --step N [--type plan|code] (or spine_review_step tool). On REVISE, fix feedback before continuing. On review spawn failure, stop with non-zero exit. "
		: "";
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

export function buildWorkerTailPrompt({
	worktreePath,
	taskFolder,
	donePath,
	taskIdHint = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "TASK-ID",
	reviewLevel = 0,
	includePromptInclude = false,
	config = {},
	projectRoot = worktreePath || process.cwd(),
}) {
	const workerAgentPath = worktreePath
		? path.join(worktreePath, ".spine", "agents", "worker.md")
		: null;
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const agentAppend =
		workerAgentPath && fs.existsSync(workerAgentPath) ? `\n\n@${workerAgentPath}` : "";
	const promptInclude =
		includePromptInclude && fs.existsSync(promptPath) ? `\n\n@${promptPath}` : "";

	const context = buildWorkerContext(config, projectRoot);

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
