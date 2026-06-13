import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runSpineJournal } from "../../bin/spine-journal.mjs";
import { appendJournalEvent, exportJournalJsonl, journalPath } from "../../src/batch/journal.mjs";

test("exportJournalJsonl returns null when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-"));
	try {
		assert.equal(exportJournalJsonl(root, "20260601T150000"), null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal export exits non-zero when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-cli-"));
	try {
		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", "20260601T150000", "--format", "jsonl"],
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Journal not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal export writes jsonl to stdout", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-cli-"));
	const batchId = "20260601T150000";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchId, "task.completed", {
			taskId: "SP-235",
			laneNumber: 2,
		});

		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", batchId, "--format", "jsonl"],
		});
		assert.equal(result.exitCode, 0);

		const rawFile = fs.readFileSync(journalPath(root, batchId), "utf-8");
		assert.equal(result.output, rawFile);

		const lines = result.output.trim().split("\n");
		assert.equal(lines.length, 2);
		assert.equal(JSON.parse(lines[0]).type, "batch.started");
		assert.equal(JSON.parse(lines[1]).type, "task.completed");
		assert.equal(JSON.parse(lines[1]).taskId, "SP-235");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal export --output writes file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-cli-"));
	const batchId = "20260601T160000";
	const outPath = path.join(root, "exports", "journal.jsonl");
	try {
		appendJournalEvent(root, batchId, "batch.failed", { reason: "merge" });

		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", batchId, "--format", "jsonl", "--output", outPath],
		});
		assert.equal(result.exitCode, 0);
		assert.equal(result.output, "");
		assert.ok(fs.existsSync(outPath));

		const exported = fs.readFileSync(outPath, "utf-8");
		const rawFile = fs.readFileSync(journalPath(root, batchId), "utf-8");
		assert.equal(exported, rawFile);
		assert.equal(JSON.parse(exported.trim()).type, "batch.failed");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
