// #293 repro: archive a batch (as completeBatch does), then run the late save
// path (finalizeBatchForIntegrate's final save with bypassWriteGuard: true).
// Buggy behavior: .spine/batch-state.json is recreated with phase "completed".
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	createInitialBatchState,
	evaluateBatchStateWriteGuard,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-293-repro-"));
const batchId = "20260927T002714";
const taskId = "SP-774";

try {
	// 1. Build a completed batch state on disk.
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [{ taskId, laneNumber: 1, status: "succeeded" }],
		lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: [taskId] }],
	});
	state.phase = "completed";
	state.endedAt = Date.now();
	state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "cafebabe" }];
	saveSpineBatchState(projectRoot, state);
	console.log("1. active state written:", fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));

	// 2. Simulate `spine batch complete`: archive + remove active state.
	const archiveDir = path.join(projectRoot, ".spine", "runtime", batchId, "archive");
	fs.mkdirSync(archiveDir, { recursive: true });
	fs.writeFileSync(
		path.join(archiveDir, "batch-state.json"),
		JSON.stringify(state, null, 2),
		"utf-8",
	);
	fs.rmSync(path.join(projectRoot, ".spine", "batch-state.json"));
	console.log("2. archived + active removed:", !fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));

	// 3. Guard verdict for an incoming *completed* phase write.
	const guard = evaluateBatchStateWriteGuard(projectRoot, state);
	console.log("3. guard for completed phase write:", JSON.stringify(guard));

	// 4. Late save path (bypassWriteGuard: true, as post-merge-limbo does).
	saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });
	const resurrected = fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json"));
	console.log("4. late bypass save recreated state file:", resurrected);
	if (resurrected) {
		console.log("   recreated phase:", loadSpineBatchState(projectRoot).raw?.phase, "<- BUG #293");
	}
} finally {
	fs.rmSync(projectRoot, { recursive: true, force: true });
}
