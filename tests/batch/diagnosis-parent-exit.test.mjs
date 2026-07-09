/**
 * SP-560 — engine_orphaned parent-shell exit vs crash diagnosis hints (#185).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
} from "../../src/batch/diagnosis.mjs";
import {
	inferEngineOrphanCause,
	journalHasEngineCrash,
	journalIndicatesParentExit,
} from "../../src/batch/diagnosis-parent-exit.mjs";
import { DETACHED_ENGINE_LOG_REL } from "../../src/batch/detached-spawn.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const TASK_ID = "SP-560T";
const BATCH_ID = "20260709T120000";

test("journalHasEngineCrash detects engine.crash journal events", () => {
	assert.equal(journalHasEngineCrash([]), false);
	assert.equal(
		journalHasEngineCrash([{ type: "task.started", taskId: TASK_ID }]),
		false,
	);
	assert.equal(
		journalHasEngineCrash([{ type: "engine.crash", payload: { error: "boom" } }]),
		true,
	);
});

test("journalIndicatesParentExit detects engine.parent_died with parent_exit signal", () => {
	assert.equal(journalIndicatesParentExit([]), false);
	assert.equal(
		journalIndicatesParentExit([
			{ type: "engine.parent_died", payload: { signal: "parent_exit", enginePid: 123 } },
		]),
		true,
	);
	assert.equal(
		journalIndicatesParentExit([{ type: "engine.parent_died", payload: { signal: "SIGTERM" } }]),
		false,
	);
});

test("inferEngineOrphanCause returns parent_exit when journal has engine.parent_died", () => {
	const cause = inferEngineOrphanCause({
		journalEvents: [
			{ type: "engine.parent_died", payload: { signal: "parent_exit" } },
		],
		staleEnginePid: true,
	});
	assert.equal(cause.kind, "parent_exit");
	assert.equal(cause.detachedEngineLogRef, DETACHED_ENGINE_LOG_REL);
});

test("inferEngineOrphanCause returns parent_exit_likely for attached start without engine.crash", () => {
	const cause = inferEngineOrphanCause({
		journalEvents: [
			{ type: "batch.started", payload: { attached: true } },
			{ type: "task.started", payload: { taskId: TASK_ID } },
		],
		staleEnginePid: true,
	});
	assert.equal(cause.kind, "parent_exit_likely");
	assert.equal(cause.detachedEngineLogRef, DETACHED_ENGINE_LOG_REL);
});

test("inferEngineOrphanCause returns unknown for detached resume stall without crash journal", () => {
	const cause = inferEngineOrphanCause({
		journalEvents: [
			{ type: "batch.resumed", payload: { pendingSegments: 1 } },
			{ type: "task.started", payload: { taskId: TASK_ID } },
		],
		staleEnginePid: true,
	});
	assert.equal(cause.kind, "unknown");
});

test("inferEngineOrphanCause returns crash when journal has engine.crash", () => {
	const cause = inferEngineOrphanCause({
		journalEvents: [{ type: "engine.crash", payload: { error: "uncaught" } }],
		staleEnginePid: true,
	});
	assert.equal(cause.kind, "crash");
});

test("buildHeadline distinguishes parent shell exit from engine crash", () => {
	const parentExitHeadline = buildHeadline("engine_orphaned", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		engineOrphanCause: { kind: "parent_exit", detachedEngineLogRef: DETACHED_ENGINE_LOG_REL },
	});
	assert.match(parentExitHeadline, /parent shell exited/i);
	assert.match(parentExitHeadline, /not a crash/i);
	assert.match(parentExitHeadline, /detached-engine\.log/);
	assert.match(parentExitHeadline, new RegExp(TASK_ID));

	const likelyHeadline = buildHeadline("engine_orphaned", {
		batchId: BATCH_ID,
		engineOrphanCause: { kind: "parent_exit_likely", detachedEngineLogRef: DETACHED_ENGINE_LOG_REL },
	});
	assert.match(likelyHeadline, /parent shell exit/i);
	assert.match(likelyHeadline, /no engine\.crash/i);

	const crashHeadline = buildHeadline("engine_orphaned", {
		batchId: BATCH_ID,
		failedTaskId: TASK_ID,
		engineOrphanCause: { kind: "crash" },
	});
	assert.match(crashHeadline, /engine died mid-run/i);
	assert.doesNotMatch(crashHeadline, /parent shell/i);
});

test("buildSuggestedCommand prefers detached resume for parent exit orphan", () => {
	assert.equal(
		buildSuggestedCommand("engine_orphaned", {
			engineOrphanCause: { kind: "parent_exit" },
		}),
		"spine batch resume --force",
	);
	assert.equal(
		buildSuggestedCommand("engine_orphaned", {
			failedTaskId: TASK_ID,
			engineOrphanCause: { kind: "parent_exit_likely" },
		}),
		`spine batch retry ${TASK_ID}`,
	);
});

test("buildDiagnosisOutput bundles parent-exit engine_orphaned headline and detached resume", () => {
	const output = buildDiagnosisOutput("engine_orphaned", {
		batchId: BATCH_ID,
		engineOrphanCause: {
			kind: "parent_exit_likely",
			detachedEngineLogRef: DETACHED_ENGINE_LOG_REL,
		},
		staleEnginePid: true,
	});
	assert.match(output.headline, /parent shell exit/i);
	assert.equal(output.suggestedCommand, "spine batch resume --force");
});

test("reconcile engine_orphaned without engine.crash suggests parent shell exit", async () => {
	const projectRoot = await initGitRepo("spine-560-parent-exit-");
	try {
		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch: `orch/spine-${BATCH_ID}`,
			wavePlan: [[TASK_ID]],
			tasks: [
				{
					taskId: TASK_ID,
					laneNumber: 1,
					status: "running",
					taskFolder: `spine-tasks/${TASK_ID}-orphan`,
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
					branch: laneTaskBranch(BATCH_ID, 1),
					taskIds: [TASK_ID],
					lastHeartbeatAt: Date.now() - 30_000,
				},
			],
		});
		state.phase = "running";
		recordBatchEnginePid(state, DEAD_PID);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, BATCH_ID, "batch.started", { attached: true });
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: TASK_ID, laneNumber: 1 });
		appendJournalEvent(projectRoot, BATCH_ID, "lane.heartbeat", { laneNumber: 1, taskId: TASK_ID });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "engine_orphaned");
		assert.match(result.headline, /parent shell exit/i);
		assert.match(result.headline, /detached-engine\.log/);
		assert.equal(result.suggestedCommand, `spine batch retry ${TASK_ID}`);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
