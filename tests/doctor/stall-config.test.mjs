import assert from "node:assert/strict";
import test from "node:test";
import {
	buildStallConfigDoctorCheck,
	isStubWorkerMode,
	resolveConfiguredStallMinutes,
} from "../../src/doctor/stall-config.mjs";

test("buildStallConfigDoctorCheck warns when stall timeout unset for real pi", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = buildStallConfigDoctorCheck({ config: { lanes: {} } });
		assert.equal(check.warning, true);
		assert.match(check.detail, /120/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("buildStallConfigDoctorCheck passes when stall timeout configured high", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = buildStallConfigDoctorCheck({ config: { lanes: { stallTimeoutMinutes: 120 } } });
		assert.equal(check.warning, undefined);
		assert.match(check.detail, /120/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("isStubWorkerMode respects SPINE_WORKER_STUB", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	assert.equal(isStubWorkerMode(), true);
	if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
	else process.env.SPINE_WORKER_STUB = prev;
});

test("resolveConfiguredStallMinutes returns null when missing", () => {
	assert.equal(resolveConfiguredStallMinutes({ lanes: {} }), null);
	assert.equal(resolveConfiguredStallMinutes({ lanes: { stallTimeoutMinutes: 90 } }), 90);
});
