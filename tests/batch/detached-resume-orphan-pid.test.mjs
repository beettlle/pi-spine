import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { prepareDetachedResumeEngineHandoff } from "../../src/batch/detached-start.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";

test("prepareDetachedResumeEngineHandoff terminates stale engine before resume spawn", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-detached-resume-orphan-"));
	const batchId = "20260615T210231";
	try {
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-247"]],
			tasks: [
				{
					taskId: "SP-247",
					laneNumber: 1,
					status: "running",
					taskFolder: "spine-tasks/SP-247-select-rules-core-refactor",
				},
			],
			lanes: [{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-247"] }],
		});
		state.phase = "paused";
		recordBatchEnginePid(state, staleEngine.pid);
		saveSpineBatchState(projectRoot, state);

		const handoff = prepareDetachedResumeEngineHandoff(projectRoot);
		assert.equal(handoff.ok, true);
		assert.equal(handoff.terminateResult?.terminated, true);
		assert.equal(handoff.terminateResult?.stalePid, staleEngine.pid);

		await new Promise((resolve, reject) => {
			if (staleEngine.exitCode !== null) {
				resolve();
				return;
			}
			const timer = setTimeout(() => reject(new Error("stale engine did not exit")), 3000);
			staleEngine.once("exit", () => {
				clearTimeout(timer);
				resolve();
			});
		});
		assert.equal(isProcessAlive(staleEngine.pid), false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "engine.orphan_terminated"));

		const after = loadSpineBatchState(projectRoot);
		assert.equal(after.raw?.resilience?.enginePid, undefined);
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});
