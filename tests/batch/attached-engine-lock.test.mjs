/**
 * SP-434 — single attached engine owner lock (GitHub #89).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
	enforceAttachedEngineSingleOwner,
	runAttachedBatchEngine,
} from "../../src/batch/attached-runner.mjs";
import { resumeBatchDetached } from "../../src/batch/detached-start.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function writePausedBatchWithEngine(projectRoot, { batchId = "20260701T191846", enginePid } = {}) {
	const taskId = "SP-434";
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "running",
				taskFolder: `spine-tasks/${taskId}-attached-engine-lock`,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
			},
		],
	});
	state.phase = "paused";
	recordBatchEnginePid(state, enginePid);
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

test("enforceAttachedEngineSingleOwner fails fast when engine PID is alive", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-attached-lock-fail-");
	try {
		const { batchId } = writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		const lock = enforceAttachedEngineSingleOwner({ projectRoot, force: false, operation: "resume" });
		assert.equal(lock.ok, false);
		assert.equal(lock.error, "attached_engine_already_running");
		assert.equal(lock.enginePid, staleEngine.pid);
		assert.equal(lock.batchId, batchId);
		assert.match(lock.output ?? "", /already running/);
		assert.match(lock.output ?? "", /PID/);
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner orphans prior engine with --force", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-attached-lock-force-");
	const batchId = "20260701T191846";
	try {
		writePausedBatchWithEngine(projectRoot, { batchId, enginePid: staleEngine.pid });

		const lock = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(lock.ok, true);
		assert.equal(lock.handoff, true);
		assert.equal(lock.terminated, true);
		assert.equal(lock.stalePid, staleEngine.pid);

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
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch rejects second attached resume when engine PID is alive", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-attached-resume-lock-");
	try {
		writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		const result = await resumeBatch({ projectRoot, force: false });
		assert.equal(result.ok, false);
		assert.equal(result.error, "attached_engine_already_running");
		assert.match(result.output ?? "", /already running/);
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatchDetached rejects spawn when attached engine PID is alive", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-detached-resume-lock-");
	try {
		writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		const detached = await resumeBatchDetached({
			projectRoot,
			spineBin: "bin/spine.mjs",
			force: false,
		});
		assert.equal(detached.ok, false);
		assert.equal(detached.result?.error, "attached_engine_already_running");
		assert.match(detached.output ?? "", /already running/);
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("runAttachedBatchEngine blocks attached start when engine PID is alive", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-attached-runner-lock-");
	try {
		writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		let engineRan = false;
		const result = await runAttachedBatchEngine({
			projectRoot,
			operation: "start",
			runEngine: async () => {
				engineRan = true;
				return { ok: true };
			},
		});
		assert.equal(engineRan, false);
		assert.equal(result.ok, false);
		assert.equal(result.error, "attached_engine_already_running");
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});
