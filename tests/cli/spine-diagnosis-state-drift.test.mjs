import assert from "node:assert/strict";
import test from "node:test";
import { buildSuggestedCommand } from "../../src/batch/diagnosis.mjs";

test("buildSuggestedCommand for state_drift uses retry with task id", () => {
	const command = buildSuggestedCommand("state_drift", { failedTaskId: "SP-441" });
	assert.equal(command, "spine batch retry SP-441");
	assert.doesNotMatch(command, /retry --force/);
});

test("buildSuggestedCommand for state_drift while running suggests pause then retry", () => {
	const command = buildSuggestedCommand("state_drift", {
		failedTaskId: "SP-441",
		phase: "running",
	});
	assert.equal(command, "spine batch pause && spine batch retry SP-441");
});

test("buildSuggestedCommand for state_drift without task id falls back to diagnose", () => {
	const command = buildSuggestedCommand("state_drift", {});
	assert.equal(command, "spine status --diagnose");
	assert.doesNotMatch(command, /retry --force/);
});
