import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_POSTURES, POSTURES } from "../../src/batch/gate-posture-defaults.mjs";
import { evaluateGatePosture } from "../../src/batch/gate-posture-evaluate.mjs";

/** @param {Partial<import("../../src/batch/gate-posture-evaluate.mjs").GatePostureEvaluateInput> & { category: import("../../src/batch/gate-posture-defaults.mjs").GateCategory }} overrides */
function input(overrides) {
	const defaults = DEFAULT_POSTURES[overrides.category];
	return {
		posture: defaults.posture,
		autoApproveAfterN: defaults.autoApproveAfterN,
		consecutiveApprovals: 0,
		tags: [],
		alwaysBreakOn: [],
		neverAutoApprove: false,
		...overrides,
	};
}

test("tier 1: locked posture requires manual", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			posture: POSTURES.LOCKED,
			autoApproveAfterN: 0,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 1);
	assert.match(result.reason, /posture: locked/);
});

test("tier 1: destroy default posture is locked", () => {
	const result = evaluateGatePosture(input({ category: "destroy" }));
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 1);
});

test("tier 1: auth default posture is locked", () => {
	const result = evaluateGatePosture(input({ category: "auth" }));
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 1);
});

test("tier 2: destroy never auto even if posture mis-set to permissive", () => {
	const result = evaluateGatePosture(
		input({
			category: "destroy",
			posture: POSTURES.PERMISSIVE,
			autoApproveAfterN: 0,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 2);
	assert.match(result.reason, /never-auto-approve/);
});

test("tier 2: auth never auto even if posture mis-set to cautious", () => {
	const result = evaluateGatePosture(
		input({
			category: "auth",
			posture: POSTURES.CAUTIOUS,
			autoApproveAfterN: 3,
			consecutiveApprovals: 99,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 2);
});

test("tier 2: neverAutoApprove flag blocks otherwise eligible category", () => {
	const result = evaluateGatePosture(
		input({
			category: "read",
			neverAutoApprove: true,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 2);
	assert.match(result.reason, /neverAutoApprove flag/);
});

test("tier 3: alwaysBreakOn matching tag requires manual", () => {
	const result = evaluateGatePosture(
		input({
			category: "read",
			tags: ["critical", "routine"],
			alwaysBreakOn: ["critical"],
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 3);
	assert.match(result.reason, /alwaysBreakOn tag: critical/);
});

test("tier 3: alwaysBreakOn does not block without tag intersection", () => {
	const result = evaluateGatePosture(
		input({
			category: "read",
			tags: ["routine"],
			alwaysBreakOn: ["critical"],
		}),
	);
	assert.equal(result.decision, "allow-auto");
	assert.equal(result.tier, 4);
});

test("tier 3: alwaysBreakOn wins over immediate auto", () => {
	const result = evaluateGatePosture(
		input({
			category: "read",
			autoApproveAfterN: 0,
			tags: ["release"],
			alwaysBreakOn: ["release"],
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 3);
});

test("tier 4: autoApproveAfterN 0 allows immediate auto", () => {
	const result = evaluateGatePosture(input({ category: "read" }));
	assert.equal(result.decision, "allow-auto");
	assert.equal(result.tier, 4);
	assert.match(result.reason, /Immediate auto-approve/);
});

test("tier 4: immediate auto does not require streak", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			posture: POSTURES.CAUTIOUS,
			autoApproveAfterN: 0,
			consecutiveApprovals: 0,
		}),
	);
	assert.equal(result.decision, "allow-auto");
	assert.equal(result.tier, 4);
});

test("tier 5: streak at threshold allows auto", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			consecutiveApprovals: 3,
		}),
	);
	assert.equal(result.decision, "allow-auto");
	assert.equal(result.tier, 5);
	assert.match(result.reason, /3 consecutive approvals/);
});

test("tier 5: streak above threshold allows auto", () => {
	const result = evaluateGatePosture(
		input({
			category: "execute",
			consecutiveApprovals: 7,
		}),
	);
	assert.equal(result.decision, "allow-auto");
	assert.equal(result.tier, 5);
});

test("tier 5: streak below threshold requires manual", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			consecutiveApprovals: 2,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 5);
	assert.match(result.reason, /below autoApproveAfterN/);
});

test("tier 5: network default uses cautious after-3 streak", () => {
	assert.equal(
		evaluateGatePosture(input({ category: "network", consecutiveApprovals: 2 })).decision,
		"require-manual",
	);
	assert.equal(
		evaluateGatePosture(input({ category: "network", consecutiveApprovals: 3 })).decision,
		"allow-auto",
	);
});

test("null autoApproveAfterN fails closed to manual when posture allows", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			posture: POSTURES.CAUTIOUS,
			autoApproveAfterN: null,
			consecutiveApprovals: 10,
		}),
	);
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, null);
	assert.match(result.reason, /No matching auto-approval path/);
});

test("cascade order: locked posture beats neverAutoApprove and alwaysBreakOn", () => {
	const result = evaluateGatePosture(
		input({
			category: "write",
			posture: POSTURES.LOCKED,
			neverAutoApprove: true,
			tags: ["x"],
			alwaysBreakOn: ["x"],
			autoApproveAfterN: 0,
		}),
	);
	assert.equal(result.tier, 1);
});

test("cascade order: never-auto beats alwaysBreakOn and immediate auto", () => {
	const result = evaluateGatePosture(
		input({
			category: "read",
			neverAutoApprove: true,
			tags: ["x"],
			alwaysBreakOn: ["x"],
			autoApproveAfterN: 0,
		}),
	);
	assert.equal(result.tier, 2);
});

test("default consecutiveApprovals is zero", () => {
	const result = evaluateGatePosture({
		category: "write",
		posture: POSTURES.CAUTIOUS,
		autoApproveAfterN: 3,
	});
	assert.equal(result.decision, "require-manual");
	assert.equal(result.tier, 5);
});
