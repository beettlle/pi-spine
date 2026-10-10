/**
 * SP-808 — Persisted quota-fallback state + sticky worker override (#329, partial).
 *
 * Covers the side-effect helpers in `src/batch/engine-lanes/quota-fallback-state.mjs`
 * (state persistence, journal events, read-only worker resolution) plus the
 * `runWorker` sticky override: when the on-disk batch state carries a fallback
 * hop for the running batch, every later worker spawn receives
 * `SPINE_AGENT_PROFILE_OVERRIDE` merged under the caller's `extraEnv`.
 *
 * The child-env assertions run `runWorker` in stub mode through a fake launch
 * script that dumps `SPINE_AGENT_PROFILE_OVERRIDE` before exec'ing the real
 * runner — the same child env `spawnWorkerChild` builds via
 * `buildWorkerChildEnv` (extras applied last).
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	applyQuotaFallback,
	loadQuotaFallbackForWorker,
	quotaFallbackWorkerEnv,
	recordQuotaFallbackExhausted,
	recordQuotaFallbackRetry,
	resolveEffectiveWorkerModel,
	resolveWorkerQuotaFallbackContext,
} from "../../src/batch/engine-lanes/quota-fallback-state.mjs";
import {
	buildQuotaFallbackState,
	decideQuotaFallback,
	markQuotaFallbackRetry,
} from "../../src/batch/quota-fallback.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState, spineBatchStatePath } from "../../src/batch/state.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

// Classification fixtures mirror the SP-804 result shape (#329 real payloads).
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

const NOW = new Date("2026-10-03T12:00:00.000Z");
const BATCH_ID = "20261009T170000";

/** Resolved-config shape: hard (zai/glm-5.3) active, allegretto (kimi-coding/k3) fallback. */
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

/** The apply decision the engine hands to `applyQuotaFallback` (row 9). */
function applyDecision() {
	const decision = decideQuotaFallback({
		config: buildConfig(),
		fallbackState: null,
		classification: ZAI_EXHAUSTED,
		taskId: "SP-100",
		workerBackend: "subprocess",
	});
	assert.equal(decision.action, "apply");
	return decision;
}

/** A fallback state the engine would have persisted (SP-807 builders). */
function seededFallbackState({ retriedTaskIds = [] } = {}) {
	let state = buildQuotaFallbackState(applyDecision(), {
		classification: ZAI_EXHAUSTED,
		taskId: "SP-100",
		now: NOW,
	});
	for (const taskId of retriedTaskIds) {
		state = markQuotaFallbackRetry(state, taskId);
	}
	return state;
}

/** @returns {Promise<string>} */
async function tempProject(prefix) {
	return mkdtemp(path.join(os.tmpdir(), prefix));
}

test("applyQuotaFallback persists resilience.quotaFallback and journals once", async () => {
	const projectRoot = await tempProject("spine-qfs-apply-");
	try {
		const state = { batchId: BATCH_ID, phase: "running" };
		const returned = await applyQuotaFallback({
			projectRoot,
			batchId: BATCH_ID,
			state,
			decision: applyDecision(),
			classification: ZAI_EXHAUSTED,
			taskId: "SP-100",
			now: NOW,
		});

		const expected = {
			fromProfile: "hard",
			toProfile: "allegretto",
			fromModel: "zai/glm-5.3",
			toModel: "kimi-coding/k3",
			exhaustedPool: "zai",
			resetAtRaw: "2026-08-30 09:12:44",
			triggerTaskId: "SP-100",
			at: "2026-10-03T12:00:00.000Z",
			retriedTaskIds: [],
		};
		assert.deepEqual(returned, expected);
		// Live state carries the hop (callers keep mutating the same object).
		assert.deepEqual(state.resilience.quotaFallback, expected);
		// Persisted through the engine saver (same one lane paths use).
		const onDisk = loadSpineBatchState(projectRoot).raw;
		assert.ok(onDisk, "batch state must be on disk after applyQuotaFallback");
		assert.deepEqual(onDisk.resilience.quotaFallback, expected);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const applied = events.filter((event) => event.type === "batch.quota_fallback_applied");
		assert.equal(applied.length, 1, "exactly one batch.quota_fallback_applied event");
		assert.deepEqual(applied[0].payload, {
			fromProfile: "hard",
			toProfile: "allegretto",
			fromModel: "zai/glm-5.3",
			toModel: "kimi-coding/k3",
			exhaustedPool: "zai",
			resetAtRaw: "2026-08-30 09:12:44",
			taskIds: ["SP-100"],
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("applyQuotaFallback journals the Kimi mirror hop with a null reset window", async () => {
	const projectRoot = await tempProject("spine-qfs-apply-mirror-");
	try {
		// Allegretto active → hard fallback: Kimi exhaustion hops to z.ai.
		const config = buildConfig();
		config.agents.activeProfile = "allegretto";
		config.agents.worker.model = "kimi-coding/k3";
		config.agents.quotaFallbackProfile = "hard";
		const decision = decideQuotaFallback({
			config,
			fallbackState: null,
			classification: KIMI_EXHAUSTED,
			taskId: "SP-200",
			workerBackend: "subprocess",
		});
		assert.equal(decision.action, "apply");

		const state = { batchId: BATCH_ID, phase: "running" };
		const returned = await applyQuotaFallback({
			projectRoot,
			batchId: BATCH_ID,
			state,
			decision,
			classification: KIMI_EXHAUSTED,
			taskId: "SP-200",
			now: NOW,
		});
		assert.equal(returned.resetAtRaw, null, "Kimi classification has no reset text");

		const applied = readJournalEvents(projectRoot, BATCH_ID).filter(
			(event) => event.type === "batch.quota_fallback_applied",
		);
		assert.equal(applied.length, 1);
		assert.deepEqual(applied[0].payload, {
			fromProfile: "allegretto",
			toProfile: "hard",
			fromModel: "kimi-coding/k3",
			toModel: "zai/glm-5.3",
			exhaustedPool: "kimi-coding",
			resetAtRaw: null,
			taskIds: ["SP-200"],
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("recordQuotaFallbackRetry appends the taskId, persists, and journals", async () => {
	const projectRoot = await tempProject("spine-qfs-retry-");
	try {
		const state = {
			batchId: BATCH_ID,
			phase: "running",
			resilience: { quotaFallback: seededFallbackState() },
		};

		const returned = await recordQuotaFallbackRetry({
			projectRoot,
			batchId: BATCH_ID,
			state,
			taskId: "SP-101",
		});

		assert.deepEqual(returned.retriedTaskIds, ["SP-101"]);
		assert.deepEqual(state.resilience.quotaFallback.retriedTaskIds, ["SP-101"]);
		const onDisk = loadSpineBatchState(projectRoot).raw;
		assert.ok(onDisk);
		assert.deepEqual(onDisk.resilience.quotaFallback.retriedTaskIds, ["SP-101"]);

		const events = readJournalEvents(projectRoot, BATCH_ID).filter(
			(event) => event.type === "task.quota_fallback_retry",
		);
		assert.equal(events.length, 1, "exactly one task.quota_fallback_retry event");
		// Journal schema v2 lifts taskId to the entry meta (SP-806 precedent).
		assert.equal(events[0].taskId, "SP-101");
		assert.deepEqual(events[0].payload, {
			toProfile: "allegretto",
			toModel: "kimi-coding/k3",
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("recordQuotaFallbackExhausted journals both pools with aligned reset times and writes no state", async () => {
	const projectRoot = await tempProject("spine-qfs-exhausted-");
	try {
		// Fallback pool died too → stop carries both pools/reset windows.
		const decision = decideQuotaFallback({
			config: buildConfig(),
			fallbackState: seededFallbackState(),
			classification: KIMI_EXHAUSTED,
			taskId: "SP-101",
			workerBackend: "subprocess",
		});
		assert.equal(decision.action, "stop");
		assert.equal(decision.reason, "fallback_pool_exhausted");

		recordQuotaFallbackExhausted({ projectRoot, batchId: BATCH_ID, decision, taskId: "SP-101" });

		const events = readJournalEvents(projectRoot, BATCH_ID).filter(
			(event) => event.type === "batch.quota_fallback_exhausted",
		);
		assert.equal(events.length, 1, "exactly one batch.quota_fallback_exhausted event");
		// Journal schema v2 lifts taskId to the entry meta (SP-806 precedent).
		assert.equal(events[0].taskId, "SP-101");
		assert.deepEqual(events[0].payload, {
			reason: "fallback_pool_exhausted",
			exhaustedPools: ["zai", "kimi-coding"],
			resetAtRaw: ["2026-08-30 09:12:44", null],
		});
		// Pure journal side effect — never writes batch state.
		assert.equal(fs.existsSync(spineBatchStatePath(projectRoot)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("quotaFallbackWorkerEnv maps state to the profile override env", () => {
	assert.deepEqual(quotaFallbackWorkerEnv(null), {});
	assert.deepEqual(quotaFallbackWorkerEnv(undefined), {});
	assert.deepEqual(quotaFallbackWorkerEnv({}), {});
	assert.deepEqual(quotaFallbackWorkerEnv({ toProfile: "" }), {});
	assert.deepEqual(quotaFallbackWorkerEnv({ toProfile: "allegretto" }), {
		SPINE_AGENT_PROFILE_OVERRIDE: "allegretto",
	});
});

test("resolveEffectiveWorkerModel prefers the fallback profile model while a hop is active", () => {
	const config = buildConfig();
	const fallback = seededFallbackState();
	assert.equal(resolveEffectiveWorkerModel(config, fallback), "kimi-coding/k3");
	// No hop → the configured worker model.
	assert.equal(resolveEffectiveWorkerModel(config, null), "zai/glm-5.3");
	assert.equal(resolveEffectiveWorkerModel(config, undefined), "zai/glm-5.3");
	// Fallback profile missing from config falls back to the configured model
	// instead of surfacing undefined. A persisted hop always points at a real
	// model (SP-807 row 6 refuses inherit/missing destinations), so the profile
	// model is returned verbatim — the decision layer owns the inherit guard.
	const drifted = buildConfig();
	drifted.agents.profiles = { hard: config.agents.profiles.hard };
	assert.equal(resolveEffectiveWorkerModel(drifted, fallback), "zai/glm-5.3");
	// Neither source yields a string → undefined (pre-SP-808 contract).
	assert.equal(resolveEffectiveWorkerModel({}, fallback), undefined);
	assert.equal(resolveEffectiveWorkerModel(undefined, null), undefined);
});

test("loadQuotaFallbackForWorker is read-only, batch-scoped, and fail-open", async () => {
	const projectRoot = await tempProject("spine-qfs-load-");
	try {
		const fallback = seededFallbackState();

		// Missing state file → null.
		assert.equal(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID }), null);

		// Unreadable/corrupt state → null, not a throw.
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(spineBatchStatePath(projectRoot), "{not-json", "utf-8");
		assert.equal(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID }), null);

		// State from another batch → null (no cross-batch override).
		fs.writeFileSync(
			spineBatchStatePath(projectRoot),
			JSON.stringify({ batchId: "20260101T000000", resilience: { quotaFallback: fallback } }),
			"utf-8",
		);
		assert.equal(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID }), null);

		// Matching batch with a hop → the fallback state.
		fs.writeFileSync(
			spineBatchStatePath(projectRoot),
			JSON.stringify({ batchId: BATCH_ID, phase: "running", resilience: { quotaFallback: fallback } }),
			"utf-8",
		);
		const hopState = fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8");
		assert.deepEqual(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID }), fallback);
		assert.equal(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"), hopState, "load must not write");
		// State without a hop → null.
		fs.writeFileSync(
			spineBatchStatePath(projectRoot),
			JSON.stringify({ batchId: BATCH_ID, phase: "running", resilience: {} }),
			"utf-8",
		);
		const noHopState = fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8");
		assert.equal(loadQuotaFallbackForWorker({ projectRoot, batchId: BATCH_ID }), null);
		assert.equal(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"), noHopState, "load must not write");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("resolveWorkerQuotaFallbackContext merges the override under caller extraEnv", async () => {
	const projectRoot = await tempProject("spine-qfs-ctx-");
	try {
		const config = buildConfig();
		const fallback = seededFallbackState();
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			spineBatchStatePath(projectRoot),
			JSON.stringify({ batchId: BATCH_ID, phase: "running", resilience: { quotaFallback: fallback } }),
			"utf-8",
		);

		// No projectRoot/batchId → no override, caller env passes through.
		const withoutBatch = resolveWorkerQuotaFallbackContext({
			projectRoot: undefined,
			batchId: undefined,
			config,
			extraEnv: { SPINE_MATRIX_ROW: "row-a" },
		});
		assert.equal(withoutBatch.fallback, null);
		assert.equal(withoutBatch.workerModel, "zai/glm-5.3");
		assert.deepEqual(withoutBatch.extraEnv, { SPINE_MATRIX_ROW: "row-a" });

		// With a hop on disk: the fallback loads read-only, the effective model
		// is the fallback profile's, and the override sits under the caller's keys.
		const withHop = resolveWorkerQuotaFallbackContext({
			projectRoot,
			batchId: BATCH_ID,
			config,
			extraEnv: { SPINE_MATRIX_ROW: "row-b" },
		});
		assert.deepEqual(withHop.fallback, fallback);
		assert.equal(withHop.workerModel, "kimi-coding/k3");
		assert.deepEqual(withHop.extraEnv, {
			SPINE_AGENT_PROFILE_OVERRIDE: "allegretto",
			SPINE_MATRIX_ROW: "row-b",
		});

		// Collision: the caller's key wins over the persisted override.
		const collision = resolveWorkerQuotaFallbackContext({
			projectRoot,
			batchId: BATCH_ID,
			config,
			extraEnv: { SPINE_AGENT_PROFILE_OVERRIDE: "caller-row" },
		});
		assert.equal(collision.fallback?.toProfile, "allegretto");
		assert.deepEqual(collision.extraEnv, { SPINE_AGENT_PROFILE_OVERRIDE: "caller-row" });

		// Missing state file → no override, behaviour unchanged.
		const noState = resolveWorkerQuotaFallbackContext({
			projectRoot: "/tmp/does-not-exist-qfs",
			batchId: BATCH_ID,
			config,
			extraEnv: undefined,
		});
		assert.equal(noState.fallback, null);
		assert.deepEqual(noState.extraEnv, {});
		assert.equal(noState.workerModel, "zai/glm-5.3");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

/**
 * Builds the fixture the runWorker spawn tests share: a temp project with a
 * minimal task packet, a fake launch script that records the child's
 * SPINE_AGENT_PROFILE_OVERRIDE then execs the real runner, and (optionally) an
 * on-disk batch state carrying a fallback hop.
 *
 * @param {object} params
 * @param {string|null} params.stateBatchId BatchId to seed in batch state (null = no state file).
 * @returns {Promise<{ projectRoot: string, taskFolder: string, capturePath: string, statePath: string }>}
 */
async function prepareWorkerSpawnFixture({ stateBatchId }) {
	const projectRoot = await tempProject("spine-qfs-worker-");
	const taskId = "TP-808";
	const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-qfs`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n## Review Level: 0\n\n## Mission\nSticky override probe.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`README.md\`\n\n## Steps\n### Step 0\n- [ ] one\n`,
		"utf-8",
	);

	const capturePath = path.join(projectRoot, "override-capture.txt");
	fs.writeFileSync(
		path.join(projectRoot, "scripts", "spine-worker-launch.sh"),
		// Records the env the child actually received, then execs the real
		// runner so the stub worker completes normally (.DONE, exit 0).
		`#!/bin/sh\nprintf '%s' "\${SPINE_AGENT_PROFILE_OVERRIDE-}" > ${JSON.stringify(capturePath)}\nexec node "$@"\n`,
		{ encoding: "utf-8", mode: 0o755 },
	);

	const statePath = spineBatchStatePath(projectRoot);
	if (stateBatchId) {
		fs.mkdirSync(path.dirname(statePath), { recursive: true });
		fs.writeFileSync(
			statePath,
			JSON.stringify({
				batchId: stateBatchId,
				phase: "running",
				resilience: { quotaFallback: seededFallbackState() },
			}),
			"utf-8",
		);
	}
	return { projectRoot, taskFolder, capturePath, statePath };
}

/**
 * Runs the stub worker through the launch script and returns the result plus
 * the captured override value.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.taskFolder
 * @param {string} params.capturePath
 * @param {string} params.batchId
 * @param {Record<string, string>} [params.extraEnv]
 */
async function runStubWorkerThroughLaunchScript({ projectRoot, taskFolder, capturePath, batchId, extraEnv }) {
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await runWorker({
			worktreePath: projectRoot,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId: "TP-808",
			config: {
				development: { workerLaunchScript: "scripts/spine-worker-launch.sh" },
				lanes: {
					heartbeatIntervalMinutes: 10,
					stallTimeoutMinutes: 10,
					stallGraceAfterProgressMinutes: 5,
				},
			},
			extraEnv,
		});
		const captured = fs.existsSync(capturePath) ? fs.readFileSync(capturePath, "utf-8") : "<missing>";
		return { result, captured };
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
	}
}

test("runWorker passes SPINE_AGENT_PROFILE_OVERRIDE to the child when the batch has a fallback", async () => {
	const { projectRoot, taskFolder, capturePath, statePath } = await prepareWorkerSpawnFixture({
		stateBatchId: BATCH_ID,
	});
	try {
		const stateBefore = fs.readFileSync(statePath, "utf-8");
		const { result, captured } = await runStubWorkerThroughLaunchScript({
			projectRoot,
			taskFolder,
			capturePath,
			batchId: BATCH_ID,
		});

		assert.equal(result.ok, true, `stub worker should succeed, got ${JSON.stringify(result)}`);
		assert.equal(captured, "allegretto", "child env must carry the fallback profile override");
		// runWorker never writes batch state (read-only contract).
		assert.equal(fs.readFileSync(statePath, "utf-8"), stateBefore);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runWorker caller extraEnv wins over the sticky override on key collision", async () => {
	const { projectRoot, taskFolder, capturePath } = await prepareWorkerSpawnFixture({
		stateBatchId: BATCH_ID,
	});
	try {
		const { result, captured } = await runStubWorkerThroughLaunchScript({
			projectRoot,
			taskFolder,
			capturePath,
			batchId: BATCH_ID,
			extraEnv: { SPINE_AGENT_PROFILE_OVERRIDE: "caller-row" },
		});

		assert.equal(result.ok, true, `stub worker should succeed, got ${JSON.stringify(result)}`);
		assert.equal(captured, "caller-row", "caller key must win over the persisted override");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runWorker sends no override when the batch state is missing or from another batch", async () => {
	// No state file at all.
	const missing = await prepareWorkerSpawnFixture({ stateBatchId: null });
	try {
		const { result, captured } = await runStubWorkerThroughLaunchScript({
			projectRoot: missing.projectRoot,
			taskFolder: missing.taskFolder,
			capturePath: missing.capturePath,
			batchId: BATCH_ID,
		});
		assert.equal(result.ok, true, `stub worker should succeed, got ${JSON.stringify(result)}`);
		assert.equal(captured, "", "no state file → no override, behaviour unchanged");
	} finally {
		await rm(missing.projectRoot, { recursive: true, force: true });
	}

	// State file belongs to a different batch → no override (stale guard).
	const stale = await prepareWorkerSpawnFixture({ stateBatchId: "20260101T000000" });
	try {
		const { result, captured } = await runStubWorkerThroughLaunchScript({
			projectRoot: stale.projectRoot,
			taskFolder: stale.taskFolder,
			capturePath: stale.capturePath,
			batchId: BATCH_ID,
		});
		assert.equal(result.ok, true, `stub worker should succeed, got ${JSON.stringify(result)}`);
		assert.equal(captured, "", "state from another batch → no override");
	} finally {
		await rm(stale.projectRoot, { recursive: true, force: true });
	}
});
