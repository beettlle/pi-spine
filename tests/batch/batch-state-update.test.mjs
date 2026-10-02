/**
 * SP-791 — updateSpineBatchState atomic read-modify-write helper (GitHub #301).
 *
 * Unit cases for the structured result contract: missing/corrupt state,
 * no-op mutate, draft cloning, guard rejection surfacing, and option
 * pass-through. The two-process concurrency proof lives in
 * batch-state-lock.test.mjs.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	loadSpineBatchState,
	saveSpineBatchState,
	spineBatchStatePath,
	updateSpineBatchState,
} from "../../src/batch/state-io.mjs";
import { recordBatchEnginePid } from "../../src/batch/state-guards.mjs";

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
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

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

test("bypassWriteGuard passes through to the shared guard/write path", async () => {
	const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 60_000)"], {
		stdio: "ignore",
	});
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-state-update-bypass-"));
	try {
		const state = { batchId: "20260930T000000-upd5", phase: "running" };
		recordBatchEnginePid(state, owner.pid);
		saveSpineBatchState(projectRoot, state, { bypassWriteGuard: true });

		const result = updateSpineBatchState(
			projectRoot,
			(draft) => {
				draft.phase = "paused";
			},
			{ bypassWriteGuard: true },
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
