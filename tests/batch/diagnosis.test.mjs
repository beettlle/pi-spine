import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { deriveDiagnosis } from "../../src/batch/reconcile-diagnosis.mjs";
import {
	buildDiagnosisOutput,
	buildHeadline,
	buildRunningTailHeadline,
	buildSuggestedCommand,
	isGateReadyHeadlineContext,
	isRunningWithoutActiveWorkers,
} from "../../src/batch/diagnosis.mjs";
import { runSpineStatus } from "../../bin/spine-status.mjs";
import { deriveMacroPhase } from "../../src/batch/macro-phase.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");
const BATCH_ID = "20260701T031142";

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

test("isRunningWithoutActiveWorkers is false when workers are active", () => {
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasRunningTasks: true,
			pendingTaskCount: 0,
			succeededTasks: 1,
			totalTasks: 3,
		}),
		false,
	);
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasPendingTasks: true,
			pendingTaskCount: 1,
			succeededTasks: 1,
			totalTasks: 3,
		}),
		false,
	);
});

test("isRunningWithoutActiveWorkers detects all-terminal tail state", () => {
	assert.equal(
		isRunningWithoutActiveWorkers({
			phase: "running",
			hasRunningTasks: false,
			hasPendingTasks: false,
			pendingTaskCount: 0,
			succeededTasks: 22,
			totalTasks: 22,
			failedTasks: 0,
		}),
		true,
	);
});

test("buildRunningTailHeadline maps macroPhase merging to operator text", () => {
	const headline = buildRunningTailHeadline("Batch 20260701T031142", {
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		macroPhase: "merging",
	});
	assert.match(headline ?? "", /merging lane branches/i);
	assert.doesNotMatch(headline ?? "", /\bis running\b/i);
});

test("buildRunningTailHeadline maps gating / post-merge limbo", () => {
	const headline = buildRunningTailHeadline("Batch test", {
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		postMergeLimbo: true,
		macroPhase: "gating",
	});
	assert.match(headline ?? "", /integrate gate/i);
	assert.doesNotMatch(headline ?? "", /\bis running\b/i);
});

test("buildHeadline preserves generic running when workers are active", () => {
	const headline = buildHeadline("running", {
		batchId: "20260601T120000",
		phase: "running",
		hasRunningTasks: true,
		hasPendingTasks: true,
		pendingTaskCount: 1,
		succeededTasks: 1,
		totalTasks: 3,
	});
	assert.equal(headline, "Batch 20260601T120000 is running");
});

test("isGateReadyHeadlineContext prefers needs_integrate and open gate", () => {
	assert.equal(isGateReadyHeadlineContext("needs_integrate", {}), true);
	assert.equal(
		isGateReadyHeadlineContext("running", {
			allTasksTerminalSuccess: true,
			integrateGateOpen: true,
		}),
		true,
	);
	assert.equal(
		isGateReadyHeadlineContext("failed", {
			allTasksTerminalSuccess: false,
			integrateGateOpen: false,
		}),
		false,
	);
});

test("buildHeadline prefers gate-ready over stale mergeGitignoredFailure (#195)", () => {
	const headline = buildHeadline("needs_integrate", {
		batchId: "20260710T120000",
		phase: "running",
		postMergeLimbo: true,
		integrateGateOpen: true,
		mergeGitignoredFailure: true,
		mergeFailed: true,
		lastError: "merge_failed_gitignored: coverage/lcov.info",
	});
	assert.match(headline, /gate opened/i);
	assert.doesNotMatch(headline, /gitignored/i);
	assert.doesNotMatch(headline, /merge conflict/i);
});

test("buildSuggestedCommand prefers gate approve over stale gitignored repair (#195)", () => {
	const command = buildSuggestedCommand("needs_integrate", {
		phase: "running",
		postMergeLimbo: true,
		integrateGateOpen: true,
		mergeGitignoredFailure: true,
		taskBranch: "task/spine-lane-1-20260710T120000",
		gitignoredPaths: ["coverage/lcov.info"],
	});
	assert.equal(command, "spine gate approve");
	assert.doesNotMatch(command, /git rm/);
});

test("buildSuggestedCommand returns gate approve when integrateGateOpen is true (#221)", () => {
	const command = buildSuggestedCommand("needs_integrate", {
		phase: "running",
		postMergeLimbo: true,
		integrateGateOpen: true,
	});
	assert.equal(command, "spine gate approve");
});

test("deriveDiagnosis returns needs_integrate for gate-pending terminal-success land loop (#221)", () => {
	const signals = {
		phase: "running",
		endedAt: null,
		failedTasks: 0,
		allTasksTerminalSuccess: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: false,
		hasSegmentDrift: false,
		failedTaskId: null,
		mergeResultsEmpty: false,
		git: {
			orchBranchExists: true,
			orchMergedToBase: false,
		},
		tasks: [{ taskId: "SP-221", classification: "terminal-success" }],
		raw: {
			tasks: [{ taskId: "SP-221", status: "running", doneFileFound: true }],
			mergeResults: [{ status: "succeeded" }],
			phase: "running",
		},
	};
	const result = deriveDiagnosis(signals);
	assert.equal(result.diagnosis, "needs_integrate");
	assert.equal(signals.postMergeLimbo, true);
});

test("buildHeadline still surfaces gitignored merge when not gate-ready", () => {
	const headline = buildHeadline("needs_merge", {
		batchId: "20260710T120000",
		mergeGitignoredFailure: true,
	});
	assert.match(headline, /gitignored paths/i);
});

test("deriveMacroPhase uses journal merge tail when diagnosis is running without workers", () => {
	const journalEvents = [
		{ type: "batch.merge_completed", payload: { waveIndex: 6, laneNumber: 1 } },
	];
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents,
			mergeResults: [],
			hasActiveWorkerTasks: false,
			allTasksTerminalSuccess: true,
			mergeResultsEmpty: true,
		}),
		"merging",
	);
});

test("deriveMacroPhase stays executing when workers are active", () => {
	const journalEvents = [{ type: "batch.merge_completed", payload: { waveIndex: 0 } }];
	assert.equal(
		deriveMacroPhase({
			diagnosis: "running",
			batchPhase: "running",
			journalEvents,
			hasActiveWorkerTasks: true,
		}),
		"executing",
	);
});

test("tail-state fixture reconciles without bare is running headline", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-tail-");
	try {
		const fixture = loadFixture("tail-state-land-loop-20260701T031142.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.ok(
			result.diagnosis === "running" || result.diagnosis === "needs_merge",
			`unexpected diagnosis: ${result.diagnosis}`,
		);
		assert.doesNotMatch(result.headline, /\bis running\b/i);
		if (result.diagnosis === "running") {
			assert.equal(result.macroPhase, "merging");
		}
		assert.match(result.headline, /merging|finalizing|gate|integrat|lane merges pending/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("tail-state headline matches batch 20260701T031142 shape via buildHeadline", () => {
	const headline = buildHeadline("running", {
		batchId: BATCH_ID,
		phase: "running",
		hasRunningTasks: false,
		hasPendingTasks: false,
		pendingTaskCount: 0,
		succeededTasks: 2,
		totalTasks: 2,
		failedTasks: 0,
		macroPhase: "merging",
		gitMerged: false,
		allTasksTerminalSuccess: true,
	});
	assert.equal(headline, `Batch ${BATCH_ID} tasks done — merging lane branches…`);
	assert.doesNotMatch(headline, /\bis running\b/i);
});

// --- SBAR handoff packet fields (#278 / SP-745) ---

test("buildDiagnosisOutput adds background and assessmentReason for needs_retry without changing legacy fields", () => {
	const ctx = {
		batchId: "20260904T120000",
		phase: "failed",
		macroPhase: "failed",
		failedTaskId: "SP-001",
		exitReason: "DirtyWorktree",
		failedTasks: 1,
		succeededTasks: 1,
		totalTasks: 3,
		pendingTaskCount: 1,
	};
	const output = buildDiagnosisOutput("needs_retry", ctx);

	// Legacy fields keep their exact values — backward compatible for consumers.
	assert.equal(output.diagnosis, "needs_retry");
	assert.equal(output.headline, buildHeadline("needs_retry", ctx));
	assert.equal(output.suggestedCommand, buildSuggestedCommand("needs_retry", ctx));
	assert.ok(Array.isArray(output.alternatives));

	assert.ok(Array.isArray(output.background));
	assert.ok(output.background.every((fact) => typeof fact === "string"));
	assert.ok(output.background.some((fact) => fact.includes("Batch: 20260904T120000")));
	assert.ok(output.background.some((fact) => fact.includes("Phase: failed")));
	assert.ok(output.background.some((fact) => fact.includes("SP-001") && fact.includes("DirtyWorktree")));

	assert.equal(typeof output.assessmentReason, "string");
	assert.ok(output.assessmentReason.includes("SP-001"));
	assert.ok(output.assessmentReason.includes("DirtyWorktree"));
	assert.notEqual(output.assessmentReason, "needs_retry");
});

test("buildDiagnosisOutput assessmentReason explains orphan taxonomy (worker_orphaned)", () => {
	const output = buildDiagnosisOutput("worker_orphaned", {
		batchId: "20260904T130000",
		failedTaskId: "SP-649",
	});
	assert.equal(output.diagnosis, "worker_orphaned");
	assert.match(output.assessmentReason, /SP-649/);
	assert.match(output.assessmentReason, /running|heartbeats/i);
	assert.ok(output.background.some((fact) => fact.includes("SP-649")));
});

test("buildDiagnosisOutput assessmentReason explains needs_integrate with open gate", () => {
	const output = buildDiagnosisOutput("needs_integrate", {
		batchId: "20260904T140000",
		phase: "running",
		baseBranch: "main",
		integrateGateOpen: true,
	});
	assert.equal(output.diagnosis, "needs_integrate");
	assert.match(output.assessmentReason, /gate/i);
	assert.ok(output.background.some((fact) => fact.includes("gate is open")));
	assert.equal(output.suggestedCommand, "spine gate approve");
});

test("spine status --diagnose renders Situation, Background, Assessment, Recommendation in order", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-sbar-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const { output } = runSpineStatus({ projectRoot, diagnose: true });
		assert.match(output, /Situation: Batch 20260601T130000/);
		assert.match(output, /Background:/);
		assert.match(output, /• Batch: 20260601T130000/);
		assert.match(output, /• Failed task: TP-002/);
		assert.match(output, /Assessment: needs_retry — /);
		assert.match(output, /Recommendation: spine batch retry TP-002/);

		const position = (marker) => output.indexOf(marker);
		const situation = position("Situation:");
		const background = position("Background:");
		const assessment = position("Assessment:");
		const recommendation = position("Recommendation:");
		assert.ok(
			situation > -1 && situation < background && background < assessment && assessment < recommendation,
			`SBAR roles out of order: ${situation}, ${background}, ${assessment}, ${recommendation}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status --json includes background and assessmentReason", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-json-sbar-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const { output } = runSpineStatus({ projectRoot, json: true, diagnose: true });
		const parsed = JSON.parse(output);
		assert.equal(parsed.diagnosis, "needs_retry");
		assert.ok(Array.isArray(parsed.background));
		assert.ok(parsed.background.some((fact) => fact.includes("TP-002")));
		assert.equal(typeof parsed.assessmentReason, "string");
		assert.ok(parsed.assessmentReason.includes("TP-002"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine status without --diagnose keeps legacy layout (no SBAR roles)", async () => {
	const projectRoot = await initGitRepo("spine-diagnosis-plain-");
	try {
		writePiBatchState(projectRoot, loadFixture("needs-retry-batch.json"));
		const { output } = runSpineStatus({ projectRoot });
		assert.match(output, /Diagnosis:\s+needs_retry/);
		assert.match(output, /→ spine batch retry TP-002/);
		assert.doesNotMatch(output, /Situation:|Background:|Assessment:|Recommendation:/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
