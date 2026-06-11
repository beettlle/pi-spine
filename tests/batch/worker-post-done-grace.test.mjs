import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

/**
 * Launch script that writes .DONE then hangs (SP-190 wedge reproduction).
 */
function writeHangAfterDoneLaunchScript(projectRoot) {
	const scriptPath = path.join(projectRoot, "scripts", "hang-after-done.sh");
	fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
	fs.writeFileSync(
		scriptPath,
		`#!/bin/sh
echo "Completed: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SPINE_TASK_FOLDER/.DONE"
exec sleep 600
`,
		{ encoding: "utf-8", mode: 0o755 },
	);
	return "scripts/hang-after-done.sh";
}

function writeMinimalPrompt(taskFolder, taskId) {
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n## Review Level: 0\n\n## Mission\nPost-done grace.\n`,
		"utf-8",
	);
}

test("runWorker terminates hung child after .DONE and returns ok: true", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-post-done-"));
	const batchId = "20260611T230000";
	const projectRoot = path.join(root, "project");
	const worktreePath = projectRoot;
	const taskId = "SP-193";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-grace`);
	fs.mkdirSync(taskFolder, { recursive: true });
	writeMinimalPrompt(taskFolder, taskId);
	const launchScript = writeHangAfterDoneLaunchScript(projectRoot);

	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		const startedAt = Date.now();
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId,
			config: {
				development: { workerLaunchScript: launchScript },
				lanes: {
					postDoneGraceMinutes: 0.05,
					stallTimeoutMinutes: 30,
					heartbeatIntervalMinutes: 60,
				},
			},
		});
		const elapsedMs = Date.now() - startedAt;

		assert.equal(result.ok, true, "hung child after .DONE should succeed");
		assert.equal(result.doneFound, true);
		assert.equal(result.classification, "succeeded");
		assert.ok(elapsedMs < 60_000, "should not wedge indefinitely");
		assert.ok(fs.existsSync(path.join(taskFolder, ".DONE")));

		const events = readJournalEvents(projectRoot, batchId);
		const terminated = events.find((event) => event.type === "worker.post_done_terminated");
		assert.ok(terminated, "worker.post_done_terminated should be journaled");
		assert.equal(terminated.taskId, taskId);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker pre-.DONE stall_timeout still works", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pre-done-stall-"));
	const batchId = "20260611T230100";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskId = "SP-193-stall";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-regression`);
	fs.mkdirSync(taskFolder, { recursive: true });
	writeMinimalPrompt(taskFolder, taskId);

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	const prevOutput = process.env.SPINE_WORKER_STUB_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = "120000";
	process.env.SPINE_WORKER_STUB_OUTPUT = "pre-done hang without .DONE";

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 2,
			taskId,
			config: {
				lanes: {
					stallTimeoutMinutes: 0.02,
					stallGraceAfterProgressMinutes: 0.01,
					postDoneGraceMinutes: 5,
					heartbeatIntervalMinutes: 60,
				},
			},
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "stall_timeout");
		assert.equal(result.doneFound, false);
		assert.match(result.output, /pre-done hang without/);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(
			events.some((event) => event.type === "lane.stall_killed"),
			"pre-.DONE stall should still journal lane.stall_killed",
		);
		assert.ok(
			!events.some((event) => event.type === "worker.post_done_terminated"),
			"post-done termination must not fire without .DONE",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_HANG_MS;
		else process.env.SPINE_WORKER_STUB_HANG_MS = prevHang;
		if (prevOutput === undefined) delete process.env.SPINE_WORKER_STUB_OUTPUT;
		else process.env.SPINE_WORKER_STUB_OUTPUT = prevOutput;
		await rm(root, { recursive: true, force: true });
	}
});
