/**
 * SP-660 — single resume owner fail-fast (GitHub #207).
 * Strengthens SP-533 for live-engine ownership and detached↔attached pairing.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import {
	enforceAttachedEngineSingleOwner,
	releaseResumeHandoffLock,
	tryAcquireResumeHandoffLock,
} from "../../src/batch/attached-runner.mjs";
import { resumeBatchDetached } from "../../src/batch/detached-start.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
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
function writeBatchWithEngine(
	projectRoot,
	{ batchId = "20260713T171709", enginePid, phase = "running" } = {},
) {
	const taskId = "SP-660";
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
				taskFolder: `spine-tasks/${taskId}-single-resume-owner`,
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
	state.phase = phase;
	recordBatchEnginePid(state, enginePid);
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

test("enforceAttachedEngineSingleOwner fails fast when live engine owns running batch", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-owner-running-");
	const batchId = "20260713T171709";
	try {
		writeBatchWithEngine(projectRoot, { batchId, enginePid: owner.pid, phase: "running" });

		const second = enforceAttachedEngineSingleOwner({
			projectRoot,
			force: true,
			operation: "resume",
		});
		assert.equal(second.ok, false);
		assert.equal(second.error, "concurrent_resume_blocked");
		assert.match(second.output ?? "", /already owns this batch/i);
		assert.equal(second.enginePid, owner.pid);

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.filter((event) => event.type === "batch.resume_handoff_started").length,
			0,
			"must not journal a second handoff while the owner is live",
		);
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner still orphans live engine from paused phase", async () => {
	const stale = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-owner-paused-orphan-");
	const batchId = "20260713T171709";
	try {
		writeBatchWithEngine(projectRoot, { batchId, enginePid: stale.pid, phase: "paused" });

		const handoff = enforceAttachedEngineSingleOwner({
			projectRoot,
			force: true,
			operation: "resume",
		});
		assert.equal(handoff.ok, true);
		assert.equal(handoff.handoff, true);
		handoff.releaseResumeLock?.();

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.resume_handoff_started"));
	} finally {
		try {
			stale.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner skips re-handoff when process already owns enginePid", async () => {
	const projectRoot = await initGitRepo("spine-resume-owner-self-");
	const batchId = "20260713T171709";
	try {
		writeBatchWithEngine(projectRoot, {
			batchId,
			enginePid: process.pid,
			phase: "paused",
		});

		const result = enforceAttachedEngineSingleOwner({
			projectRoot,
			force: true,
			operation: "resume",
		});
		assert.equal(result.ok, true);
		assert.equal(result.releaseResumeLock, undefined);

		const events = readJournalEvents(projectRoot, batchId);
		assert.equal(
			events.filter((event) => event.type === "batch.resume_handoff_started").length,
			0,
			"detached child already recorded as owner must not journal a paired handoff",
		);
	} finally {
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("attached resume --force fails while detached handoff lock is held", async () => {
	const projectRoot = await initGitRepo("spine-resume-owner-detached-then-attached-");
	const batchId = "20260713T171709";
	try {
		writeBatchWithEngine(projectRoot, {
			batchId,
			enginePid: process.pid + 999_999,
			phase: "paused",
		});

		const detachedHolder = tryAcquireResumeHandoffLock(projectRoot, batchId);
		assert.equal(detachedHolder.ok, true);

		const attached = await resumeBatch({ projectRoot, force: true });
		assert.equal(attached.ok, false);
		assert.equal(attached.error, "concurrent_resume_blocked");
		assert.match(attached.output ?? "", /already in progress/i);

		detachedHolder.release();
	} finally {
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("detached resume --force fails while attached handoff lock is held", async () => {
	const projectRoot = await initGitRepo("spine-resume-owner-attached-then-detached-");
	const batchId = "20260713T171709";
	try {
		writeBatchWithEngine(projectRoot, {
			batchId,
			enginePid: process.pid + 999_999,
			phase: "paused",
		});

		const attachedHolder = tryAcquireResumeHandoffLock(projectRoot, batchId);
		assert.equal(attachedHolder.ok, true);

		const detached = await resumeBatchDetached({
			projectRoot,
			spineBin: "bin/spine.mjs",
			force: true,
		});
		assert.equal(detached.ok, false);
		assert.equal(detached.result?.error, "concurrent_resume_blocked");
		assert.match(detached.output ?? "", /already in progress/i);

		attachedHolder.release();
	} finally {
		releaseResumeHandoffLock(projectRoot, batchId);
		await destroyGitRepo(projectRoot);
	}
});

test("resumeBatch fails fast when live engine owns running batch", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
	const projectRoot = await initGitRepo("spine-resume-owner-attached-live-");
	try {
		writeBatchWithEngine(projectRoot, { enginePid: owner.pid, phase: "running" });

		const result = await resumeBatch({ projectRoot, force: true });
		assert.equal(result.ok, false);
		assert.equal(result.error, "concurrent_resume_blocked");
		assert.match(result.output ?? "", /already owns this batch/i);
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});
