import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	detectOrphanRunning,
	journalEventsSinceResume,
	journalHasTerminalBatchEvent,
	journalIndicatesStalledSession,
} from "../../src/batch/orphan-detect.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const INCIDENT_FIXTURES = path.join(process.cwd(), "tests/fixtures/incidents");

/**
 * @param {string} name
 */
function loadIncidentFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(INCIDENT_FIXTURES, name), "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {{ batchState: object, journalTail?: object[], meta?: { batchId?: string } }} fixture
 */
function materializeIncidentFixture(projectRoot, fixture) {
	const batchId = fixture.meta?.batchId ?? fixture.batchState.batchId;
	saveSpineBatchState(projectRoot, fixture.batchState);

	const journalFile = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"journal",
		"events.jsonl",
	);
	fs.mkdirSync(path.dirname(journalFile), { recursive: true });
	for (const event of fixture.journalTail ?? []) {
		fs.appendFileSync(journalFile, `${JSON.stringify(event)}\n`, "utf-8");
	}
}

test("journalIndicatesStalledSession: post-resume start without terminal", () => {
	const fixture = loadIncidentFixture("pidless-ghost-running.json");
	const scoped = journalEventsSinceResume(fixture.journalTail, fixture.batchState);

	assert.equal(journalHasTerminalBatchEvent(fixture.journalTail), true);
	assert.equal(journalHasTerminalBatchEvent(scoped), false);
	assert.equal(journalIndicatesStalledSession(scoped), true);
});

test("detectOrphanRunning: PID-less ghost running with post-resume journal stall", () => {
	const fixture = loadIncidentFixture("pidless-ghost-running.json");
	const scoped = journalEventsSinceResume(fixture.journalTail, fixture.batchState);
	const orphan = detectOrphanRunning({
		phase: "running",
		hasRunningTasks: true,
		tasks: [{ taskId: "SAT-040", classification: "running", laneNumber: 1 }],
		lanes: fixture.batchState.lanes,
		raw: fixture.batchState,
		journalEvents: scoped,
	});

	assert.ok(orphan);
	assert.equal(orphan.kind, "engine");
	assert.equal(orphan.enginePid, null);
	assert.equal(orphan.taskId, "SAT-040");
});

test("pidless ghost fixture reconcile is engine_orphaned, not running", async () => {
	const projectRoot = await initGitRepo("spine-pidless-ghost-");
	try {
		const fixture = loadIncidentFixture("pidless-ghost-running.json");
		materializeIncidentFixture(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "running");
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.equal(result.suggestedCommand, "spine batch resume --attached");
		assert.match(result.headline, /engine died/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("terminal event within scoped window suppresses PID-less ghost signal", () => {
	const fixture = loadIncidentFixture("pidless-ghost-running.json");
	const scoped = [
		...journalEventsSinceResume(fixture.journalTail, fixture.batchState),
		{
			schemaVersion: 1,
			eventId: "pidless-post-resume-task-failed",
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
		lanes: fixture.batchState.lanes,
		raw: fixture.batchState,
		journalEvents: scoped,
	});

	assert.equal(orphan, null);
});
