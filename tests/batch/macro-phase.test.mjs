import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	MACRO_PHASES,
	deriveMacroPhase,
	isMacroPhase,
	macroPhaseLabel,
} from "../../src/batch/macro-phase.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

/**
 * @param {string} name
 */
function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 */
function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("MACRO_PHASES exports all eleven lifecycle values", () => {
	assert.deepEqual(MACRO_PHASES, [
		"idle",
		"planning",
		"executing",
		"merging",
		"reviewing",
		"gating",
		"integrating",
		"completed",
		"failed",
		"aborted",
		"paused",
	]);
	for (const phase of MACRO_PHASES) {
		assert.equal(isMacroPhase(phase), true);
		assert.equal(typeof macroPhaseLabel(phase), "string");
		assert.ok(macroPhaseLabel(phase).length > 0);
	}
});

test("deriveMacroPhase: idle when no batch signals", () => {
	assert.equal(deriveMacroPhase({ diagnosis: null, batchPhase: null }), "idle");
	assert.equal(deriveMacroPhase({}), "idle");
});

test("deriveMacroPhase: planning from batch phase", () => {
	assert.equal(
		deriveMacroPhase({ diagnosis: "running", batchPhase: "planning" }),
		"planning",
	);
});

test("deriveMacroPhase: executing for active running batch", () => {
	assert.equal(
		deriveMacroPhase({ diagnosis: "running", batchPhase: "running" }),
		"executing",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "running", batchPhase: "executing" }),
		"executing",
	);
});

test("deriveMacroPhase: merging phase and needs_merge diagnosis", () => {
	assert.equal(
		deriveMacroPhase({ diagnosis: "needs_merge", batchPhase: "merging" }),
		"merging",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "needs_merge", batchPhase: "running" }),
		"merging",
	);
});

test("deriveMacroPhase: reviewing when review.started is open", () => {
	const journalEvents = [
		{
			type: "review.started",
			taskId: "TP-002",
			payload: { reviewType: "code", stepNumber: 2 },
		},
	];
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents,
		}),
		"reviewing",
	);
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents: [
				...journalEvents,
				{
					type: "review.completed",
					taskId: "TP-002",
					payload: { reviewType: "code", stepNumber: 2, verdict: "APPROVE" },
				},
			],
		}),
		"executing",
	);
});

test("deriveMacroPhase: gating for pending gate or post-merge limbo", () => {
	assert.equal(
		deriveMacroPhase({
			diagnosis: "needs_integrate",
			batchPhase: "running",
			postMergeLimbo: true,
		}),
		"gating",
	);
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			gateRecord: { status: "pending", kind: "integrate" },
		}),
		"gating",
	);
});

test("deriveMacroPhase: integrating for needs_integrate and open integrate.started", () => {
	assert.equal(
		deriveMacroPhase({
			diagnosis: "needs_integrate",
			batchPhase: "completed",
		}),
		"integrating",
	);
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents: [{ type: "integrate.started", payload: { orchBranch: "orch/x" } }],
		}),
		"integrating",
	);
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents: [
				{ type: "integrate.started", payload: {} },
				{ type: "integrate.completed", payload: {} },
			],
		}),
		"executing",
	);
});

test("deriveMacroPhase: completed, failed, aborted, paused terminal phases", () => {
	assert.equal(
		deriveMacroPhase({ diagnosis: "completed", batchPhase: "completed" }),
		"completed",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "limbo_stale", batchPhase: "stopped" }),
		"completed",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "needs_retry", batchPhase: "paused" }),
		"failed",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "aborted", batchPhase: "aborted" }),
		"aborted",
	);
	assert.equal(
		deriveMacroPhase({ diagnosis: "paused", batchPhase: "paused" }),
		"paused",
	);
});

test("fixture running-batch.json reconciles to executing macro-phase", async () => {
	const projectRoot = await initGitRepo("spine-macro-phase-");
	try {
		writePiBatchState(projectRoot, loadFixture("running-batch.json"));
		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "running");
		assert.equal(result.macroPhase, "executing");
		assert.equal(result.macroPhaseLabel, "Executing");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("fixture taskplane-executing.json maps to executing", () => {
	const fixture = loadFixture("taskplane-executing.json");
	assert.equal(
		deriveMacroPhase({ diagnosis: "running", batchPhase: fixture.phase }),
		"executing",
	);
});

test("fixture needs-retry-batch.json maps to failed macro-phase", async () => {
	const projectRoot = await initGitRepo("spine-macro-phase-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "needs_retry");
		assert.equal(result.macroPhase, "failed");
		assert.equal(result.macroPhaseLabel, "Failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("fixture limbo-stale maps to completed macro-phase", async () => {
	const projectRoot = await initGitRepo("spine-macro-phase-");
	try {
		writePiBatchState(projectRoot, loadFixture("limbo-stale-20260531T165700.json"));
		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "limbo_stale");
		assert.equal(result.macroPhase, "completed");
		assert.equal(result.macroPhaseLabel, "Completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("all macro-phase enum values are reachable via deriveMacroPhase", () => {
	const cases = /** @type {Array<{ expected: import("../../src/batch/macro-phase.mjs").MacroPhase, input: import("../../src/batch/macro-phase.mjs").DeriveMacroPhaseInput }>} */ ([
		{ expected: "idle", input: { diagnosis: null, batchPhase: null } },
		{ expected: "planning", input: { diagnosis: "running", batchPhase: "planning" } },
		{ expected: "executing", input: { diagnosis: "running", batchPhase: "running" } },
		{ expected: "merging", input: { diagnosis: "needs_merge", batchPhase: "merging" } },
		{
			expected: "reviewing",
			input: {
				diagnosis: "running",
				batchPhase: "running",
				journalEvents: [
					{
						type: "review.started",
						taskId: "SP-1",
						payload: { reviewType: "plan", stepNumber: 0 },
					},
				],
			},
		},
		{
			expected: "gating",
			input: {
				diagnosis: "needs_integrate",
				batchPhase: "running",
				postMergeLimbo: true,
			},
		},
		{
			expected: "integrating",
			input: { diagnosis: "needs_integrate", batchPhase: "completed" },
		},
		{ expected: "completed", input: { diagnosis: "completed", batchPhase: "completed" } },
		{ expected: "failed", input: { diagnosis: "failed", batchPhase: "failed" } },
		{ expected: "aborted", input: { diagnosis: "aborted", batchPhase: "aborted" } },
		{ expected: "paused", input: { diagnosis: "paused", batchPhase: "paused" } },
	]);

	const covered = new Set();
	for (const { expected, input } of cases) {
		assert.equal(deriveMacroPhase(input), expected);
		covered.add(expected);
	}
	assert.equal(covered.size, MACRO_PHASES.length);
});
