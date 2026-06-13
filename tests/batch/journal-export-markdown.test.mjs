import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	exportJournalMarkdown,
	formatJournalMarkdownTimeline,
	runSpineJournal,
} from "../../bin/spine-journal.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";

test("exportJournalMarkdown returns null when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-md-"));
	try {
		assert.equal(exportJournalMarkdown(root, "20260601T150000"), null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatJournalMarkdownTimeline produces stable table shape", () => {
	const batchId = "20260601T150000";
	const events = [
		{
			type: "batch.started",
			timestamp: "2026-06-01T15:00:00.000Z",
			payload: { baseBranch: "main", orchBranch: "orch/batch" },
		},
		{
			type: "task.completed",
			timestamp: "2026-06-01T15:05:00.000Z",
			laneId: "lane-1",
			taskId: "SP-236",
			payload: { commitSha: "abc1234567890abcdef" },
		},
	];

	const markdown = formatJournalMarkdownTimeline(batchId, events);
	assert.match(markdown, /^# Batch journal timeline — 20260601T150000\n\n/);
	assert.match(markdown, /\| Time \(UTC\) \| Event \| Lane \| Task \| Summary \|/);
	assert.match(markdown, /\|------------\|-------\|------\|------\|--------- \|/);
	assert.match(markdown, /\| 2026-06-01 15:00:00 \| batch.started \| — \| — \| main → orch\/batch \|/);
	assert.match(markdown, /\| 2026-06-01 15:05:00 \| task.completed \| lane-1 \| SP-236 \| commit abc12345 \|/);
});

test("formatJournalMarkdownTimeline escapes pipe characters in summary", () => {
	const markdown = formatJournalMarkdownTimeline("batch", [
		{
			type: "task.failed",
			timestamp: "2026-06-01T16:00:00.000Z",
			payload: { error: "a|b" },
		},
	]);
	assert.match(markdown, /a\\|b/);
});

test("runSpineJournal export markdown exits non-zero when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-md-cli-"));
	try {
		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", "20260601T150000", "--format", "markdown"],
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Journal not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal export writes markdown to stdout", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-md-cli-"));
	const batchId = "20260601T170000";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchId, "task.completed", {
			taskId: "SP-236",
			laneNumber: 2,
		});

		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", batchId, "--format", "markdown"],
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /# Batch journal timeline — 20260601T170000/);
		assert.match(result.output, /batch.started/);
		assert.match(result.output, /task.completed/);
		assert.match(result.output, /SP-236/);
		assert.match(result.output, /lane-2/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpineJournal export markdown --output writes file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-export-md-cli-"));
	const batchId = "20260601T180000";
	const outPath = path.join(root, "exports", "journal.md");
	try {
		appendJournalEvent(root, batchId, "batch.failed", { reason: "merge" });

		const result = runSpineJournal({
			projectRoot: root,
			args: ["export", "--batch", batchId, "--format", "markdown", "--output", outPath],
		});
		assert.equal(result.exitCode, 0);
		assert.equal(result.output, "");
		assert.ok(fs.existsSync(outPath));

		const exported = fs.readFileSync(outPath, "utf-8");
		assert.match(exported, /# Batch journal timeline — 20260601T180000/);
		assert.match(exported, /batch.failed/);
		assert.match(exported, /merge/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
