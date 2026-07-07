/**
 * SP-533 — concurrent resume --force fail-fast (GitHub #167).
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
	enforceAttachedEngineSingleOwner,
	releaseResumeHandoffLock,
	tryAcquireResumeHandoffLock,
} from "../../src/batch/attached-runner.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { resumeBatchDetached } from "../../src/batch/detached-start.mjs";
import { isProcessAlive } from "../../src/process/liveness.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import {
	createInitialBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function writePausedBatchWithEngine(projectRoot, { batchId = "20260707T230106", enginePid } = {}) {
	const taskId = "SP-533";
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
				taskFolder: `spine-tasks/${taskId}-concurrent-resume`,
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

test("tryAcquireResumeHandoffLock rejects second holder while first lock is held", async () => {
	const projectRoot = await initGitRepo("spine-resume-concurrent-lock-");
	const batchId = "20260707T230106";
	try {
		const first = tryAcquireResumeHandoffLock(projectRoot, batchId);
		assert.equal(first.ok, true);

		const second = tryAcquireResumeHandoffLock(projectRoot, batchId);
		assert.equal(second.ok, false);
		assert.equal(second.holderPid, process.pid);

		first.release();
		const third = tryAcquireResumeHandoffLock(projectRoot, batchId);
		assert.equal(third.ok, true);
		third.release();
	} finally {
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner blocks concurrent resume --force", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-concurrent-enforce-");
	const batchId = "20260707T230106";
	try {
		writePausedBatchWithEngine(projectRoot, { batchId, enginePid: staleEngine.pid });

		const first = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(first.ok, true);
		assert.equal(first.handoff, true);
		assert.equal(typeof first.releaseResumeLock, "function");

		const second = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(second.ok, false);
		assert.equal(second.error, "concurrent_resume_blocked");
		assert.match(second.output ?? "", /already in progress/i);
		assert.equal(second.batchId, batchId);

		first.releaseResumeLock?.();
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner journals resume handoff start on forced resume", async () => {
	const projectRoot = await initGitRepo("spine-resume-concurrent-journal-");
	const batchId = "20260707T230106";
	try {
		writePausedBatchWithEngine(projectRoot, { batchId, enginePid: process.pid + 999_999 });

		const lock = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(lock.ok, true);
		lock.releaseResumeLock?.();

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.resume_handoff_started"));
	} finally {
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch rejects concurrent resume --force while handoff lock is held", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-concurrent-attached-");
	try {
		writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		const first = tryAcquireResumeHandoffLock(projectRoot, "20260707T230106");
		assert.equal(first.ok, true);

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, false);
		assert.equal(result.error, "concurrent_resume_blocked");

		first.release();
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatchDetached rejects concurrent resume --force while handoff lock is held", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-concurrent-detached-");
	try {
		writePausedBatchWithEngine(projectRoot, { enginePid: staleEngine.pid });

		const first = tryAcquireResumeHandoffLock(projectRoot, "20260707T230106");
		assert.equal(first.ok, true);

		const detached = await resumeBatchDetached({
			projectRoot,
			spineBin: "bin/spine.mjs",
			force: true,
		});
		assert.equal(detached.ok, false);
		assert.equal(detached.result?.error, "concurrent_resume_blocked");
		assert.match(detached.output ?? "", /already in progress/i);

		first.release();
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("first forced resume succeeds and releases lock for a follow-up resume", async () => {
	const staleEngine = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-concurrent-handoff-");
	const batchId = "20260707T230106";
	try {
		writePausedBatchWithEngine(projectRoot, { batchId, enginePid: staleEngine.pid });

		const first = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(first.ok, true);
		assert.equal(first.terminated, true);
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
		first.releaseResumeLock?.();

		const second = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(second.ok, true);
		second.releaseResumeLock?.();
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});
