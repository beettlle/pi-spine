import assert from "node:assert/strict";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	deriveStructuralBatchStateFromJournal,
	detectBatchStateDrift,
	rebuildBatchStateFromJournal,
	rebuildBatchStateFromDisk,
} from "../../src/batch/journal-rebuild.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { loadScenario, materializeScenario } from "../helpers/scenario-fixture.mjs";

function fixtureJournalEvents(fixture) {
	return fixture.journalTail ?? fixture.journalEvents ?? [];
}

function staleFailedSeed(fixture, taskId) {
	const seed = structuredClone(fixture.batchState);
	const task = seed.tasks.find((entry) => entry.taskId === taskId);
	if (task) {
		task.status = "failed";
		task.exitReason = "prompt_parse_failed";
		task.classification = "prompt_parse_failed";
		task.doneFileFound = false;
	}
	seed.failedTasks = 1;
	seed.succeededTasks = 0;
	seed.phase = "failed";
	return seed;
}

test("deriveStructuralBatchStateFromJournal rebuilds multi-lane skeleton without cache seed", () => {
	const fixture = loadScenario("resume-parallel-lane-orphan");
	const events = fixtureJournalEvents(fixture);
	const structural = deriveStructuralBatchStateFromJournal(events, null);

	assert.equal(structural.batchId, "20260603T224829");
	assert.equal(structural.lanes.length, 3);
	assert.deepEqual(
		structural.lanes.map((lane) => lane.laneNumber).sort((a, b) => a - b),
		[1, 2, 3],
	);

	const lane1 = structural.lanes.find((lane) => lane.laneNumber === 1);
	assert.ok(lane1);
	assert.ok(lane1.taskIds.includes("SAT-036"));
	assert.ok(lane1.taskIds.includes("SAT-044"));
	assert.equal(structural.tasks.length, 8);
	assert.ok(structural.tasks.every((task) => task.status === "pending"));
	assert.ok(structural.wavePlan.flat().length >= 8);
});

test("resume-parallel-lane-orphan fixture: journal-only rebuild marks resumed tasks running", () => {
	const fixture = loadScenario("resume-parallel-lane-orphan");
	const events = fixtureJournalEvents(fixture);
	const rebuilt = rebuildBatchStateFromJournal(null, events);

	assert.equal(rebuilt.phase, "running");
	const runningIds = rebuilt.tasks.filter((task) => task.status === "running").map((task) => task.taskId);
	assert.ok(runningIds.includes("SAT-036"));
	assert.ok(runningIds.includes("SAT-037"));
	assert.ok(runningIds.includes("SAT-044"));
	assert.equal(rebuilt.failedTasks, 0);
});

test("orphan-running-resume fixture: structural + lifecycle rebuild without seed", () => {
	const fixture = loadScenario("orphan-running-resume");
	const events = fixtureJournalEvents(fixture);
	const structural = deriveStructuralBatchStateFromJournal(events, null);
	const rebuilt = rebuildBatchStateFromJournal(null, events);

	assert.equal(structural.tasks.length, 1);
	assert.equal(structural.tasks[0].taskId, "SAT-040");
	const task = rebuilt.tasks.find((entry) => entry.taskId === "SAT-040");
	assert.equal(task.status, "running");
	assert.equal(rebuilt.phase, "running");
});

test("pidless-ghost-running fixture: post-resume task.started wins over historical failure", () => {
	const fixture = loadScenario("pidless-ghost-running");
	const events = fixtureJournalEvents(fixture);
	const rebuilt = rebuildBatchStateFromJournal(null, events);
	const task = rebuilt.tasks.find((entry) => entry.taskId === "SAT-040");

	assert.equal(task.status, "running");
	assert.equal(rebuilt.phase, "running");
});

test("resume-orphan-historical-failure fixture: rebuild ignores pre-resume failure for active task", () => {
	const fixture = loadScenario("resume-orphan-historical-failure");
	const events = fixtureJournalEvents(fixture);
	const rebuilt = rebuildBatchStateFromJournal(null, events);
	const task = rebuilt.tasks.find((entry) => entry.taskId === "SAT-040");

	assert.equal(task.status, "running");
	assert.equal(rebuilt.phase, "running");
});

test("retry-clears-failed-classification fixture: rebuild fixes stale failed cache", () => {
	const fixture = loadScenario("retry-clears-failed-classification");
	const events = fixtureJournalEvents(fixture);
	const seed = staleFailedSeed(fixture, "SP-118");
	const rebuilt = rebuildBatchStateFromJournal(seed, events);
	const task = rebuilt.tasks.find((entry) => entry.taskId === "SP-118");

	assert.equal(task.status, "succeeded");
	assert.equal(task.exitReason, "done");
	assert.equal(rebuilt.succeededTasks, 1);
	assert.equal(rebuilt.failedTasks, 0);
});

test("retry-clears-failed-classification fixture: detectBatchStateDrift flags cache vs journal", () => {
	const fixture = loadScenario("retry-clears-failed-classification");
	const events = fixtureJournalEvents(fixture);
	const cached = staleFailedSeed(fixture, "SP-118");
	const rebuilt = rebuildBatchStateFromJournal(cached, events);
	const drift = detectBatchStateDrift(cached, rebuilt, events);

	assert.equal(drift.drifted, true);
	assert.ok(drift.entries.some((entry) => entry.taskId === "SP-118" && entry.field === "status"));
});

test("incident fixtures rebuild from disk matches in-memory journal rebuild", async () => {
	const projectRoot = await initGitRepo("spine-journal-rebuild-incident-disk-");
	try {
		const batchId = materializeScenario(projectRoot, "orphan-running-resume");
		const events = readJournalEvents(projectRoot, batchId);
		const fromDisk = rebuildBatchStateFromDisk(projectRoot, batchId, null);
		const fromEvents = rebuildBatchStateFromJournal(null, events);
		const diskTask = fromDisk.tasks.find((entry) => entry.taskId === "SAT-040");
		const eventTask = fromEvents.tasks.find((entry) => entry.taskId === "SAT-040");

		assert.equal(diskTask.status, eventTask.status);
		assert.equal(fromDisk.phase, fromEvents.phase);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
