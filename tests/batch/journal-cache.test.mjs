import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	appendJournalEvent,
	clearJournalCache,
	invalidateJournalCache,
	journalPath,
	readJournalEvents,
	readJournalEventsCached,
} from "../../src/batch/journal.mjs";

const BATCH_ID = "20260703T120000";

test("readJournalEventsCached returns same events as readJournalEvents", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, BATCH_ID, "task.started", { taskId: "SP-001" });

		const uncached = readJournalEvents(root, BATCH_ID);
		const cached = readJournalEventsCached(root, BATCH_ID);

		assert.equal(cached.length, uncached.length);
		assert.equal(cached[0].type, "batch.started");
		assert.equal(cached[1].type, "task.started");
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEventsCached returns cached copy on second call without file change", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const first = readJournalEventsCached(root, BATCH_ID);
		const second = readJournalEventsCached(root, BATCH_ID);

		// Same array reference proves the cache was hit (no re-parse).
		assert.strictEqual(first, second);
		assert.equal(first.length, 1);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEventsCached invalidates when file mtime changes", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const first = readJournalEventsCached(root, BATCH_ID);
		assert.equal(first.length, 1);

		// Append changes the file mtime.
		appendJournalEvent(root, BATCH_ID, "task.started", { taskId: "SP-002" });

		const second = readJournalEventsCached(root, BATCH_ID);
		assert.equal(second.length, 2);
		// Different array reference proves re-read occurred.
		assert.notStrictEqual(first, second);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEventsCached returns empty array for missing file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		const events = readJournalEventsCached(root, "nonexistent-batch");
		assert.deepEqual(events, []);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("clearJournalCache forces re-read on next call", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const first = readJournalEventsCached(root, BATCH_ID);
		clearJournalCache();
		const second = readJournalEventsCached(root, BATCH_ID);

		// Different reference after cache clear.
		assert.notStrictEqual(first, second);
		assert.equal(second.length, 1);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("invalidateJournalCache with matching path clears cache", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const first = readJournalEventsCached(root, BATCH_ID);
		const filePath = journalPath(root, BATCH_ID);
		invalidateJournalCache(filePath);

		const second = readJournalEventsCached(root, BATCH_ID);
		assert.notStrictEqual(first, second);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("invalidateJournalCache with non-matching path preserves cache", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const first = readJournalEventsCached(root, BATCH_ID);
		invalidateJournalCache("/some/other/path.jsonl");

		const second = readJournalEventsCached(root, BATCH_ID);
		// Same reference — cache was not cleared.
		assert.strictEqual(first, second);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEventsCached handles transition from missing to existing file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	try {
		clearJournalCache();
		const empty = readJournalEventsCached(root, BATCH_ID);
		assert.deepEqual(empty, []);

		appendJournalEvent(root, BATCH_ID, "batch.started", { baseBranch: "main" });

		const events = readJournalEventsCached(root, BATCH_ID);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "batch.started");
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEventsCached handles switch between different batch IDs", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-jcache-"));
	const batchA = "20260703T100000";
	const batchB = "20260703T110000";
	try {
		clearJournalCache();
		appendJournalEvent(root, batchA, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchB, "batch.started", { baseBranch: "develop" });

		const eventsA = readJournalEventsCached(root, batchA);
		assert.equal(eventsA.length, 1);
		assert.equal(eventsA[0].payload.baseBranch, "main");

		// Switching to a different batch re-reads.
		const eventsB = readJournalEventsCached(root, batchB);
		assert.equal(eventsB.length, 1);
		assert.equal(eventsB[0].payload.baseBranch, "develop");

		assert.notStrictEqual(eventsA, eventsB);
	} finally {
		clearJournalCache();
		await rm(root, { recursive: true, force: true });
	}
});
