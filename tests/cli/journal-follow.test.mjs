import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	formatJournalFollowLine,
	formatJournalFollowOutputLine,
	parseJournalFollowArgs,
	readJournalFollowSnapshot,
	resolveFollowBatchId,
	runJournalFollow,
} from "../../src/cli/journal-follow.mjs";

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function writeBatchState(projectRoot, batchId) {
	const spineDir = path.join(projectRoot, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	fs.writeFileSync(
		path.join(spineDir, "batch-state.json"),
		JSON.stringify({ batchId, phase: "running" }, null, 2),
		"utf-8",
	);
}

test("parseJournalFollowArgs reads batch, lane, and json flags", () => {
	assert.deepEqual(parseJournalFollowArgs(["--batch", "20260601T150000", "--lane", "lane-2", "--json"]), {
		batchId: "20260601T150000",
		laneId: "lane-2",
		json: true,
	});
	assert.deepEqual(parseJournalFollowArgs([]), {
		batchId: null,
		laneId: null,
		json: false,
	});
});

test("resolveFollowBatchId uses reconcile then batch-state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	const batchId = "20260601T170000";
	try {
		assert.equal(resolveFollowBatchId(root, batchId), batchId);
		assert.equal(resolveFollowBatchId(root, null), null);

		writeBatchState(root, batchId);
		assert.equal(resolveFollowBatchId(root, null), batchId);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("formatJournalFollowLine uses summarizeJournalEvent", () => {
	const line = formatJournalFollowLine({
		type: "task.completed",
		timestamp: "2026-06-01T15:00:00.000Z",
		laneId: "lane-1",
		taskId: "SP-361",
		payload: { reason: "done" },
	});
	assert.match(line, /task.completed/);
	assert.match(line, /lane-1/);
	assert.match(line, /SP-361/);
	assert.match(line, /done/);
});

test("formatJournalFollowOutputLine filters by lane and supports json passthrough", () => {
	const raw =
		'{"schemaVersion":1,"type":"task.started","timestamp":"2026-06-01T15:00:00.000Z","batchId":"b1","laneId":"lane-1","taskId":"SP-361","payload":{}}';

	assert.match(formatJournalFollowOutputLine(raw, { laneId: "lane-1" }) ?? "", /task.started/);
	assert.equal(formatJournalFollowOutputLine(raw, { laneId: "lane-2" }), null);
	assert.equal(formatJournalFollowOutputLine(raw, { json: true }), `${raw}\n`);
	assert.equal(formatJournalFollowOutputLine(raw, { json: true, laneId: "lane-2" }), null);
});

test("readJournalFollowSnapshot prints header once in human mode", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	const batchId = "20260601T180000";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		const filePath = path.join(root, ".spine", "runtime", batchId, "journal", "events.jsonl");
		const lines = [];
		readJournalFollowSnapshot(
			filePath,
			{
				onLine: (line) => lines.push(line),
				headerPrinted: { value: false },
			},
			fs,
		);
		assert.match(lines.join(""), /time\s+\| type/);
		assert.match(lines.join(""), /batch.started/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runJournalFollow exits non-zero when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	try {
		const result = await runJournalFollow({
			projectRoot: root,
			args: ["--batch", "20260601T190000"],
			follow: false,
			deps: { ...defaultFollowDeps(), stdout: { write: () => {} } },
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /Journal not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runJournalFollow exits non-zero when no batch can be resolved", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	try {
		const result = await runJournalFollow({
			projectRoot: root,
			args: [],
			follow: false,
			deps: { ...defaultFollowDeps(), stdout: { write: () => {} } },
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /No active batch/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runJournalFollow prints existing events without following", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	const batchId = "20260601T200000";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchId, "task.completed", {
			taskId: "SP-361",
			laneNumber: 1,
		});

		const result = await runJournalFollow({
			projectRoot: root,
			args: ["--batch", batchId],
			follow: false,
			deps: { ...defaultFollowDeps(), stdout: { write: () => {} } },
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /batch.started/);
		assert.match(result.output, /task.completed/);
		assert.match(result.output, /SP-361/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runJournalFollow defaults batch from batch-state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-"));
	const batchId = "20260601T210000";
	try {
		writeBatchState(root, batchId);
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });

		const result = await runJournalFollow({
			projectRoot: root,
			args: [],
			follow: false,
			deps: { ...defaultFollowDeps(), stdout: { write: () => {} } },
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /batch.started/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spine journal follow exits non-zero when journal missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-follow-cli-"));
	const spineBin = path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
		"..",
		"bin",
		"spine.mjs",
	);
	try {
		const result = spawnSync(process.execPath, [spineBin, "journal", "follow", "--batch", "20260601T220000"], {
			cwd: root,
			encoding: "utf-8",
		});
		assert.notEqual(result.status, 0);
		assert.match(result.stderr + result.stdout, /Journal not found/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

/**
 * @returns {{ fs: typeof fs, stdout: { write: (chunk: string) => void }, onSignal: () => void, offSignal: () => void }}
 */
function defaultFollowDeps() {
	return {
		fs,
		stdout: process.stdout,
		onSignal: () => {},
		offSignal: () => {},
	};
}
