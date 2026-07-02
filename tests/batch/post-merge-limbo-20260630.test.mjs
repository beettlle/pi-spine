/**
 * SP-377 / SP-378 — post-merge limbo regression (batch 20260630T212050, GitHub #59).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { rm } from "node:fs/promises";
import test from "node:test";
import { installAttachedExitFinalizeHandlers } from "../../src/batch/attached-runner.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	finalizeAttachedLandLoopBeforeExit,
	hydrateMergeResultsFromJournal,
	isPostMergeLimbo,
} from "../../src/batch/post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "../../src/batch/resume-multi-validate.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import {
	BATCH_20260630T212050_ID,
	loadBatch20260630OrphanFixture,
	materializeBatch20260630OrphanFixture,
} from "../helpers/batch-20260630T212050-fixture.mjs";
import { initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = BATCH_20260630T212050_ID;
const FIXTURE_PATH = path.join(
	process.cwd(),
	"tests/fixtures/batch-20260630T212050/orphan-after-merge.json",
);

test("batch 20260630T212050 orphan-after-merge fixture describes GitHub #59 incident", () => {
	const fixture = loadBatch20260630OrphanFixture();
	assert.equal(fixture.meta.batchId, BATCH_ID);
	assert.equal(fixture.meta.githubIssue, 59);
	assert.equal(fixture.batchState.mergeResults.length, 0);
	assert.equal(fixture.batchState.phase, "running");
	assert.ok(fixture.journalTail.some((event) => event.type === "batch.merge_completed"));
	assert.ok(fixture.journalTail.some((event) => event.type === "engine.orphan_terminated"));
	assert.ok(fs.existsSync(FIXTURE_PATH));
});

test("batch 20260630T212050 journal fixture is limbo via resume detect but not bare state", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-fixture-");
	try {
		materializeBatch20260630OrphanFixture(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(isPostMergeLimbo(state), false);
		assert.equal(detectPostMergeLimboForResume({ projectRoot, state }), true);
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)), false);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("hydrateMergeResultsFromJournal enables state limbo detection for batch 20260630T212050", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-hydrate-");
	try {
		materializeBatch20260630OrphanFixture(projectRoot);
		const state = loadSpineBatchState(projectRoot).raw;
		assert.equal(hydrateMergeResultsFromJournal({ projectRoot, state, batchId: BATCH_ID }), true);
		assert.equal(isPostMergeLimbo(state), true);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("finalizeAttachedLandLoopBeforeExit opens gate for batch 20260630T212050 journal limbo", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-finalize-");
	try {
		materializeBatch20260630OrphanFixture(projectRoot);

		const handoff = finalizeAttachedLandLoopBeforeExit({
			projectRoot,
			signal: "SIGTERM",
		});
		assert.equal(handoff.handled, true);
		assert.equal(handoff.action, "finalized_in_process");
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));

		const events = readJournalEvents(projectRoot, BATCH_ID);
		const mergeIndex = events.findLastIndex((event) => event.type === "batch.merge_completed");
		const handoffIndex = events.findIndex((event) => event.type === "engine.attached_post_merge_handoff");
		const gateIndex = events.findIndex((event) => event.type === "gate.opened");
		assert.ok(handoffIndex > mergeIndex);
		assert.ok(gateIndex > mergeIndex);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("installAttachedExitFinalizeHandlers finalizes journal limbo on SIGTERM without manual resume", async () => {
	const projectRoot = await initGitRepo("spine-limbo-20260630-handler-");
	const previousExit = process.exit;
	/** @type {number|undefined} */
	let exitCode;
	process.exit = (code) => {
		exitCode = code;
	};

	try {
		materializeBatch20260630OrphanFixture(projectRoot);
		installAttachedExitFinalizeHandlers({ projectRoot });
		process.emit("SIGTERM");
		assert.equal(exitCode, 0);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, BATCH_ID)));
	} finally {
		process.exit = previousExit;
		process.removeAllListeners("SIGTERM");
		process.removeAllListeners("SIGINT");
		await rm(projectRoot, { recursive: true, force: true });
	}
});
