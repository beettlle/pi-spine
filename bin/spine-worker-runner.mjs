#!/usr/bin/env node
/**
 * Worker runner invoked by spine engine in lane worktree.
 * --stub: create .DONE for CI / tests when pi is unavailable.
 * --pi: run `pi -p` with task PROMPT unless SPINE_WORKER_PI_AGENT=0.
 *
 * Batch context env (set by worker-host.mjs, inherited by pi child):
 *   SPINE_TASK_FOLDER   — absolute path to taskplane-tasks/TP-NNN-…/
 *   SPINE_WORKTREE      — lane git worktree root
 *   SPINE_PROJECT_ROOT  — pi-spine project root (journal + gate paths)
 *   SPINE_BATCH_ID      — active batch id
 *   SPINE_TASK_ID       — e.g. TP-038
 *   SPINE_LANE_NUMBER   — 1-based lane index
 *   SPINE_LANE_ID       — optional alias (falls back to lane number in CLIs)
 *   SPINE_LANE_CORRELATION_ID — journal correlation id for this lane run
 *   SPINE_JOURNAL_ATTACH — "1" when batch journal writes are enabled
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
	assertReviewToolAvailable,
	readReviewLevel,
	resolveBatchJournalContext,
	runStepReview,
} from "../src/batch/review.mjs";

const taskFolder = process.env.SPINE_TASK_FOLDER;
const worktreePath = process.env.SPINE_WORKTREE;
if (!taskFolder) {
	console.error("SPINE_TASK_FOLDER required");
	process.exit(1);
}

const reviewGate = assertReviewToolAvailable({ taskFolder });
if (!reviewGate.ok) {
	console.error(reviewGate.error);
	process.exit(1);
}

const mode = process.argv.includes("--stub") ? "stub" : "pi";

function buildReviewJournal() {
	return resolveBatchJournalContext();
}

function enforceStubReviewIfConfigured() {
	if (process.env.SPINE_WORKER_STUB_ENFORCE_REVIEW !== "1") return;
	if (readReviewLevel(taskFolder) <= 0) return;

	const reviewResult = runStepReview({
		taskFolder,
		worktreePath: worktreePath || process.cwd(),
		stepNumber: Number(process.env.SPINE_WORKER_STUB_REVIEW_STEP || 1),
		reviewType: process.env.SPINE_WORKER_STUB_REVIEW_TYPE === "code" ? "code" : "plan",
		stub: true,
		journal: buildReviewJournal(),
	});

	if (!reviewResult.ok) {
		console.error(reviewResult.error ?? `review failed: ${reviewResult.verdict ?? "spawn"}`);
		process.exit(reviewResult.exitCode ?? 1);
	}
}

if (mode === "stub") {
	const taskIdFromFolder = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "";
	const failTasks = String(process.env.SPINE_WORKER_STUB_FAIL_TASKS ?? "")
		.split(/[,\s]+/)
		.filter(Boolean);
	if (failTasks.includes(taskIdFromFolder)) {
		const dirtyRel = process.env.SPINE_WORKER_STUB_DIRTY_FILE;
		if (dirtyRel && worktreePath) {
			const dirtyPath = path.join(worktreePath, dirtyRel);
			fs.mkdirSync(path.dirname(dirtyPath), { recursive: true });
			fs.writeFileSync(dirtyPath, `stub dirty ${new Date().toISOString()}\n`, "utf-8");
		}
		console.error(`stub worker forced failure for ${taskIdFromFolder}`);
		process.exit(1);
	}

	const delayMs = Number(process.env.SPINE_WORKER_STUB_DELAY_MS || 0);
	if (delayMs > 0) {
		const dirtyRel = process.env.SPINE_WORKER_STUB_DIRTY_FILE;
		if (dirtyRel && worktreePath) {
			const dirtyPath = path.join(worktreePath, dirtyRel);
			fs.mkdirSync(path.dirname(dirtyPath), { recursive: true });
			fs.writeFileSync(dirtyPath, `stub dirty ${new Date().toISOString()}\n`, "utf-8");
		}
		spawnSync("sleep", [String(delayMs / 1000)], { stdio: "ignore" });
	}
	if (process.env.SPINE_WORKER_STUB_TOUCH === "1" && worktreePath) {
		fs.writeFileSync(
			path.join(worktreePath, "stub-worker-touch.txt"),
			`stub touch ${new Date().toISOString()}\n`,
			"utf-8",
		);
	}

	enforceStubReviewIfConfigured();

	const donePath = path.join(taskFolder, ".DONE");
	fs.writeFileSync(
		donePath,
		`Completed: ${new Date().toISOString()}\nTask: stub\n`,
		"utf-8",
	);
	process.exit(0);
}

const version = spawnSync("pi", ["--version"], { encoding: "utf-8" });
if (version.status !== 0) {
	console.error("pi not available:", version.stderr);
	process.exit(1);
}

const donePath = path.join(taskFolder, ".DONE");
if (fs.existsSync(donePath)) {
	process.exit(0);
}

if (process.env.SPINE_WORKER_PI_AGENT === "0") {
	console.error(
		"pi worker mode requires manual agent completion (.DONE in task folder). Set SPINE_WORKER_PI_AGENT=1 to run pi -p.",
	);
	process.exit(1);
}

const promptPath = path.join(taskFolder, "PROMPT.md");
const workerAgentPath = worktreePath
	? path.join(worktreePath, ".spine", "agents", "worker.md")
	: null;

const piArgs = ["-p", "--no-session"];
if (workerAgentPath && fs.existsSync(workerAgentPath)) {
	piArgs.push("--append-system-prompt", workerAgentPath);
}
if (fs.existsSync(promptPath)) {
	piArgs.push(`@${promptPath}`);
}
const taskIdHint = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "TASK-ID";
const reviewLevel = readReviewLevel(taskFolder);
const reviewHint =
	reviewLevel > 0
		? `When Review Level > 0, after each step run: spine review step --step N [--type plan|code] (or spine_review_step tool). On REVISE, fix feedback before continuing. On review spawn failure, stop with non-zero exit. `
		: "";
const toolsHint =
	"Prefer spine_review_step, spine_report_progress, and spine_request_gate Pi tools over bash when available. ";
piArgs.push(
	`Complete this task in the worktree (${worktreePath || "."}). Follow PROMPT.md, keep STATUS.md current, run npm test. ` +
		toolsHint +
		reviewHint +
		`Commit at step boundaries when you change files (feat(${taskIdHint}): …). ` +
		`The batch engine auto-commits any remaining uncommitted work when you create ${donePath}, but uncommitted changes without .DONE fail the batch. ` +
		`Create ${donePath} only when all completion criteria are met.`,
);

const timeoutMs = Number(process.env.SPINE_WORKER_PI_TIMEOUT_MS || 60 * 60 * 1000);
const result = spawnSync("pi", piArgs, {
	cwd: worktreePath || process.cwd(),
	encoding: "utf-8",
	timeout: timeoutMs,
});

if (result.error?.code === "ETIMEDOUT") {
	console.error("pi worker timed out");
	process.exit(124);
}

if (result.status !== 0) {
	process.stderr.write(result.stderr ?? "");
	process.stdout.write(result.stdout ?? "");
	process.exit(result.status ?? 1);
}

if (!fs.existsSync(donePath)) {
	console.error("pi exited but .DONE was not created");
	process.exit(1);
}

process.exit(0);
