import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	buildWatchSnapshot,
	DEFAULT_WATCH_INTERVAL_SEC,
	formatWatchHumanLine,
	parseWatchArgs,
	runSpineWatch,
} from "../../src/cli/watch.mjs";
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

test("parseWatchArgs defaults", () => {
	const args = parseWatchArgs([]);
	assert.equal(args.intervalSec, DEFAULT_WATCH_INTERVAL_SEC);
	assert.equal(args.json, false);
	assert.equal(args.once, false);
});

test("parseWatchArgs accepts interval json and once", () => {
	const args = parseWatchArgs(["--interval", "2", "--json", "--once"]);
	assert.equal(args.intervalSec, 2);
	assert.equal(args.json, true);
	assert.equal(args.once, true);
});

test("parseWatchArgs rejects invalid interval", () => {
	assert.throws(() => parseWatchArgs(["--interval", "0"]), /--interval requires/);
	assert.throws(() => parseWatchArgs(["--interval", "nope"]), /--interval requires/);
});

test("parseWatchArgs rejects unknown flags", () => {
	assert.throws(() => parseWatchArgs(["--verbose"]), /Unknown watch option/);
});

test("formatWatchHumanLine renders compact reconcile summary", () => {
	const line = formatWatchHumanLine({
		diagnosis: "running",
		batchId: "20260629T120000",
		macroPhaseLabel: "Executing",
		headline: "Batch is running",
	});
	assert.equal(line, "running | 20260629T120000 | Executing | Batch is running");
});

test("formatWatchHumanLine uses idle placeholders when batch absent", () => {
	const line = formatWatchHumanLine({
		headline: "No active batch — ready to plan or start",
		suggestedCommand: "spine preflight",
		macroPhase: "idle",
		macroPhaseLabel: "Idle",
	});
	assert.match(line, /^idle \| — \| Idle \| No active batch/);
});

test("buildWatchSnapshot includes core fields and progress block when present", () => {
	const snapshot = buildWatchSnapshot(
		{
			diagnosis: "running",
			batchId: "20260629T120000",
			phase: "running",
			macroPhase: "executing",
			macroPhaseLabel: "Executing",
			headline: "Batch is running",
			suggestedCommand: "spine status --diagnose",
			succeededTasks: 1,
			pendingTasks: 2,
			totalTasks: 3,
			currentWaveIndex: 0,
			waveCount: 2,
		},
		1_700_000_000_000,
	);

	assert.equal(snapshot.observedAt, 1_700_000_000_000);
	assert.equal(snapshot.diagnosis, "running");
	assert.equal(snapshot.batchId, "20260629T120000");
	assert.deepEqual(snapshot.progress, {
		succeededTasks: 1,
		pendingTasks: 2,
		totalTasks: 3,
		currentWaveIndex: 0,
		waveCount: 2,
	});
});

test("buildWatchSnapshot prefers explicit progress object", () => {
	const snapshot = buildWatchSnapshot({
		headline: "ok",
		suggestedCommand: "spine status",
		progress: { succeededTasks: 4, totalTasks: 4 },
	});
	assert.deepEqual(snapshot.progress, { succeededTasks: 4, totalTasks: 4 });
});

test("runSpineWatch --once human mode prints one line", async () => {
	const lines = [];
	const result = await runSpineWatch({
		projectRoot: "/tmp/unused",
		once: true,
		isTTY: false,
		reconcileFn: () => ({
			diagnosis: "paused",
			batchId: "batch-a",
			macroPhaseLabel: "Paused",
			headline: "Batch paused",
			suggestedCommand: "spine batch resume",
		}),
		writeStdout: (text) => lines.push(text),
	});

	assert.equal(result.exitCode, 0);
	assert.deepEqual(lines, ["paused | batch-a | Paused | Batch paused\n"]);
});

test("runSpineWatch --once json mode prints NDJSON snapshot", async () => {
	const lines = [];
	const result = await runSpineWatch({
		projectRoot: "/tmp/unused",
		once: true,
		json: true,
		nowFn: () => 42,
		reconcileFn: () => ({
			diagnosis: null,
			headline: "No active batch",
			suggestedCommand: "spine preflight",
			macroPhase: "idle",
			macroPhaseLabel: "Idle",
		}),
		writeStdout: (text) => lines.push(text),
	});

	assert.equal(result.exitCode, 0);
	assert.equal(lines.length, 1);
	const parsed = JSON.parse(lines[0]);
	assert.equal(parsed.observedAt, 42);
	assert.equal(parsed.macroPhase, "idle");
	assert.equal(parsed.headline, "No active batch");
	assert.equal(parsed.progress, undefined);
});

test("runSpineWatch polls until once breaks loop without extra reconcile calls", async () => {
	let reconcileCalls = 0;
	const sleeps = [];
	await runSpineWatch({
		projectRoot: "/tmp/unused",
		once: true,
		intervalSec: 1,
		isTTY: false,
		reconcileFn: () => {
			reconcileCalls += 1;
			return {
				headline: "tick",
				suggestedCommand: "spine status",
			};
		},
		sleepFn: async (ms) => {
			sleeps.push(ms);
		},
		writeStdout: () => {},
	});

	assert.equal(reconcileCalls, 1);
	assert.deepEqual(sleeps, []);
});

test("spine watch --once integrates with reconcileBatch in idle repo", async () => {
	const projectRoot = await initGitRepo("spine-watch-idle-");
	try {
		const result = runSpine(["watch", "--once"], { cwd: projectRoot });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /idle \| — \| Idle \|/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine watch --json --once emits reconcile snapshot for active batch", async () => {
	const projectRoot = await initGitRepo("spine-watch-json-");
	try {
		const fixture = loadFixture("running-batch.json");
		writeSpineBatchState(projectRoot, fixture);

		const result = runSpine(["watch", "--json", "--once"], { cwd: projectRoot });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const snapshot = JSON.parse(result.stdout.trim());
		assert.equal(snapshot.batchId, fixture.batchId);
		assert.equal(snapshot.macroPhase, "executing");
		assert.equal(snapshot.diagnosis, "running");
		assert.ok(snapshot.headline);
		assert.ok(snapshot.suggestedCommand);
		assert.ok(typeof snapshot.observedAt === "number");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine watch rejects invalid interval", () => {
	const result = runSpine(["watch", "--interval", "0", "--once"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /--interval requires/);
});

test("spine help lists watch command", () => {
	const result = runSpine(["help"]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /spine watch/);
});
