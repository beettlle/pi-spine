import assert from "node:assert/strict";
import test from "node:test";
import {
	detectOrphanRunning,
	journalEventsSinceResume,
	journalHasTerminalBatchEvent,
} from "../../src/batch/orphan-detect.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { loadScenario, materializeScenario } from "../helpers/scenario-fixture.mjs";

const DEAD_PID = 999_999_999;

test("journalEventsSinceResume excludes pre-resume terminal events", () => {
	const events = loadScenario("resume-orphan-historical-failure").journalTail;
	const raw = loadScenario("resume-orphan-historical-failure").batchState;

	assert.equal(journalHasTerminalBatchEvent(events), true);

	const scoped = journalEventsSinceResume(events, raw);
	assert.equal(journalHasTerminalBatchEvent(scoped), false);
	assert.equal(scoped[0]?.type, "batch.resumed");
	assert.equal(scoped.length, 2);
});

test("detectOrphanRunning: historical task.failed + post-resume silence + dead engine", () => {
	const fixture = loadScenario("resume-orphan-historical-failure");
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: "SAT-040", classification: "running", laneNumber: 1 }],
		lanes: [{ laneNumber: 1 }],
		raw: fixture.batchState,
		journalEvents: fixture.journalTail,
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "engine");
	assert.equal(orphan.enginePid, DEAD_PID);
});

test("resume orphan with historical failure fixture is not diagnosed as running", async () => {
	const projectRoot = await initGitRepo("spine-resume-orphan-historical-");
	try {
		materializeScenario(projectRoot, "resume-orphan-historical-failure");

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, "spine batch retry SAT-040");
		assert.match(result.headline, /engine died/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("terminal event within scoped window still suppresses engine orphan", () => {
	const fixture = loadScenario("resume-orphan-historical-failure");
	const events = [
		...fixture.journalTail,
		{
			schemaVersion: 1,
			eventId: "post-resume-task-failed",
			type: "task.failed",
			timestamp: "2026-06-03T22:50:00.000Z",
			batchId: "20260603T224829",
			taskId: "SAT-040",
			payload: { taskId: "SAT-040", laneNumber: 1 },
		},
	];

	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: "SAT-040", classification: "running", laneNumber: 1 }],
		lanes: [{ laneNumber: 1 }],
		raw: fixture.batchState,
		journalEvents: events,
	});

	assert.equal(orphan, null);
});
