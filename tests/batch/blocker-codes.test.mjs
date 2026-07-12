import assert from "node:assert/strict";
import test from "node:test";
import {
	BLOCKER_CODES,
	isBlockerCode,
	makeBlocker,
} from "../../src/batch/blocker-codes.mjs";

test("BLOCKER_CODES includes integrate and readiness allow-list entries", () => {
	assert.ok(BLOCKER_CODES.includes("missing_gate"));
	assert.ok(BLOCKER_CODES.includes("gate_pending"));
	assert.ok(BLOCKER_CODES.includes("gate_rejected"));
	assert.ok(BLOCKER_CODES.includes("stale_revision"));
	assert.ok(BLOCKER_CODES.includes("force_integrate_blocked"));
	assert.ok(BLOCKER_CODES.includes("missing_task"));
	assert.ok(BLOCKER_CODES.includes("open_gate"));
	assert.ok(BLOCKER_CODES.includes("missing_ready_for_pr_gate"));
	assert.equal(new Set(BLOCKER_CODES).size, BLOCKER_CODES.length);
});

test("makeBlocker returns { code, message } for allow-listed codes", () => {
	const blocker = makeBlocker("missing_gate", "Integrate gate not opened");
	assert.deepEqual(blocker, {
		code: "missing_gate",
		message: "Integrate gate not opened",
	});

	const stale = makeBlocker("stale_revision", "Gate targetRevision drifted from orch tip");
	assert.equal(stale.code, "stale_revision");
	assert.match(stale.message, /targetRevision/);
});

test("makeBlocker rejects unknown codes fail-closed", () => {
	assert.throws(() => makeBlocker("not_a_real_code", "x"), /Unknown BlockerCode/);
	assert.throws(() => makeBlocker("", "x"), /Unknown BlockerCode/);
	assert.throws(() => makeBlocker(/** @type {any} */ (null), "x"), /Unknown BlockerCode/);
});

test("makeBlocker rejects empty or non-string messages", () => {
	assert.throws(() => makeBlocker("gate_pending", ""), /non-empty string/);
	assert.throws(() => makeBlocker("gate_pending", "   "), /non-empty string/);
	assert.throws(() => makeBlocker("gate_pending", /** @type {any} */ (42)), /non-empty string/);
});

test("isBlockerCode mirrors the allow-list", () => {
	assert.equal(isBlockerCode("gate_rejected"), true);
	assert.equal(isBlockerCode("unknown"), false);
	assert.equal(isBlockerCode(1), false);
});
