import assert from "node:assert/strict";
import test from "node:test";
import { deriveMacroPhase } from "../../src/batch/macro-phase.mjs";
import { buildRunningTailHeadline } from "../../src/batch/diagnosis-tail-state.mjs";

const DRIFT_ORPHAN_DIAGNOSES = ["state_drift", "engine_orphaned", "worker_orphaned"];

for (const diagnosis of DRIFT_ORPHAN_DIAGNOSES) {
	test(`deriveMacroPhase: ${diagnosis} with active workers stays executing (#165)`, () => {
		assert.equal(
			deriveMacroPhase({
				diagnosis,
				batchPhase: "running",
				hasActiveWorkerTasks: true,
			}),
			"executing",
		);
	});
}

test("deriveMacroPhase: state_drift with all tasks terminal and pending gate is gating", () => {
	assert.equal(
		deriveMacroPhase({
			diagnosis: "state_drift",
			batchPhase: "running",
			hasActiveWorkerTasks: false,
			allTasksTerminalSuccess: true,
			gateRecord: { status: "pending", kind: "integrate" },
		}),
		"gating",
	);
});

test("deriveMacroPhase: engine_orphaned after success with post-merge limbo is gating", () => {
	assert.equal(
		deriveMacroPhase({
			diagnosis: "engine_orphaned",
			batchPhase: "running",
			hasActiveWorkerTasks: false,
			allTasksTerminalSuccess: true,
			postMergeLimbo: true,
			gateRecord: { status: "pending", kind: "integrate" },
		}),
		"gating",
	);
});

test("deriveMacroPhase: drift/orphan without workers or terminal success stays failed", () => {
	for (const diagnosis of DRIFT_ORPHAN_DIAGNOSES) {
		assert.equal(
			deriveMacroPhase({
				diagnosis,
				batchPhase: "running",
				hasActiveWorkerTasks: false,
				allTasksTerminalSuccess: false,
			}),
			"failed",
		);
	}
});

test("deriveMacroPhase: needs_retry stays failed even with active workers", () => {
	assert.equal(
		deriveMacroPhase({
			diagnosis: "needs_retry",
			batchPhase: "running",
			hasActiveWorkerTasks: true,
		}),
		"failed",
	);
});

test("buildRunningTailHeadline never surfaces macro Failed label (#165)", () => {
	const headline = buildRunningTailHeadline("Batch 20260706T210401", {
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		failedTasks: 0,
		totalTasks: 2,
		macroPhase: "failed",
		allTasksTerminalSuccess: true,
	});
	assert.ok(headline);
	assert.doesNotMatch(headline, /\bfailed\b/i);
});
