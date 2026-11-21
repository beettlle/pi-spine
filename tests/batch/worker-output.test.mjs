import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rm, mkdtemp } from "node:fs/promises";

import {
	BACKGROUND_VERIFICATION_HINT,
	detectBackgroundedVerification,
	finalizeWorkerOutput,
	isWorkerDoneMarkerValid,
	looksLikePiJsonNdjson,
	parseWorkerDoneMarker,
	persistWorkerOutputLog,
	readWorkerDoneMarker,
	summarizePiJsonFailureOutput,
	writeWorkerDoneMarker,
} from "../../src/batch/worker-output.mjs";
import { buildWorkerDoneMissingHeadline } from "../../src/batch/diagnosis-worker-done-missing.mjs";
import { MAX_PAYLOAD_BYTES } from "../../src/batch/journal.mjs";

test("parseWorkerDoneMarker accepts legacy empty and text markers", () => {
	assert.deepEqual(parseWorkerDoneMarker(""), { valid: true, legacy: true, kind: "empty" });
	assert.deepEqual(parseWorkerDoneMarker("   \n"), { valid: true, legacy: true, kind: "empty" });
	assert.deepEqual(parseWorkerDoneMarker("Completed: 2026-06-20\nTask: stub\n"), {
		valid: true,
		legacy: true,
		kind: "text",
	});
});

test("parseWorkerDoneMarker accepts structured JSON markers", () => {
	const parsed = parseWorkerDoneMarker(
		JSON.stringify({ taskId: "SP-321", completedAt: "2026-06-20T12:00:00.000Z" }),
	);
	assert.equal(parsed.valid, true);
	assert.equal(parsed.legacy, false);
	assert.equal(parsed.kind, "json");
	assert.equal(parsed.taskId, "SP-321");
	assert.equal(parsed.completedAt, "2026-06-20T12:00:00.000Z");
});

test("parseWorkerDoneMarker rejects partial JSON markers", () => {
	const partial = parseWorkerDoneMarker('{"taskId":"SP-321"');
	assert.equal(partial.valid, false);
	assert.equal(partial.kind, "json_partial");
	assert.equal(partial.reason, "parse_error");

	const missingFields = parseWorkerDoneMarker('{"taskId":"SP-321"}');
	assert.equal(missingFields.valid, false);
	assert.equal(missingFields.kind, "json_partial");
	assert.equal(missingFields.reason, "missing_fields");
});

test("isWorkerDoneMarkerValid mirrors parseWorkerDoneMarker", () => {
	assert.equal(isWorkerDoneMarkerValid(""), true);
	assert.equal(isWorkerDoneMarkerValid('{"taskId":"SP-321"}'), false);
	assert.equal(
		isWorkerDoneMarkerValid(
			JSON.stringify({ taskId: "SP-321", completedAt: "2026-06-20T12:00:00.000Z" }),
		),
		true,
	);
});

test("writeWorkerDoneMarker writes atomic structured JSON", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-done-"));
	try {
		const donePath = path.join(root, "spine-tasks", "SP-321-test", ".DONE");
		writeWorkerDoneMarker(donePath, { taskId: "SP-321" });

		const content = fs.readFileSync(donePath, "utf-8");
		const data = JSON.parse(content);
		assert.equal(data.taskId, "SP-321");
		assert.match(data.completedAt, /^\d{4}-\d{2}-\d{2}T/);

		const entries = fs.readdirSync(path.dirname(donePath), { recursive: true });
		assert.equal(entries.some((name) => String(name).includes(".tmp")), false);

		const read = readWorkerDoneMarker(donePath);
		assert.equal(read.present, true);
		assert.equal(read.valid, true);
		assert.equal(read.kind, "json");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("readWorkerDoneMarker reports absent marker", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-done-missing-"));
	try {
		const donePath = path.join(root, ".DONE");
		assert.deepEqual(readWorkerDoneMarker(donePath), { present: false, valid: false });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("detectBackgroundedVerification matches background-and-exit worker output (#276)", () => {
	// Exact narration from the #276 incident.
	assert.equal(
		detectBackgroundedVerification(
			"`release:check` still running (output is redirected ...). I'll wait for the completion wake; no action needed until then.",
		),
		true,
	);
	// Strong single-phrase matches.
	assert.equal(detectBackgroundedVerification("started the suite as a background monitor"), true);
	assert.equal(detectBackgroundedVerification("release:check is running in the background"), true);
	// Pending work plus background context.
	assert.equal(
		detectBackgroundedVerification("test suite still running; output redirected to /tmp/out.log"),
		true,
	);
	// Negative cases.
	assert.equal(detectBackgroundedVerification(""), false);
	assert.equal(detectBackgroundedVerification(null), false);
	assert.equal(detectBackgroundedVerification("Error: expected 3 to equal 4"), false);
	assert.equal(detectBackgroundedVerification("npm error Test failed. See above for more details."), false);
	assert.equal(detectBackgroundedVerification("all 212 tests passed in 40s"), false);
	// Pending work without background context is not a background-and-exit signal.
	assert.equal(detectBackgroundedVerification("render still running after 2s"), false);
});

test("buildWorkerDoneMissingHeadline appends targeted hint for backgrounded verification (#276)", () => {
	const base = { batchId: "20260902T000000", failedTaskId: "SP-238", changedFileCount: 1 };
	const incidentTail =
		"`release:check` still running (output is redirected ...). I'll wait for the completion wake; no action needed until then.";

	const hinted = buildWorkerDoneMissingHeadline("batch 20260902T000000", {
		...base,
		workerOutputTail: incidentTail,
	});
	assert.match(hinted, /exited without \.DONE/);
	assert.ok(hinted.includes(BACKGROUND_VERIFICATION_HINT));

	const plain = buildWorkerDoneMissingHeadline("batch 20260902T000000", {
		...base,
		workerOutputTail: "npm error Test failed. See above for more details.",
	});
	assert.match(plain, /exited without \.DONE/);
	assert.equal(plain.includes(BACKGROUND_VERIFICATION_HINT), false);
});

test("persistWorkerOutputLog writes atomically without temp leftovers", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-output-atomic-"));
	try {
		const result = persistWorkerOutputLog({
			projectRoot: root,
			batchId: "20260620T120000",
			laneNumber: 1,
			taskId: "SP-321",
			rawOutput: "line one\nline two\n",
		});

		assert.ok(result?.logPath);
		assert.equal(fs.readFileSync(result.logPath, "utf-8"), "line one\nline two\n");

		const logDir = path.dirname(result.logPath);
		const entries = fs.readdirSync(logDir);
		assert.equal(entries.some((name) => name.includes(".tmp")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("looksLikePiJsonNdjson detects session/message_start streams (#381)", () => {
	assert.equal(looksLikePiJsonNdjson('{"type":"session","version":3}\n'), true);
	assert.equal(looksLikePiJsonNdjson("npm error Test failed"), false);
});

test("summarizePiJsonFailureOutput stays under journal cap and skips system prompt (#381)", () => {
	const systemPreamble = "You are a coding assistant running inside pi".padEnd(40_000, "X");
	const stream = [
		JSON.stringify({ type: "session", version: 3, id: "t" }),
		JSON.stringify({
			type: "message_start",
			message: { role: "system", content: "", sections: { preamble: systemPreamble } },
		}),
		JSON.stringify({
			type: "message_end",
			message: { role: "system", content: "", sections: { preamble: systemPreamble } },
		}),
		JSON.stringify({
			type: "message_update",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "hello from assistant" }],
			},
		}),
		JSON.stringify({ type: "error", error: "provider timeout" }),
	].join("\n");

	assert.ok(Buffer.byteLength(stream, "utf8") > MAX_PAYLOAD_BYTES);

	const summary = summarizePiJsonFailureOutput(stream, {
		exitCode: 143,
		classification: "failed",
		logRef: "lanes/lane-1/worker-output-SP-882.log",
	});
	assert.ok(Buffer.byteLength(summary, "utf8") < MAX_PAYLOAD_BYTES);
	assert.match(summary, /exitCode=143/);
	assert.match(summary, /provider timeout/);
	assert.equal(summary.includes(systemPreamble.slice(0, 80)), false);
	assert.match(summary, /fullLog: lanes\/lane-1\/worker-output-SP-882\.log/);
});

test("finalizeWorkerOutput journals JSON summary while persisting full stream (#381)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-json-fail-summary-"));
	try {
		const systemPreamble = "SYSTEM_PROMPT_MARKER".padEnd(50_000, "!");
		const rawOutput = [
			JSON.stringify({ type: "session", version: 3 }),
			JSON.stringify({
				type: "message_start",
				message: { role: "system", content: "", sections: { preamble: systemPreamble } },
			}),
			JSON.stringify({ type: "agent_start" }),
		].join("\n");

		const finalized = finalizeWorkerOutput({
			rawOutput,
			classification: "failed",
			ok: false,
			projectRoot: root,
			batchId: "20261121T000000",
			laneNumber: 1,
			taskId: "SP-882",
			exitCode: 143,
		});

		assert.ok(finalized.logPath);
		assert.ok(fs.readFileSync(finalized.logPath, "utf-8").includes("SYSTEM_PROMPT_MARKER"));
		assert.ok(Buffer.byteLength(finalized.output, "utf8") < MAX_PAYLOAD_BYTES);
		assert.match(finalized.output, /pi --mode json failure/);
		assert.equal(finalized.output.includes("SYSTEM_PROMPT_MARKER"), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
