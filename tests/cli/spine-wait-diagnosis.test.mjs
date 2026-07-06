import assert from "node:assert/strict";
import test from "node:test";

import {
	deriveWaitPseudoDiagnoses,
	parseUntilDiagnoses,
	reconciliationMatchesUntil,
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
