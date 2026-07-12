import assert from "node:assert/strict";
import test from "node:test";
import {
	DEFAULT_POSTURES,
	GATE_CATEGORIES,
	LOCKED_CATEGORIES,
	POSTURES,
} from "../../src/batch/gate-posture-defaults.mjs";
import { resolveGatePostureConfig } from "../../src/config/gate-posture-config.mjs";
import { resolveGatePostureConfig as resolveFromLoad } from "../../src/config/spine-config-load.mjs";

test("missing postures section returns DEFAULT_POSTURES and empty alwaysBreakOn", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			requireBeforeIntegrate: true,
			collectBuildEvidence: true,
			collectTestEvidence: true,
		},
	});

	for (const category of GATE_CATEGORIES) {
		assert.deepEqual(resolved.categories[category], DEFAULT_POSTURES[category]);
	}
	assert.deepEqual([...resolved.alwaysBreakOn], []);
});

test("null/undefined config fails closed to defaults", () => {
	const fromNull = resolveGatePostureConfig(null);
	const fromUndefined = resolveGatePostureConfig(undefined);
	for (const category of GATE_CATEGORIES) {
		assert.deepEqual(fromNull.categories[category], DEFAULT_POSTURES[category]);
		assert.deepEqual(fromUndefined.categories[category], DEFAULT_POSTURES[category]);
	}
});

test("valid postures overlay merges over defaults", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				read: { posture: "cautious", autoApproveAfterN: 2 },
				write: { posture: "guarded", autoApproveAfterN: 7 },
			},
			alwaysBreakOn: ["deploy-prod", "force-push"],
		},
	});

	assert.deepEqual(resolved.categories.read, {
		posture: POSTURES.CAUTIOUS,
		autoApproveAfterN: 2,
	});
	assert.deepEqual(resolved.categories.write, {
		posture: POSTURES.GUARDED,
		autoApproveAfterN: 7,
	});
	assert.deepEqual(resolved.categories.execute, DEFAULT_POSTURES.execute);
	assert.deepEqual(resolved.categories.network, DEFAULT_POSTURES.network);
	assert.deepEqual([...resolved.alwaysBreakOn], ["deploy-prod", "force-push"]);
});

test("alwaysBreakOn under gates.postures is accepted", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				read: { posture: "permissive", autoApproveAfterN: 0 },
				alwaysBreakOn: ["shell-rm"],
			},
		},
	});
	assert.deepEqual([...resolved.alwaysBreakOn], ["shell-rm"]);
});

test("unknown posture string fails closed to locked", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				write: { posture: "wide-open", autoApproveAfterN: 0 },
			},
		},
	});
	assert.deepEqual(resolved.categories.write, {
		posture: POSTURES.LOCKED,
		autoApproveAfterN: null,
	});
});

test("invalid autoApproveAfterN fails closed to locked", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				network: { posture: "cautious", autoApproveAfterN: -1 },
				execute: { posture: "guarded", autoApproveAfterN: 1.5 },
				read: { posture: "permissive", autoApproveAfterN: "soon" },
			},
		},
	});
	assert.equal(resolved.categories.network.posture, POSTURES.LOCKED);
	assert.equal(resolved.categories.execute.posture, POSTURES.LOCKED);
	assert.equal(resolved.categories.read.posture, POSTURES.LOCKED);
});

test("unknown category keys are ignored", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				telepathy: { posture: "permissive", autoApproveAfterN: 0 },
			},
		},
	});
	for (const category of GATE_CATEGORIES) {
		assert.deepEqual(resolved.categories[category], DEFAULT_POSTURES[category]);
	}
	assert.equal("telepathy" in resolved.categories, false);
});

test("locked categories stay locked even when config tries to relax them", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				destroy: { posture: "permissive", autoApproveAfterN: 0 },
				auth: { posture: "cautious", autoApproveAfterN: 1 },
			},
		},
	});
	for (const category of LOCKED_CATEGORIES) {
		assert.deepEqual(resolved.categories[category], {
			posture: POSTURES.LOCKED,
			autoApproveAfterN: null,
		});
	}
});

test("invalid postures container fails closed to defaults", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: ["not-an-object"],
		},
	});
	for (const category of GATE_CATEGORIES) {
		assert.deepEqual(resolved.categories[category], DEFAULT_POSTURES[category]);
	}
});

test("invalid alwaysBreakOn shape fails closed to empty list", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			alwaysBreakOn: "deploy-prod",
		},
	});
	assert.deepEqual([...resolved.alwaysBreakOn], []);
});

test("non-string alwaysBreakOn entries are dropped", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			alwaysBreakOn: ["ok", 42, "", "  ", null, "keep"],
		},
	});
	assert.deepEqual([...resolved.alwaysBreakOn], ["ok", "keep"]);
});

test("resolved result is frozen", () => {
	const resolved = resolveGatePostureConfig({});
	assert.ok(Object.isFrozen(resolved));
	assert.ok(Object.isFrozen(resolved.categories));
	assert.ok(Object.isFrozen(resolved.alwaysBreakOn));
	for (const category of GATE_CATEGORIES) {
		assert.ok(Object.isFrozen(resolved.categories[category]));
	}
});

test("spine-config-load re-exports resolveGatePostureConfig", () => {
	assert.equal(resolveFromLoad, resolveGatePostureConfig);
});

test("omitted autoApproveAfterN defaults to 0 for non-locked overlay", () => {
	const resolved = resolveGatePostureConfig({
		gates: {
			postures: {
				write: { posture: "cautious" },
			},
		},
	});
	assert.deepEqual(resolved.categories.write, {
		posture: POSTURES.CAUTIOUS,
		autoApproveAfterN: 0,
	});
});
