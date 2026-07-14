/**
 * SP-658 / #205 — diagnose headline honesty: orphan / gate-ready outrank stale gitignored (#195 follow-up).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildHeadline,
	buildSuggestedCommand,
	shouldPreferPrimaryOverGitignoredHeadline,
} from "../../src/batch/diagnosis.mjs";

test("shouldPreferPrimaryOverGitignoredHeadline: orphan and gate-ready demote stale gitignored", () => {
	assert.equal(shouldPreferPrimaryOverGitignoredHeadline("worker_orphaned", {}), true);
	assert.equal(shouldPreferPrimaryOverGitignoredHeadline("engine_orphaned", {}), true);
	assert.equal(shouldPreferPrimaryOverGitignoredHeadline("needs_integrate", {}), true);
	assert.equal(
		shouldPreferPrimaryOverGitignoredHeadline("failed", {
			allTasksTerminalSuccess: true,
			integrateGateOpen: true,
		}),
		true,
	);
	assert.equal(shouldPreferPrimaryOverGitignoredHeadline("needs_merge", {}), false);
	assert.equal(shouldPreferPrimaryOverGitignoredHeadline("failed", {}), false);
});

test("buildHeadline: stale GitignoredDirtyWorktree + worker_orphaned → orphan headline (#205)", () => {
	const headline = buildHeadline("worker_orphaned", {
		batchId: "20260713T171709",
		failedTaskId: "SP-649",
		mergeGitignoredFailure: true,
		mergeFailed: true,
		exitReason: "worker_orphaned",
		lastError: "merge_failed_gitignored: .pi-smart-router/state.db-shm",
		gitignoredPaths: [".pi-smart-router/state.db-shm", ".pi-smart-router/state.db-wal"],
	});
	assert.match(headline, /lane worker orphaned/i);
	assert.match(headline, /SP-649/);
	assert.doesNotMatch(headline, /gitignored/i);
	assert.doesNotMatch(headline, /drop cached ignored/i);
});

test("buildSuggestedCommand: orphan prefers retry over stale gitignored repair (#205)", () => {
	const command = buildSuggestedCommand("worker_orphaned", {
		failedTaskId: "SP-649",
		mergeGitignoredFailure: true,
		taskBranch: "task/spine-lane-1-20260713T171709",
		gitignoredPaths: [".pi-smart-router/state.db-shm"],
	});
	assert.equal(command, "spine batch retry SP-649");
	assert.doesNotMatch(command, /git rm/);
	assert.doesNotMatch(command, /gitignored/i);
});

test("buildHeadline: engine_orphaned outranks stale mergeGitignoredFailure (#205)", () => {
	const headline = buildHeadline("engine_orphaned", {
		batchId: "20260713T171709",
		failedTaskId: "SP-649",
		mergeGitignoredFailure: true,
	});
	assert.match(headline, /engine died/i);
	assert.doesNotMatch(headline, /gitignored/i);
});

test("buildHeadline still surfaces gitignored when merge is primary (not orphan)", () => {
	const headline = buildHeadline("needs_merge", {
		batchId: "20260713T171709",
		mergeGitignoredFailure: true,
	});
	assert.match(headline, /gitignored paths/i);
});

test("buildHeadline prefers gate-ready over stale mergeGitignoredFailure (#195 regression)", () => {
	const headline = buildHeadline("needs_integrate", {
		batchId: "20260713T171709",
		phase: "running",
		postMergeLimbo: true,
		integrateGateOpen: true,
		mergeGitignoredFailure: true,
		mergeFailed: true,
	});
	assert.match(headline, /gate opened/i);
	assert.doesNotMatch(headline, /gitignored/i);
});
