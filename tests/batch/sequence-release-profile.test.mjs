/**
 * SP-536 — sequence release profile (FR-STA-25).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	SEQUENCE_RELEASE_PROFILE,
	buildReleaseSequenceDryRunHeader,
	buildSequenceDryRunPlan,
	isReleaseSequenceScope,
	resolveSequenceProfile,
	validateReleaseSequenceWaveCaps,
	runSequence,
} from "../../src/batch/sequence.mjs";
import {
	buildSequenceReleaseProfileDoctorCheck,
	SEQUENCE_RELEASE_MANIFEST_DOC,
	validateSequenceAutoApproveGate,
} from "../../src/doctor/sequence-safety.mjs";
import { parseSequenceArgs } from "../../src/cli/sequence.mjs";

const RELEASE_SCOPE = "SP-530,SP-531,SP-532";

const RELEASE_PLAN = {
	waves: [
		{ index: 0, waveIndex: 0, taskIds: ["SP-530", "SP-532", "SP-533", "SP-538"] },
		{ index: 1, waveIndex: 1, taskIds: ["SP-531"] },
	],
};

const OVERSIZED_RELEASE_PLAN = {
	waves: [
		{
			index: 0,
			waveIndex: 0,
			taskIds: ["SP-530", "SP-531", "SP-532", "SP-533", "SP-534"],
		},
	],
};

/**
 * @param {string|undefined} prev
 */
function restoreStubEnv(prev) {
	if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
	else process.env.SPINE_WORKER_STUB = prev;
}

test("isReleaseSequenceScope detects comma-separated release scope IDs", () => {
	assert.equal(isReleaseSequenceScope(RELEASE_SCOPE), true);
	assert.equal(isReleaseSequenceScope("pending"), false);
	assert.equal(isReleaseSequenceScope("SP-530"), false);
});

test("resolveSequenceProfile applies release profile for comma scope or --profile release", () => {
	assert.equal(resolveSequenceProfile({ scope: RELEASE_SCOPE })?.id, "release");
	assert.equal(resolveSequenceProfile({ scope: "pending", profile: "release" })?.id, "release");
	assert.equal(resolveSequenceProfile({ scope: "pending" }), null);
});

test("validateReleaseSequenceWaveCaps rejects waves exceeding maxTasksPerWave", () => {
	const ok = validateReleaseSequenceWaveCaps(RELEASE_PLAN);
	assert.equal(ok.ok, true);

	const bad = validateReleaseSequenceWaveCaps(OVERSIZED_RELEASE_PLAN);
	assert.equal(bad.ok, false);
	assert.equal(bad.error, "release_wave_cap_exceeded");
	assert.match(bad.output ?? "", /Wave 0: 5 tasks/);
	assert.match(bad.output ?? "", /max 4 tasks per wave/);
});

test("buildSequenceDryRunPlan includes release profile header and gate-only annotations", () => {
	const dryPlan = buildSequenceDryRunPlan({
		plan: RELEASE_PLAN,
		profile: SEQUENCE_RELEASE_PROFILE,
	});
	assert.equal(dryPlan.ok, true);
	assert.equal(dryPlan.profile, "release");
	assert.match(dryPlan.output ?? "", /Release sequence profile/);
	assert.match(dryPlan.output ?? "", new RegExp(SEQUENCE_RELEASE_PROFILE.manifestDocPath));
	assert.match(dryPlan.output ?? "", /GATE-ONLY: operator approval required/);
	assert.match(dryPlan.output ?? "", /spine batch start SP-530 SP-532 SP-533 SP-538/);
});

test("buildReleaseSequenceDryRunHeader cross-links manifest example", () => {
	const header = buildReleaseSequenceDryRunHeader();
	assert.match(header.join("\n"), new RegExp(SEQUENCE_RELEASE_MANIFEST_DOC));
	assert.match(header.join("\n"), /gate_approve/);
});

test("parseSequenceArgs honors --profile release", () => {
	const parsed = parseSequenceArgs([RELEASE_SCOPE, "--profile", "release", "--dry-run"]);
	assert.equal(parsed.profile, "release");
	assert.equal(parsed.scope, RELEASE_SCOPE);
	assert.equal(parsed.dryRun, true);
});

test("validateSequenceAutoApproveGate blocks release profile on real pi with manifest hint", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({
			autoApproveGate: true,
			profile: SEQUENCE_RELEASE_PROFILE,
		});
		assert.equal(check.ok, false);
		assert.equal(check.error, "auto_approve_gate_unsafe");
		assert.match(check.output ?? "", /gate-only operator loop/);
		assert.match(check.suggestedCommand ?? "", new RegExp(SEQUENCE_RELEASE_MANIFEST_DOC));
	} finally {
		restoreStubEnv(prev);
	}
});

test("buildSequenceReleaseProfileDoctorCheck references manifest example", () => {
	const check = buildSequenceReleaseProfileDoctorCheck();
	assert.equal(check.ok, true);
	assert.match(check.suggestedCommand ?? "", new RegExp(SEQUENCE_RELEASE_MANIFEST_DOC));
	assert.match(check.detail ?? "", /gate_approve/);
});

test("runSequence release dry-run prints wave plan without starting batches", async () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await runSequence({
			projectRoot: process.cwd(),
			plan: RELEASE_PLAN,
			scope: RELEASE_SCOPE,
			dryRun: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.equal(result.profile, "release");
		assert.match(result.output ?? "", /spine batch start/);
		assert.match(result.output ?? "", /spine gate approve/);
		assert.doesNotMatch(result.output ?? "", /batch_start_failed/);
	} finally {
		restoreStubEnv(prev);
	}
});

test("runSequence refuses release auto-approve on real pi", async () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const result = await runSequence({
			projectRoot: process.cwd(),
			plan: RELEASE_PLAN,
			scope: RELEASE_SCOPE,
			dryRun: true,
			autoApproveGate: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "auto_approve_gate_unsafe");
		assert.match(result.output ?? "", /release sequence profiles/);
	} finally {
		restoreStubEnv(prev);
	}
});

test("runSequence rejects oversized release waves before dry-run output", async () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await runSequence({
			projectRoot: process.cwd(),
			plan: OVERSIZED_RELEASE_PLAN,
			scope: RELEASE_SCOPE,
			dryRun: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "release_wave_cap_exceeded");
	} finally {
		restoreStubEnv(prev);
	}
});
