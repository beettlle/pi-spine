import assert from "node:assert/strict";
import test from "node:test";

import {
	buildMaxParallelDoctorCheck,
	suggestMaxParallel,
} from "../../src/doctor/suggest-max-parallel.mjs";

const suggestCases = [
	{ cpu: 4, expected: 2 },
	{ cpu: 8, expected: 4 },
	{ cpu: 1, expected: 1 },
	{ cpu: 2, expected: 1 },
];

for (const { cpu, expected } of suggestCases) {
	test(`suggestMaxParallel(${cpu}) → ${expected}`, () => {
		const { suggested } = suggestMaxParallel(cpu);
		assert.equal(suggested, expected);
	});
}

test("buildMaxParallelDoctorCheck warns when configured exceeds suggested + 1", () => {
	const check = buildMaxParallelDoctorCheck({ configured: 4, cpuCount: 4 });
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /configured=4, suggested=2/);
	assert.ok(check.suggestedCommand);
});

test("buildMaxParallelDoctorCheck no warning when configured matches suggested", () => {
	const check = buildMaxParallelDoctorCheck({ configured: 2, cpuCount: 4 });
	assert.equal(check.ok, true);
	assert.equal(check.warning, false);
	assert.match(check.detail, /configured=2, suggested=2/);
	assert.equal(check.suggestedCommand, undefined);
});

test("buildMaxParallelDoctorCheck no warning at default 3 when suggested is 2 (4-core)", () => {
	const check = buildMaxParallelDoctorCheck({ configured: 3, cpuCount: 4 });
	assert.equal(check.ok, true);
	assert.equal(check.warning, false);
});
