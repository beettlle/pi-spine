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
	verifyJournalChecksum,
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

test("appendJournalEvent stamps a verifiable SHA-256 checksum on new events", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-checksum-"));
	try {
		const batchId = "20260815T170000";
		const entry = appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });

		assert.equal(typeof entry.checksum, "string");
		assert.match(entry.checksum, /^[0-9a-f]{64}$/);
		assert.ok(verifyJournalChecksum(entry));

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].checksum, entry.checksum);
		assert.ok(verifyJournalChecksum(events[0]));

		// Tampering with any field invalidates the checksum.
		const tampered = { ...events[0], type: "batch.failed" };
		assert.equal(verifyJournalChecksum(tampered), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEvents loads legacy lines without checksum", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-legacy-"));
	const batchId = "20260815T170100";
	const journalDir = path.join(root, ".spine", "runtime", batchId, "journal");
	try {
		fs.mkdirSync(journalDir, { recursive: true });
		const legacyV1 = {
			schemaVersion: JOURNAL_SCHEMA_VERSION,
			eventId: "legacy-v1-no-checksum",
			type: "batch.started",
			timestamp: "2026-08-15T17:01:00.000Z",
			batchId,
			payload: { baseBranch: "main" },
		};
		fs.writeFileSync(path.join(journalDir, "events.jsonl"), `${JSON.stringify(legacyV1)}\n`, "utf-8");

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].eventId, "legacy-v1-no-checksum");
		assert.equal(events[0].checksum, undefined);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("readJournalEvents skips checksum-mismatched lines without discarding the file", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-tamper-"));
	const batchId = "20260815T170200";
	try {
		appendJournalEvent(root, batchId, "batch.started", { baseBranch: "main" });
		appendJournalEvent(root, batchId, "task.completed", { taskId: "SP-1" });

		// Corrupt the first line after writing: checksum no longer matches.
		const filePath = path.join(root, ".spine", "runtime", batchId, "journal", "events.jsonl");
		const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
		const corrupted = { ...JSON.parse(lines[0]), type: "batch.failed" };
		fs.writeFileSync(filePath, `${JSON.stringify(corrupted)}\n${lines[1]}\n`, "utf-8");

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "task.completed");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("concurrent appendJournalEvent calls do not interleave partial lines", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-journal-conc-"));
	const batchId = "20260815T170300";
	try {
		const count = 200;
		await Promise.all(
			Array.from({ length: count }, (_, index) =>
				Promise.resolve().then(() =>
					appendJournalEvent(root, batchId, "lane.heartbeat", { laneNumber: (index % 4) + 1, index }),
				),
			),
		);

		const filePath = path.join(root, ".spine", "runtime", batchId, "journal", "events.jsonl");
		const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
		assert.equal(lines.length, count);
		for (const line of lines) {
			const parsed = JSON.parse(line);
			assert.equal(parsed.type, "lane.heartbeat");
			assert.ok(verifyJournalChecksum(parsed));
		}
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
