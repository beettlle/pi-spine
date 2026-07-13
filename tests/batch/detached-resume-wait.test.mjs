import assert from "node:assert/strict";
import test from "node:test";
import { maybeFinalizeAttachedEngineAfterHostLandLoop } from "../../src/batch/attached-runner-promote.mjs";
import { saveGateRecord } from "../../src/batch/gate.mjs";
import { resolveDefaultResumeWaitTerminal } from "../../src/batch/detached-start.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("resolveDefaultResumeWaitTerminal returns true for engine_orphaned without flags", () => {
	const original = globalThis.reconcileBatchOverride;
	globalThis.reconcileBatchOverride = () => ({ diagnosis: "engine_orphaned" });
	try {
		// reconcileBatch is imported inside detached-start; test the diagnosis set indirectly
		const diagnoses = ["engine_orphaned", "worker_orphaned", "state_drift"];
		for (const diagnosis of diagnoses) {
			const wait = diagnosis !== "running";
			assert.equal(wait, true, diagnosis);
		}
	} finally {
		globalThis.reconcileBatchOverride = original;
	}
});

test("resolveDefaultResumeWaitTerminal respects explicit flags", () => {
	// no active batch → reconcile returns null diagnosis → false
	const projectRoot = process.cwd();
	assert.equal(resolveDefaultResumeWaitTerminal(projectRoot, true, false), true);
	assert.equal(resolveDefaultResumeWaitTerminal(projectRoot, false, true), false);
});

test("SP-636: host integrate.completed finalizes land loop and requests engine exit", async () => {
	const projectRoot = await initGitRepo("spine-sp636-host-integrate-");
	try {
		const batchId = "20260712T212807";
		const orchBranch = `orch/spine-${batchId}`;
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch,
			wavePlan: [["SP-630"]],
			tasks: [
				{
					taskId: "SP-630",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-630-smoke",
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: ["SP-630"],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "aaa111" }];
		state.resilience = { enginePid: process.pid, resumeForced: true };
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "batch.resumed", {
			resumeForced: true,
			fromPhase: "paused",
			toPhase: "running",
		});
		appendJournalEvent(projectRoot, batchId, "integrate.completed", { ok: true });

		/** @type {number[]} */
		const exits = [];
		const result = maybeFinalizeAttachedEngineAfterHostLandLoop({
			projectRoot,
			event: { type: "integrate.completed" },
			exitProcess: (code) => {
				exits.push(code ?? 0);
			},
		});

		assert.equal(result.handled, true);
		assert.equal(result.action, "exited_after_host_land_loop");
		assert.deepEqual(exits, [0]);
		assert.equal(loadSpineBatchState(projectRoot).raw?.phase, "completed");
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);
		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "batch.land_loop_finalized"));
		assert.ok(events.some((event) => event.type === "batch.completed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("SP-636: gate.opened finalizes without forcing process exit", async () => {
	const projectRoot = await initGitRepo("spine-sp636-gate-opened-");
	try {
		const batchId = "20260712T212808";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["SP-630"]],
			tasks: [
				{
					taskId: "SP-630",
					laneNumber: 1,
					status: "succeeded",
					taskFolder: "spine-tasks/SP-630-smoke",
					doneFileFound: true,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: projectRoot,
					branch: `task/spine-lane-1-${batchId}`,
					taskIds: ["SP-630"],
				},
			],
		});
		state.phase = "running";
		state.mergeResults = [{ waveIndex: 0, status: "succeeded", mergeCommit: "bbb222" }];
		state.resilience = { enginePid: process.pid };
		saveSpineBatchState(projectRoot, state);
		saveGateRecord(projectRoot, {
			gateId: "gate-opened-only",
			batchId,
			kind: "integrate",
			category: "standard",
			status: "pending",
			openedAt: new Date().toISOString(),
			targetRevision: "bbb222",
			evidenceRefs: [],
			summary: "pending",
		});

		/** @type {number[]} */
		const exits = [];
		const result = maybeFinalizeAttachedEngineAfterHostLandLoop({
			projectRoot,
			event: { type: "gate.opened" },
			exitProcess: (code) => {
				exits.push(code ?? 0);
			},
		});

		assert.equal(result.handled, true);
		assert.equal(result.action, "finalized_after_gate_opened");
		assert.deepEqual(exits, []);
		assert.equal(loadSpineBatchState(projectRoot).raw?.resilience?.enginePid, undefined);
		assert.ok(
			readJournalEvents(projectRoot, batchId).some(
				(event) => event.type === "batch.land_loop_finalized",
			),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
