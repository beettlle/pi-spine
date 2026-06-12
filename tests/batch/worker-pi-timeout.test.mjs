import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerChildEnv } from "../../src/batch/worker-host.mjs";
import {
	resolveWorkerPiTimeoutMs,
	STALL_MINUTES_BY_SIZE,
} from "../../src/batch/task-stall-budget.mjs";
import { buildPiWorkerTimeoutDoctorCheck } from "../../src/doctor/stall-config.mjs";

test("resolveWorkerPiTimeoutMs uses per-size stall floor", () => {
	assert.equal(
		resolveWorkerPiTimeoutMs({
			config: { lanes: { stallTimeoutMinutes: 60 } },
			taskSize: "M",
		}),
		STALL_MINUTES_BY_SIZE.M * 60 * 1000,
	);
	assert.equal(
		resolveWorkerPiTimeoutMs({
			config: { lanes: { stallTimeoutMinutes: 60 } },
			taskSize: "S",
		}),
		STALL_MINUTES_BY_SIZE.S * 60 * 1000,
	);
});

test("resolveWorkerPiTimeoutMs honors SPINE_WORKER_PI_TIMEOUT_MS override", () => {
	const previous = process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	process.env.SPINE_WORKER_PI_TIMEOUT_MS = String(45 * 60 * 1000);
	try {
		assert.equal(
			resolveWorkerPiTimeoutMs({
				config: { lanes: { stallTimeoutMinutes: 60 } },
				taskSize: "M",
			}),
			45 * 60 * 1000,
		);
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_WORKER_PI_TIMEOUT_MS;
		} else {
			process.env.SPINE_WORKER_PI_TIMEOUT_MS = previous;
		}
	}
});

test("buildWorkerChildEnv sets SPINE_WORKER_PI_TIMEOUT_MS from stall budget", () => {
	const env = buildWorkerChildEnv({
		taskFolder: "/tmp/task",
		worktreePath: "/tmp/wt",
		piTimeoutMs: STALL_MINUTES_BY_SIZE.M * 60 * 1000,
	});
	assert.equal(
		env.SPINE_WORKER_PI_TIMEOUT_MS,
		String(STALL_MINUTES_BY_SIZE.M * 60 * 1000),
	);
});

test("buildPiWorkerTimeoutDoctorCheck reports stall-aligned timeout for M floor", () => {
	const prevStub = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = buildPiWorkerTimeoutDoctorCheck({
			config: { lanes: { stallTimeoutMinutes: 120 } },
		});
		assert.equal(check.ok, true);
		assert.match(check.detail, /180m/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
	}
});
