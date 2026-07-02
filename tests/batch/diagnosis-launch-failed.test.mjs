import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	buildDiagnosisOutput,
	buildHeadline,
	buildSuggestedCommand,
	inferLaunchFailureKind,
} from "../../src/batch/diagnosis.mjs";
import { formatMixedOutcomeMessage } from "../../src/batch/engine-scope.mjs";
import { appendJournalEvent, extractJournalDiagnosisHints } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/incidents");

test("buildHeadline surfaces PI_SPINE_ROOT launch failure", () => {
	const headline = buildHeadline("needs_retry", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		launchFailureKind: "pi_spine_root",
	});
	assert.match(headline, /failed at worker launch/);
	assert.match(headline, /PI_SPINE_ROOT\/devcontainer/);
});

test("buildHeadline surfaces lane commit failures after worker completion", () => {
	const dirty = buildHeadline("needs_retry", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		exitReason: "DirtyWorktree",
	});
	assert.match(dirty, /dirty lane worktree/i);
	assert.match(dirty, /SAT-048/);

	const laneCommit = buildHeadline("needs_retry", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		exitReason: "lane_commit_failed",
	});
	assert.match(laneCommit, /SAT-048 completed but lane commit failed/);
});

test("buildSuggestedCommand prefers spine doctor for launch failures", () => {
	assert.equal(
		buildSuggestedCommand("needs_retry", { launchFailureKind: "pi_spine_root" }),
		"spine doctor",
	);
	assert.equal(
		buildSuggestedCommand("needs_retry", { launchFailureKind: "launch_failed" }),
		"spine doctor",
	);
	assert.equal(
		buildSuggestedCommand("needs_retry", {
			failedTaskId: "SAT-048",
			launchFailureKind: null,
		}),
		"spine batch retry SAT-048",
	);
});

test("inferLaunchFailureKind reads worker output hints from journal", () => {
	const events = [
		{
			type: "task.failed",
			taskId: "SAT-048",
			payload: {
				taskId: "SAT-048",
				classification: "failed",
				workerPhase: "launching",
				output: "CONFIG_PI_SPINE_ROOT_MISSING: set PI_SPINE_ROOT in devcontainer",
				workerOutputLogRef: ".spine/runtime/20260605T160800/lanes/lane-1/worker-output-SAT-048.log",
			},
		},
	];

	assert.equal(
		inferLaunchFailureKind({
			journalEvents: events,
			failedTaskId: "SAT-048",
		}),
		"pi_spine_root",
	);
});

test("extractJournalDiagnosisHints prioritizes setup hook and merge blocked events", () => {
	const events = [
		{ type: "lane.checkpoint_warning", timestamp: new Date().toISOString(), payload: {} },
		{
			type: "lane.setup_hook.failed",
			timestamp: new Date().toISOString(),
			payload: { error: "hook exit 1" },
		},
		{
			type: "batch.merge_blocked",
			timestamp: new Date().toISOString(),
			payload: { failedTaskIds: ["SAT-048"] },
		},
	];

	const hints = extractJournalDiagnosisHints(events);
	assert.equal(hints[0]?.type, "batch.merge_blocked");
	assert.equal(hints[1]?.type, "lane.setup_hook.failed");
});

test("formatMixedOutcomeMessage lists succeeded tasks and spine batch retry guidance", () => {
	const message = formatMixedOutcomeMessage(
		[{ taskId: "SAT-048" }],
		[],
		[{ taskId: "SAT-047" }],
	);
	assert.match(message, /Succeeded task\(s\): SAT-047/);
	assert.match(message, /Failed task\(s\): SAT-048/);
	assert.match(message, /Retry SAT-048 next: spine batch retry SAT-048/);
});

test("reconcileBatch diagnoses launch failure wave from fixture", async () => {
	const projectRoot = await initGitRepo("spine-launch-failure-");
	try {
		const fixture = JSON.parse(
			fs.readFileSync(path.join(FIXTURES, "lane-worktree-devcontainer.json"), "utf-8"),
		);
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify(fixture.batchState, null, 2),
			"utf-8",
		);

		const batchId = fixture.batchState.batchId;
		for (const event of fixture.journalEvents) {
			appendJournalEvent(projectRoot, batchId, event.type, {
				taskId: event.taskId,
				...event.payload,
			});
		}

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "needs_retry");
		assert.match(result.headline, /failed at worker launch/);
		assert.match(result.headline, /PI_SPINE_ROOT\/devcontainer/);
		assert.equal(result.suggestedCommand, "spine doctor");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildDiagnosisOutput bundles launch failure headline and command", () => {
	const output = buildDiagnosisOutput("needs_retry", {
		batchId: "20260605T160800",
		failedTaskId: "SAT-048",
		launchFailureKind: "launch_failed",
	});
	assert.match(output.headline, /failed at worker launch/);
	assert.equal(output.suggestedCommand, "spine doctor");
});
