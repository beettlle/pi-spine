/**
 * Phase 6 incident regression matrix (I-01–I-10).
 * Source: docs/incidents/20260531-phase0-taskplane-batch.md
 * PRD: §18.4–18.8, §23 Phase 6
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import test from "node:test";
import { runSpineState } from "../../bin/spine-state.mjs";
import { abortBatch } from "../../src/batch/abort.mjs";
import { archiveBatchStatePath } from "../../src/batch/lifecycle.mjs";
import {
	assessWaveMergeEligibility,
	forceMergeWave,
} from "../../src/batch/engine.mjs";
import {
	activitySignalsChanged,
	collectProgressSignals,
	computeStallDeadline,
	resolveStallConfig,
} from "../../src/batch/heartbeat.mjs";
import {
	buildPostMortemHeadline,
	generateBatchPostMortem,
} from "../../src/batch/postmortem.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { retryTask } from "../../src/batch/retry.mjs";
import { runStepReview } from "../../src/batch/review.mjs";
import {
	countPendingSegments,
	createInitialBatchState,
	defaultSegmentId,
	saveSpineBatchState,
	spineBatchStatePath,
	updateSegmentForTask,
	validateBatchState,
} from "../../src/batch/state.mjs";
import { laneTaskBranch, laneWorktreePath } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");
const CONTEXT_PATH = path.join(process.cwd(), "spine-tasks/CONTEXT.md");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeFailedBatch(projectRoot, { phase = "failed" } = {}) {
	const batchId = "20260601T170000";
	const taskId = "TP-999";
	const state = createInitialBatchState({
		batchId,
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		wavePlan: [[taskId]],
		tasks: [
			{
				taskId,
				laneNumber: 1,
				status: "failed",
				taskFolder: `taskplane-tasks/${taskId}-smoke`,
				startedAt: Date.now() - 60_000,
				endedAt: Date.now(),
				doneFileFound: false,
				exitReason: "worker_failed",
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, batchId, 1),
				branch: laneTaskBranch(batchId, 1),
				taskIds: [taskId],
				lastHeartbeatAt: null,
			},
		],
	});
	state.phase = phase;
	state.failedTasks = 1;
	updateSegmentForTask(state, taskId, "failed");
	saveSpineBatchState(projectRoot, state);
	return { batchId, taskId, state };
}

function writeReviewTask(root, reviewLevel) {
	const folder = path.join(root, "taskplane-tasks", "TP-777-review");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: TP-777 — Review

## Review Level: ${reviewLevel} (Plan and Code)

## Mission
Incident I-10 regression.

## Dependencies
- **None**

## File Scope
- \`src/review.txt\`

## Steps
### Step 1: Work
- [ ] one
`,
		"utf-8",
	);
	return folder;
}

test("I-01 progress signals extend stall deadline past hard timeout", () => {
	const stallConfig = resolveStallConfig({
		lanes: { stallTimeoutMinutes: 1, stallGraceAfterProgressMinutes: 30 },
	});
	const startedAt = 0;
	const lastProgressAt = 30 * 60 * 1000;
	const deadline = computeStallDeadline({ startedAt, lastProgressAt, stallConfig });
	assert.equal(deadline, lastProgressAt + stallConfig.graceAfterProgressMs);
	assert.ok(deadline > startedAt + stallConfig.stallTimeoutMs);
});

test("I-02 spine batch retry resets task and segment with pendingSegments > 0", async () => {
	const projectRoot = await initGitRepo("spine-incident-i02-");
	try {
		const { taskId } = writeFailedBatch(projectRoot);
		const result = retryTask({ projectRoot, taskId });
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.equal(result.pendingSegments, 1);
		const saved = JSON.parse(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"));
		assert.equal(saved.segments[0].status, "pending");
		assert.equal(countPendingSegments(saved, taskId), 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("I-03 spine state validate rejects corrupt batch-state", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-incident-i03-"));
	try {
		saveSpineBatchState(root, {
			batchId: "bad",
			phase: "running",
			lastError: "plain string not object",
		});
		const result = runSpineState({ projectRoot: root, args: ["validate"] });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /validation failed/i);
		assert.match(result.output, /spine state validate --diagnose/);

		const valid = createInitialBatchState({
			batchId: "20260601T120000",
			baseBranch: "main",
			orchBranch: "orch/spine-20260601T120000",
			wavePlan: [["TP-014"]],
			tasks: [
				{
					taskId: "TP-014",
					laneNumber: 1,
					status: "pending",
					taskFolder: "taskplane-tasks/TP-014-smoke",
					startedAt: null,
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: ".worktrees/spine-20260601T120000/lane-1",
					branch: "task/spine-lane-1-20260601T120000",
					taskIds: ["TP-014"],
					lastHeartbeatAt: null,
				},
			],
		});
		assert.equal(validateBatchState(valid).ok, true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("I-04 spine batch abort archives batch-state before clearing active file", async () => {
	const projectRoot = await initGitRepo("spine-incident-i04-");
	try {
		const batchId = "20260601T170000";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [["TP-999"]],
			tasks: [
				{
					taskId: "TP-999",
					laneNumber: 1,
					status: "running",
					taskFolder: "taskplane-tasks/TP-999-smoke",
					startedAt: Date.now(),
					endedAt: null,
					doneFileFound: false,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, batchId, 1),
					branch: laneTaskBranch(batchId, 1),
					taskIds: ["TP-999"],
					lastHeartbeatAt: null,
					workerPid: 999999,
				},
			],
		});
		state.phase = "running";
		saveSpineBatchState(projectRoot, state);

		const activePath = spineBatchStatePath(projectRoot);
		assert.ok(fs.existsSync(activePath));
		const result = abortBatch({ projectRoot, reason: "operator abort" });
		assert.equal(result.ok, true);

		const archivePath = archiveBatchStatePath(projectRoot, batchId);
		assert.ok(fs.existsSync(archivePath), "archive must exist");
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");
		assert.equal(defaultSegmentId("TP-999"), "TP-999::default");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("I-05 wave merge blocked on failed/pending tasks; force-merge override exists", async () => {
	const projectRoot = await initGitRepo("spine-incident-i05-");
	try {
		const state = {
			wavePlan: [["TP-997", "TP-998"]],
			tasks: [
				{ taskId: "TP-997", status: "succeeded" },
				{ taskId: "TP-998", status: "failed" },
			],
			resilience: { forceMergedWaves: [] },
		};
		const blocked = assessWaveMergeEligibility(state, 0);
		assert.equal(blocked.ok, false);
		assert.deepEqual(blocked.failedTaskIds, ["TP-998"]);

		writeFailedBatch(projectRoot);
		const force = forceMergeWave({ projectRoot, waveIndex: 0 });
		assert.equal(force.ok, true);
		const saved = JSON.parse(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"));
		assert.ok(saved.resilience?.forceMergedWaves?.includes(0));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("I-06 retry refused while batch phase is executing or merging", async () => {
	const projectRoot = await initGitRepo("spine-incident-i06-");
	try {
		const { taskId } = writeFailedBatch(projectRoot);
		for (const phase of ["running", "merging"]) {
			const state = JSON.parse(fs.readFileSync(spineBatchStatePath(projectRoot), "utf-8"));
			state.phase = phase;
			saveSpineBatchState(projectRoot, state);
			const result = retryTask({ projectRoot, taskId });
			assert.equal(result.ok, false, `expected retry blocked in phase ${phase}`);
			assert.equal(result.error, "cannot_retry");
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("I-07 stall logic uses STATUS, lane commit, and file-scope mtime signals", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-i07-"));
	const statusPath = path.join(dir, "STATUS.md");
	const scopeFile = path.join(dir, "src", "scoped.txt");
	fs.mkdirSync(path.dirname(scopeFile), { recursive: true });
	fs.writeFileSync(statusPath, "step 0", "utf-8");
	fs.writeFileSync(scopeFile, "v1", "utf-8");

	const first = collectProgressSignals({
		worktreePath: dir,
		taskFolder: dir,
		fileScopePaths: ["src/scoped.txt"],
	});
	assert.ok(first.statusMtimeMs);
	assert.ok(first.fileScopeMtimeMs);

	fs.writeFileSync(scopeFile, "v2", "utf-8");
	const second = collectProgressSignals({
		worktreePath: dir,
		taskFolder: dir,
		fileScopePaths: ["src/scoped.txt"],
	});
	assert.equal(activitySignalsChanged(first, second), true);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("I-08 post-mortem does not claim success when failures exist", async () => {
	const projectRoot = await initGitRepo("spine-incident-i08-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".pi", "batch-state.json"),
			JSON.stringify(fixture, null, 2),
			"utf-8",
		);
		const reconciliation = reconcileBatch({ projectRoot, verbose: true });
		const md = generateBatchPostMortem(fixture, [], reconciliation, projectRoot);
		assert.match(md, /TP-002/);
		assert.doesNotMatch(md, /ran smoothly/i);
		assert.doesNotMatch(md, /completed successfully/i);
		const headline = buildPostMortemHeadline(reconciliation, fixture);
		assert.doesNotMatch(headline, /ran smoothly/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("I-09 CONTEXT documents serial bootstrap and preflight execution policy", () => {
	assert.ok(fs.existsSync(CONTEXT_PATH), "spine-tasks/CONTEXT.md must exist");
	const content = fs.readFileSync(CONTEXT_PATH, "utf-8");
	assert.match(content, /Execution policy/i);
	assert.match(content, /Preflight/i);
	assert.match(content, /Never.*hand-edit.*batch-state/i);
});

test("I-10 runStepReview fail-closed when review tool unavailable at level > 0", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-incident-i10-"));
	const taskFolder = writeReviewTask(root, 2);
	try {
		const result = await runStepReview({
			taskFolder,
			worktreePath: root,
			stepNumber: 1,
			reviewType: "plan",
			stubFail: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.spawnFailed, true);
		assert.equal(result.exitCode, 1);
		assert.notEqual(result.verdict, "APPROVE");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
