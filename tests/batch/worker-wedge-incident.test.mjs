import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

const FIXTURE_PATH = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../fixtures/batch-state/sp-190-wedge-hang.json",
);

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

test("SP-190 wedge fixture describes hung-child-after-.DONE incident", () => {
	const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
	assert.equal(fixture.batchId, "20260611T222221");
	assert.equal(fixture.tasks[0].taskId, "SP-190");
	assert.equal(fixture.tasks[0].doneFileFound, true);
	assert.equal(fixture.phase, "running");
});

test("SP-190 wedge class: engine completes within post-done grace (SP-193)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-sp190-wedge-"));
	const batchId = "20260611T222221";
	const projectRoot = path.join(root, "project");
	const worktreePath = projectRoot;
	const taskId = "SP-190";
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-wedge`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n**Size:** M\n\n## Review Level: 2\n\n## Mission\nWedge regression.\n`,
		"utf-8",
	);
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

		assert.equal(result.ok, true);
		assert.equal(result.doneFound, true);
		assert.ok(elapsedMs < 60_000, "SP-190 wedge must not block 17+ minutes");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "worker.post_done_terminated"));
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});
