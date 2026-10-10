/**
 * SP-809 — In-lane automatic single-hop quota fallback retry (#329, partial).
 *
 * Drives full `startBatch` stub runs whose workers fail with provider quota
 * payloads (`SPINE_WORKER_STUB_FAIL_OUTPUT`, SP-806) and asserts the SP-809
 * wrapper behaviour end-to-end: one `batch.quota_fallback_applied` per batch,
 * one retry per task in the same lane worktree, `batch.quota_fallback_exhausted`
 * when the fallback pool dies too, no retry for transient overload or an unset
 * `agents.quotaFallbackProfile`, and fallback state surviving retry + resume.
 *
 * The stub runner hook under test: `SPINE_WORKER_STUB_PASS_PROFILE` — when it
 * equals the child env's `SPINE_AGENT_PROFILE_OVERRIDE` (pinned by the sticky
 * fallback, SP-808), the forced failure is skipped and the normal stub path runs.
 *
 * Fixture config: profiles `hard` = zai/glm-5.3 (active) and `allegretto` =
 * kimi-coding/k3, `agents.quotaFallbackProfile: "allegretto"`.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { readMetricsLines } from "../../src/batch/metrics.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { resumeBatch } from "../../src/batch/resume.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/** z.ai usage-limit payload as pi forwards it on worker stderr (#329 §3). */
const ZAI_1308_PAYLOAD =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}';
const ZAI_RESET_AT_RAW = "2026-08-30 09:12:44";

/** Kimi transient-overload payload (429, rate_limit_error, overloaded). */
const KIMI_OVERLOADED_PAYLOAD =
	'429: {"error":{"type":"rate_limit_error","message":"The server is currently overloaded, please retry later"}}';

const FALLBACK_PROFILE = "allegretto";
const PRIMARY_MODEL = "zai/glm-5.3";
const FALLBACK_MODEL = "kimi-coding/k3";

/** Every stub env var this suite touches; restored after each test. */
const STUB_ENV_KEYS = [
	"SPINE_WORKER_STUB",
	"SPINE_WORKER_STUB_FAIL_TASKS",
	"SPINE_WORKER_STUB_FAIL_OUTPUT",
	"SPINE_WORKER_STUB_PASS_PROFILE",
	"SPINE_WORKER_STUB_DIRTY_FILE",
];

/**
 * Enables stub mode with the given overrides and returns a restore function.
 *
 * @param {Record<string, string | undefined>} overrides
 * @returns {() => void}
 */
function setStubEnv(overrides) {
	const saved = {};
	for (const key of STUB_ENV_KEYS) saved[key] = process.env[key];
	process.env.SPINE_WORKER_STUB = "1";
	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	return () => {
		for (const key of STUB_ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} [fileScopePath]
 */
function writeSmokeTask(projectRoot, taskId, fileScopePath = `src/${taskId}.txt`) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: fileScopePath,
			mission: "SP-809 quota fallback integration fixture.",
		}),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {string[]} taskIds
 */
function writeDependencies(projectRoot, taskIds) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{ version: 1, tasks: Object.fromEntries(taskIds.map((id) => [id, []])) },
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * Writes the quota-fallback fixture config: profiles hard (zai/glm-5.3,
 * active) and allegretto (kimi-coding/k3), optional fallback hop to
 * allegretto. Returns the config file bytes for the untouched-bytes assertion.
 *
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.withFallback]
 * @param {number} [options.maxParallel]
 * @returns {string}
 */
function writeQuotaConfig(projectRoot, { withFallback = true, maxParallel = 1 } = {}) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	config.agents = {
		...config.agents,
		activeProfile: "hard",
		profiles: {
			hard: { worker: { model: PRIMARY_MODEL, thinking: "high" } },
			[FALLBACK_PROFILE]: { worker: { model: FALLBACK_MODEL, thinking: "high" } },
		},
	};
	if (withFallback) {
		config.agents.quotaFallbackProfile = FALLBACK_PROFILE;
	} else {
		delete config.agents.quotaFallbackProfile;
	}
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	return fs.readFileSync(configPath, "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} message
 */
function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 */
function readConfigBytes(projectRoot) {
	return fs.readFileSync(path.join(projectRoot, ".spine", "spine-config.json"), "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} type
 * @returns {object[]}
 */
function eventsOfType(projectRoot, batchId, type) {
	return readJournalEvents(projectRoot, batchId).filter((event) => event.type === type);
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @returns {object[]}
 */
function taskMetricRecords(projectRoot, taskId) {
	return readMetricsLines(path.join(projectRoot, ".spine", "run-metrics.jsonl")).filter(
		(line) => line.recordType === "task" && line.taskId === taskId,
	);
}

/**
 * Asserts no quota fallback ran: none of the SP-809 journal events and the
 * task ran exactly once (single task.started).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} taskId
 */
function assertNoFallback(projectRoot, batchId, taskId) {
	assert.equal(eventsOfType(projectRoot, batchId, "batch.quota_fallback_applied").length, 0);
	assert.equal(eventsOfType(projectRoot, batchId, "batch.quota_fallback_exhausted").length, 0);
	assert.equal(eventsOfType(projectRoot, batchId, "task.quota_fallback_retry").length, 0);
	const starts = eventsOfType(projectRoot, batchId, "task.started").filter(
		(event) => event.taskId === taskId,
	);
	assert.equal(starts.length, 1, "no fallback means the task ran exactly once");
}

test("quota failure falls back once and the retry succeeds on the fallback profile", async () => {
	const taskId = "TQ-801";
	const projectRoot = await initGitRepo("spine-qf-success-");
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
		SPINE_WORKER_STUB_PASS_PROFILE: FALLBACK_PROFILE,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot);
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add quota fallback task");

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(state?.phase, "completed");
		assert.equal(state?.resilience?.quotaFallback?.toProfile, FALLBACK_PROFILE);
		assert.equal(state?.resilience?.quotaFallback?.exhaustedPool, "zai");

		// Exactly one hop, one retry, no exhaustion, one quota failure total.
		assert.equal(eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_applied").length, 1);
		assert.equal(eventsOfType(projectRoot, result.batchId, "task.quota_fallback_retry").length, 1);
		assert.equal(
			eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_exhausted").length,
			0,
		);
		assert.equal(eventsOfType(projectRoot, result.batchId, "worker.quota_exhausted").length, 1);

		// Run-metrics tell the truth: the failed attempt ran on the primary
		// model, the retried success on the fallback profile's model (SP-808).
		const records = taskMetricRecords(projectRoot, taskId);
		const failed = records.filter((record) => record.outcome === "failed");
		const completed = records.filter((record) => record.outcome === "completed");
		assert.equal(failed.length, 1);
		assert.equal(failed[0].model, PRIMARY_MODEL);
		assert.equal(failed[0].exitReason, "provider_quota_exhausted");
		assert.equal(completed.length, 1);
		assert.equal(completed[0].model, FALLBACK_MODEL);

		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("fallback pool exhausted stops with provider_quota_exhausted and no further hop", async () => {
	const taskId = "TQ-802";
	const projectRoot = await initGitRepo("spine-qf-exhausted-");
	// No PASS_PROFILE: the retry fails too. The static z.ai payload is reused;
	// attempt 2 runs under the fallback model, so the classifier attributes it
	// to the kimi-coding pool (model-derived pool id).
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot);
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add quota fallback task");

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, false, "batch with an exhausted fallback chain must fail");

		const task = loadSpineBatchState(projectRoot).raw?.tasks?.find(
			(entry) => entry.taskId === taskId,
		);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "provider_quota_exhausted");

		// One hop, one retry, one exhaustion event — and no third run.
		assert.equal(eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_applied").length, 1);
		assert.equal(eventsOfType(projectRoot, result.batchId, "task.quota_fallback_retry").length, 1);
		const exhausted = eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_exhausted");
		assert.equal(exhausted.length, 1);
		// The operator must see both reset windows (#329): the recorded primary
		// pool first, the fallback pool's classification last.
		assert.deepEqual(exhausted[0]?.payload?.exhaustedPools, ["zai", "kimi-coding"]);
		assert.deepEqual(exhausted[0]?.payload?.resetAtRaw, [ZAI_RESET_AT_RAW, ZAI_RESET_AT_RAW]);

		// Exactly two worker runs (one per attempt) — never a third.
		assert.equal(eventsOfType(projectRoot, result.batchId, "worker.quota_exhausted").length, 2);
		const starts = eventsOfType(projectRoot, result.batchId, "task.started").filter(
			(event) => event.taskId === taskId,
		);
		assert.equal(starts.length, 2);

		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("parallel lanes on the same exhausted pool produce exactly one fallback hop", async () => {
	const taskA = "TQ-811";
	const taskB = "TQ-812";
	const projectRoot = await initGitRepo("spine-qf-parallel-");
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: `${taskA},${taskB}`,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
		SPINE_WORKER_STUB_PASS_PROFILE: FALLBACK_PROFILE,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot, { maxParallel: 2 });
		writeSmokeTask(projectRoot, taskA, "src/parallel-a.txt");
		writeSmokeTask(projectRoot, taskB, "src/parallel-b.txt");
		writeDependencies(projectRoot, [taskA, taskB]);
		execCommit(projectRoot, "add parallel quota tasks");

		const result = await startBatch({
			projectRoot,
			scope: `${taskA} ${taskB}`,
			skipPreflight: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);

		// The synchronous decide → apply section keeps parallel lanes to one hop.
		assert.equal(eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_applied").length, 1);
		assert.equal(eventsOfType(projectRoot, result.batchId, "task.quota_fallback_retry").length, 2);
		assert.equal(
			eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_exhausted").length,
			0,
		);

		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(state?.phase, "completed");
		assert.equal(state?.succeededTasks, 2);

		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("transient overload never falls back even with a fallback profile configured", async () => {
	const taskId = "TQ-813";
	const projectRoot = await initGitRepo("spine-qf-overloaded-");
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: KIMI_OVERLOADED_PAYLOAD,
		SPINE_WORKER_STUB_PASS_PROFILE: FALLBACK_PROFILE,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot);
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add overloaded task");

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, false);

		const task = loadSpineBatchState(projectRoot).raw?.tasks?.find(
			(entry) => entry.taskId === taskId,
		);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "provider_overloaded");

		assertNoFallback(projectRoot, result.batchId, taskId);
		assert.equal(eventsOfType(projectRoot, result.batchId, "worker.quota_exhausted").length, 0);
		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("unset quotaFallbackProfile keeps the pre-fallback flow for a quota failure", async () => {
	const taskId = "TQ-814";
	const projectRoot = await initGitRepo("spine-qf-unset-");
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
		SPINE_WORKER_STUB_PASS_PROFILE: FALLBACK_PROFILE,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot, { withFallback: false });
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add no-fallback task");

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, false);

		const state = loadSpineBatchState(projectRoot).raw;
		const task = state?.tasks?.find((entry) => entry.taskId === taskId);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "provider_quota_exhausted");
		assert.equal(state?.resilience?.quotaFallback, undefined);

		// Journal matches the pre-change flow: the quota classification event is
		// still there, but no fallback/retry events and no second run.
		assert.equal(eventsOfType(projectRoot, result.batchId, "worker.quota_exhausted").length, 1);
		assertNoFallback(projectRoot, result.batchId, taskId);
		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("retry reuses the lane worktree: partial work from attempt 1 survives", async () => {
	const taskId = "TQ-815";
	const fileScope = "src/partial-work.txt";
	const projectRoot = await initGitRepo("spine-qf-partial-");
	// The forced-failure branch writes the dirty file on attempt 1; the normal
	// stub path (attempt 2) never touches it. If the retry reset the worktree,
	// the file would be gone; it must survive into the merged lane commit.
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
		SPINE_WORKER_STUB_PASS_PROFILE: FALLBACK_PROFILE,
		SPINE_WORKER_STUB_DIRTY_FILE: fileScope,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot);
		writeSmokeTask(projectRoot, taskId, fileScope);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add partial-work task");

		const result = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(eventsOfType(projectRoot, result.batchId, "batch.quota_fallback_applied").length, 1);

		// The retry ran in the same lane worktree: attempt 1's dirty file is
		// still on disk there and was committed to the lane branch (the merged
		// orch branch, not the main checkout, receives lane commits).
		const state = loadSpineBatchState(projectRoot).raw;
		const task = state?.tasks?.find((entry) => entry.taskId === taskId);
		const lane = state?.lanes?.find((entry) => entry.laneNumber === task?.laneNumber);
		assert.ok(lane?.worktreePath, "lane worktree path missing from batch state");
		const partialPath = path.join(lane.worktreePath, fileScope);
		assert.ok(
			fs.existsSync(partialPath),
			"attempt-1 partial work must survive the retry in the same lane worktree",
		);
		assert.match(fs.readFileSync(partialPath, "utf-8"), /stub dirty/);
		const committedContent = execFileSync(
			"git",
			["cat-file", "-p", `${lane.branch}:${fileScope}`],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.match(committedContent, /stub dirty/, "partial work must ride the lane commit");
		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("retry + resume keeps the fallback state and pins the resumed worker to the fallback profile", async () => {
	const taskId = "TQ-816";
	const projectRoot = await initGitRepo("spine-qf-resume-");
	const restore = setStubEnv({
		SPINE_WORKER_STUB_FAIL_TASKS: taskId,
		SPINE_WORKER_STUB_FAIL_OUTPUT: ZAI_1308_PAYLOAD,
	});
	try {
		const configBytes = writeQuotaConfig(projectRoot);
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, [taskId]);
		execCommit(projectRoot, "add resume quota task");

		// Attempt 1 + in-lane retry both exhaust: fallback applied, task failed.
		const first = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		assert.equal(first.ok, false);
		const mid = loadSpineBatchState(projectRoot).raw;
		assert.equal(mid?.phase, "failed");
		assert.equal(mid?.resilience?.quotaFallback?.toProfile, FALLBACK_PROFILE);
		assert.ok(
			mid?.resilience?.quotaFallback?.retriedTaskIds?.includes(taskId),
			"the in-lane retry must be recorded before resume",
		);

		// Operator flow: `spine batch retry` + resume. The stub now treats the
		// fallback profile as passing — the resumed worker only succeeds if the
		// sticky SPINE_AGENT_PROFILE_OVERRIDE reaches its child env (SP-808).
		process.env.SPINE_WORKER_STUB_PASS_PROFILE = FALLBACK_PROFILE;
		const retry = retryTask({ projectRoot, taskId });
		assert.equal(retry.ok, true, retry.output ?? retry.error);

		const resumed = await resumeBatch({ projectRoot });
		assert.equal(resumed.ok, true, resumed.output ?? resumed.error);

		const final = loadSpineBatchState(projectRoot).raw;
		assert.equal(final?.phase, "completed");
		const task = final?.tasks?.find((entry) => entry.taskId === taskId);
		assert.equal(task?.status, "succeeded");
		assert.equal(
			final?.resilience?.quotaFallback?.toProfile,
			FALLBACK_PROFILE,
			"fallback state must survive retry + resume",
		);

		// Still exactly one hop for the whole batch lifecycle.
		assert.equal(eventsOfType(projectRoot, first.batchId, "batch.quota_fallback_applied").length, 1);
		assert.equal(readConfigBytes(projectRoot), configBytes, "config must stay untouched");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});
