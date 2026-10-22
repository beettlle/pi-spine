/**
 * SP-843 — Quota fallback hop expires or is cleared (#350).
 *
 * Covers the two ways a batch returns to its primary pool after the hop:
 * expiry (parsed reset time + 5 min grace, injected `now`) through
 * `runWithQuotaFallback` / `loadQuotaFallbackForWorker`, and the operator
 * command `spine batch quota-fallback clear` (state guards, journal event,
 * next-command hint), plus the diagnose lines for a sticky hop.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { resolveTaskWorkerProfile } from "../../src/batch/engine-lanes/task-agent-profile.mjs";
import {
	clearExpiredQuotaFallback,
	clearQuotaFallbackByOperator,
	loadQuotaFallbackForWorker,
} from "../../src/batch/engine-lanes/quota-fallback-state.mjs";
import { runWithQuotaFallback } from "../../src/batch/engine-lanes/quota-fallback-run.mjs";
import { buildDiagnosisOutput } from "../../src/batch/diagnosis.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	QUOTA_FALLBACK_EXPIRY_GRACE_MS,
	buildQuotaFallbackState,
	decideQuotaFallback,
} from "../../src/batch/quota-fallback.mjs";
import { loadSpineBatchState, spineBatchStatePath } from "../../src/batch/state.mjs";

const BATCH_ID = "20261022T090000";
const HOP_AT = new Date("2026-10-03T12:00:00.000Z");
/** z.ai reset text; read as UTC+8 → 2026-10-03T14:00:00.000Z. */
const ZAI_RESET_RAW = "2026-10-03 22:00:00";
const ZAI_RESET_AT = Date.parse("2026-10-03T14:00:00.000Z");
const EXPIRES_AT = ZAI_RESET_AT + QUOTA_FALLBACK_EXPIRY_GRACE_MS;

const ZAI_EXHAUSTED = {
	kind: "quota_exhausted",
	poolId: "zai",
	httpStatus: 429,
	providerCode: "1308",
	resetAtRaw: ZAI_RESET_RAW,
	resetAt: null,
	message: `Usage limit reached for 5 hour. Your limit will reset at ${ZAI_RESET_RAW}`,
};
const KIMI_EXHAUSTED = {
	kind: "quota_exhausted",
	poolId: "kimi-coding",
	httpStatus: 403,
	providerCode: "permission_error",
	resetAtRaw: "10pm PT",
	resetAt: null,
	message: "You've reached your usage limit for this billing cycle.",
};

/** hard (zai/glm-5.3) active, allegretto (kimi-coding/k3) fallback. */
function buildConfig() {
	return {
		agents: {
			activeProfile: "hard",
			worker: { model: "zai/glm-5.3", thinking: "high" },
			profiles: {
				hard: { worker: { model: "zai/glm-5.3", thinking: "high" } },
				allegretto: { worker: { model: "kimi-coding/k3", thinking: "high" } },
			},
			quotaFallbackProfile: "allegretto",
		},
	};
}

/** A hop the engine would have persisted for `classification`. */
function buildHop(classification = ZAI_EXHAUSTED, { retriedTaskIds = [] } = {}) {
	// Kimi exhaustion hops the other way (allegretto active → hard fallback).
	const config = buildConfig();
	if (classification.poolId === "kimi-coding") {
		config.agents.activeProfile = "allegretto";
		config.agents.worker.model = "kimi-coding/k3";
		config.agents.quotaFallbackProfile = "hard";
	}
	const decision = decideQuotaFallback({
		config,
		classification,
		taskId: "SP-100",
		workerBackend: "subprocess",
	});
	assert.equal(decision.action, "apply");
	return {
		...buildQuotaFallbackState(decision, { classification, taskId: "SP-100", now: HOP_AT }),
		retriedTaskIds,
	};
}

/** Batch state with one failed task `SP-100` and an optional hop. */
function buildState({ phase = "paused", hop = null, taskStatus = "failed" } = {}) {
	return {
		schemaVersion: 1,
		batchId: BATCH_ID,
		phase,
		tasks: [{ taskId: "SP-100", status: taskStatus, exitReason: taskStatus === "failed" ? "provider_quota_exhausted" : null }],
		segments: [],
		lanes: [],
		resilience: hop ? { quotaFallback: hop } : {},
	};
}

/** Writes `state` to `.spine/batch-state.json` (same shape other quota tests seed). */
function seedState(projectRoot, state) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(spineBatchStatePath(projectRoot), JSON.stringify(state, null, 2), "utf-8");
}

/** @returns {Promise<string>} */
function tempProject(prefix) {
	return mkdtemp(path.join(os.tmpdir(), prefix));
}

function eventsOfType(projectRoot, type) {
	return readJournalEvents(projectRoot, BATCH_ID).filter((event) => event.type === type);
}

/** Profile resolution a worker spawn performs for this task (SP-835 `prepareWorkerAttempt`). */
function resolveSpawnProfile({ projectRoot, state, now }) {
	const quotaFallback =
		state.resilience?.quotaFallback ?? loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID, now });
	return resolveTaskWorkerProfile({ config: buildConfig(), quotaFallback, task: state.tasks[0] });
}

const RUN_PARAMS = { batchId: BATCH_ID, taskId: "SP-100", config: buildConfig(), workerBackend: "subprocess" };

// --- Expiry ---

test("expired hop: the retried worker spawns on the primary profile and the clear is journaled once", async () => {
	const projectRoot = await tempProject("spine-qfc-expire-");
	try {
		const state = buildState({ hop: buildHop() });
		seedState(projectRoot, state);
		assert.equal(state.resilience.quotaFallback.resetAt, ZAI_RESET_AT);
		const spawned = [];

		// Before expiry the sticky hop pins the worker to the fallback profile.
		await runWithQuotaFallback(
			async () => {
				spawned.push(resolveSpawnProfile({ projectRoot, state, now: EXPIRES_AT - 1 }));
				return { ok: true };
			},
			{ ...RUN_PARAMS, projectRoot, state, now: EXPIRES_AT - 1 },
		);
		assert.equal(spawned[0].profile, "allegretto");
		assert.equal(spawned[0].source, "quota_fallback");
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_cleared").length, 0);

		// At resetAt + grace the hop is cleared before the worker spawns.
		await runWithQuotaFallback(
			async () => {
				spawned.push(resolveSpawnProfile({ projectRoot, state, now: EXPIRES_AT }));
				return { ok: true };
			},
			{ ...RUN_PARAMS, projectRoot, state, now: EXPIRES_AT },
		);
		assert.equal(spawned[1].profile, "hard");
		assert.equal(spawned[1].source, "active_profile");
		assert.equal(state.resilience.quotaFallback, undefined, "live state drops the hop");
		assert.equal(loadSpineBatchState(projectRoot).raw.resilience.quotaFallback, undefined, "disk state drops the hop");

		// A later run does not journal the clear again.
		await runWithQuotaFallback(async () => ({ ok: true }), { ...RUN_PARAMS, projectRoot, state, now: EXPIRES_AT + 1000 });
		const cleared = eventsOfType(projectRoot, "batch.quota_fallback_cleared");
		assert.equal(cleared.length, 1);
		assert.deepEqual(cleared[0].payload, {
			reason: "expired",
			fromProfile: "hard",
			toProfile: "allegretto",
			exhaustedPool: "zai",
			resetAt: ZAI_RESET_AT,
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("loadQuotaFallbackForWorker ignores an expired hop without writing", async () => {
	const projectRoot = await tempProject("spine-qfc-load-");
	try {
		seedState(projectRoot, buildState({ hop: buildHop() }));
		const before = fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8");
		assert.ok(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID, now: EXPIRES_AT - 1 }));
		assert.equal(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID, now: EXPIRES_AT }), null);
		assert.equal(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"), before, "load must not write");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("unparsable reset time never expires the hop", async () => {
	const projectRoot = await tempProject("spine-qfc-unparsable-");
	try {
		const hop = buildHop(KIMI_EXHAUSTED);
		assert.equal(hop.resetAt, null);
		const state = buildState({ hop });
		seedState(projectRoot, state);
		const farFuture = Date.parse("2099-01-01T00:00:00.000Z");

		assert.equal(await clearExpiredQuotaFallback({ projectRoot, batchId: BATCH_ID, state, now: farFuture }), null);
		assert.ok(state.resilience.quotaFallback);
		assert.ok(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID, now: farFuture }));
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_cleared").length, 0);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("a new quota error after the hop expired can hop again", async () => {
	const projectRoot = await tempProject("spine-qfc-rehop-");
	try {
		// SP-100 already used its auto-retry on the first hop, so only expiry
		// (not the sticky retry budget) lets a fresh hop happen.
		const state = buildState({ hop: buildHop(ZAI_EXHAUSTED, { retriedTaskIds: ["SP-100"] }) });
		seedState(projectRoot, state);
		const secondResetRaw = "2026-10-03 23:00:00";
		let runs = 0;

		await runWithQuotaFallback(
			async () => {
				runs += 1;
				if (runs === 1) {
					return {
						ok: false,
						workerResult: {
							classification: "provider_quota_exhausted",
							providerQuota: { ...ZAI_EXHAUSTED, resetAtRaw: secondResetRaw },
						},
					};
				}
				return { ok: true };
			},
			{ ...RUN_PARAMS, projectRoot, state, now: EXPIRES_AT },
		);

		assert.equal(runs, 2, "the failed task is retried on the new hop");
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_cleared").length, 1);
		const applied = eventsOfType(projectRoot, "batch.quota_fallback_applied");
		assert.equal(applied.length, 1, "a second hop is applied after the clear");
		assert.equal(applied[0].payload.toProfile, "allegretto");
		assert.equal(state.resilience.quotaFallback.resetAtRaw, secondResetRaw);
		assert.deepEqual(state.resilience.quotaFallback.retriedTaskIds, ["SP-100"]);
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_exhausted").length, 0);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

// --- Operator clear ---

test("operator clear deletes the hop, journals it, and prints the next commands", async () => {
	const projectRoot = await tempProject("spine-qfc-operator-");
	try {
		for (const phase of ["paused", "failed"]) {
			seedState(projectRoot, buildState({ phase, hop: buildHop() }));
			const result = clearQuotaFallbackByOperator({ projectRoot });
			assert.equal(result.ok, true, result.output);
			assert.equal(result.exitCode, 0);
			assert.deepEqual(result.nextCommands, ["spine batch retry SP-100", "spine batch resume"]);
			assert.match(result.output, /Cleared quota fallback/);
			assert.match(result.output, /spine batch retry SP-100/);
			assert.match(result.output, /spine batch resume/);
			const onDisk = loadSpineBatchState(projectRoot).raw;
			assert.equal(onDisk.resilience?.quotaFallback, undefined);
			assert.equal(onDisk.phase, phase, "clear must not change the phase");
		}
		const cleared = eventsOfType(projectRoot, "batch.quota_fallback_cleared");
		assert.equal(cleared.length, 2);
		assert.deepEqual(cleared[0].payload, {
			reason: "operator",
			fromProfile: "hard",
			toProfile: "allegretto",
			exhaustedPool: "zai",
			resetAt: ZAI_RESET_AT,
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("operator clear refuses a running batch and keeps the hop", async () => {
	const projectRoot = await tempProject("spine-qfc-running-");
	try {
		seedState(projectRoot, buildState({ phase: "running", hop: buildHop(), taskStatus: "pending" }));
		const result = clearQuotaFallbackByOperator({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.error, "cannot_clear_quota_fallback");
		assert.match(result.output, /batch phase is running/);
		assert.ok(loadSpineBatchState(projectRoot).raw.resilience.quotaFallback, "hop must survive a refused clear");
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_cleared").length, 0);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("operator clear errors clearly with no hop or no batch", async () => {
	const projectRoot = await tempProject("spine-qfc-nohop-");
	try {
		const noBatch = clearQuotaFallbackByOperator({ projectRoot });
		assert.equal(noBatch.ok, false);
		assert.equal(noBatch.error, "no_active_batch");

		seedState(projectRoot, buildState({ hop: null }));
		const noHop = clearQuotaFallbackByOperator({ projectRoot });
		assert.equal(noHop.ok, false);
		assert.equal(noHop.exitCode, 1);
		assert.equal(noHop.error, "no_quota_fallback");
		assert.match(noHop.output, /No quota fallback is active/);
		assert.equal(eventsOfType(projectRoot, "batch.quota_fallback_cleared").length, 0);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("spine batch quota-fallback clear routes through the batch CLI", async () => {
	const projectRoot = await tempProject("spine-qfc-cli-");
	try {
		seedState(projectRoot, buildState({ hop: buildHop() }));

		const usage = await runSpineBatch({ projectRoot, args: ["quota-fallback"] });
		assert.equal(usage.exitCode, 1);
		assert.match(usage.output, /Usage: spine batch quota-fallback clear/);
		assert.ok(loadSpineBatchState(projectRoot).raw.resilience.quotaFallback);

		const json = await runSpineBatch({ projectRoot, args: ["quota-fallback", "clear", "--json"] });
		assert.equal(json.exitCode, 0);
		assert.equal(JSON.parse(json.output).ok, true);
		assert.equal(loadSpineBatchState(projectRoot).raw.resilience?.quotaFallback, undefined);

		const again = await runSpineBatch({ projectRoot, args: ["quota-fallback", "clear"] });
		assert.equal(again.exitCode, 1);
		assert.match(again.output, /No quota fallback is active/);

		const help = await runSpineBatch({ projectRoot, args: ["--help"] });
		assert.match(help.output, /quota-fallback clear/);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

// --- Diagnose ---

test("diagnose shows the hop expiry and suggests the clear command when the fallback pool died too", () => {
	const quotaFallback = buildHop();
	const withExpiry = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-100",
		exitReason: "provider_quota_exhausted",
		quotaFallback,
		lastQuotaExhausted: { poolId: "zai", resetAtRaw: ZAI_RESET_RAW },
	});
	assert.ok(withExpiry.background.includes(`Quota fallback expires ${new Date(EXPIRES_AT).toISOString()}`));
	assert.ok(
		!withExpiry.background.some((line) => line.includes("quota-fallback clear")),
		"no clear suggestion while the fallback pool still works",
	);

	const chainDead = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-100",
		exitReason: "provider_quota_exhausted",
		quotaFallback,
		lastQuotaExhausted: { exhaustedPools: ["zai", "kimi-coding"], resetAtRaw: [ZAI_RESET_RAW, null] },
	});
	assert.ok(chainDead.background.some((line) => line.includes("spine batch quota-fallback clear")));

	const unparsable = buildDiagnosisOutput("needs_retry", {
		batchId: BATCH_ID,
		failedTaskId: "SP-100",
		quotaFallback: buildHop(KIMI_EXHAUSTED),
	});
	assert.ok(unparsable.background.includes("Quota fallback has no parsable reset time (no automatic expiry)"));
});
