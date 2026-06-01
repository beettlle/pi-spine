import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runSpineJournal } from "../../bin/spine-journal.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";

test("runSpineJournal replay exits non-zero when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-cli-"));
	try {
		const result = runSpineJournal({
			projectRoot: root,
			args: ["replay", "--batch", "20260601T150000"],
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Journal not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal replay prints human table", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-cli-"));
	const batchId = "20260601T150000";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchId, "task.completed", {
			taskId: "TP-014",
			laneNumber: 1,
			correlationId: "corr-1",
		});

		const result = runSpineJournal({
			projectRoot: root,
			args: ["replay", "--batch", batchId],
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /Journal replay/);
		assert.match(result.output, /batch.started/);
		assert.match(result.output, /task.completed/);
		assert.match(result.output, /TP-014/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal replay --json returns events array", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-cli-"));
	const batchId = "20260601T160000";
	try {
		appendJournalEvent(root, batchId, "batch.failed", { reason: "merge" });
		const result = runSpineJournal({
			projectRoot: root,
			args: ["replay", "--batch", batchId, "--json"],
		});
		assert.equal(result.exitCode, 0);
		const parsed = JSON.parse(result.output);
		assert.equal(parsed.batchId, batchId);
		assert.equal(parsed.events.length, 1);
		assert.equal(parsed.events[0].type, "batch.failed");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
