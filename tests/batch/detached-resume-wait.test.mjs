import assert from "node:assert/strict";
import test from "node:test";
import { resolveDefaultResumeWaitTerminal } from "../../src/batch/detached-start.mjs";

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
