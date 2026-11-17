import assert from "node:assert/strict";
import test from "node:test";

import {
	deriveWaitPseudoDiagnoses,
	hasLiveSiblingLaneWorker,
	matchReconciliationUntil,
	parseUntilDiagnoses,
	reconciliationMatchesUntil,
	WAIT_LIVE_SIBLING_GATED_DIAGNOSES,
} from "../../src/cli/spine-wait.mjs";
import {
	buildSuggestedCommand,
	sanitizeRetrySuggestedCommand,
} from "../../src/batch/diagnosis.mjs";

test("parseUntilDiagnoses accepts land-loop pseudo diagnoses", () => {
	const diagnoses = parseUntilDiagnoses("gate_open,needs_approval,post_merge_limbo,completed");
	assert.deepEqual(
		[...diagnoses].sort(),
		["completed", "gate_open", "needs_approval", "post_merge_limbo"],
	);
});

test("parseUntilDiagnoses still rejects unknown diagnoses", () => {
	assert.throws(() => parseUntilDiagnoses("gate_open,not_real"), /Unknown diagnosis/);
});

test("deriveWaitPseudoDiagnoses detects gate_open from integrate gate approve suggestion", () => {
	const pseudo = deriveWaitPseudoDiagnoses({
		diagnosis: "needs_integrate",
		macroPhase: "gating",
		headline: "Batch b1 gate opened — approve to continue land loop",
		suggestedCommand: "spine gate approve",
	});
	assert.deepEqual([...pseudo].sort(), ["gate_open", "needs_approval"]);
});

test("deriveWaitPseudoDiagnoses detects post_merge_limbo before gate opens", () => {
	const pseudo = deriveWaitPseudoDiagnoses({
		diagnosis: "needs_integrate",
		macroPhase: "gating",
		headline: "Batch b1 merged but gate not opened — resume to complete land loop",
		suggestedCommand: "spine batch resume --force",
	});
	assert.deepEqual([...pseudo], ["post_merge_limbo"]);
});

test("reconciliationMatchesUntil matches gate_open pseudo diagnosis", () => {
	const until = new Set(["gate_open"]);
	const result = {
		diagnosis: "running",
		macroPhase: "gating",
		headline: "Batch b1 gate opened — approve to continue land loop",
		suggestedCommand: "spine gate approve",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("reconciliationMatchesUntil matches taxonomy diagnosis unchanged", () => {
	const until = new Set(["needs_integrate"]);
	const result = {
		diagnosis: "needs_integrate",
		suggestedCommand: "spine integrate",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("reconciliationMatchesUntil satisfies standard until list with needs_integrate (#221)", () => {
	const until = new Set([
		"completed",
		"failed",
		"needs_integrate",
		"needs_retry",
		"aborted",
	]);
	const result = {
		diagnosis: "needs_integrate",
		suggestedCommand: "spine gate approve",
		macroPhase: "gating",
		headline: "Batch b1 gate opened — approve to continue land loop",
	};
	assert.equal(reconciliationMatchesUntil(result, until), true);
});

test("sanitizeRetrySuggestedCommand replaces bare retry --force with task id", () => {
	assert.equal(
		sanitizeRetrySuggestedCommand("spine batch retry --force", "SP-014"),
		"spine batch retry SP-014",
	);
});

test("sanitizeRetrySuggestedCommand falls back to diagnose without task id", () => {
	assert.equal(
		sanitizeRetrySuggestedCommand("spine batch retry --force", null),
		"spine status --diagnose",
	);
});

test("buildSuggestedCommand for state_drift never suggests bare retry --force", () => {
	const command = buildSuggestedCommand("state_drift", { failedTaskId: "SP-014" });
	assert.equal(command, "spine batch retry SP-014");
	assert.doesNotMatch(command, /retry --force/);
});

test("buildSuggestedCommand sanitizes stale salvage retry --force payloads", () => {
	const command = buildSuggestedCommand("needs_retry", {
		failedTaskId: "SP-014",
		salvageRetryCommand: "spine batch retry --force",
	});
	assert.equal(command, "spine batch retry SP-014");
});

// --- Live sibling lane gate (#375) ----------------------------------------------

test("WAIT_LIVE_SIBLING_GATED_DIAGNOSES covers reconcile's hasFailedTasks-branch diagnoses", () => {
	assert.deepEqual([...WAIT_LIVE_SIBLING_GATED_DIAGNOSES].sort(), [
		"needs_replan",
		"needs_retry",
		"worker_done_missing",
	]);
});

test("hasLiveSiblingLaneWorker prefers signals.hasRunningTasks over phase", () => {
	assert.equal(
		hasLiveSiblingLaneWorker({ phase: "failed", signals: { hasRunningTasks: true } }),
		true,
	);
	assert.equal(
		hasLiveSiblingLaneWorker({ phase: "running", signals: { hasRunningTasks: false } }),
		false,
	);
});

test("hasLiveSiblingLaneWorker falls back to batch phase when signals are absent", () => {
	assert.equal(hasLiveSiblingLaneWorker({ phase: "running" }), true);
	assert.equal(hasLiveSiblingLaneWorker({ phase: "executing" }), true);
	assert.equal(hasLiveSiblingLaneWorker({ phase: "failed" }), false);
	assert.equal(hasLiveSiblingLaneWorker({}), false);
});

test("reconciliationMatchesUntil holds needs_retry while a sibling lane worker runs (#375)", () => {
	const until = new Set(["completed", "needs_retry"]);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "needs_retry", phase: "running", signals: { hasRunningTasks: true } },
			until,
		),
		false,
	);
	assert.equal(
		reconciliationMatchesUntil({ diagnosis: "needs_retry", phase: "running" }, until),
		false,
	);
});

test("reconciliationMatchesUntil matches needs_retry once sibling lanes are terminal (#375)", () => {
	const until = new Set(["completed", "needs_retry"]);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "needs_retry", phase: "failed", signals: { hasRunningTasks: false } },
			until,
		),
		true,
	);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "needs_retry", phase: "failed" },
			until,
		),
		true,
	);
	assert.equal(
		reconciliationMatchesUntil({ diagnosis: "needs_retry", signals: { hasRunningTasks: false } }, until),
		true,
	);
});

test("reconciliationMatchesUntil holds worker_done_missing and needs_replan while a sibling runs (#375)", () => {
	const until = new Set(["worker_done_missing", "needs_replan"]);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "worker_done_missing", phase: "running", signals: { hasRunningTasks: true } },
			until,
		),
		false,
	);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "needs_replan", phase: "running" },
			until,
		),
		false,
	);
});

test("reconciliationMatchesUntil keeps failed matching while a sibling lane worker runs (#375)", () => {
	const until = new Set(["failed"]);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "failed", phase: "failed", signals: { hasRunningTasks: true } },
			until,
		),
		true,
	);
	// #252 phase alias keeps working even mid-batch with a live sibling.
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "worker_done_missing", phase: "failed", signals: { hasRunningTasks: true } },
			until,
		),
		true,
	);
});

test("reconciliationMatchesUntil keeps success/integrate/pseudos matching while a sibling runs (#375)", () => {
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "completed", phase: "running", signals: { hasRunningTasks: true } },
			new Set(["completed"]),
		),
		true,
	);
	assert.equal(
		reconciliationMatchesUntil(
			{ diagnosis: "needs_integrate", phase: "running", signals: { hasRunningTasks: true } },
			new Set(["needs_integrate"]),
		),
		true,
	);
	assert.equal(
		reconciliationMatchesUntil(
			{
				diagnosis: "needs_integrate",
				macroPhase: "gating",
				headline: "Batch b1 gate opened — approve to continue land loop",
				suggestedCommand: "spine gate approve",
				phase: "running",
				signals: { hasRunningTasks: true },
			},
			new Set(["gate_open"]),
		),
		true,
	);
});

test("matchReconciliationUntil names the gated token; only reconciliationMatchesUntil holds it", () => {
	const until = new Set(["needs_retry"]);
	const result = { diagnosis: "needs_retry", phase: "running", signals: { hasRunningTasks: true } };
	assert.equal(matchReconciliationUntil(result, until), "needs_retry");
	assert.equal(reconciliationMatchesUntil(result, until), false);
});
