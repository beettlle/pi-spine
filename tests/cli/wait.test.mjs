import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	diagnosisMatchesUntil,
	parseDurationMs,
	parseUntilDiagnoses,
	parseWaitArgs,
	runSpineWait,
} from "../../src/cli/wait.mjs";
import { DEFAULT_WATCH_INTERVAL_SEC } from "../../src/cli/watch.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");
const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, ...argv], {
		cwd: options.cwd ?? process.cwd(),
		encoding: "utf-8",
	});
}

test("parseDurationMs accepts plain seconds and suffix forms", () => {
	assert.equal(parseDurationMs("30"), 30_000);
	assert.equal(parseDurationMs("45s"), 45_000);
	assert.equal(parseDurationMs("5m"), 300_000);
	assert.equal(parseDurationMs("2h"), 7_200_000);
});

test("parseDurationMs rejects invalid values", () => {
	assert.throws(() => parseDurationMs(""), /--timeout requires/);
	assert.throws(() => parseDurationMs("0"), /positive duration/);
	assert.throws(() => parseDurationMs("5x"), /duration like/);
});

test("parseUntilDiagnoses parses comma-separated diagnoses", () => {
	const diagnoses = parseUntilDiagnoses("completed,needs_integrate,failed,aborted");
	assert.deepEqual([...diagnoses].sort(), ["aborted", "completed", "failed", "needs_integrate"]);
});

test("parseUntilDiagnoses rejects unknown diagnoses", () => {
	assert.throws(() => parseUntilDiagnoses("completed,not_a_diagnosis"), /Unknown diagnosis/);
	assert.throws(() => parseUntilDiagnoses(""), /--until requires/);
});

test("parseWaitArgs requires --until and applies defaults", () => {
	const args = parseWaitArgs(["--until", "completed,failed"]);
	assert.deepEqual([...args.until].sort(), ["completed", "failed"]);
	assert.equal(args.intervalSec, DEFAULT_WATCH_INTERVAL_SEC);
	assert.equal(args.timeoutMs, null);
	assert.equal(args.json, false);
});

test("parseWaitArgs accepts timeout interval and json", () => {
	const args = parseWaitArgs([
		"--until",
		"completed",
		"--timeout",
		"90s",
		"--interval",
		"2",
		"--json",
	]);
	assert.deepEqual([...args.until], ["completed"]);
	assert.equal(args.timeoutMs, 90_000);
	assert.equal(args.intervalSec, 2);
	assert.equal(args.json, true);
});

test("parseWaitArgs rejects unknown flags", () => {
	assert.throws(() => parseWaitArgs(["--until", "completed", "--once"]), /Unknown wait option/);
});

test("diagnosisMatchesUntil matches only non-null diagnoses in set", () => {
	const until = new Set(["completed", "failed"]);
	assert.equal(diagnosisMatchesUntil("completed", until), true);
	assert.equal(diagnosisMatchesUntil("running", until), false);
	assert.equal(diagnosisMatchesUntil(null, until), false);
});

test("runSpineWait exits 0 when diagnosis matches", async () => {
	const lines = [];
	const result = await runSpineWait({
		projectRoot: "/tmp/unused",
		untilDiagnoses: new Set(["completed"]),
		json: true,
		nowFn: () => 99,
		reconcileFn: () => ({
			diagnosis: "completed",
			headline: "Batch completed",
			suggestedCommand: "spine integrate",
			batchId: "batch-done",
			macroPhase: "completed",
			macroPhaseLabel: "Completed",
		}),
		writeStdout: (text) => lines.push(text),
		sleepFn: async () => {
			throw new Error("sleep should not run after match");
		},
	});

	assert.equal(result.exitCode, 0);
	assert.equal(result.matched, true);
	assert.equal(lines.length, 1);
	const snapshot = JSON.parse(lines[0]);
	assert.equal(snapshot.diagnosis, "completed");
	assert.equal(snapshot.observedAt, 99);
});

test("runSpineWait exits 1 on timeout and emits final json snapshot", async () => {
	const lines = [];
	let now = 1_000;
	const result = await runSpineWait({
		projectRoot: "/tmp/unused",
		untilDiagnoses: new Set(["completed"]),
		timeoutMs: 1_000,
		intervalSec: 1,
		json: true,
		nowFn: () => now,
		reconcileFn: () => ({
			diagnosis: "running",
			headline: "Batch is running",
			suggestedCommand: "spine status --diagnose",
			batchId: "batch-run",
			macroPhase: "executing",
			macroPhaseLabel: "Executing",
		}),
		sleepFn: async () => {
			now += 1_000;
		},
		writeStdout: (text) => lines.push(text),
	});

	assert.equal(result.exitCode, 1);
	assert.equal(result.timedOut, true);
	assert.equal(result.matched, false);
	assert.equal(lines.length, 1);
	const snapshot = JSON.parse(lines[0]);
	assert.equal(snapshot.diagnosis, "running");
});

test("runSpineWait polls until diagnosis changes", async () => {
	let calls = 0;
	const sleeps = [];
	const result = await runSpineWait({
		projectRoot: "/tmp/unused",
		untilDiagnoses: new Set(["failed"]),
		intervalSec: 1,
		reconcileFn: () => {
			calls += 1;
			return {
				diagnosis: calls < 3 ? "running" : "failed",
				headline: calls < 3 ? "running" : "failed",
				suggestedCommand: "spine status",
			};
		},
		sleepFn: async (ms) => {
			sleeps.push(ms);
		},
		writeStdout: () => {},
	});

	assert.equal(result.exitCode, 0);
	assert.equal(calls, 3);
	assert.deepEqual(sleeps, [1_000, 1_000]);
});

test("spine wait --json exits 0 when diagnosis matches fixture", async () => {
	const projectRoot = await initGitRepo("spine-wait-match-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writeSpineBatchState(projectRoot, fixture);

		const result = runSpine(
			["wait", "--until", "needs_retry,failed,completed", "--json"],
			{ cwd: projectRoot },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const snapshot = JSON.parse(result.stdout.trim());
		assert.equal(snapshot.diagnosis, "needs_retry");
		assert.ok(typeof snapshot.observedAt === "number");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine wait times out with exit 1", async () => {
	const projectRoot = await initGitRepo("spine-wait-timeout-");
	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);

		const result = runSpine(
			["wait", "--until", "completed", "--timeout", "1s", "--interval", "1"],
			{ cwd: projectRoot },
		);
		assert.equal(result.status, 1, result.stderr || result.stdout);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine wait rejects missing --until", () => {
	const result = runSpine(["wait", "--timeout", "30s"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /--until is required/);
});

test("spine help lists wait command", () => {
	const result = runSpine(["help"]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /spine wait/);
});
