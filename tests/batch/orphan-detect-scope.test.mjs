import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	detectOrphanRunning,
	journalEventsSinceResume,
	journalHasTerminalBatchEvent,
} from "../../src/batch/orphan-detect.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
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

test("journalEventsSinceResume excludes pre-resume terminal events", () => {
	const events = loadIncidentFixture("resume-orphan-historical-failure.json").journalTail;
	const raw = loadIncidentFixture("resume-orphan-historical-failure.json").batchState;

	assert.equal(journalHasTerminalBatchEvent(events), true);

	const scoped = journalEventsSinceResume(events, raw);
	assert.equal(journalHasTerminalBatchEvent(scoped), false);
	assert.equal(scoped[0]?.type, "batch.resumed");
	assert.equal(scoped.length, 2);
});

test("detectOrphanRunning: historical task.failed + post-resume silence + dead engine", () => {
	const fixture = loadIncidentFixture("resume-orphan-historical-failure.json");
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
		const fixture = loadIncidentFixture("resume-orphan-historical-failure.json");
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

test("terminal event within scoped window still suppresses engine orphan", () => {
	const fixture = loadIncidentFixture("resume-orphan-historical-failure.json");
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
