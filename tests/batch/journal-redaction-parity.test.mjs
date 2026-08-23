import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	appendJournalEvent,
	readJournalEvents,
} from "../../src/batch/journal.mjs";
import {
	redactWorkerOutput,
	resolveWorkerOutputConfig,
} from "../../src/batch/worker-output.mjs";
import {
	redactHandoffSecrets,
	redactHandoffText,
} from "../../src/cli/handoff.mjs";
import { sanitizeMetricRecord } from "../../src/batch/metrics.mjs";

/**
 * SP-716 (#260) parity guard: the same secret shape must be redacted
 * identically across every channel — journal payloads, worker output,
 * handoff text/structures, and metric records.
 */
const SECRET_CORPUS = [
	"sk-live1234567890abcdef",
	"ghp_abcdefghij0123456789",
	"Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload",
	"postgres://user:pw@db.internal:5432/app",
	"OPENAI_API_KEY=sk-test123456789",
	"password: hunter2",
];

const outputConfig = resolveWorkerOutputConfig({});

function assertFullyRedacted(channel, rendered, secrets) {
	for (const secret of secrets) {
		assert.ok(!rendered.includes(secret), `${channel} leaked secret: ${secret}`);
	}
	assert.match(rendered, /\[REDACTED\]/, `${channel} produced no redaction marker`);
}

test("parity: identical secret shapes redacted in journal, worker output, and handoff", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-redact-parity-"));
	try {
		const batchId = "20260823T000000";
		for (const [index, secret] of SECRET_CORPUS.entries()) {
			// Journal channel: secret rides in output/environment payload fields.
			appendJournalEvent(root, batchId, "task.failed", {
				taskId: `SP-${index}`,
				output: `worker failed with ${secret}`,
				environment: `env had ${secret}`,
			});
			const events = readJournalEvents(root, batchId);
			const entry = events[events.length - 1];
			assertFullyRedacted("journal", JSON.stringify(entry.payload), [secret]);

			// Worker-output channel: secret in a raw stdout/stderr chunk.
			const workerRendered = redactWorkerOutput(`line before ${secret} line after`, outputConfig);
			assertFullyRedacted("worker-output", workerRendered, [secret]);

			// Handoff channel: free text and structured payload.
			assertFullyRedacted("handoff-text", redactHandoffText(`tail: ${secret}`), [secret]);
			const handoffRendered = redactHandoffSecrets({ note: `tail: ${secret}` });
			assertFullyRedacted("handoff-struct", JSON.stringify(handoffRendered), [secret]);

			// Metrics channel: secret in a record string field.
			const metricRendered = sanitizeMetricRecord({ summary: `saw ${secret}` });
			assertFullyRedacted("metrics", JSON.stringify(metricRendered), [secret]);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("journal redacts value-shaped secrets in output and environment fields", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-redact-journal-"));
	try {
		const batchId = "20260823T000001";
		appendJournalEvent(root, batchId, "task.failed", {
			output: "boom sk-live1234567890abcdef",
			environment: "GITHUB_TOKEN=ghp_abcdefghij0123456789",
			classification: "failed",
		});
		const [event] = readJournalEvents(root, batchId);
		assert.equal(event.payload.output, "boom [REDACTED]");
		assert.equal(event.payload.environment, "[REDACTED]");
		assert.equal(event.payload.classification, "failed");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("journal payload cap is byte-safe for multi-byte UTF-8", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-redact-cap-"));
	try {
		const batchId = "20260823T000002";
		// 32 KiB of 3-byte characters: string length is under MAX_PAYLOAD_BYTES
		// but the UTF-8 byte length is far above it.
		const entry = appendJournalEvent(root, batchId, "task.failed", {
			output: "€".repeat(32 * 1024),
		});
		assert.equal(entry.payload._truncated, true);
		assert.ok(entry.payload._originalBytes > entry.payload._maxBytes);
		assert.ok(Buffer.byteLength(entry.payload.preview, "utf-8") <= entry.payload._maxBytes);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
