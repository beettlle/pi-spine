/**
 * SP-837 (#325) — reviewer rows in run-metrics.
 *
 * - engine stub batch (REVISE then pass per review type): two `recordType: "review"`
 *   rows per type with attempts 1 and 2, model/thinking from the profile-resolved
 *   reviewer (worker and reviewer differ), and `finalVerdict` on the worker row.
 * - blocked reviewer pairing: one `outcome: "blocked"` row per blocked review type.
 * - runReviewPollLoop (DI stubs): spawn failure / timeout / provider error rows.
 * - `metrics.enabled: false` writes nothing.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runReviewPollLoop } from "../../src/batch/engine-lanes/review-poll.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { metricsFilePath, readMetricsLines } from "../../src/batch/metrics.mjs";
import { REVIEW_TIMEOUT_REASON } from "../../src/batch/review.mjs";
import { REVIEW_PROVIDER_ERROR_REASON } from "../../src/batch/reviewer-provider-error.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const GEMINI_WORKER = "google/gemini-2.5-pro";
const GEMINI_REVIEWER = "google/gemini-3.1-pro";
const CLAUDE_REVIEWER = "anthropic/claude-sonnet-4-5";

const ENV_KEYS = [
	"SPINE_WORKER_STUB",
	"SPINE_REVIEW_STUB",
	"SPINE_ENGINE_PLAN_STUB_VERDICTS",
	"SPINE_ENGINE_CODE_STUB_VERDICTS",
	"SPINE_ENGINE_FINAL_STUB_VERDICTS",
];

/**
 * @param {Record<string, string>} [verdicts]
 * @returns {() => void} restore function
 */
function setStubEnv(verdicts = {}) {
	const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	for (const [key, value] of Object.entries(verdicts)) process.env[key] = value;
	return () => {
		for (const key of ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {number} reviewLevel
 */
function writeReviewedTask(projectRoot, taskId, reviewLevel) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-review-metrics`);
	fs.mkdirSync(folder, { recursive: true });
	const body = minimalValidPromptMarkdown(taskId, {
		fileScope: `src/${taskId}.txt`,
		mission: "SP-837 reviewer run-metrics fixture.",
	}).replace("## Mission", `## Review Level: ${reviewLevel}\n\n## Mission`);
	fs.writeFileSync(path.join(folder, "PROMPT.md"), body, "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "add task"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} agents
 */
function writeAgents(projectRoot, agents) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.agents = { ...config.agents, ...agents };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "agents config", "--allow-empty"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
}

/**
 * @param {string} projectRoot
 */
function readRows(projectRoot) {
	return readMetricsLines(metricsFilePath(projectRoot, {}));
}

test("stub REVISE then pass per review type → two rows with attempts 1 and 2", async () => {
	const projectRoot = await initGitRepo("spine-review-metrics-attempts-");
	const restore = setStubEnv({
		SPINE_ENGINE_PLAN_STUB_VERDICTS: "REVISE,APPROVE",
		SPINE_ENGINE_CODE_STUB_VERDICTS: "REVISE,APPROVE",
		SPINE_ENGINE_FINAL_STUB_VERDICTS: "REVISE,PASS",
	});
	try {
		writeAgents(projectRoot, {
			worker: { model: GEMINI_WORKER, thinking: "high" },
			reviewer: { model: GEMINI_REVIEWER, thinking: "high" },
			reviewerProfile: "claude-rev",
			profiles: {
				"claude-rev": { reviewer: { model: CLAUDE_REVIEWER, thinking: "medium" } },
			},
		});
		writeReviewedTask(projectRoot, "TP-851", 3);

		const result = await startBatch({ projectRoot, scope: "TP-851", skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const rows = readRows(projectRoot);
		const reviewRows = rows.filter((row) => row.recordType === "review");
		const expectedVerdicts = { plan: "APPROVE", code: "APPROVE", final: "PASS" };
		for (const reviewType of ["plan", "code", "final"]) {
			const typeRows = reviewRows.filter((row) => row.reviewType === reviewType);
			assert.deepEqual(
				typeRows.map((row) => [row.attempt, row.verdict, row.outcome]),
				[
					[1, "REVISE", "verdict"],
					[2, expectedVerdicts[reviewType], "verdict"],
				],
				`${reviewType} rows`,
			);
			for (const row of typeRows) {
				assert.equal(row.schemaVersion, 1);
				assert.equal(row.agentRole, "reviewer");
				assert.equal(row.role, "reviewer");
				assert.equal(row.taskId, "TP-851");
				assert.equal(row.model, CLAUDE_REVIEWER);
				assert.equal(row.thinking, "medium");
				assert.ok(Number.isFinite(Date.parse(row.endedAt)));
				assert.ok(row.durationMs >= 0);
			}
		}

		const taskRow = rows.find((row) => row.recordType === "task" && row.taskId === "TP-851");
		assert.equal(taskRow?.agentRole, "worker");
		assert.equal(taskRow?.model, GEMINI_WORKER, "worker model differs from reviewer model");
		assert.equal(taskRow?.finalVerdict, "PASS");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("final REVISE exhaustion sets finalVerdict REVISE on the worker row", async () => {
	const projectRoot = await initGitRepo("spine-review-metrics-final-revise-");
	const restore = setStubEnv({ SPINE_ENGINE_FINAL_STUB_VERDICTS: "REVISE,REVISE,REVISE" });
	try {
		writeAgents(projectRoot, {
			worker: { model: GEMINI_WORKER, thinking: "high" },
			reviewer: { model: CLAUDE_REVIEWER, thinking: "high" },
		});
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.review = { ...config.review, maxFinalAttempts: 2 };
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
		writeReviewedTask(projectRoot, "TP-852", 1);

		const result = await startBatch({ projectRoot, scope: "TP-852", skipPreflight: true });
		assert.equal(result.ok, false);

		const rows = readRows(projectRoot);
		const finalRows = rows.filter((row) => row.recordType === "review" && row.reviewType === "final");
		assert.deepEqual(
			finalRows.map((row) => [row.attempt, row.verdict]),
			[
				[1, "REVISE"],
				[2, "REVISE"],
			],
		);
		const taskRow = rows.find((row) => row.recordType === "task" && row.taskId === "TP-852");
		assert.equal(taskRow?.finalVerdict, "REVISE");
		assert.equal(taskRow?.exitReason, "review_exhausted");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("blocked reviewer pairing records one blocked row per blocked review type", async () => {
	const projectRoot = await initGitRepo("spine-review-metrics-blocked-");
	const restore = setStubEnv();
	try {
		writeAgents(projectRoot, {
			worker: { model: GEMINI_WORKER, thinking: "high" },
			reviewer: { model: GEMINI_REVIEWER, thinking: "high" },
		});
		writeReviewedTask(projectRoot, "TP-853", 1);

		const result = await startBatch({ projectRoot, scope: "TP-853", skipPreflight: true });
		assert.equal(result.ok, false);

		const reviewRows = readRows(projectRoot).filter((row) => row.recordType === "review");
		assert.deepEqual(
			reviewRows.map((row) => [row.reviewType, row.outcome, row.failureReason, row.model]),
			[
				["plan", "blocked", "same_model_family", GEMINI_REVIEWER],
				["final", "blocked", "same_model_family", GEMINI_REVIEWER],
			],
		);
		assert.ok(reviewRows.every((row) => row.verdict === undefined && row.attempt === undefined));
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

/**
 * Drive runReviewPollLoop with an injected review result (no engine, no worker).
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} reviewResult
 * @param {Record<string, any>} [config]
 */
async function pollOnce(projectRoot, reviewResult, config) {
	return runReviewPollLoop({
		reviewType: "code",
		passVerdict: "APPROVE",
		attemptField: "codeReviewAttempts",
		attemptKey: "codeReviewAttempt",
		maxAttempts: 2,
		runEngineReview: async () => reviewResult,
		recordReviewTaskFailure: () => {},
		invalidVerdictOutput: "invalid",
		journalEvents: [],
		projectRoot,
		state: {},
		batchId: "20261018T120000",
		config: config ?? {
			agents: { reviewer: { code: { model: CLAUDE_REVIEWER, thinking: "high" } } },
		},
		task: { taskId: "SP-837" },
		lane: { laneNumber: 2, laneId: "lane-2" },
		taskFolderInWorktree: path.join(projectRoot, "spine-tasks", "SP-837"),
		wt: projectRoot,
		taskBranch: "lane-2",
		laneCorrelationId: "corr-837",
		fileScopePaths: [],
	});
}

const FAILURE_CASES = [
	["spawn_failed", { ok: false, spawnFailed: true, error: "pi not found" }, undefined],
	[
		"timeout",
		{ ok: false, spawnFailed: true, reason: REVIEW_TIMEOUT_REASON, error: "timed out" },
		REVIEW_TIMEOUT_REASON,
	],
	[
		"provider_error",
		{ ok: false, spawnFailed: true, reason: REVIEW_PROVIDER_ERROR_REASON, error: "400" },
		REVIEW_PROVIDER_ERROR_REASON,
	],
];

for (const [outcome, reviewResult, failureReason] of FAILURE_CASES) {
	test(`reviewer ${outcome} writes a review row with the failing attempt`, async () => {
		const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-metrics-fail-"));
		try {
			const result = await pollOnce(projectRoot, reviewResult);
			assert.equal(result.ok, false);

			const rows = readRows(projectRoot);
			assert.equal(rows.length, 1);
			const [row] = rows;
			assert.equal(row.recordType, "review");
			assert.equal(row.reviewType, "code");
			assert.equal(row.outcome, outcome);
			assert.equal(row.failureReason, failureReason);
			assert.equal(row.attempt, 1);
			assert.equal(row.laneNumber, 2);
			assert.equal(row.model, CLAUDE_REVIEWER);
			assert.equal(row.thinking, "high");
			assert.equal(row.verdict, undefined);
		} finally {
			await rm(projectRoot, { recursive: true, force: true });
		}
	});
}

test("unpinned reviewer records model and thinking as inherit", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-metrics-inherit-"));
	try {
		await pollOnce(projectRoot, { ok: true, verdict: "APPROVE", feedback: "ok" }, {});
		const [row] = readRows(projectRoot);
		assert.equal(row.outcome, "verdict");
		assert.equal(row.verdict, "APPROVE");
		assert.equal(row.model, "inherit");
		assert.equal(row.thinking, "inherit");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("metrics.enabled=false writes no reviewer rows", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-metrics-off-"));
	try {
		const config = { metrics: { enabled: false } };
		await pollOnce(projectRoot, { ok: true, verdict: "APPROVE", feedback: "ok" }, config);
		await pollOnce(projectRoot, { ok: false, spawnFailed: true, error: "boom" }, config);
		assert.equal(fs.existsSync(metricsFilePath(projectRoot, config)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
