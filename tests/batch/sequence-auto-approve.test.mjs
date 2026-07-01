/**
 * SP-390 — sequence auto-approve gate safety (GitHub #54 Tier 2 SP-E).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	buildSequenceAutoApproveDoctorCheck,
	validateSequenceAutoApproveGate,
} from "../../src/doctor/sequence-safety.mjs";
import { runSequence } from "../../src/batch/sequence.mjs";

const TWO_WAVE_PLAN = {
	waves: [
		{ index: 0, taskIds: ["SP-501"] },
		{ index: 1, taskIds: ["SP-502"] },
	],
};

/**
 * @param {string|undefined} prev
 */
function restoreStubEnv(prev) {
	if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
	else process.env.SPINE_WORKER_STUB = prev;
}

test("validateSequenceAutoApproveGate allows stub mode without force", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: true });
		assert.equal(check.ok, true);
		assert.equal(check.stubMode, true);
	} finally {
		restoreStubEnv(prev);
	}
});

test("validateSequenceAutoApproveGate blocks real pi without force", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: true });
		assert.equal(check.ok, false);
		assert.equal(check.error, "auto_approve_gate_unsafe");
		assert.match(check.output, /--auto-approve-gate/);
		assert.match(check.suggestedCommand, /SPINE_WORKER_STUB=1/);
	} finally {
		restoreStubEnv(prev);
	}
});

test("validateSequenceAutoApproveGate allows real pi with force", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: true, force: true });
		assert.equal(check.ok, true);
		assert.equal(check.forced, true);
	} finally {
		restoreStubEnv(prev);
	}
});

test("validateSequenceAutoApproveGate skips check when flag is false", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: false });
		assert.equal(check.ok, true);
		assert.equal(check.stubMode, undefined);
		assert.equal(check.forced, undefined);
	} finally {
		restoreStubEnv(prev);
	}
});

test("buildSequenceAutoApproveDoctorCheck warns for real pi", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = buildSequenceAutoApproveDoctorCheck();
		assert.equal(check.warning, true);
		assert.match(check.detail, /real pi/);
	} finally {
		restoreStubEnv(prev);
	}
});

test("buildSequenceAutoApproveDoctorCheck passes for stub mode", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const check = buildSequenceAutoApproveDoctorCheck();
		assert.equal(check.warning, undefined);
		assert.match(check.detail, /SPINE_WORKER_STUB/);
	} finally {
		restoreStubEnv(prev);
	}
});

test("runSequence refuses auto-approve on dry-run for real pi", async () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const result = await runSequence({
			projectRoot: process.cwd(),
			plan: TWO_WAVE_PLAN,
			dryRun: true,
			autoApproveGate: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "auto_approve_gate_unsafe");
	} finally {
		restoreStubEnv(prev);
	}
});

test("runSequence allows auto-approve dry-run with force on real pi", async () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const result = await runSequence({
			projectRoot: process.cwd(),
			plan: TWO_WAVE_PLAN,
			dryRun: true,
			autoApproveGate: true,
			force: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.match(result.output ?? "", /spine gate approve/);
	} finally {
		restoreStubEnv(prev);
	}
});
