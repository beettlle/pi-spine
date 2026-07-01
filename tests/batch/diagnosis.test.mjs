import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	buildHeadline,
	buildRunningTailHeadline,
	isRunningWithoutActiveWorkers,
} from "../../src/batch/diagnosis.mjs";
import { deriveMacroPhase } from "../../src/batch/macro-phase.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");
const BATCH_ID = "20260701T031142";

/**
 * @param {string} name
 */
function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 */
function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("isRunningWithoutActiveWorkers is false when workers are active", () => {
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasRunningTasks: true,
			pendingTaskCount: 0,
			succeededTasks: 1,
			totalTasks: 3,
		}),
		false,
	);
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasPendingTasks: true,
			pendingTaskCount: 1,
			succeededTasks: 1,
			totalTasks: 3,
		}),
		false,
	);
});

test("isRunningWithoutActiveWorkers detects all-terminal tail state", () => {
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasRunningTasks: false,
			hasPendingTasks: false,
			pendingTaskCount: 0,
			succeededTasks: 22,
			totalTasks: 22,
			failedTasks: 0,
		}),
		true,
	);
});

test("buildRunningTailHeadline maps macroPhase merging to operator text", () => {
	const headline = buildRunningTailHeadline("Batch 20260701T031142", {
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		macroPhase: "merging",
	});
	assert.match(headline ?? "", /merging lane branches/i);
	assert.doesNotMatch(headline ?? "", /\bis running\b/i);
});

test("buildRunningTailHeadline maps gating / post-merge limbo", () => {
	const headline = buildRunningTailHeadline("Batch test", {
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		postMergeLimbo: true,
		macroPhase: "gating",
	});
	assert.match(headline ?? "", /integrate gate/i);
	assert.doesNotMatch(headline ?? "", /\bis running\b/i);
});

test("buildHeadline preserves generic running when workers are active", () => {
	const headline = buildHeadline("running", {
		batchId: "20260601T120000",
		phase: "running",
		hasRunningTasks: true,
		hasPendingTasks: true,
		pendingTaskCount: 1,
		succeededTasks: 1,
		totalTasks: 3,
	});
	assert.equal(headline, "Batch 20260601T120000 is running");
});

test("deriveMacroPhase uses journal merge tail when diagnosis is running without workers", () => {
	const journalEvents = [
		{ type: "batch.merge_completed", payload: { waveIndex: 6, laneNumber: 1 } },
	];
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents,
			mergeResults: [],
			hasActiveWorkerTasks: false,
			allTasksTerminalSuccess: true,
			mergeResultsEmpty: true,
		}),
		"merging",
	);
});

test("deriveMacroPhase stays executing when workers are active", () => {
	const journalEvents = [{ type: "batch.merge_completed", payload: { waveIndex: 0 } }];
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents,
			hasActiveWorkerTasks: true,
		}),
		"executing",
	);
});

test("tail-state fixture reconciles without bare is running headline", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-tail-");
	try {
		const fixture = loadFixture("tail-state-land-loop-20260701T031142.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.ok(
			result.diagnosis === "running" || result.diagnosis === "needs_merge",
			`unexpected diagnosis: ${result.diagnosis}`,
		);
		assert.doesNotMatch(result.headline, /\bis running\b/i);
		if (result.diagnosis === "running") {
			assert.equal(result.macroPhase, "merging");
		}
		assert.match(result.headline, /merging|finalizing|gate|integrat|lane merges pending/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("tail-state headline matches batch 20260701T031142 shape via buildHeadline", () => {
	const headline = buildHeadline("running", {
		batchId: BATCH_ID,
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		macroPhase: "merging",
		gitMerged: false,
		allTasksTerminalSuccess: true,
	});
	assert.equal(headline, `Batch ${BATCH_ID} tasks done — merging lane branches…`);
	assert.doesNotMatch(headline, /\bis running\b/i);
});
