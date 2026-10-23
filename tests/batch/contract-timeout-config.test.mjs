import assert from "node:assert/strict";
import test from "node:test";

import { validateContractConfig } from "../../src/config/contract.mjs";
import { parseSettingPath } from "../../src/config/settings-fields.mjs";
import {
	buildPrimaryFailureHeadline,
	buildPrimaryFailureSuggestedCommand,
	isContractTimeoutFailure,
} from "../../src/batch/diagnosis-primary-failure.mjs";

const TIMEOUT_CHECK = {
	field: "testCommand",
	ok: false,
	message: "Contract testCommand failed after 2 attempt(s): testCommand timed out after 10 min and was terminated",
};

test("contract.testTimeoutMs accepts integers within bounds (#369)", () => {
	assert.equal(validateContractConfig({ contract: { testTimeoutMs: 1_200_000 } }), null);
	assert.equal(validateContractConfig({ contract: { testTimeoutMs: 1000 } }), null);
});

test("contract.testTimeoutMs rejects non-integers, zero, and values over 4 hours", () => {
	for (const testTimeoutMs of [0, -1, 1.5, "600000", 999, 4 * 60 * 60 * 1000 + 1]) {
		const error = validateContractConfig({ contract: { testTimeoutMs } });
		assert.equal(error?.code, "CONFIG_CONTRACT_TEST_TIMEOUT_INVALID", String(testTimeoutMs));
		assert.match(error?.suggestedCommand ?? "", /spine settings set contract\.testTimeoutMs/);
	}
});

test("contract.testTimeoutMs is editable through spine settings", () => {
	const parsed = parseSettingPath("contract.testTimeoutMs");
	assert.equal(parsed.ok, true);
});

test("contract.reviewTimeoutMs accepts integers within bounds (SP-845)", () => {
	assert.equal(validateContractConfig({ contract: { reviewTimeoutMs: 1_200_000 } }), null);
	assert.equal(validateContractConfig({ contract: { reviewTimeoutMs: 1000 } }), null);
});

test("contract.reviewTimeoutMs rejects non-integers, zero, and values over 4 hours", () => {
	for (const reviewTimeoutMs of [0, -1, 1.5, "600000", 999, 4 * 60 * 60 * 1000 + 1]) {
		const error = validateContractConfig({ contract: { reviewTimeoutMs } });
		assert.equal(error?.code, "CONFIG_CONTRACT_REVIEW_TIMEOUT_INVALID", String(reviewTimeoutMs));
		assert.match(error?.suggestedCommand ?? "", /spine settings set contract\.reviewTimeoutMs/);
	}
});

test("contract.reviewPolicy accepts blocking and advisory, rejects the rest (SP-845)", () => {
	assert.equal(validateContractConfig({ contract: { reviewPolicy: "blocking" } }), null);
	assert.equal(validateContractConfig({ contract: { reviewPolicy: "advisory" } }), null);
	for (const reviewPolicy of ["off", "warn", 1, true]) {
		const error = validateContractConfig({ contract: { reviewPolicy } });
		assert.equal(error?.code, "CONFIG_CONTRACT_REVIEW_POLICY_INVALID", String(reviewPolicy));
		assert.match(error?.suggestedCommand ?? "", /spine settings set contract\.reviewPolicy blocking/);
	}
});

test("contract.reviewTimeoutMs is editable through spine settings", () => {
	assert.equal(parseSettingPath("contract.reviewTimeoutMs").ok, true);
	assert.equal(parseSettingPath("contract.reviewPolicy").ok, true);
});

test("isContractTimeoutFailure reads the latest contract event for the task", () => {
	const events = [
		{ type: "contract.verified", payload: { taskId: "SP-843", ok: false, checks: [TIMEOUT_CHECK] } },
		{ type: "contract.verified", payload: { taskId: "SP-900", ok: false, checks: [{ field: "testCommand", ok: false, message: "exit 1" }] } },
	];
	assert.equal(isContractTimeoutFailure(events, "SP-843"), true);
	assert.equal(isContractTimeoutFailure(events, "SP-900"), false);
	assert.equal(isContractTimeoutFailure(events, "SP-999"), false);
	assert.equal(isContractTimeoutFailure(events, null), false);

	const laterPass = [...events, { type: "contract.verified", payload: { taskId: "SP-843", ok: true, checks: [] } }];
	assert.equal(isContractTimeoutFailure(laterPass, "SP-843"), false);
});

const REVIEW_TIMEOUT_CHECK = {
	field: "reviewCommand",
	ok: false,
	message: "Contract reviewCommand failed: reviewCommand timed out after 20 min and was terminated",
};

test("isContractTimeoutFailure distinguishes a reviewCommand timeout (SP-845)", () => {
	const events = [
		{ type: "contract.failed", payload: { taskId: "SP-845", ok: false, checks: [REVIEW_TIMEOUT_CHECK] } },
	];
	assert.equal(isContractTimeoutFailure(events, "SP-845"), "review");
	assert.equal(isContractTimeoutFailure(events, "SP-999"), false);
	// A testCommand timeout on the same task is still a plain boolean true.
	const testEvents = [
		{ type: "contract.failed", payload: { taskId: "SP-845", ok: false, checks: [TIMEOUT_CHECK] } },
	];
	assert.equal(isContractTimeoutFailure(testEvents, "SP-845"), true);
});

test("review-timeout diagnosis suggests contract.reviewTimeoutMs, not the test key (SP-845)", () => {
	const ctx = { exitReason: "contract_failed", failedTaskId: "SP-845", contractTimedOut: "review" };
	const headline = buildPrimaryFailureHeadline("Batch B1", ctx) ?? "";
	assert.match(headline, /contract reviewCommand timed out/);
	assert.match(headline, /contract\.reviewTimeoutMs/);
	assert.doesNotMatch(headline, /contract\.testTimeoutMs/);
	assert.equal(
		buildPrimaryFailureSuggestedCommand(ctx),
		"spine settings set contract.reviewTimeoutMs 2400000 && spine batch retry SP-845",
	);
});

test("contract timeout diagnosis names the timeout key instead of PROMPT.md scope", () => {
	const ctx = { exitReason: "contract_failed", failedTaskId: "SP-843", contractTimedOut: true };
	const headline = buildPrimaryFailureHeadline("Batch B1", ctx) ?? "";
	assert.match(headline, /timed out/);
	assert.match(headline, /contract\.testTimeoutMs/);
	assert.doesNotMatch(headline, /PROMPT\.md/);
	assert.equal(
		buildPrimaryFailureSuggestedCommand(ctx),
		"spine settings set contract.testTimeoutMs 1200000 && spine batch retry SP-843",
	);
});

test("non-timeout contract failures keep the PROMPT.md remediation", () => {
	const ctx = { exitReason: "contract_failed", failedTaskId: "SP-843", contractTimedOut: false };
	assert.match(buildPrimaryFailureHeadline("Batch B1", ctx) ?? "", /fix PROMPT\.md scope/);
	assert.match(buildPrimaryFailureSuggestedCommand(ctx) ?? "", /PROMPT\.md then spine batch retry SP-843/);
});
