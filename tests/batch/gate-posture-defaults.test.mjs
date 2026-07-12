import assert from "node:assert/strict";
import test from "node:test";
import {
	DEFAULT_POSTURES,
	GATE_CATEGORIES,
	LOCKED_CATEGORIES,
	POSTURES,
} from "../../src/batch/gate-posture-defaults.mjs";

const EXPECTED_CATEGORIES = ["read", "write", "execute", "destroy", "network", "auth"];

test("GATE_CATEGORIES lists the six #123 categories in order", () => {
	assert.deepEqual([...GATE_CATEGORIES], EXPECTED_CATEGORIES);
});

test("POSTURES names the four documented posture tiers", () => {
	assert.deepEqual(POSTURES, {
		PERMISSIVE: "permissive",
		CAUTIOUS: "cautious",
		GUARDED: "guarded",
		LOCKED: "locked",
	});
});

test("DEFAULT_POSTURES covers every category exactly once", () => {
	assert.deepEqual(Object.keys(DEFAULT_POSTURES).sort(), [...EXPECTED_CATEGORIES].sort());
	for (const category of GATE_CATEGORIES) {
		const entry = DEFAULT_POSTURES[category];
		assert.ok(entry, `missing DEFAULT_POSTURES.${category}`);
		assert.equal(typeof entry.posture, "string");
		assert.ok(
			Object.values(POSTURES).includes(entry.posture),
			`${category} posture must be a known POSTURES value`,
		);
		assert.ok(
			entry.autoApproveAfterN === null ||
				(Number.isInteger(entry.autoApproveAfterN) && entry.autoApproveAfterN >= 0),
			`${category} autoApproveAfterN must be null or a non-negative integer`,
		);
	}
});

test("destroy and auth are locked with null autoApproveAfterN", () => {
	assert.deepEqual([...LOCKED_CATEGORIES], ["destroy", "auth"]);
	for (const category of LOCKED_CATEGORIES) {
		assert.equal(DEFAULT_POSTURES[category].posture, POSTURES.LOCKED);
		assert.equal(DEFAULT_POSTURES[category].autoApproveAfterN, null);
	}
});

test("non-locked categories match documented #123 defaults", () => {
	assert.deepEqual(DEFAULT_POSTURES.read, {
		posture: POSTURES.PERMISSIVE,
		autoApproveAfterN: 0,
	});
	assert.deepEqual(DEFAULT_POSTURES.write, {
		posture: POSTURES.CAUTIOUS,
		autoApproveAfterN: 3,
	});
	assert.deepEqual(DEFAULT_POSTURES.execute, {
		posture: POSTURES.GUARDED,
		autoApproveAfterN: 5,
	});
	assert.deepEqual(DEFAULT_POSTURES.network, {
		posture: POSTURES.CAUTIOUS,
		autoApproveAfterN: 3,
	});
});

test("DEFAULT_POSTURES and nested entries are frozen", () => {
	assert.ok(Object.isFrozen(DEFAULT_POSTURES));
	assert.ok(Object.isFrozen(GATE_CATEGORIES));
	assert.ok(Object.isFrozen(POSTURES));
	assert.ok(Object.isFrozen(LOCKED_CATEGORIES));
	for (const category of GATE_CATEGORIES) {
		assert.ok(Object.isFrozen(DEFAULT_POSTURES[category]));
	}
});
