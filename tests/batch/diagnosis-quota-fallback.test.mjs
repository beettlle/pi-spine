/**
 * SP-810 — Operator surface: diagnose quota fallback (partial GitHub #329).
 *
 * Covers the reconcile diagnosis context fields, the SBAR Background lines
 * (incl. the paste-ready manifest line) and Assessment rationale for quota
 * situations, plus the journal hint priority/summary picks for the three
 * quota event types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildDiagnosisOutput } from "../../src/batch/diagnosis.mjs";
import { buildReconcileDiagnosisContext } from "../../src/batch/reconcile-diagnosis-context.mjs";
import {
	extractJournalDiagnosisHints,
	summarizeJournalEvent,
} from "../../src/batch/journal.mjs";

const BATCH_ID = "20261010T000000-ab12";
const FALLBACK_AT = "2026-10-09T21:30:00.000Z";

function quotaFallbackState(overrides = {}) {
	return {
		exhaustedPool: "kimi-coding",
		resetAtRaw: "10pm PT",
		toProfile: "zai-fallback",
		toModel: "zai/glm-4.6",
		at: FALLBACK_AT,
		triggerTaskId: "SP-900",
		...overrides,
	};
}

function contextParams({ quotaFallback = null, journalEvents = [] } = {}) {
	return {
		batch: { batchId: BATCH_ID, baseBranch: "main", phase: "failed" },
		git: { baseBranch: "main", orchMergedToBase: false },
		signals: {
			raw: quotaFallback ? { resilience: { quotaFallback } } : {},
			journalEvents,
			failedTasks: 1,
			allTasksTerminalSuccess: false,
		},
		classifiedTasks: [],
		diagnosis: "needs_retry",
		failedTaskId: "SP-900",
		mergeFailureSummary: {},
	};
}

// --- buildReconcileDiagnosisContext ---

test("context exposes quotaFallback state and latest quota-exhaustion payload", () => {
	const ctx = buildReconcileDiagnosisContext(
		contextParams({
			quotaFallback: quotaFallbackState(),
			journalEvents: [
				{
					type: "worker.quota_exhausted",
					payload: { poolId: "kimi-coding", resetAtRaw: "10pm PT" },
				},
				{ type: "task.failed", payload: { reason: "ignored" } },
			],
		}),
	);
	assert.deepStrictEqual(ctx.quotaFallback, quotaFallbackState());
	assert.deepStrictEqual(ctx.lastQuotaExhausted, { poolId: "kimi-coding", resetAtRaw: "10pm PT" });
});

test("context picks the latest quota event and falls back to null without quota data", () => {
	const ctx = buildReconcileDiagnosisContext(
		contextParams({
			journalEvents: [
				{
					type: "batch.quota_fallback_exhausted",
					payload: { exhaustedPools: ["kimi-coding", "zai"], resetAtRaw: ["10pm PT", null] },
				},
				{
					type: "worker.quota_exhausted",
					payload: { poolId: "anthropic", resetAtRaw: "midnight" },
				},
			],
		}),
	);
	assert.equal(ctx.quotaFallback, null);
	// Reverse scan must pick the worker.quota_exhausted event, not the older
	// fallback-exhausted one.
	assert.deepStrictEqual(ctx.lastQuotaExhausted, { poolId: "anthropic", resetAtRaw: "midnight" });

	const empty = buildReconcileDiagnosisContext(contextParams());
	assert.equal(empty.quotaFallback, null);
	assert.equal(empty.lastQuotaExhausted, null);
});

// --- Background lines for an active fallback ---

test("background shows the fallback hop line and the paste-ready manifest line", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		phase: "running",
		failedTaskId: "SP-900",
		exitReason: "provider_quota_exhausted",
		quotaFallback: quotaFallbackState(),
		lastQuotaExhausted: { poolId: "kimi-coding", resetAtRaw: "10pm PT" },
	});
	assert.ok(
		output.background.includes(
			"Quota fallback active: kimi-coding exhausted (resets 10pm PT, provider local time) → zai-fallback (zai/glm-4.6) since 2026-10-09T21:30:00.000Z, triggered by SP-900",
		),
	);
	// Manifest line stays ASCII (`->`) exactly as operators paste it (#248).
	assert.ok(
		output.background.includes(
			"Agent pin override: yes (2026-10-09, auto quota fallback kimi-coding -> zai-fallback, batch 20261010T000000-ab12)",
		),
	);
});

// --- Assessment rationale ---

test("quota exhaustion without fallback shows the reset window instead of implying retry", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-900",
		exitReason: "provider_quota_exhausted",
		quotaFallback: null,
		lastQuotaExhausted: { poolId: "kimi-coding", resetAtRaw: "10pm PT" },
	});
	assert.match(output.assessmentReason, /provider quota is exhausted/);
	assert.match(output.assessmentReason, /resets 10pm PT/);
	assert.match(output.assessmentReason, /no quota fallback can take over/);
	assert.doesNotMatch(output.assessmentReason, /retry is reasonable/);
});

test("quota exhaustion without a recorded reset says reset time unknown", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-900",
		exitReason: "provider_quota_exhausted",
		quotaFallback: null,
		lastQuotaExhausted: null,
	});
	assert.match(output.assessmentReason, /reset time unknown/);
});

test("exhausted fallback chain lists every pool reset window", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-900",
		exitReason: "provider_quota_exhausted",
		quotaFallback: quotaFallbackState(),
		lastQuotaExhausted: {
			exhaustedPools: ["kimi-coding", "zai"],
			resetAtRaw: ["10pm PT", null],
		},
	});
	assert.match(output.assessmentReason, /kimi-coding resets 10pm PT/);
	assert.match(output.assessmentReason, /zai resets unknown/);
	assert.match(output.assessmentReason, /no quota fallback can take over/);
});

test("provider_overloaded assessment says retry is reasonable", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-900",
		exitReason: "provider_overloaded",
	});
	assert.match(output.assessmentReason, /transient provider overload/);
	assert.match(output.assessmentReason, /retry is reasonable/);
});

test("failed task without quota data produces output identical to before SP-810", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		phase: "failed",
		failedTaskId: "SP-900",
		exitReason: "contract_violation",
	});
	assert.equal(
		output.assessmentReason,
		'Task SP-900 exited "contract_violation" without completing its contract, so the batch cannot proceed until it is retried',
	);
	assert.ok(
		!output.background.some(
			(line) => line.startsWith("Quota fallback active") || line.startsWith("Agent pin override"),
		),
	);

	const noExitReason = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-900",
	});
	assert.equal(
		noExitReason.assessmentReason,
		"Worker for task SP-900 died before writing .DONE, so the batch cannot proceed until it is retried",
	);
});

// --- Journal hints ---

test("quota events rank as diagnosis hints with key fields in their summaries", () => {
	const events = [
		{
			type: "lane.progress_snapshot",
			timestamp: "2026-10-09T21:00:00.000Z",
			payload: { dirtyPathCount: 2 },
		},
		{
			type: "worker.quota_exhausted",
			timestamp: "2026-10-09T21:10:00.000Z",
			payload: { poolId: "kimi-coding", resetAtRaw: "10pm PT", taskId: "SP-900" },
		},
		{
			type: "batch.quota_fallback_applied",
			timestamp: "2026-10-09T21:11:00.000Z",
			payload: {
				fromProfile: "default",
				toProfile: "zai-fallback",
				exhaustedPool: "kimi-coding",
			},
		},
		{
			type: "batch.quota_fallback_exhausted",
			timestamp: "2026-10-09T21:20:00.000Z",
			payload: { exhaustedPools: ["kimi-coding", "zai"], resetAtRaw: ["10pm PT", null] },
		},
	];
	const hints = extractJournalDiagnosisHints(events);
	const types = hints.map((hint) => hint.type);
	assert.ok(types.includes("worker.quota_exhausted"));
	assert.ok(types.includes("batch.quota_fallback_applied"));
	assert.ok(types.includes("batch.quota_fallback_exhausted"));

	const byType = new Map(hints.map((hint) => [hint.type, hint.summary]));
	assert.match(byType.get("worker.quota_exhausted"), /pool kimi-coding/);
	assert.match(byType.get("worker.quota_exhausted"), /resets 10pm PT/);
	assert.match(byType.get("batch.quota_fallback_applied"), /default → zai-fallback/);
	assert.match(byType.get("batch.quota_fallback_exhausted"), /exhausted: kimi-coding, zai/);
	assert.match(byType.get("batch.quota_fallback_exhausted"), /resets 10pm PT \/ unknown/);
});

test("summarizeJournalEvent leaves non-quota events untouched", () => {
	const summary = summarizeJournalEvent({
		type: "task.failed",
		payload: { reason: "contract failed" },
	});
	assert.match(summary, /contract failed/);
	assert.doesNotMatch(summary, /resets|exhausted:/);
});
