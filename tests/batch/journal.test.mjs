import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	appendJournalEvent,
	capPayloadSize,
	extractJournalDiagnosisHints,
	JOURNAL_SCHEMA_VERSION,
	MAX_PAYLOAD_BYTES,
	normalizeJournalEvent,
	readJournalEvents,
	readLastTaskFailedEvent,
	redactSecrets,
} from "../../src/batch/journal.mjs";

test("appendJournalEvent writes schema v1 with ISO timestamp and payload", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-"));
	try {
		const entry = appendJournalEvent(root, "20260601T120000", "batch.started", {
			baseBranch: "main",
			orchBranch: "orch/spine-20260601T120000",
		});

		assert.equal(entry.schemaVersion, JOURNAL_SCHEMA_VERSION);
		assert.ok(entry.eventId);
		assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
		assert.equal(entry.type, "batch.started");
		assert.equal(entry.payload.baseBranch, "main");

		const events = readJournalEvents(root, "20260601T120000");
		assert.equal(events.length, 1);
		assert.equal(events[0].schemaVersion, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("readLastTaskFailedEvent returns most recent task.failed", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-failed-"));
	try {
		const batchId = "20260603T130000";
		appendJournalEvent(root, batchId, "task.failed", { taskId: "TP-1", classification: "failed" });
		appendJournalEvent(root, batchId, "task.completed", { taskId: "TP-1" });
		appendJournalEvent(root, batchId, "task.failed", {
			taskId: "TP-2",
			classification: "stall_timeout",
			error: "stalled",
		});

		const last = readLastTaskFailedEvent(root, batchId);
		assert.equal(last?.taskId, "TP-2");
		assert.equal(last?.payload?.classification, "stall_timeout");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("redactSecrets masks sensitive keys", () => {
	const redacted = redactSecrets({
		apiKey: "secret-value",
		token: "abc",
		nested: { password: "pw", ok: "visible" },
	});
	assert.equal(redacted.apiKey, "[REDACTED]");
	assert.equal(redacted.token, "[REDACTED]");
	assert.equal(redacted.nested.password, "[REDACTED]");
	assert.equal(redacted.nested.ok, "visible");
});

test("capPayloadSize truncates oversized payloads", () => {
	const huge = { blob: "x".repeat(MAX_PAYLOAD_BYTES) };
	const capped = capPayloadSize(huge);
	assert.equal(capped._truncated, true);
	assert.ok(Number(capped._originalBytes) > MAX_PAYLOAD_BYTES);
});

test("normalizeJournalEvent upgrades legacy lines", () => {
	const legacy = {
		type: "task.completed",
		batchId: "20260531T165700",
		timestamp: 1717180800000,
		taskId: "TP-001",
	};
	const normalized = normalizeJournalEvent(legacy);
	assert.equal(normalized.schemaVersion, 1);
	assert.equal(normalized.taskId, "TP-001");
	assert.ok(normalized.timestamp.includes("T"));
	assert.equal(normalized._legacy, true);
});

test("readJournalEvents reads mixed legacy and v1 lines", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-mix-"));
	const batchId = "20260601T130000";
	const journalDir = path.join(root, ".spine", "runtime", batchId, "journal");
	try {
		fs.mkdirSync(journalDir, { recursive: true });
		const legacyLine = JSON.stringify({
			type: "lane.heartbeat",
			batchId,
			timestamp: Date.now(),
			laneNumber: 1,
		});
		fs.writeFileSync(path.join(journalDir, "events.jsonl"), `${legacyLine}\n`, "utf-8");
		appendJournalEvent(root, batchId, "task.completed", { taskId: "TP-014" });

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 2);
		assert.equal(events[0].type, "lane.heartbeat");
		assert.equal(events[1].type, "task.completed");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("extractJournalDiagnosisHints surfaces failure events from tail", () => {
	const hints = extractJournalDiagnosisHints([
		{ type: "batch.started", timestamp: "2026-06-01T12:00:00.000Z", payload: {} },
		{
			type: "lane.stall_warning",
			timestamp: "2026-06-01T12:30:00.000Z",
			payload: { stallDeadline: 123 },
		},
		{
			type: "task.failed",
			timestamp: "2026-06-01T12:31:00.000Z",
			payload: { classification: "stall_timeout" },
		},
	]);
	assert.ok(hints.some((hint) => hint.type === "task.failed"));
	assert.ok(hints.some((hint) => hint.type === "lane.stall_warning"));
});
