import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	evaluateBatchStateWriteGuard,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

test("evaluateBatchStateWriteGuard rejects writes from non-owner live engine", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-stale-writer-"));
	const batchId = "20260615T210231";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-247"]],
			tasks: [{ taskId: "SP-247", laneNumber: 1, status: "running" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-247"] }],
		});
		state.phase = "running";
		recordBatchEnginePid(state, owner.pid);
		saveSpineBatchState(projectRoot, state);

		const guard = evaluateBatchStateWriteGuard(projectRoot, {
			...state,
			phase: "running",
			tasks: [{ taskId: "SP-247", laneNumber: 1, status: "failed" }],
		});
		assert.equal(guard.allowed, false);
		assert.equal(guard.reason, "stale_engine_pid");

		saveSpineBatchState(projectRoot, {
			...state,
			phase: "running",
			tasks: [{ taskId: "SP-247", laneNumber: 1, status: "failed" }],
		});

		const after = loadSpineBatchState(projectRoot);
		assert.equal(after.raw?.tasks?.[0]?.status, "running");
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("saveSpineBatchState rejects resurrecting archived batch cache", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-archived-resurrection-"));
	const batchId = "20260615T210231";
	try {
		const archiveDir = path.join(
			projectRoot,
			".spine",
			"runtime",
			batchId,
			"archive",
		);
		fs.mkdirSync(archiveDir, { recursive: true });
		fs.writeFileSync(
			path.join(archiveDir, "batch-state.json"),
			JSON.stringify({ batchId, phase: "completed" }, null, 2),
			"utf-8",
		);

		const resurrect = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-247"]],
			tasks: [{ taskId: "SP-247", laneNumber: 1, status: "running" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-247"] }],
		});
		resurrect.phase = "running";

		const guard = evaluateBatchStateWriteGuard(projectRoot, resurrect);
		assert.equal(guard.allowed, false);
		assert.equal(guard.reason, "archived_batch_resurrection");

		saveSpineBatchState(projectRoot, resurrect);
		assert.equal(loadSpineBatchState(projectRoot).raw, null);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("guard rejects post-archive resurrection for terminal phases too and journals the rejection (#293 / SP-790)", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-archived-terminal-"));
	const batchId = "20260615T210232";
	try {
		const archiveDir = path.join(projectRoot, ".spine", "runtime", batchId, "archive");
		fs.mkdirSync(archiveDir, { recursive: true });
		fs.writeFileSync(
			path.join(archiveDir, "batch-state.json"),
			JSON.stringify({ batchId, phase: "completed" }, null, 2),
			"utf-8",
		);

		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-248"]],
			tasks: [{ taskId: "SP-248", laneNumber: 1, status: "succeeded" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-248"] }],
		});

		// Every incoming phase — including terminal ones — is rejected: a late
		// land-loop finalize after `spine batch complete` must not recreate the file.
		for (const phase of ["completed", "failed"]) {
			const guard = evaluateBatchStateWriteGuard(projectRoot, { ...state, phase });
			assert.equal(guard.allowed, false, `phase ${phase} should be rejected`);
			assert.equal(guard.reason, "archived_batch_resurrection");
		}

		// The engine-trusted bypass no longer skips the resurrection check.
		saveSpineBatchState(projectRoot, { ...state, phase: "completed" }, { bypassWriteGuard: true });
		assert.equal(loadSpineBatchState(projectRoot).raw, null, "bypassed save recreated archived state");

		const rejectedEvents = readJournalEvents(projectRoot, batchId).filter(
			(event) => event.type === "batch.state_write_rejected",
		);
		assert.equal(rejectedEvents.length, 1);
		assert.equal(rejectedEvents[0]?.payload?.reason, "archived_batch_resurrection");
		assert.equal(rejectedEvents[0]?.payload?.incomingPhase, "completed");

		// Operator recovery (force-resume from batch-meta, #126) may rebuild archived state.
		saveSpineBatchState(
			projectRoot,
			{ ...state, phase: "paused" },
			{ bypassWriteGuard: true, allowArchivedResurrection: true },
		);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("saveSpineBatchState allows a normal new-batch write when no archive exists", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-new-batch-write-"));
	try {
		const state = createInitialBatchState({
			batchId: "20260616T090000",
			baseBranch: "main",
			orchBranch: "orch/spine-20260616T090000",
			wavePlan: [["SP-249"]],
			tasks: [{ taskId: "SP-249", laneNumber: 1, status: "pending" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-249"] }],
		});
		saveSpineBatchState(projectRoot, state);
		assert.equal(loadSpineBatchState(projectRoot).raw?.batchId, "20260616T090000");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
