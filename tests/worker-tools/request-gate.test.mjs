import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { saveGateRecord } from "../../src/batch/gate.mjs";
import { requestWorkerGate } from "../../src/worker-tools/request-gate.mjs";

test("requestWorkerGate fails closed without batch context", () => {
	const result = requestWorkerGate({ projectRoot: "", batchId: "20260602T120000" });
	assert.equal(result.ok, false);
	assert.match(result.error ?? "", /batch context/i);
	assert.equal(result.suggestedCommand, "spine status --diagnose");
});

test("requestWorkerGate returns not_supported for integrate gate", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rg-int-"));
	const batchId = "20260602T140000";
	saveGateRecord(projectRoot, {
		gateId: "gate-1",
		batchId,
		kind: "integrate",
		status: "pending",
		openedAt: new Date().toISOString(),
		evidenceRefs: [],
	});

	const result = requestWorkerGate({ projectRoot, batchId, reason: "need help" });
	assert.equal(result.ok, false);
	assert.equal(result.notSupported, true);
	assert.equal(result.limitation, "integrate-only");
	assert.equal(result.suggestedCommand, "spine gate status");
	assert.ok(Array.isArray(result.alternatives));
	assert.equal(result.gate?.kind, "integrate");

	fs.rmSync(projectRoot, { recursive: true, force: true });
});

test("requestWorkerGate returns not_supported when no gate record (manual deferred)", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rg-man-"));
	const batchId = "20260602T150000";

	const result = requestWorkerGate({ projectRoot, batchId });
	assert.equal(result.ok, false);
	assert.equal(result.notSupported, true);
	assert.equal(result.limitation, "manual-gate-deferred");
	assert.equal(result.suggestedCommand, "spine gate approve");
	assert.ok(Array.isArray(result.alternatives));
	assert.ok(result.alternatives.includes("spine gate status"));

	fs.rmSync(projectRoot, { recursive: true, force: true });
});
