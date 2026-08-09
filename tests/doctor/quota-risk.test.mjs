/**
 * SP-700 — Doctor advisory quota-risk check (GitHub #251).
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	QUOTA_RISK_CHECK_LABEL,
	buildQuotaRiskDoctorCheck,
	collectQuotaPinTargets,
	detectQuotaRiskSignals,
} from "../../src/doctor/quota-risk.mjs";

const NOW = Date.parse("2026-08-09T12:00:00.000Z");

function baseConfig(overrides = {}) {
	// Default pins must resolve to pool "unknown" so clear/skip cases stay
	// valid after SP-701 mapped anthropic + github-copilot into POOL_PREFIXES.
	return {
		agents: {
			worker: { model: "openai/gpt-4" },
			reviewer: { model: "openai/gpt-4o" },
			...overrides,
		},
	};
}

function taskRecord(overrides = {}) {
	return {
		recordType: "task",
		outcome: "failed",
		startedAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
		durationMs: 60 * 1000,
		model: "kimi-coding/kimi-for-coding",
		...overrides,
	};
}

// --- collectQuotaPinTargets ---

test("collectQuotaPinTargets skips non-quota-pool providers", () => {
	const targets = collectQuotaPinTargets(baseConfig());
	assert.deepStrictEqual(targets, []);
});

test("collectQuotaPinTargets flags base worker pins on known quota pools", () => {
	const config = baseConfig({ worker: { model: "kimi-coding/kimi-for-coding" } });
	const targets = collectQuotaPinTargets(config);
	assert.equal(targets.length, 1);
	assert.equal(targets[0].poolId, "kimi-coding");
	assert.equal(targets[0].source, "agents.worker.model");
});

test("collectQuotaPinTargets flags escalate target profile worker pin", () => {
	const config = baseConfig({
		profiles: {
			hard: { worker: { model: "zai/glm-4.6" } },
		},
		escalatePolicy: { enabled: true, toProfile: "hard" },
	});
	const targets = collectQuotaPinTargets(config);
	assert.equal(targets.length, 1);
	assert.equal(targets[0].poolId, "zai");
	assert.match(targets[0].source, /escalate target/);
});

test("collectQuotaPinTargets ignores escalate target when policy disabled", () => {
	const config = baseConfig({
		profiles: {
			hard: { worker: { model: "zai/glm-4.6" } },
		},
		escalatePolicy: { enabled: false, toProfile: "hard" },
	});
	assert.deepStrictEqual(collectQuotaPinTargets(config), []);
});

test("collectQuotaPinTargets dedupes identical pins and skips inherit", () => {
	const config = baseConfig({
		worker: { model: "inherit" },
		profiles: {
			hard: { worker: { model: "inherit" } },
		},
		escalatePolicy: { enabled: true, toProfile: "hard" },
	});
	assert.deepStrictEqual(collectQuotaPinTargets(config), []);
});

// --- detectQuotaRiskSignals ---

test("detectQuotaRiskSignals flags launch storm of short failures", () => {
	const lines = [taskRecord(), taskRecord(), taskRecord()];
	const signals = detectQuotaRiskSignals(lines, { now: NOW });
	assert.equal(signals.length, 1);
	assert.match(signals[0], /launch storm/);
});

test("detectQuotaRiskSignals flags quota-abort failures", () => {
	const lines = [taskRecord({ diagnosis: "worker aborted: provider quota exhausted" })];
	const signals = detectQuotaRiskSignals(lines, { now: NOW });
	assert.equal(signals.length, 1);
	assert.match(signals[0], /quota-abort/);
});

test("detectQuotaRiskSignals ignores old, successful, or long failures", () => {
	const lines = [
		taskRecord({ startedAt: new Date(NOW - 3 * 60 * 60 * 1000).toISOString() }),
		taskRecord({ outcome: "completed" }),
		taskRecord({ durationMs: 10 * 60 * 1000 }),
	];
	assert.deepStrictEqual(detectQuotaRiskSignals(lines, { now: NOW }), []);
});

test("detectQuotaRiskSignals degrades closed on missing input", () => {
	assert.deepStrictEqual(detectQuotaRiskSignals(undefined, { now: NOW }), []);
	assert.deepStrictEqual(detectQuotaRiskSignals([], { now: NOW }), []);
});

// --- buildQuotaRiskDoctorCheck ---

test("clear when no quota-constrained pins and no metrics signals", () => {
	const check = buildQuotaRiskDoctorCheck({ config: baseConfig(), metricsLines: [], now: NOW });
	assert.equal(check.label, QUOTA_RISK_CHECK_LABEL);
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
	assert.match(check.detail, /no escalate\/hard worker pins/);
});

test("warns (ok: true) when pin targets quota-constrained pool without headroom evidence", () => {
	const config = baseConfig({ worker: { model: "kimi-coding/kimi-for-coding" } });
	const check = buildQuotaRiskDoctorCheck({ config, metricsLines: [], now: NOW });
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /kimi-coding/);
	assert.match(check.detail, /no live\/estimate headroom evidence/);
	assert.equal(check.suggestedCommand, "spine metrics quota");
});

test("warns for escalate hard-profile pin without headroom", () => {
	const config = baseConfig({
		profiles: { hard: { worker: { model: "zai/glm-4.6" } } },
		escalatePolicy: { enabled: true, toProfile: "hard" },
	});
	const check = buildQuotaRiskDoctorCheck({ config, now: NOW });
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /escalate target/);
});

test("clear when live probe reports headroom above used quota", () => {
	const config = baseConfig({ worker: { model: "kimi-coding/kimi-for-coding" } });
	const probeResults = {
		"kimi-coding": {
			poolId: "kimi-coding",
			source: "live",
			usage: { taskCount: 0, durationMs: 0, tokensOut: 100 },
			limit: 1000,
		},
	};
	const check = buildQuotaRiskDoctorCheck({ config, probeResults, metricsLines: [], now: NOW });
	assert.equal(check.ok, true);
	assert.equal(check.warning, undefined);
});

test("warns when live probe reports exhausted quota", () => {
	const config = baseConfig({ worker: { model: "kimi-coding/kimi-for-coding" } });
	const probeResults = {
		"kimi-coding": {
			poolId: "kimi-coding",
			source: "live",
			usage: { taskCount: 0, durationMs: 0, tokensOut: 1000 },
			limit: 1000,
		},
	};
	const check = buildQuotaRiskDoctorCheck({ config, probeResults, metricsLines: [], now: NOW });
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /quota exhausted/);
});

test("warns on zero balance, clears on positive balance", () => {
	const config = baseConfig({ worker: { model: "kimi-coding/kimi-for-coding" } });
	const warnCheck = buildQuotaRiskDoctorCheck({
		config,
		probeResults: {
			"kimi-coding": {
				poolId: "kimi-coding",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, estimatedUsd: 0 },
			},
		},
		metricsLines: [],
		now: NOW,
	});
	assert.equal(warnCheck.warning, true);
	assert.match(warnCheck.detail, /zero\/negative balance/);

	const clearCheck = buildQuotaRiskDoctorCheck({
		config,
		probeResults: {
			"kimi-coding": {
				poolId: "kimi-coding",
				source: "live",
				usage: { taskCount: 0, durationMs: 0, estimatedUsd: 12.5 },
			},
		},
		metricsLines: [],
		now: NOW,
	});
	assert.equal(clearCheck.ok, true);
	assert.equal(clearCheck.warning, undefined);
});

test("warns on launch-storm metrics signal even without quota pins", () => {
	const lines = [taskRecord(), taskRecord(), taskRecord()];
	const check = buildQuotaRiskDoctorCheck({
		config: baseConfig(),
		metricsLines: lines,
		now: NOW,
	});
	assert.equal(check.ok, true);
	assert.equal(check.warning, true);
	assert.match(check.detail, /launch storm/);
});
