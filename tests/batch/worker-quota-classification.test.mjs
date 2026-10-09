/**
 * SP-806 — Worker quota failure classification (#329, partial).
 *
 * Drives full `startBatch` stub runs through the SP-806 stub hook
 * (`SPINE_WORKER_STUB_FAIL_OUTPUT`) and asserts the provider payload is
 * classified end-to-end: worker exit reason, batch journal, run-metrics
 * failureKind, and doctor quota-risk signals.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { readMetricsLines } from "../../src/batch/metrics.mjs";
import { detectQuotaRiskSignals } from "../../src/doctor/quota-risk.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/** z.ai usage-limit payload as pi forwards it on worker stderr (#329 §3). */
const ZAI_1308_PAYLOAD =
	'429: {"code":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2026-08-30 09:12:44"}';

/** Kimi transient-overload payload (429, rate_limit_error, overloaded). */
const KIMI_OVERLOADED_PAYLOAD =
	'429: {"error":{"type":"rate_limit_error","message":"The server is currently overloaded, please retry later"}}';

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: `src/${taskId}.txt`,
			mission: "Smoke task for worker quota classification tests.",
		}),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeDependencies(projectRoot, taskId) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
}

/**
 * Pins the fixture's worker model so quota pool resolution and the journaled
 * `model` field are deterministic regardless of repo defaults.
 *
 * @param {string} projectRoot
 * @param {string} model
 */
function setWorkerModel(projectRoot, model) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.agents = { ...config.agents, worker: { ...(config.agents?.worker ?? {}), model } };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
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
 * Runs a one-task stub batch whose worker is forced to fail with the given
 * stderr payload. Restores every stub env var it touches.
 *
 * @param {object} params
 * @param {string} params.prefix Temp repo prefix.
 * @param {string} params.taskId
 * @param {string | undefined} params.failOutput `SPINE_WORKER_STUB_FAIL_OUTPUT` payload.
 * @returns {Promise<{ projectRoot: string, result: Awaited<ReturnType<typeof startBatch>> }>}
 */
async function runForcedFailureStubBatch({ prefix, taskId, failOutput }) {
	const projectRoot = await initGitRepo(prefix);
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	const prevFailOutput = process.env.SPINE_WORKER_STUB_FAIL_OUTPUT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = taskId;
	if (failOutput === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_OUTPUT;
	else process.env.SPINE_WORKER_STUB_FAIL_OUTPUT = failOutput;
	try {
		writeSmokeTask(projectRoot, taskId);
		writeDependencies(projectRoot, taskId);
		setWorkerModel(projectRoot, "zai/glm-4.6");
		execCommit(projectRoot, `add ${taskId} task`);

		const result = await startBatch({
			projectRoot,
			scope: taskId,
			skipPreflight: true,
		});
		return { projectRoot, result };
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		if (prevFailOutput === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_OUTPUT;
		else process.env.SPINE_WORKER_STUB_FAIL_OUTPUT = prevFailOutput;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function loadTaskState(projectRoot, taskId) {
	const state = loadSpineBatchState(projectRoot);
	const task = state.raw?.tasks?.find((entry) => entry.taskId === taskId);
	assert.ok(task, `task ${taskId} missing from batch state`);
	return /** @type {Record<string, any>} */ (task);
}

test("z.ai 1308 stub failure is classified provider_quota_exhausted end-to-end", async () => {
	const taskId = "TQ-130";
	const { projectRoot, result } = await runForcedFailureStubBatch({
		prefix: "spine-quota-zai-",
		taskId,
		failOutput: ZAI_1308_PAYLOAD,
	});
	try {
		assert.equal(result.ok, false, "batch with a quota-failed task must not be ok");

		// Worker classification flows to task.exitReason through the lane path.
		const task = loadTaskState(projectRoot, taskId);
		assert.equal(task.exitReason, "provider_quota_exhausted");
		assert.equal(task.status, "failed");

		// Journal carries the dedicated quota event with provider details.
		// Non-meta fields live under the event `payload` wrapper (journal schema
		// v2); taskId/laneId/correlationId are top-level meta.
		const events = readJournalEvents(projectRoot, result.batchId);
		const quotaEvents = events.filter((event) => event.type === "worker.quota_exhausted");
		assert.equal(quotaEvents.length, 1, "exactly one worker.quota_exhausted event");
		const quotaEvent = quotaEvents[0];
		assert.equal(quotaEvent.taskId, taskId);
		assert.equal(quotaEvent.payload?.providerCode, "1308");
		assert.equal(quotaEvent.payload?.httpStatus, 429);
		assert.equal(quotaEvent.payload?.resetAtRaw, "2026-08-30 09:12:44");
		// Fixture pins the worker model to zai/glm-4.6 → shared "zai" pool.
		assert.equal(quotaEvent.payload?.poolId, "zai");
		assert.equal(quotaEvent.payload?.model, "zai/glm-4.6");
		assert.match(String(quotaEvent.laneId ?? ""), /^lane-\d+$/);

		// The lane.died reason and task.failed payload carry the new exit reason
		// and the attached providerQuota object.
		const laneDied = events.find(
			(event) => event.type === "lane.died" && event.taskId === taskId,
		);
		assert.equal(laneDied?.payload?.reason, "provider_quota_exhausted");
		const taskFailed = events.find(
			(event) => event.type === "task.failed" && event.taskId === taskId,
		);
		// workerResult carries `classification` (+ `providerQuota`); the batch
		// state maps it to task.exitReason separately.
		assert.equal(taskFailed?.payload?.classification, "provider_quota_exhausted");
		assert.equal(taskFailed?.payload?.providerQuota?.kind, "quota_exhausted");
		assert.equal(taskFailed?.payload?.providerQuota?.providerCode, "1308");

		// Run-metrics record maps the exit reason to failureKind "quota".
		const metricsLines = readMetricsLines(
			path.join(projectRoot, ".spine", "run-metrics.jsonl"),
		);
		const taskRecord = metricsLines.find(
			(line) => line.recordType === "task" && line.taskId === taskId,
		);
		assert.ok(taskRecord, "task metric record missing");
		assert.equal(taskRecord.outcome, "failed");
		assert.equal(taskRecord.exitReason, "provider_quota_exhausted");
		assert.equal(taskRecord.failureKind, "quota");

		// Doctor quota-risk signals fire on those records without changes.
		const signals = detectQuotaRiskSignals(metricsLines, { now: Date.now() });
		assert.ok(
			signals.some((signal) => /quota-abort/.test(signal)),
			`expected a quota-abort signal, got: ${JSON.stringify(signals)}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("kimi 429 overloaded stub failure is classified provider_overloaded without a quota journal event", async () => {
	const taskId = "TQ-131";
	const { projectRoot, result } = await runForcedFailureStubBatch({
		prefix: "spine-quota-kimi-",
		taskId,
		failOutput: KIMI_OVERLOADED_PAYLOAD,
	});
	try {
		assert.equal(result.ok, false);

		const task = loadTaskState(projectRoot, taskId);
		assert.equal(task.exitReason, "provider_overloaded");
		assert.equal(task.status, "failed");

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.equal(
			events.filter((event) => event.type === "worker.quota_exhausted").length,
			0,
			"transient overload must not journal worker.quota_exhausted",
		);
		const taskFailed = events.find(
			(event) => event.type === "task.failed" && event.taskId === taskId,
		);
		assert.equal(taskFailed?.payload?.providerQuota?.kind, "transient_overload");
		assert.equal(taskFailed?.payload?.providerQuota?.providerCode, "rate_limit_error");

		const metricsLines = readMetricsLines(
			path.join(projectRoot, ".spine", "run-metrics.jsonl"),
		);
		const taskRecord = metricsLines.find(
			(line) => line.recordType === "task" && line.taskId === taskId,
		);
		assert.ok(taskRecord, "task metric record missing");
		assert.equal(taskRecord.exitReason, "provider_overloaded");
		assert.equal(taskRecord.failureKind, "quota");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("plain forced stub failure without output keeps classification failed", async () => {
	const taskId = "TQ-132";
	const { projectRoot, result } = await runForcedFailureStubBatch({
		prefix: "spine-quota-plain-",
		taskId,
		failOutput: undefined,
	});
	try {
		assert.equal(result.ok, false);

		const task = loadTaskState(projectRoot, taskId);
		assert.equal(task.exitReason, "failed");
		assert.equal(task.status, "failed");

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.equal(
			events.filter((event) => event.type === "worker.quota_exhausted").length,
			0,
		);
		const taskFailed = events.find(
			(event) => event.type === "task.failed" && event.taskId === taskId,
		);
		assert.equal(taskFailed?.payload?.classification, "failed");
		assert.equal(taskFailed?.payload?.providerQuota, undefined);

		const metricsLines = readMetricsLines(
			path.join(projectRoot, ".spine", "run-metrics.jsonl"),
		);
		const taskRecord = metricsLines.find(
			(line) => line.recordType === "task" && line.taskId === taskId,
		);
		assert.ok(taskRecord, "task metric record missing");
		assert.equal(taskRecord.exitReason, "failed");
		assert.equal(taskRecord.failureKind, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
