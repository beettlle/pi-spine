/**
 * SP-880 (#338) — reviewer `pi --mode json` usage on review metric rows.
 *
 * - `buildReviewerPiArgs` emits `--mode json` (the stream producer) and keeps
 *   the existing pin/`-ne`/prompt contract.
 * - `spawnReviewerPi` sums a recorded pi JSON stream fixture into `usage`
 *   (SP-878 parser) and keeps capped human logs: assistant `message_end` text
 *   replaces JSON noise, raw tail preserved when no text was extracted.
 *   Usage keys are omitted when pi reports none — never invented.
 * - `buildReviewMetricRecord` / `recordReviewMetric` copy only finite usage.
 * - `runReviewPollLoop` (DI) forwards engine-review result usage into verdict
 *   and spawn-failure rows; results without usage produce rows without keys.
 * - Fixture → rows → `rollupMetrics`: byRole/byModel usage populated end-to-end.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { buildReviewerPiArgs, spawnReviewerPi } from "../../src/batch/review-spawn.mjs";
import {
	buildReviewMetricRecord,
	metricsFilePath,
	readMetricsLines,
	recordReviewMetric,
} from "../../src/batch/metrics.mjs";
import { rollupMetrics } from "../../src/batch/metrics-rollup.mjs";
import { runReviewPollLoop } from "../../src/batch/engine-lanes/review-poll.mjs";
import { runStepReview } from "../../src/batch/review-step-run.mjs";
import { sumUsageFromPiJsonStream } from "../../src/batch/pi-json-usage.mjs";

const CLAUDE_REVIEWER = "anthropic/claude-sonnet-4-5";

/**
 * Recorded-style pi JSON stream fixture (pi 1.5.2 docs/json.md shapes).
 *
 * `message_update` snapshots stream mid-flight and MUST NOT count (the SP-878
 * parser deliberately ignores them so totals never double-count). Costs are
 * binary-exact (0.25 + 0.125 + 0.0625 + 0.125) so deep-equal holds.
 */
const REVIEWER_JSON_FIXTURE = [
	'{"type":"session_started","id":"s1"}',
	'{"type":"message_update","usage":{"input":999,"output":999,"totalTokens":1998}}',
	'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"Code review verdict: APPROVE"},{"type":"tool_call","id":"t1"}],"usage":{"input":100,"cacheRead":10,"cacheWrite":5,"output":50,"cost":{"total":0.25}}}}',
	'{"type":"tool_execution_end","result":{"usage":{"input":7,"output":3,"cost":{"total":0.125}}}}',
	'{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"All checks passed."}],"usage":{"input":30,"output":12,"cost":{"total":0.0625}}}}',
	'{"type":"compaction_end","result":{"usage":{"input":2,"output":1,"cost":{"total":0.125}}}}',
	'{"type":"message_update","usage":{"input":1000,"output":900,"totalTokens":1900}}',
	"",
].join("\n");

const FIXTURE_USAGE = {
	tokensIn: 100 + 10 + 5 + 7 + 30 + 2,
	tokensOut: 50 + 3 + 12 + 1,
	estimatedUsd: 0.25 + 0.125 + 0.0625 + 0.125,
};

test("SP-878 parser sums the reviewer fixture exactly (fixture sanity)", () => {
	assert.deepEqual(sumUsageFromPiJsonStream(REVIEWER_JSON_FIXTURE), FIXTURE_USAGE);
});

test("buildReviewerPiArgs emits --mode json and keeps the pinned argv contract", () => {
	const piArgs = buildReviewerPiArgs({
		worktreePath: "/tmp/wt",
		taskFolder: "/tmp/task",
		reviewPrompt: "# Review Request",
		systemPrompt: "system prompt",
		config: { agents: { reviewer: { code: { model: CLAUDE_REVIEWER, thinking: "high" } } } },
	});
	const modeIndex = piArgs.indexOf("--mode");
	assert.ok(modeIndex !== -1, `expected --mode in argv: ${JSON.stringify(piArgs)}`);
	assert.equal(piArgs[modeIndex + 1], "json");
	assert.ok(piArgs.includes("-ne"), `expected -ne (no user extensions): ${JSON.stringify(piArgs)}`);
	assert.ok(piArgs.includes("-p") && piArgs.includes("--no-session"));
	assert.ok(piArgs.includes("--model") && piArgs.includes(CLAUDE_REVIEWER));
	assert.ok(piArgs.includes("--thinking") && piArgs.includes("high"));
	assert.equal(piArgs[piArgs.length - 1], "# Review Request", "review prompt must stay last");
});

/**
 * @param {string} root
 * @param {string} body Shell script lines for the fake `pi`.
 * @returns {string} binDir to prepend to PATH
 */
function writeFakePi(root, body) {
	const binDir = path.join(root, "bin");
	fs.mkdirSync(binDir, { recursive: true });
	fs.writeFileSync(path.join(binDir, "pi"), `${body}\n`, { mode: 0o755 });
	return binDir;
}

/**
 * Env save/restore around a reviewer spawn against a fake `pi`.
 *
 * @param {() => Promise<void>} run
 */
async function withFakePiSpawn(root, scriptBody, run) {
	const binDir = writeFakePi(root, scriptBody);
	const prev = {
		path: process.env.PATH,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
		taskFolder: process.env.SPINE_TASK_FOLDER,
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		isWorker: process.env.SPINE_IS_WORKER,
		reviewStub: process.env.SPINE_REVIEW_STUB,
		workerStub: process.env.SPINE_WORKER_STUB,
	};
	process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
	delete process.env.SPINE_WORKER_RUNNER;
	delete process.env.SPINE_TASK_FOLDER;
	delete process.env.SPINE_REVIEW_TEST_NO_PI;
	// SP-884: runStepReview tests must spawn a real (fake-binary) pi even when
	// executed inside a batch worker session or with stub review env inherited.
	delete process.env.SPINE_IS_WORKER;
	delete process.env.SPINE_REVIEW_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		await run();
	} finally {
		process.env.PATH = prev.path;
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		if (prev.taskFolder === undefined) delete process.env.SPINE_TASK_FOLDER;
		else process.env.SPINE_TASK_FOLDER = prev.taskFolder;
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		if (prev.isWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prev.isWorker;
		if (prev.reviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prev.reviewStub;
		if (prev.workerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev.workerStub;
	}
}

/** @param {string} root */
async function makeTaskFolder(root) {
	const taskFolder = path.join(root, "spine-tasks", "SP-880-spawn");
	fs.mkdirSync(taskFolder, { recursive: true });
	return taskFolder;
}

test("spawnReviewerPi sums fixture stream usage and keeps capped human logs", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-spawn-"));
	const fixturePath = path.join(root, "reviewer-stream.ndjson");
	fs.writeFileSync(fixturePath, REVIEWER_JSON_FIXTURE, "utf-8");
	try {
		await withFakePiSpawn(root, `#!/bin/sh\ncat '${fixturePath}'\nexit 0`, async () => {
			const taskFolder = await makeTaskFolder(root);
			const result = await spawnReviewerPi({
				worktreePath: root,
				taskFolder,
				reviewPrompt: "# Review Request: usage stream",
				systemPrompt: "",
				timeoutMs: 10_000,
			});
			assert.equal(result.spawnFailed, false);
			assert.deepEqual(result.usage, FIXTURE_USAGE);
			// Human log: message_end text survives; JSON event noise does not.
			assert.match(result.stdoutTail ?? "", /Code review verdict: APPROVE/);
			assert.match(result.stdoutTail ?? "", /All checks passed\./);
			assert.doesNotMatch(result.stdoutTail ?? "", /message_end/);
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spawnReviewerPi omits usage and keeps the raw tail when pi reports none", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-none-"));
	const jsonless = path.join(root, "no-usage.ndjson");
	try {
		// Plain-text output (pre-JSON-mode behavior): no usage, tail unchanged.
		await withFakePiSpawn(root, '#!/bin/sh\necho "PI_STDOUT_MARKER"\nexit 0', async () => {
			const taskFolder = await makeTaskFolder(root);
			const result = await spawnReviewerPi({
				worktreePath: root,
				taskFolder,
				reviewPrompt: "# Review Request: no usage",
				systemPrompt: "",
				timeoutMs: 10_000,
			});
			assert.equal(result.spawnFailed, false);
			assert.equal(result.usage, undefined, "no usage key when pi reports none");
			assert.match(result.stdoutTail ?? "", /PI_STDOUT_MARKER/);
		});

		// JSON stream without any usage-bearing events: still no usage key.
		fs.writeFileSync(
			jsonless,
			'{"type":"session_started","id":"s2"}\n{"type":"turn_aborted","reason":"overlap"}\n',
			"utf-8",
		);
		await withFakePiSpawn(root, `#!/bin/sh\ncat '${jsonless}'\nexit 0`, async () => {
			const taskFolder = await makeTaskFolder(root);
			const result = await spawnReviewerPi({
				worktreePath: root,
				taskFolder,
				reviewPrompt: "# Review Request: json without usage",
				systemPrompt: "",
				timeoutMs: 10_000,
			});
			assert.equal(result.spawnFailed, false);
			assert.equal(result.usage, undefined);
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spawnReviewerPi carries no usage on the fail-closed pi-unavailable path", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-nopi-"));
	const taskFolder = path.join(root, "spine-tasks", "SP-880-nopi");
	fs.mkdirSync(taskFolder, { recursive: true });
	const prev = {
		noPi: process.env.SPINE_REVIEW_TEST_NO_PI,
		workerRunner: process.env.SPINE_WORKER_RUNNER,
	};
	delete process.env.SPINE_WORKER_RUNNER;
	process.env.SPINE_REVIEW_TEST_NO_PI = "1";
	try {
		const result = await spawnReviewerPi({
			worktreePath: root,
			taskFolder,
			reviewPrompt: "# Review Request",
			systemPrompt: "",
		});
		assert.equal(result.spawnFailed, true);
		assert.equal(result.usage, undefined, "no invented usage when pi never spawned");
	} finally {
		if (prev.noPi === undefined) delete process.env.SPINE_REVIEW_TEST_NO_PI;
		else process.env.SPINE_REVIEW_TEST_NO_PI = prev.noPi;
		if (prev.workerRunner === undefined) delete process.env.SPINE_WORKER_RUNNER;
		else process.env.SPINE_WORKER_RUNNER = prev.workerRunner;
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewMetricRecord copies finite usage and drops non-finite/absent usage", () => {
	const base = {
		batchId: "20261120T120000",
		taskId: "SP-880",
		reviewType: "code",
		verdict: "APPROVE",
		attempt: 1,
	};

	const withUsage = buildReviewMetricRecord({
		...base,
		usage: { tokensIn: 154, tokensOut: 66, estimatedUsd: 0.5625 },
	});
	assert.equal(withUsage.tokensIn, 154);
	assert.equal(withUsage.tokensOut, 66);
	assert.equal(withUsage.estimatedUsd, 0.5625);

	// NaN / Infinity must not invent usage; zero is a real report and stays.
	const withGarbage = buildReviewMetricRecord({
		...base,
		usage: { tokensIn: Number.NaN, tokensOut: Number.POSITIVE_INFINITY, estimatedUsd: 0 },
	});
	assert.equal(withGarbage.tokensIn, undefined);
	assert.equal(withGarbage.tokensOut, undefined);
	assert.equal(withGarbage.estimatedUsd, 0);

	const withoutUsage = buildReviewMetricRecord({ ...base });
	assert.equal(withoutUsage.tokensIn, undefined);
	assert.equal(withoutUsage.tokensOut, undefined);
	assert.equal(withoutUsage.estimatedUsd, undefined);
});

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} extra
 * @param {object} [config]
 */
function writeReviewerRow(projectRoot, extra, config) {
	return recordReviewMetric({
		projectRoot,
		config,
		batchId: "20261120T120000",
		taskId: "SP-880",
		reviewType: "code",
		attempt: 1,
		outcome: "verdict",
		verdict: "APPROVE",
		...extra,
	});
}

test("recordReviewMetric writes reviewer rows whose usage survives redaction", () => {
	const projectRoot = path.join(os.tmpdir(), `spine-review-usage-row-${process.pid}-${Date.now()}`);
	fs.mkdirSync(projectRoot, { recursive: true });
	try {
		const config = { agents: { reviewer: { code: { model: CLAUDE_REVIEWER, thinking: "high" } } } };
		writeReviewerRow(projectRoot, { usage: FIXTURE_USAGE }, config);
		const [row] = readMetricsLines(metricsFilePath(projectRoot, {}));
		assert.equal(row.recordType, "review");
		assert.equal(row.agentRole, "reviewer");
		assert.equal(row.model, CLAUDE_REVIEWER);
		assert.equal(row.tokensIn, FIXTURE_USAGE.tokensIn);
		assert.equal(row.tokensOut, FIXTURE_USAGE.tokensOut);
		assert.equal(row.estimatedUsd, FIXTURE_USAGE.estimatedUsd);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

/**
 * Drive runReviewPollLoop with an injected review result (no engine, no worker).
 *
 * @param {string} projectRoot
 * @param {Record<string, any>} reviewResult
 */
async function pollOnce(projectRoot, reviewResult) {
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
		batchId: "20261120T120000",
		config: { agents: { reviewer: { code: { model: CLAUDE_REVIEWER, thinking: "high" } } } },
		task: { taskId: "SP-880" },
		lane: { laneNumber: 2, laneId: "lane-2" },
		taskFolderInWorktree: path.join(projectRoot, "spine-tasks", "SP-880"),
		wt: projectRoot,
		taskBranch: "lane-2",
		laneCorrelationId: "corr-880",
		fileScopePaths: [],
	});
}

/**
 * @param {string} projectRoot
 * @returns {object[]}
 */
function readRows(projectRoot) {
	return readMetricsLines(metricsFilePath(projectRoot, {}));
}

test("runReviewPollLoop forwards usage into the verdict row", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-verdict-"));
	try {
		const result = await pollOnce(projectRoot, {
			ok: true,
			verdict: "APPROVE",
			feedback: "ok",
			usage: FIXTURE_USAGE,
		});
		assert.equal(result.ok, true);
		const [row] = readRows(projectRoot);
		assert.equal(row.recordType, "review");
		assert.equal(row.outcome, "verdict");
		assert.equal(row.verdict, "APPROVE");
		assert.equal(row.tokensIn, FIXTURE_USAGE.tokensIn);
		assert.equal(row.tokensOut, FIXTURE_USAGE.tokensOut);
		assert.equal(row.estimatedUsd, FIXTURE_USAGE.estimatedUsd);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runReviewPollLoop forwards usage into the spawn-failure row", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-fail-"));
	try {
		const result = await pollOnce(projectRoot, {
			ok: false,
			spawnFailed: true,
			error: "pi not found",
			usage: { tokensIn: 10, tokensOut: 2, estimatedUsd: 0.125 },
		});
		assert.equal(result.ok, false);
		const [row] = readRows(projectRoot);
		assert.equal(row.recordType, "review");
		assert.equal(row.outcome, "spawn_failed");
		assert.equal(row.tokensIn, 10);
		assert.equal(row.tokensOut, 2);
		assert.equal(row.estimatedUsd, 0.125);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runReviewPollLoop omits usage keys when the review result has none", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-review-usage-absent-"));
	try {
		await pollOnce(projectRoot, { ok: true, verdict: "APPROVE", feedback: "ok" });
		const [row] = readRows(projectRoot);
		assert.equal(row.outcome, "verdict");
		assert.equal(row.tokensIn, undefined);
		assert.equal(row.tokensOut, undefined);
		assert.equal(row.estimatedUsd, undefined);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("fixture → review rows → rollupMetrics populates byRole and byModel usage", () => {
	const projectRoot = path.join(os.tmpdir(), `spine-review-usage-rollup-${process.pid}-${Date.now()}`);
	fs.mkdirSync(projectRoot, { recursive: true });
	try {
		// Two reviewer models run the same recorded stream fixture; usage sums per role/model.
		const models = [CLAUDE_REVIEWER, "google/gemini-3.1-pro"];
		for (const model of models) {
			const config = { agents: { reviewer: { code: { model, thinking: "high" } } } };
			writeReviewerRow(projectRoot, { usage: FIXTURE_USAGE }, config);
		}
		const lines = readMetricsLines(metricsFilePath(projectRoot, {}));
		assert.equal(lines.length, models.length);

		const rollup = rollupMetrics(lines);
		assert.ok(rollup, "rollup must be non-null when usage is present");

		// byRole: reviewer carries the summed tokens and cost of both spawns.
		const reviewerRole = rollup.byRole.reviewer;
		assert.ok(reviewerRole, "reviewer role bucket must exist");
		assert.equal(reviewerRole.tokensIn, FIXTURE_USAGE.tokensIn * models.length);
		assert.equal(reviewerRole.tokensOut, FIXTURE_USAGE.tokensOut * models.length);
		assert.equal(reviewerRole.estimatedUsd, FIXTURE_USAGE.estimatedUsd * models.length);

		// byModel: one bucket per pinned reviewer, each with the single-run usage.
		for (const model of models) {
			const bucket = rollup.byModel[model];
			assert.ok(bucket, `byModel bucket for ${model} must exist`);
			assert.equal(bucket.tokensIn, FIXTURE_USAGE.tokensIn);
			assert.equal(bucket.estimatedUsd, FIXTURE_USAGE.estimatedUsd);
		}

		// The review-table group keeps its per-(type, model) shape alongside usage.
		assert.equal(rollup.reviews.length, models.length);
		assert.ok(rollup.reviews.every((group) => group.reviewType === "code" && group.count === 1));
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("spine metrics show populates byRole/byModel from fixture stream records end-to-end", () => {
	const projectRoot = path.join(os.tmpdir(), `spine-review-usage-cli-${process.pid}-${Date.now()}`);
	fs.mkdirSync(projectRoot, { recursive: true });
	try {
		const config = { metrics: { enabled: true, path: ".spine/run-metrics.jsonl" } };
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "sp-880" }, metrics: config.metrics }, null, 2),
			"utf-8",
		);
		// Same recorded pi JSON stream fixture a real reviewer spawn would emit.
		const usage = sumUsageFromPiJsonStream(REVIEWER_JSON_FIXTURE);
		assert.deepEqual(usage, FIXTURE_USAGE);
		const config2 = {
			...config,
			agents: { reviewer: { code: { model: CLAUDE_REVIEWER, thinking: "high" } } },
		};
		writeReviewerRow(projectRoot, { usage }, config2);

		const spineBin = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../bin/spine.mjs",
		);
		const env = { ...process.env };
		delete env.SPINE_IS_WORKER;
		delete env.SPINE_WORKER_RUNNER;
		const stdout = execFileSync(process.execPath, [spineBin, "metrics", "show", "--json"], {
			cwd: projectRoot,
			encoding: "utf-8",
			env,
		});
		const parsed = JSON.parse(stdout);
		assert.equal(parsed.lines.length, 1);
		assert.equal(parsed.rollups.byRole.reviewer.tokensIn, FIXTURE_USAGE.tokensIn);
		assert.equal(parsed.rollups.byModel[CLAUDE_REVIEWER].estimatedUsd, FIXTURE_USAGE.estimatedUsd);

		const human = execFileSync(process.execPath, [spineBin, "metrics", "show"], {
			cwd: projectRoot,
			encoding: "utf-8",
			env,
		});
		assert.match(human, /reviewer/);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

// ─── SP-884 (#377): the real runStepReview hop ───
// SP-880's DI tests stub `runEngineReview`, so they cannot see the hop where
// usage was actually lost: runStepReview (review-step-run.mjs) sits between
// spawnReviewerPi (which sums the pi JSON stream) and the poll loop (which
// emits metric rows). These tests drive the REAL runStepReview against a fake
// pi that records the fixture stream, asserting usage survives on the result.

/**
 * Minimal task packet for runStepReview (code review required at level ≥ 2).
 *
 * @param {string} root
 * @param {string} taskId
 * @returns {string} task folder path
 */
function writeRunStepTask(root, taskId = "SP-884-run") {
	const taskFolder = path.join(root, "spine-tasks", taskId);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: ${taskId}\n\n## Review Level: 2\n\n### Step 1: Ship it\n- [x] done\n`,
		"utf-8",
	);
	return taskFolder;
}

test("runStepReview forwards fixture stream usage onto the APPROVE result (live hop)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-runstep-usage-ok-"));
	try {
		const fixturePath = path.join(root, "reviewer-stream.ndjson");
		fs.writeFileSync(fixturePath, REVIEWER_JSON_FIXTURE, "utf-8");
		// Usage is emitted BEFORE the artifact is written so the captured JSONL
		// is complete regardless of artifact-poll timing (no early-honor race).
		const script = [
			"#!/bin/bash",
			`cat '${fixturePath}'`,
			'for arg in "$@"; do',
			"  p=$(printf '%s' \"$arg\" | grep -oE '`[^`]*\\.reviews/[^`]*\\.md`' | tr -d '`' | head -1)",
			'  if [ -n "$p" ]; then',
			'    mkdir -p "${p%/*}"',
			'    printf \'# Code Review\\n\\n### Verdict: APPROVE\\n\\nLooks good.\\n\' > "$p"',
			"  fi",
			"done",
			"exit 0",
		].join("\n");
		await withFakePiSpawn(root, script, async () => {
			const taskFolder = writeRunStepTask(root);
			const result = await runStepReview({
				taskFolder,
				worktreePath: root,
				stepNumber: 1,
				reviewType: "code",
				config: {},
			});
			assert.equal(result.spawnFailed, false, `spawn failed: ${result.error}`);
			assert.equal(result.verdict, "APPROVE");
			assert.deepEqual(result.usage, FIXTURE_USAGE);
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview keeps fixture usage on the spawn-failed result (exit 1, no artifact)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-runstep-usage-fail-"));
	try {
		const fixturePath = path.join(root, "reviewer-stream.ndjson");
		fs.writeFileSync(fixturePath, REVIEWER_JSON_FIXTURE, "utf-8");
		const script = [`#!/bin/bash`, `cat '${fixturePath}'`, "exit 1"].join("\n");
		await withFakePiSpawn(root, script, async () => {
			const taskFolder = writeRunStepTask(root);
			const result = await runStepReview({
				taskFolder,
				worktreePath: root,
				stepNumber: 1,
				reviewType: "code",
				config: {},
			});
			assert.equal(result.spawnFailed, true);
			assert.equal(result.verdict ?? null, null);
			// Tokens pi reported before failing still attribute to the review
			// attempt (the poll loop forwards them to the spawn_failed row).
			assert.deepEqual(result.usage, FIXTURE_USAGE);
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runStepReview omits usage entirely when the pi stream reports none", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-runstep-usage-absent-"));
	try {
		const script = [
			"#!/bin/bash",
			'for arg in "$@"; do',
			"  p=$(printf '%s' \"$arg\" | grep -oE '`[^`]*\\.reviews/[^`]*\\.md`' | tr -d '`' | head -1)",
			'  if [ -n "$p" ]; then',
			'    mkdir -p "${p%/*}"',
			'    printf \'# Code Review\\n\\n### Verdict: APPROVE\\n\\nLooks good.\\n\' > "$p"',
			"  fi",
			"done",
			"exit 0",
		].join("\n");
		await withFakePiSpawn(root, script, async () => {
			const taskFolder = writeRunStepTask(root);
			const result = await runStepReview({
				taskFolder,
				worktreePath: root,
				stepNumber: 1,
				reviewType: "code",
				config: {},
			});
			assert.equal(result.spawnFailed, false, `spawn failed: ${result.error}`);
			assert.equal(result.verdict, "APPROVE");
			assert.equal(result.usage, undefined, "no usage keys invented without a reported stream");
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
