#!/usr/bin/env node
/**
 * Worker runner invoked by spine engine in lane worktree.
 * --stub: create .DONE for CI / tests when pi is unavailable.
 * --pi: attempt pi invocation (placeholder — full agent loop is Phase 2+).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const taskFolder = process.env.SPINE_TASK_FOLDER;
if (!taskFolder) {
	console.error("SPINE_TASK_FOLDER required");
	process.exit(1);
}

const mode = process.argv.includes("--stub") ? "stub" : "pi";

if (mode === "stub") {
	const donePath = path.join(taskFolder, ".DONE");
	fs.writeFileSync(
		donePath,
		`Completed: ${new Date().toISOString()}\nTask: stub\n`,
		"utf-8",
	);
	process.exit(0);
}

// pi mode: for now run a no-op that expects external .DONE or fails
// Full pi agent integration lands in follow-up; engine uses stub when pi missing.
const result = spawnSync("pi", ["--version"], { encoding: "utf-8" });
if (result.status !== 0) {
	console.error("pi not available:", result.stderr);
	process.exit(1);
}

const donePath = path.join(taskFolder, ".DONE");
if (!fs.existsSync(donePath)) {
	console.error(
		"pi worker mode requires manual agent completion (.DONE in task folder). Use SPINE_WORKER_STUB=1 for automated tests.",
	);
	process.exit(1);
}
process.exit(0);
