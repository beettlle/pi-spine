import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { appendBatchHistoryEntry, batchHistoryPath } from "../../src/batch/state.mjs";

/** Read the history file as a parsed array. */
function readHistory(projectRoot) {
	return JSON.parse(fs.readFileSync(batchHistoryPath(projectRoot), "utf-8"));
}

/** List quarantined corrupt-history files under `.spine/runtime/`. */
function listQuarantineFiles(projectRoot) {
	const runtimeDir = path.join(projectRoot, ".spine", "runtime");
	if (!fs.existsSync(runtimeDir)) return [];
	return fs.readdirSync(runtimeDir).filter((name) => name.startsWith("batch-history.json.corrupt."));
}

test("appendBatchHistoryEntry writes atomically and leaves no temp files", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-history-atomic-"));
	try {
		appendBatchHistoryEntry(projectRoot, { batchId: "b1", action: "completed" });
		appendBatchHistoryEntry(projectRoot, { batchId: "b2", action: "dismissed" });

		const history = readHistory(projectRoot);
		assert.equal(history.length, 2);
		assert.equal(history[0].batchId, "b1");
		assert.equal(history[1].batchId, "b2");

		// Atomic write uses temp file + rename; no *.tmp artifacts may survive.
		const spineDir = path.join(projectRoot, ".spine");
		const leftovers = fs.readdirSync(spineDir).filter((name) => name.endsWith(".tmp"));
		assert.deepEqual(leftovers, []);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("concurrent appends retain both entries", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-history-concurrent-"));
	try {
		// appendBatchHistoryEntry is synchronous, so Promise.all interleaves the
		// call sites the way concurrent engine/operator paths would; both
		// entries must survive the read-modify-write cycle.
		await Promise.all([
			Promise.resolve().then(() =>
				appendBatchHistoryEntry(projectRoot, { batchId: "concurrent-a", action: "completed" }),
			),
			Promise.resolve().then(() =>
				appendBatchHistoryEntry(projectRoot, { batchId: "concurrent-b", action: "completed" }),
			),
		]);

		const history = readHistory(projectRoot);
		const batchIds = history.map((entry) => entry.batchId).sort();
		assert.deepEqual(batchIds, ["concurrent-a", "concurrent-b"]);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("corrupt history file is quarantined, never silently reset", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-history-corrupt-"));
	try {
		const filePath = batchHistoryPath(projectRoot);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		const corruptBytes = '{"batchId":"old", unparseable garbage';
		fs.writeFileSync(filePath, corruptBytes, "utf-8");

		appendBatchHistoryEntry(projectRoot, { batchId: "new-batch", action: "completed" });

		// Corrupt bytes preserved in a timestamped quarantine file.
		const quarantined = listQuarantineFiles(projectRoot);
		assert.equal(quarantined.length, 1);
		const quarantinePath = path.join(projectRoot, ".spine", "runtime", quarantined[0]);
		assert.equal(fs.readFileSync(quarantinePath, "utf-8"), corruptBytes);

		// Fresh history contains only the new entry; original was not wiped silently.
		const history = readHistory(projectRoot);
		assert.equal(history.length, 1);
		assert.equal(history[0].batchId, "new-batch");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("non-array history root is quarantined as corrupt", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-history-nonarray-"));
	try {
		const filePath = batchHistoryPath(projectRoot);
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.writeFileSync(filePath, '{"not":"an array"}\n', "utf-8");

		appendBatchHistoryEntry(projectRoot, { batchId: "fresh", action: "aborted" });

		assert.equal(listQuarantineFiles(projectRoot).length, 1);
		const history = readHistory(projectRoot);
		assert.equal(history.length, 1);
		assert.equal(history[0].batchId, "fresh");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
