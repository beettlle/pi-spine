import assert from "node:assert/strict";
import test from "node:test";

import {
	buildQuotaFallbackState,
	decideQuotaFallback,
	markQuotaFallbackRetry,
} from "../../src/batch/quota-fallback.mjs";

// Classification fixtures mirror the SP-804 result shape for the real
// payloads retained in #329 (z.ai 1308 five-hour window, Kimi billing-cycle
// permission_error, Kimi overload rate_limit_error).
const ZAI_EXHAUSTED = {
	kind: "quota_exhausted",
	poolId: "zai",
	httpStatus: 429,
	providerCode: "1308",
	resetAtRaw: "2026-08-30 09:12:44",
	resetAt: null,
	message: "Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44",
};
const KIMI_EXHAUSTED = {
	kind: "quota_exhausted",
	poolId: "kimi-coding",
	httpStatus: 403,
	providerCode: "permission_error",
	resetAtRaw: null,
	resetAt: null,
	message: "You've reached your usage limit for this billing cycle.",
};
const KIMI_OVERLOAD = {
	kind: "transient_overload",
	poolId: "kimi-coding",
	httpStatus: 429,
	providerCode: "rate_limit_error",
	resetAtRaw: null,
	resetAt: null,
	message: "The engine is currently overloaded, please try again later",
};

const NOW = new Date("2026-10-03T12:00:00.000Z");

/**
 * Mirrors the resolved spine-config shape: `agents.worker.model` is the active
 * profile's worker model flattened to the top level, `agents.profiles` keeps
 * every entry (`hard` = zai/glm-5.3, `allegretto` = kimi-coding/k3).
 */
function buildConfig({ activeProfile = "hard", fallbackProfile = "allegretto", profiles } = {}) {
	return {
		agents: {
			activeProfile,
			worker: { model: activeProfile === "allegretto" ? "kimi-coding/k3" : "zai/glm-5.3" },
			profiles:
				profiles ??
				{
					hard: { worker: { model: "zai/glm-5.3", thinking: "high" } },
					allegretto: { worker: { model: "kimi-coding/k3", thinking: "high" } },
				},
			quotaFallbackProfile: fallbackProfile,
		},
	};
}

/**
 * Produces a fallback state the way SP-809 will: decide an apply, then build
 * the persisted state from it. Keeps the fixtures in sync with the real shape.
 */
function appliedFallbackState({
	fromProfile = "hard",
	toProfile = "allegretto",
	triggerTaskId = "SP-100",
	retriedTaskIds = [],
} = {}) {
	const config = buildConfig({ activeProfile: fromProfile, fallbackProfile: toProfile });
	const classification = fromProfile === "hard" ? ZAI_EXHAUSTED : KIMI_EXHAUSTED;
	const decision = decideQuotaFallback({
		config,
		fallbackState: null,
		classification,
		taskId: triggerTaskId,
		workerBackend: "subprocess",
	});
	assert.equal(decision.action, "apply");
	let state = buildQuotaFallbackState(decision, { classification, taskId: triggerTaskId, now: NOW });
	for (const taskId of retriedTaskIds) {
		state = markQuotaFallbackRetry(state, taskId);
	}
	return state;
}

// Row 1 — unset or blank fallback key disables the chain entirely, even with a
// quota classification in hand (row 1 outranks row 2).
test("row 1: unset quotaFallbackProfile is disabled", () => {
	for (const quotaFallbackProfile of [undefined, "", "   "]) {
		const config = buildConfig();
		config.agents.quotaFallbackProfile = quotaFallbackProfile;
		assert.deepEqual(decideQuotaFallback({ config, classification: ZAI_EXHAUSTED }), {
			action: "none",
			reason: "disabled",
		});
	}
});

// Row 2 — null classification and transient overload never fall back, even
// when a hop is already applied (a lane on the fallback pool that is merely
// overloaded is not an exhaustion of that pool).
test("row 2: null classification and transient overload are not_quota", () => {
	const config = buildConfig();
	assert.deepEqual(decideQuotaFallback({ config, classification: null, workerBackend: "subprocess" }), {
		action: "none",
		reason: "not_quota",
	});
	assert.deepEqual(decideQuotaFallback({ config, classification: KIMI_OVERLOAD, workerBackend: "subprocess" }), {
		action: "none",
		reason: "not_quota",
	});
	const state = appliedFallbackState();
	assert.deepEqual(
		decideQuotaFallback({ config, fallbackState: state, classification: KIMI_OVERLOAD, taskId: "SP-101" }),
		{ action: "none", reason: "not_quota" },
	);
});

// Row 3 — agentSession workers run in-process and ignore child env pins.
test("row 3: agentSession backend is unsupported", () => {
	const config = buildConfig();
	assert.deepEqual(
		decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, workerBackend: "agentSession" }),
		{ action: "none", reason: "backend_unsupported" },
	);
	// Row 2 outranks row 3: overload on agentSession reports not_quota.
	assert.deepEqual(
		decideQuotaFallback({ config, classification: KIMI_OVERLOAD, workerBackend: "agentSession" }),
		{ action: "none", reason: "not_quota" },
	);
});

// Row 4 — profile referenced but not defined fails closed (schema normally
// prevents this; the decision must not guess on drift). Stop results carry the
// classification pool/reset even before any hop exists.
test("row 4: fallback profile missing from agents.profiles stops", () => {
	const config = buildConfig({ fallbackProfile: "ghost" });
	assert.deepEqual(decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, workerBackend: "subprocess" }), {
		action: "stop",
		reason: "profile_missing",
		exhaustedPools: ["zai"],
		resetAtRaw: ["2026-08-30 09:12:44"],
	});
	// Kimi classification with no reset text keeps the arrays index-aligned with a null.
	assert.deepEqual(decideQuotaFallback({ config, classification: KIMI_EXHAUSTED, workerBackend: "subprocess" }), {
		action: "stop",
		reason: "profile_missing",
		exhaustedPools: ["kimi-coding"],
		resetAtRaw: [null],
	});
});

// Row 5a — a task only gets one auto-retry; a second exhaustion of the same
// task stops and reports both pools/reset times seen so far.
test("row 5a: task already retried once stops with both pools reported", () => {
	const config = buildConfig();
	const state = appliedFallbackState({ retriedTaskIds: ["SP-101"] });
	assert.deepEqual(
		decideQuotaFallback({
			config,
			fallbackState: state,
			classification: KIMI_EXHAUSTED,
			taskId: "SP-101",
			workerBackend: "subprocess",
		}),
		{
			action: "stop",
			reason: "task_retry_spent",
			exhaustedPools: ["zai", "kimi-coding"],
			resetAtRaw: ["2026-08-30 09:12:44", null],
		},
	);
});

// Row 5b — a lane still pinned to the original pool hits the same exhaustion:
// re-route it onto the already-applied fallback, with no new hop. The
// destination comes from the recorded state, not re-read config.
test("row 5b: lane still on the exhausted pool is retried onto the applied fallback", () => {
	const config = buildConfig();
	const state = appliedFallbackState({ retriedTaskIds: ["SP-101"] });
	assert.deepEqual(
		decideQuotaFallback({
			config,
			fallbackState: state,
			classification: ZAI_EXHAUSTED,
			taskId: "SP-102",
			workerBackend: "subprocess",
		}),
		{ action: "retry", toProfile: "allegretto", toModel: "kimi-coding/k3" },
	);
	// Destination stays the recorded one even if the config key is rewritten mid-batch.
	const rewritten = buildConfig({ activeProfile: "hard", fallbackProfile: "hard" });
	assert.deepEqual(
		decideQuotaFallback({
			config: rewritten,
			fallbackState: state,
			classification: ZAI_EXHAUSTED,
			taskId: "SP-102",
			workerBackend: "subprocess",
		}),
		{ action: "retry", toProfile: "allegretto", toModel: "kimi-coding/k3" },
	);
});

// Row 5c — the fallback pool exhausted too: stop, one hop max, reporting both
// pools so callers can surface both reset times.
test("row 5c: fallback pool exhausted stops after the single hop", () => {
	const config = buildConfig();
	const state = appliedFallbackState();
	assert.deepEqual(
		decideQuotaFallback({
			config,
			fallbackState: state,
			classification: KIMI_EXHAUSTED,
			taskId: "SP-101",
			workerBackend: "subprocess",
		}),
		{
			action: "stop",
			reason: "fallback_pool_exhausted",
			exhaustedPools: ["zai", "kimi-coding"],
			resetAtRaw: ["2026-08-30 09:12:44", null],
		},
	);
});

// Row 6 — a fallback profile without a usable worker model (missing or
// `inherit`) cannot be routed to; `inherit` resolves to the "unknown" pool so
// it must be refused before any pool comparison.
test("row 6: fallback model missing or inherit is unresolved", () => {
	for (const model of [undefined, "inherit"]) {
		const config = buildConfig({
			profiles: {
				hard: { worker: { model: "zai/glm-5.3" } },
				allegretto: model === undefined ? { worker: {} } : { worker: { model } },
			},
		});
		assert.deepEqual(
			decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, workerBackend: "subprocess" }),
			{
				action: "stop",
				reason: "fallback_model_unresolved",
				exhaustedPools: ["zai"],
				resetAtRaw: ["2026-08-30 09:12:44"],
			},
		);
	}
});

// Row 7 — a fallback inside the exhausted provider pool buys nothing.
test("row 7: fallback model in the exhausted pool is same_pool", () => {
	const config = buildConfig({
		fallbackProfile: "zai-flash",
		profiles: {
			hard: { worker: { model: "zai/glm-5.3" } },
			"zai-flash": { worker: { model: "zai/glm-5.3-flash" } },
		},
	});
	assert.deepEqual(decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, workerBackend: "subprocess" }), {
		action: "stop",
		reason: "same_pool",
		exhaustedPools: ["zai"],
		resetAtRaw: ["2026-08-30 09:12:44"],
	});
});

// Row 8 — a live probe that already reported the fallback pool exhausted
// outranks the configuration.
test("row 8: probe-reported exhaustion of the fallback pool stops", () => {
	const config = buildConfig();
	assert.deepEqual(
		decideQuotaFallback({
			config,
			classification: ZAI_EXHAUSTED,
			workerBackend: "subprocess",
			probeExhaustedPools: ["kimi-coding", "google"],
		}),
		{
			action: "stop",
			reason: "probe_exhausted",
			exhaustedPools: ["zai"],
			resetAtRaw: ["2026-08-30 09:12:44"],
		},
	);
	// Probes about other pools do not block the hop.
	const decision = decideQuotaFallback({
		config,
		classification: ZAI_EXHAUSTED,
		workerBackend: "subprocess",
		probeExhaustedPools: ["google"],
	});
	assert.equal(decision.action, "apply");
});

// Row 9 — the single hop carries the full from/to pin for z.ai → Kimi, and
// nothing else (only stop results carry the exhausted-pool report).
test("row 9: z.ai exhaustion applies the hop to Kimi with correct models and pools", () => {
	const config = buildConfig(); // hard (zai/glm-5.3) → allegretto (kimi-coding/k3)
	assert.deepEqual(decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, workerBackend: "subprocess" }), {
		action: "apply",
		fromProfile: "hard",
		toProfile: "allegretto",
		fromModel: "zai/glm-5.3",
		toModel: "kimi-coding/k3",
		exhaustedPool: "zai",
		toPool: "kimi-coding",
	});
});

// Row 9 mirror — Kimi exhaustion hops back to the z.ai profile symmetrically.
test("row 9 mirror: Kimi exhaustion applies the hop to z.ai with correct models and pools", () => {
	const config = buildConfig({ activeProfile: "allegretto", fallbackProfile: "hard" });
	assert.deepEqual(decideQuotaFallback({ config, classification: KIMI_EXHAUSTED, workerBackend: "subprocess" }), {
		action: "apply",
		fromProfile: "allegretto",
		toProfile: "hard",
		fromModel: "kimi-coding/k3",
		toModel: "zai/glm-5.3",
		exhaustedPool: "kimi-coding",
		toPool: "zai",
	});
});

// buildQuotaFallbackState records the hop the engine persists: pools/models
// from the decision, reset text and trigger from the classification, ISO
// timestamp from the injected clock, and an empty retry budget.
test("buildQuotaFallbackState captures the hop shape", () => {
	const config = buildConfig();
	const decision = decideQuotaFallback({ config, classification: ZAI_EXHAUSTED, taskId: "SP-100", workerBackend: "subprocess" });
	assert.deepEqual(buildQuotaFallbackState(decision, { classification: ZAI_EXHAUSTED, taskId: "SP-100", now: NOW }), {
		fromProfile: "hard",
		toProfile: "allegretto",
		fromModel: "zai/glm-5.3",
		toModel: "kimi-coding/k3",
		exhaustedPool: "zai",
		resetAtRaw: "2026-08-30 09:12:44",
		triggerTaskId: "SP-100",
		at: "2026-10-03T12:00:00.000Z",
		retriedTaskIds: [],
	});
	// Kimi reset text is null and stays null rather than being coerced.
	const mirrorConfig = buildConfig({ activeProfile: "allegretto", fallbackProfile: "hard" });
	const mirrorDecision = decideQuotaFallback({ config: mirrorConfig, classification: KIMI_EXHAUSTED, taskId: "SP-200", workerBackend: "subprocess" });
	assert.deepEqual(
		buildQuotaFallbackState(mirrorDecision, { classification: KIMI_EXHAUSTED, taskId: "SP-200", now: NOW }),
		{
			fromProfile: "allegretto",
			toProfile: "hard",
			fromModel: "kimi-coding/k3",
			toModel: "zai/glm-5.3",
			exhaustedPool: "kimi-coding",
			resetAtRaw: null,
			triggerTaskId: "SP-200",
			at: "2026-10-03T12:00:00.000Z",
			retriedTaskIds: [],
		},
	);
});

// markQuotaFallbackRetry is idempotent and never mutates its input.
test("markQuotaFallbackRetry appends once without mutation", () => {
	const state = appliedFallbackState({ retriedTaskIds: ["SP-101"] });
	const snapshot = structuredClone(state);
	const marked = markQuotaFallbackRetry(state, "SP-102");
	assert.deepEqual(marked.retriedTaskIds, ["SP-101", "SP-102"]);
	assert.deepEqual(state, snapshot); // input untouched
	const again = markQuotaFallbackRetry(marked, "SP-102");
	assert.deepEqual(again.retriedTaskIds, ["SP-101", "SP-102"]); // no duplicate
	assert.deepEqual(marked, { ...marked }); // prior state unchanged by the second call
	// Non-object state fails loud instead of silently producing an empty state.
	assert.throws(() => markQuotaFallbackRetry(null, "SP-101"), TypeError);
});

// Purity: deciding, building, and marking leave every input deep-equal.
test("decideQuotaFallback and helpers never mutate their inputs", () => {
	const config = buildConfig();
	const classification = structuredClone(ZAI_EXHAUSTED);
	const configSnapshot = structuredClone(config);
	const classificationSnapshot = structuredClone(classification);
	const decision = decideQuotaFallback({ config, classification, taskId: "SP-100", workerBackend: "subprocess" });
	assert.deepEqual(config, configSnapshot);
	assert.deepEqual(classification, classificationSnapshot);
	const state = buildQuotaFallbackState(decision, { classification, taskId: "SP-100", now: NOW });
	assert.deepEqual(config, configSnapshot);
	assert.deepEqual(classification, classificationSnapshot);
	const stateSnapshot = structuredClone(state);
	decideQuotaFallback({ config, fallbackState: state, classification: KIMI_EXHAUSTED, taskId: "SP-101", workerBackend: "subprocess" });
	markQuotaFallbackRetry(state, "SP-101");
	assert.deepEqual(state, stateSnapshot);
});
