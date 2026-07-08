/**
 * SP-343 — attached batch prints land-loop milestones and exits after completed (GitHub #34).
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	ATTACHED_LAND_LOOP_MILESTONE_TYPES,
	formatAttachedMilestoneLine,
	formatAttachedBatchCliResult,
} from "../../src/batch/attached-runner.mjs";
import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");
const TASK_ID = "SP-343";

/**
 * @param {string} projectRoot
 */
function writeSmokeTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", `${TASK_ID}-attached-exit`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(TASK_ID, {
			fileScope: "src/attached-batch-exit.txt",
			mission: "Attached batch exit regression fixture.",
		}),
		"utf-8",
	);
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [TASK_ID]: [] } }, null, 2),
		"utf-8",
	);
}

test("formatAttachedMilestoneLine renders land-loop journal types", () => {
	assert.ok(ATTACHED_LAND_LOOP_MILESTONE_TYPES.has("batch.completed"));
	assert.equal(
		formatAttachedMilestoneLine({ type: "task.completed", taskId: TASK_ID }),
		`[spine] task.completed ${TASK_ID}\n`,
	);
	assert.equal(
		formatAttachedMilestoneLine({
			type: "batch.merge_completed",
			payload: { waveIndex: 0 },
		}),
		"[spine] batch.merge_completed wave=0\n",
	);
});

test("runSpineBatch attached start returns integrate handoff without process.exit in tests", async () => {
	const projectRoot = await initGitRepo("spine-attached-batch-exit-defer-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHarness = process.env.SPINE_ALLOW_ATTACHED_HARNESS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_ALLOW_ATTACHED_HARNESS = "1";

	try {
		writeSmokeTask(projectRoot);
		spawnSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		spawnSync("git", ["commit", "-m", "attached exit task"], { cwd: projectRoot, stdio: "ignore" });

		const milestones = [];
		const originalWrite = process.stdout.write.bind(process.stdout);
		process.stdout.write = (chunk, encoding, callback) => {
			milestones.push(String(chunk));
			return originalWrite(chunk, encoding, callback);
		};

		const cli = await runSpineBatch({
			projectRoot,
			args: ["start", TASK_ID, "--attached", "--skip-preflight"],
			deferAttachedExit: true,
		});

		process.stdout.write = originalWrite;

		assert.equal(cli.exitCode, 0, cli.output);
		assert.match(cli.output ?? "", /integrate|gate/i);
		assert.ok(milestones.some((line) => line.includes("[spine] batch.completed")));

		const { raw } = loadSpineBatchState(projectRoot);
		assert.equal(raw?.phase, "completed");
		assert.ok(raw?.batchId);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, raw.batchId)));

		const events = readJournalEvents(projectRoot, raw.batchId);
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHarness === undefined) delete process.env.SPINE_ALLOW_ATTACHED_HARNESS;
		else process.env.SPINE_ALLOW_ATTACHED_HARNESS = prevHarness;
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("attached batch CLI subprocess exits after completed with stdout milestones", async () => {
	const projectRoot = await initGitRepo("spine-attached-batch-exit-cli-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSmokeTask(projectRoot);
		spawnSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		spawnSync("git", ["commit", "-m", "attached exit cli task"], { cwd: projectRoot, stdio: "ignore" });

		const child = spawn(
			process.execPath,
			[SPINE_BIN, "batch", "start", TASK_ID, "--attached", "--skip-preflight"],
			{
				cwd: projectRoot,
				env: { ...process.env, SPINE_ALLOW_ATTACHED_HARNESS: "1" },
				stdio: ["ignore", "pipe", "pipe"],
			},
		);

		let stdout = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString("utf-8");
		});

		const exitCode = await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new Error("attached batch CLI did not exit within 90s"));
			}, 90_000);
			child.on("close", (code) => {
				clearTimeout(timer);
				resolve(code);
			});
		});

		assert.equal(exitCode, 0, stdout);
		assert.ok(stdout.includes("[spine] batch.completed"), stdout);
		assert.match(stdout, /spine gate|integrate/i);
		assert.ok(stdout.includes("Batch started") || stdout.includes("succeeded"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("formatAttachedBatchCliResult includes diagnosis suggested command", () => {
	const output = formatAttachedBatchCliResult({
		projectRoot: process.cwd(),
		operation: "start",
		result: {
			ok: true,
			exitCode: 0,
			batchId: "test-batch",
			output: "Batch test-batch completed.\n",
		},
	});
	assert.match(output.output, /→/);
	assert.equal(output.exitCode, 0);
});
