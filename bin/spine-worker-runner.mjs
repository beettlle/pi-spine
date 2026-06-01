#!/usr/bin/env node
/**
 * Worker runner invoked by spine engine in lane worktree.
 * --stub: create .DONE for CI / tests when pi is unavailable.
 * --pi: run `pi -p` with task PROMPT unless SPINE_WORKER_PI_AGENT=0.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const taskFolder = process.env.SPINE_TASK_FOLDER;
const worktreePath = process.env.SPINE_WORKTREE;
if (!taskFolder) {
	console.error("SPINE_TASK_FOLDER required");
	process.exit(1);
}

const mode = process.argv.includes("--stub") ? "stub" : "pi";

if (mode === "stub") {
	const delayMs = Number(process.env.SPINE_WORKER_STUB_DELAY_MS || 0);
	if (delayMs > 0) {
		spawnSync("sleep", [String(delayMs / 1000)], { stdio: "ignore" });
	}
	if (process.env.SPINE_WORKER_STUB_TOUCH === "1" && worktreePath) {
		fs.writeFileSync(
			path.join(worktreePath, "stub-worker-touch.txt"),
			`stub touch ${new Date().toISOString()}\n`,
			"utf-8",
		);
	}
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
piArgs.push(
	`Complete this task in the worktree. Follow PROMPT.md, keep STATUS.md current, run npm test, and create ${donePath} when all completion criteria are met.`,
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
