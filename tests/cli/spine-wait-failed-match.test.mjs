import assert from "node:assert/strict";
import test from "node:test";

import {
	diagnosisMatchesUntil,
	reconciliationMatchesUntil,
} from "../../src/cli/spine-wait.mjs";

test("--until failed matches terminal failure with worker_done_missing diagnosis (#252)", () => {
	const until = new Set(["completed", "failed", "needs_integrate"]);
	const result = {
		phase: "failed",
		diagnosis: "worker_done_missing",
		suggestedCommand: "spine batch retry SP-001",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("--until failed matches terminal failure with worker_orphaned diagnosis (#252)", () => {
	const until = new Set(["failed"]);
	const result = {
		phase: "failed",
		diagnosis: "worker_orphaned",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("--until failed matches terminal failure with engine_orphaned diagnosis (#252)", () => {
	const until = new Set(["failed"]);
	const result = {
		phase: "failed",
		diagnosis: "engine_orphaned",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("--until failed still matches literal failed diagnosis", () => {
	const until = new Set(["failed"]);
	const result = {
		phase: "failed",
		diagnosis: "failed",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("--until failed does not match when batch phase is not failed", () => {
	const until = new Set(["failed"]);
	const result = {
		phase: "running",
		diagnosis: "running",
	};
	assert.equal(reconciliationMatchesUntil(result, until), false);
});

test("phase-failed fallback does not fire when failed is not in --until list", () => {
	const until = new Set(["completed", "needs_integrate"]);
	const result = {
		phase: "failed",
		diagnosis: "worker_done_missing",
	};
	assert.equal(reconciliationMatchesUntil(result, until), false);
});

test("explicit failure-class diagnosis token still matches directly", () => {
	const until = new Set(["worker_done_missing"]);
	const result = {
		phase: "failed",
		diagnosis: "worker_done_missing",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
	assert.equal(diagnosisMatchesUntil("worker_done_missing", until), true);
});

test("explicit failure-class token matches even when phase is absent", () => {
	const until = new Set(["engine_orphaned"]);
	const result = {
		diagnosis: "engine_orphaned",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});
