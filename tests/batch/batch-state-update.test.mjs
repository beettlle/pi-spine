/**
 * SP-791 — updateSpineBatchState atomic read-modify-write helper (GitHub #301).
 *
 * Unit cases for the structured result contract: missing/corrupt state,
 * no-op mutate, draft cloning, guard rejection surfacing, and option
 * pass-through. The two-process concurrency proof lives in
 * batch-state-lock.test.mjs.
 *
 * SP-793 — resume-gate-reopen migrated onto the helper (GitHub #301): the
 * reopen decision and persist share one locked read, and the write goes
 * through the guard with no owner bypass.
 */

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { tryResumeCompletedGateReopen } from "../../src/batch/resume-gate-reopen.mjs";
import {
	loadSpineBatchState,
	saveSpineBatchState,
	spineBatchStatePath,
	updateSpineBatchState,
} from "../../src/batch/state-io.mjs";
import { recordBatchEnginePid } from "../../src/batch/state-guards.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("mutates and saves disk state in one call", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-write-"));
	try {
		saveSpineBatchState(projectRoot, { batchId: "20260930T000000-upd1", phase: "running" });

		const result = updateSpineBatchState(projectRoot, (draft) => {
			draft.phase = "paused";
			draft.progress = { done: 3 };
		});

		assert.deepEqual(Object.keys(result).sort(), ["changed", "ok", "state"]);
		assert.equal(result.ok, true);
		assert.equal(result.changed, true);
		assert.equal(result.state?.phase, "paused");
		assert.equal(result.state?.progress?.done, 3);

		const disk = loadSpineBatchState(projectRoot).raw;
		assert.equal(disk?.phase, "paused");
		assert.equal(disk?.progress?.done, 3);
		assert.equal(disk?.batchId, "20260930T000000-upd1");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("returns { ok: false, reason: missing } when batch-state.json does not exist", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-missing-"));
	try {
		const result = updateSpineBatchState(projectRoot, (draft) => {
			draft.phase = "paused";
		});
		assert.deepEqual(result, { ok: false, reason: "missing" });
		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("returns { ok: false, reason: corrupt } when batch-state.json is unparseable", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-corrupt-"));
	try {
		const filePath = spineBatchStatePath(projectRoot);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, "{ not json", "utf-8");

		const result = updateSpineBatchState(projectRoot, (draft) => {
			draft.phase = "paused";
		});
		assert.deepEqual(result, { ok: false, reason: "corrupt" });
		assert.equal(fs.readFileSync(filePath, "utf-8"), "{ not json");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("mutate returning false is a no-op: nothing is written, disk state returned", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-noop-"));
	try {
		saveSpineBatchState(projectRoot, { batchId: "20260930T000000-upd2", phase: "running" });
		const before = loadSpineBatchState(projectRoot).raw;

		const result = updateSpineBatchState(projectRoot, (draft) => {
			draft.phase = "paused";
			return false;
		});

		assert.equal(result.ok, true);
		assert.equal(result.changed, false);
		assert.equal(result.state?.phase, "running");
		assert.equal(result.state?.updatedAt, before.updatedAt);

		// No write happened: the on-disk record is byte-identical.
		const after = loadSpineBatchState(projectRoot).raw;
		assert.equal(after?.phase, "running");
		assert.equal(after?.updatedAt, before.updatedAt);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("draft is a structuredClone — mutating it never touches diskState", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-clone-"));
	try {
		saveSpineBatchState(projectRoot, {
			batchId: "20260930T000000-upd3",
			phase: "running",
			nested: { list: [1] },
		});

		const result = updateSpineBatchState(projectRoot, (draft, { diskState }) => {
			assert.notEqual(draft, diskState);
			assert.notEqual(draft.nested, diskState.nested);
			draft.phase = "paused";
			draft.nested.list.push(2);
			diskState.phase = "completed";
			return false;
		});

		assert.equal(result.changed, false);
		// diskState mutation inside mutate is caller-local; disk is untouched.
		const disk = loadSpineBatchState(projectRoot).raw;
		assert.equal(disk?.phase, "running");
		assert.deepEqual(disk?.nested?.list, [1]);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("guard rejection surfaces stale_engine_pid and keeps disk state", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-guard-"));
	try {
		const batchId = "20260930T000000-upd4";
		const state = { batchId, phase: "running" };
		recordBatchEnginePid(state, owner.pid);
		// Seed with bypass: the test process is not the recorded owner.
		saveSpineBatchState(projectRoot, state, { bypassOwnerCheck: true });

		const result = updateSpineBatchState(projectRoot, (draft) => {
			draft.phase = "paused";
		});

		assert.equal(result.ok, false);
		assert.equal(result.reason, "stale_engine_pid");
		assert.equal(result.state?.phase, "running");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "running");

		// SP-790 visibility: the refused write is journaled, not silent.
		const events = readJournalEvents(projectRoot, batchId);
		const rejected = events.filter((event) => event.type === "batch.state_write_rejected");
		assert.equal(rejected.length, 1);
		assert.equal(rejected[0].payload?.reason, "stale_engine_pid");
		assert.equal(rejected[0].payload?.incomingPhase, "paused");
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("bypassOwnerCheck passes through to the shared guard/write path", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-bypass-"));
	try {
		const state = { batchId: "20260930T000000-upd5", phase: "running" };
		recordBatchEnginePid(state, owner.pid);
		saveSpineBatchState(projectRoot, state, { bypassOwnerCheck: true });

		const result = updateSpineBatchState(
			projectRoot,
			(draft) => {
				draft.phase = "paused";
			},
			{ bypassOwnerCheck: true },
		);

		assert.equal(result.ok, true);
		assert.equal(result.changed, true);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await rm(projectRoot, { recursive: true, force: true });
	}
});

/** Minimal completed-batch fixture for the gate-reopen cases (SP-793 / #301). */
function gateReopenCompletedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "TP-793", status: "succeeded", taskFolder: "TP-793", doneFileFound: true }],
	};
}

/** Give the orch branch one commit so a gate targetRevision pin can resolve. */
function createOrchBranchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/** Seed batch-state.json byte-exactly (raw write so the guard sees exactly this). */
function writeRawBatchState(projectRoot, state) {
	const filePath = spineBatchStatePath(projectRoot);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

test("SP-793: resume-gate-reopen reopens through the guarded helper — no owner bypass", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-helper-");
	const batchId = "20260930T000000-reopen1";
	const orchBranch = "orch/spine-reopen-helper";
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	try {
		createOrchBranchWithWork(projectRoot, orchBranch);
		const state = gateReopenCompletedFixture(batchId, orchBranch);
		// Completed saves clear the engine PID, so seed a live foreign owner with a
		// raw write — the exact disk shape the write guard must adjudicate.
		recordBatchEnginePid(state, owner.pid);
		writeRawBatchState(projectRoot, state);
		const seededBytes = fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8");

		const result = tryResumeCompletedGateReopen({
			projectRoot,
			resumeCheck: { batchId, gateReopen: true },
			releaseResumeLock: () => {},
		});

		// The reopen itself succeeds: a fresh pending gate record is on disk.
		assert.equal(result.reopened, true, result.output);
		assert.equal(result.ok, true);
		const gate = JSON.parse(fs.readFileSync(gateRecordPath(projectRoot, batchId), "utf-8"));
		assert.equal(gate.status, "pending");
		assert.equal(gate.batchId, batchId);

		// The persist went through the guard WITHOUT bypassOwnerCheck: the live
		// foreign owner refused the state write (pre-SP-793 the bypass wrote anyway).
		const events = readJournalEvents(projectRoot, batchId);
		const rejected = events.filter((event) => event.type === "batch.state_write_rejected");
		assert.equal(rejected.length, 1);
		assert.equal(rejected[0].payload?.reason, "stale_engine_pid");

		// Refused write kept the owner's disk record byte-identical.
		assert.equal(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"), seededBytes);
	} finally {
		try {
			owner.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});

test("SP-793: resume-gate-reopen reads fresh state under the lock and does not clobber a concurrent phase: paused", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-paused-");
	const batchId = "20260930T000000-reopen2";
	const orchBranch = "orch/spine-reopen-paused";
	try {
		createOrchBranchWithWork(projectRoot, orchBranch);
		// The resume precheck snapshotted phase: completed (gateReopen was set);
		// the concurrent operator pause lands on disk before the reopen write.
		writeRawBatchState(projectRoot, {
			...gateReopenCompletedFixture(batchId, orchBranch),
			phase: "paused",
		});

		const result = tryResumeCompletedGateReopen({
			projectRoot,
			resumeCheck: { batchId, gateReopen: true },
			releaseResumeLock: () => {},
		});

		// The reopen decision used the locked fresh read — a completed-only
		// operation must decline on the concurrently paused batch.
		assert.equal(result.reopened, false);
		assert.equal(result.reopenReason, "batch_not_completed");
		assert.equal(result.ok, false);

		// The paused phase survives: no whole-file clobber of the concurrent write.
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "paused");

		// Declined reopen never opened a gate record.
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, batchId)), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
