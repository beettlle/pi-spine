import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runStepReview } from "../../src/batch/review.mjs";
import { terminateStaleDetachedEngine } from "../../src/batch/resume-engine.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

test("terminateStaleDetachedEngine SIGTERM stale pid on failed resume", async () => {
	const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-orphan-engine-"));
	const batchId = "20260612T011148";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-194"]],
			tasks: [{ taskId: "SP-194", laneNumber: 1, status: "succeeded" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-194"] }],
		});
		state.resilience = { enginePid: child.pid };
		saveSpineBatchState(projectRoot, state);

		const result = terminateStaleDetachedEngine({
			projectRoot,
			state,
			batchId,
			fromPhase: "failed",
		});
		assert.equal(result.terminated, true);
		assert.equal(result.stalePid, child.pid);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "engine.orphan_terminated"));
	} finally {
		try {
			child.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runStepReview honors existing final PASS without re-spawn", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-honor-final-"));
	const batchId = "20260612T011148";
	const taskId = "SP-194";
	const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-honor`);
	fs.mkdirSync(path.join(taskFolder, ".reviews"), { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		"# Task\n\n## Review Level: 2\n\n### Step 1\n\nWork\n",
		"utf-8",
	);
	fs.writeFileSync(
		path.join(taskFolder, ".reviews", "final-20260612T010000.md"),
		"### Verdict: PASS\n",
		"utf-8",
	);

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [{ taskId, laneNumber: 1, status: "succeeded", taskFolder }],
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: [taskId] }],
	});
	saveSpineBatchState(projectRoot, state);

	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: projectRoot,
			stepNumber: 1,
			reviewType: "final",
			journal: { projectRoot, batchId, taskId, laneNumber: 1 },
			stub: false,
		});
		assert.equal(result.ok, true);
		assert.equal(result.skipped, true);
		assert.equal(result.honored, true);
		assert.equal(result.verdict, "PASS");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(!events.some((event) => event.type === "review.started"));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runStepReview skips review.failed journal when batch already completed", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-frozen-review-"));
	const batchId = "20260612T011148";
	const taskId = "SP-194";
	const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-frozen`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		"# Task\n\n## Review Level: 2\n\n### Step 1\n\nWork\n",
		"utf-8",
	);

	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [{ taskId, laneNumber: 1, status: "succeeded", taskFolder }],
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: [taskId] }],
	});
	state.phase = "completed";
	state.endedAt = Date.now();
	saveSpineBatchState(projectRoot, state);

	const prevPi = process.env.PATH;
	process.env.PATH = "/nonexistent";

	try {
		const result = runStepReview({
			taskFolder,
			worktreePath: projectRoot,
			stepNumber: 1,
			reviewType: "final",
			journal: { projectRoot, batchId, taskId, laneNumber: 1 },
			stub: false,
		});
		assert.equal(result.spawnFailed, true);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(!events.some((event) => event.type === "review.failed"));
	} finally {
		process.env.PATH = prevPi;
		await rm(projectRoot, { recursive: true, force: true });
	}
});
