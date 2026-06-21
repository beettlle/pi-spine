import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rm, mkdtemp } from "node:fs/promises";

import {
	isWorkerDoneMarkerValid,
	parseWorkerDoneMarker,
	persistWorkerOutputLog,
	readWorkerDoneMarker,
	writeWorkerDoneMarker,
} from "../../src/batch/worker-output.mjs";

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
