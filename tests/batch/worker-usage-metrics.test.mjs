/**
 * SP-879 (#338) — worker `pi --mode json` usage flows into task metric fields.
 *
 * The runner asks pi for a structured NDJSON stream (`--mode json`), sums the
 * provider-reported usage with the SP-878 parser, and persists it as a
 * `worker-usage.json` sidecar next to the task packet. The engine reads the
 * sidecar in `recordLaneTaskMetric` and copies the finite counters onto the
 * task metric record. Nothing is invented: stub/execute paths never write a
 * sidecar, non-JSON stdout yields no sidecar, and skipped tasks never attach
 * a stale committed sidecar.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	buildWorkerPiArgs,
	persistWorkerUsageSidecar,
} from "../../bin/spine-worker-runner.mjs";
import {
	attachTaskUsageFromSidecar,
	recordLaneTaskMetric,
} from "../../src/batch/engine-lanes/queue.mjs";
import { metricsFilePath } from "../../src/batch/metrics.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { withoutLiveJournalEnv } from "../helpers/live-journal-env.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUNNER_PATH = path.join(REPO_ROOT, "bin", "spine-worker-runner.mjs");

const MESSAGE_END_LINE = JSON.stringify({
	type: "message_end",
	message: {
		role: "assistant",
		content: [{ type: "text", text: "ASSISTANT_TEE_MARKER" }],
		usage: { input: 100, cacheRead: 10, cacheWrite: 0, output: 50, cost: { total: 0.25 } },
	},
});

// Streaming snapshots must never be counted (SP-878 ignores message_update);
// compaction usage is real nested spend and is summed.
const MESSAGE_UPDATE_LINE = JSON.stringify({
	type: "message_update",
	usage: { input: 9999, output: 9999, cost: { total: 9 } },
});
const COMPACTION_END_LINE = JSON.stringify({
	type: "compaction_end",
	result: { usage: { input: 200, output: 25, cost: { total: 0.75 } } },
});

function writeSmokeTask(root, taskId = "SP-879") {
	const taskFolder = path.join(root, "spine-tasks", taskId);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`${minimalValidPromptMarkdown(taskId, { fileScope: "src/smoke.txt" })}\n\n## Review Level: 0\n`,
		"utf-8",
	);
	return taskFolder;
}

/**
 * Fake `pi` on PATH. `--version` exits 0; worker invocation prints the given
 * stdout lines, optionally creates .DONE, and exits with the given code.
 */
function writeFakePi(binDir, { lines = [], donePath = null, exitCode = 0 }) {
	const script = [
		"#!/bin/sh",
		'if [ "$1" = "--version" ]; then echo "pi 0.0.0-fake"; exit 0; fi',
		...lines,
		donePath ? `touch "${donePath}"` : "",
		`exit ${exitCode}`,
		"",
	].join("\n");
	const piPath = path.join(binDir, "pi");
	fs.writeFileSync(piPath, script, { mode: 0o755 });
	return piPath;
}

function runnerEnv(root, taskFolder, binDir) {
	return {
		// Strip inherited worker journal env so the runner subprocess cannot
		// write to a live batch journal inside a worker (#328).
		...withoutLiveJournalEnv(),
		PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: root,
		SPINE_PROJECT_ROOT: root,
	};
}

function readSidecar(taskFolder) {
	const sidecarPath = path.join(taskFolder, "worker-usage.json");
	if (!fs.existsSync(sidecarPath)) return null;
	return JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
}

test("buildWorkerPiArgs runs pi in JSON mode without breaking the argv contract", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-usage-args-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:pi-lmstudio"] }),
		"utf-8",
	);
	const previousAgentDir = process.env.PI_AGENT_DIR;
	process.env.PI_AGENT_DIR = agentDir;
	try {
			const taskFolder = writeSmokeTask(root, "SP-879-json");
			const piArgs = await buildWorkerPiArgs({
				worktreePath: root,
				taskFolder,
				donePath: path.join(taskFolder, ".DONE"),
				spineConfig: {},
			});

			assert.equal(piArgs[0], "-p");
			assert.equal(piArgs[1], "--no-session");
			assert.equal(piArgs[2], "--mode");
			assert.equal(piArgs[3], "json");
			assert.ok(!piArgs.includes("-ne"));
			// Tail prompt (prompt text, not path) still last.
			assert.ok(piArgs.at(-1).includes("SP-879-json"));
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_AGENT_DIR;
		else process.env.PI_AGENT_DIR = previousAgentDir;
		await rm(root, { recursive: true, force: true });
	}
});

test("runner persists summed pi JSON usage sidecar on success", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-usage-ok-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		const taskFolder = writeSmokeTask(root, "SP-879-ok");
		writeFakePi(binDir, {
			lines: [
				`echo '${MESSAGE_UPDATE_LINE}'`,
				`echo '${MESSAGE_END_LINE}'`,
				`echo '${COMPACTION_END_LINE}'`,
			],
			donePath: path.join(taskFolder, ".DONE"),
			exitCode: 0,
		});

		const result = spawnSync(process.execPath, [RUNNER_PATH], {
			encoding: "utf-8",
			env: runnerEnv(root, taskFolder, binDir),
		});
		assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);

		const sidecar = readSidecar(taskFolder);
		assert.ok(sidecar, "expected worker-usage.json sidecar");
		// tokensIn = 100 input + 10 cacheRead + 0 cacheWrite + 200 compaction;
		// the message_update streaming snapshot (9999) is excluded.
		assert.equal(sidecar.tokensIn, 310);
		assert.equal(sidecar.tokensOut, 75);
		// 0.25 + 0.75 are binary-exact; provider-reported cost sums, not estimates.
		assert.equal(sidecar.estimatedUsd, 1);
		assert.equal(sidecar.recordType, "worker-usage");
		assert.equal(sidecar.schemaVersion, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runner writes no sidecar when pi stdout is not a JSON usage stream", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-usage-plain-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		const taskFolder = writeSmokeTask(root, "SP-879-plain");
		writeFakePi(binDir, {
			lines: ["echo 'plain human output'"],
			donePath: path.join(taskFolder, ".DONE"),
			exitCode: 0,
		});

		const result = spawnSync(process.execPath, [RUNNER_PATH], {
			encoding: "utf-8",
			env: runnerEnv(root, taskFolder, binDir),
		});
		assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
		assert.equal(readSidecar(taskFolder), null, "no sidecar without reported usage");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runner persists usage and tees assistant text when pi fails without .DONE", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-usage-fail-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		const taskFolder = writeSmokeTask(root, "SP-879-fail");
		writeFakePi(binDir, {
			lines: [`echo '${MESSAGE_END_LINE}'`],
			donePath: null,
			exitCode: 0,
		});

		const result = spawnSync(process.execPath, [RUNNER_PATH], {
			encoding: "utf-8",
			env: runnerEnv(root, taskFolder, binDir),
		});
		assert.equal(result.status, 1, `expected exit 1, got ${result.status}: ${result.stderr}`);
		// Real spend happened even though the run failed — usage is persisted…
		const sidecar = readSidecar(taskFolder);
		assert.ok(sidecar, "sidecar written on done-missing failure");
		assert.equal(sidecar.tokensIn, 110);
		assert.equal(sidecar.tokensOut, 50);
		assert.equal(sidecar.estimatedUsd, 0.25);
		// …and raw pi output stays flushable for salvage context (SP-708).
		assert.match(result.stdout, /ASSISTANT_TEE_MARKER/);
		assert.match(result.stderr, /pi exited but \.DONE was not created/);
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("stub runner never leaves a usage sidecar and clears a stale one", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-usage-stub-"));
	try {
		const binDir = path.join(root, "bin");
		fs.mkdirSync(binDir, { recursive: true });
		const taskFolder = writeSmokeTask(root, "SP-879-stub");
		// A stale sidecar from a previous real-pi attempt must not survive.
		persistWorkerUsageSidecar({ taskFolder, usage: { tokensIn: 1, tokensOut: 2, estimatedUsd: 3 } });

		const result = spawnSync(process.execPath, [RUNNER_PATH, "--stub"], {
			encoding: "utf-8",
			env: runnerEnv(root, taskFolder, binDir),
		});
		assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);
		assert.equal(readSidecar(taskFolder), null, "stub clears/never writes the usage sidecar");
		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("attachTaskUsageFromSidecar copies only finite non-negative reported counters", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-attach-usage-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-879-attach");
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "worker-usage.json"),
			JSON.stringify({
				schemaVersion: 1,
				recordType: "worker-usage",
				tokensIn: 310,
				tokensOut: 75,
				estimatedUsd: 1,
				garbage: "not-a-counter",
			}),
			"utf-8",
		);
		const task = { taskId: "SP-879-attach", status: "succeeded" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task }), true);
		assert.equal(task.tokensIn, 310);
		assert.equal(task.tokensOut, 75);
		assert.equal(task.estimatedUsd, 1);

		// Existing finite task fields win; sidecar never overrides.
		const pinned = { taskId: "x", tokensIn: 5 };
		fs.writeFileSync(
			path.join(taskFolder, "worker-usage.json"),
			JSON.stringify({ schemaVersion: 1, recordType: "worker-usage", tokensIn: 310, tokensOut: 75 }),
			"utf-8",
		);
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: pinned }), true);
		assert.equal(pinned.tokensIn, 5);
		assert.equal(pinned.tokensOut, 75);

		// Negative and non-finite values are rejected (never invented).
		fs.writeFileSync(
			path.join(taskFolder, "worker-usage.json"),
			JSON.stringify({ schemaVersion: 1, recordType: "worker-usage", tokensIn: -3, tokensOut: Number.POSITIVE_INFINITY }),
			"utf-8",
		);
		const guarded = { taskId: "y" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: guarded }), false);
		assert.equal(guarded.tokensIn, undefined);
		assert.equal(guarded.tokensOut, undefined);

		// Malformed sidecars are a no-op, not a crash.
		fs.writeFileSync(path.join(taskFolder, "worker-usage.json"), "{not json", "utf-8");
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: {} }), false);
		assert.equal(attachTaskUsageFromSidecar({ taskFolder: path.join(root, "missing"), task: {} }), false);
		assert.equal(attachTaskUsageFromSidecar({ task: {} }), false);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("attachTaskUsageFromSidecar rejects foreign record types and unknown schema versions", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-attach-usage-guard-"));
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-884-guard");
		fs.mkdirSync(taskFolder, { recursive: true });
		const writeSidecar = (body) =>
			fs.writeFileSync(path.join(taskFolder, "worker-usage.json"), JSON.stringify(body), "utf-8");

		// A file stamped as a different record type is not worker usage: a
		// lookalike sidecar must not inject tokens into metric rows (SP-884).
		writeSidecar({ recordType: "batch", schemaVersion: 1, tokensIn: 999, tokensOut: 999 });
		const foreign = { taskId: "SP-884-guard" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: foreign }), false);
		assert.equal(foreign.tokensIn, undefined);
		assert.equal(foreign.tokensOut, undefined);

		// Unknown future schema versions are rejected until the reader learns them.
		writeSidecar({ recordType: "worker-usage", schemaVersion: 2, tokensIn: 999 });
		const future = { taskId: "SP-884-guard" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: future }), false);
		assert.equal(future.tokensIn, undefined);

		// A correctly producer-stamped sidecar stays accepted.
		writeSidecar({ recordType: "worker-usage", schemaVersion: 1, tokensIn: 310, tokensOut: 75 });
		const stamped = { taskId: "SP-884-guard" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: stamped }), true);
		assert.equal(stamped.tokensIn, 310);
		assert.equal(stamped.tokensOut, 75);

		// Omitting the identity fields entirely must not bypass the guard
		// either: an unstamped lookalike is not a legacy format (the writer has
		// stamped identity since SP-879), so it attaches no usage at all.
		writeSidecar({ tokensIn: 5, estimatedUsd: 0.5 });
		const unstamped = { taskId: "SP-884-guard" };
		assert.equal(attachTaskUsageFromSidecar({ taskFolder, task: unstamped }), false);
		assert.equal(unstamped.tokensIn, undefined);
		assert.equal(unstamped.estimatedUsd, undefined);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("recordLaneTaskMetric includes worker usage on the task record and omits it for skipped tasks", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-lane-metric-usage-"));
	try {
		const config = { metrics: { path: "spine-test-run-metrics.jsonl" } };
		const taskFolder = path.join(root, "spine-tasks", "SP-879-metric");
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(
			path.join(taskFolder, "worker-usage.json"),
			JSON.stringify({ schemaVersion: 1, recordType: "worker-usage", tokensIn: 310, tokensOut: 75, estimatedUsd: 1 }),
			"utf-8",
		);

		recordLaneTaskMetric({
			projectRoot: root,
			batchId: "b-sp879",
			task: {
				taskId: "SP-879-metric",
				status: "succeeded",
				startedAt: Date.now() - 1000,
				endedAt: Date.now(),
			},
			config,
			taskFolder,
		});
		const lines = fs.readFileSync(metricsFilePath(root, config), "utf-8").trim().split("\n");
		const successRecord = JSON.parse(lines.at(-1));
		assert.equal(successRecord.taskId, "SP-879-metric");
		assert.equal(successRecord.tokensIn, 310);
		assert.equal(successRecord.tokensOut, 75);
		assert.equal(successRecord.estimatedUsd, 1);

		// Skipped tasks never ran a worker: a stale committed sidecar (from an
		// earlier batch's lane commit) must not leak usage onto their record.
		recordLaneTaskMetric({
			projectRoot: root,
			batchId: "b-sp879",
			task: {
				taskId: "SP-879-metric",
				status: "skipped",
				startedAt: Date.now() - 1000,
				endedAt: Date.now(),
				exitReason: "skipped_done_on_disk",
			},
			config,
			taskFolder,
		});
		const skipRecord = JSON.parse(fs.readFileSync(metricsFilePath(root, config), "utf-8").trim().split("\n").at(-1));
		assert.equal(skipRecord.taskId, "SP-879-metric");
		assert.equal(skipRecord.outcome, "skipped");
		assert.equal(skipRecord.tokensIn, undefined);
		assert.equal(skipRecord.tokensOut, undefined);
		assert.equal(skipRecord.estimatedUsd, undefined);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
