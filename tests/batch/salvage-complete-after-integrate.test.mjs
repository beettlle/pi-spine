/**
 * SP-763 — `spine batch complete` must not refuse after salvage --integrate (#292).
 *
 * A batch that failed after a worker wrote `.DONE` keeps failed-task bits in the
 * active batch state (task status "failed", failed segment, failedTasks counter).
 * Salvage integrate lands that lane work on main, but complete still refused with
 * needs_retry, forcing operators to `dismiss --force`. After a successful salvage
 * integrate the salvaged tasks are healed to succeeded; unrelated unresolved
 * failures must still block complete.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { archiveBatchStatePath, completeBatch, dismissBatch } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import { integrateSalvageableLane } from "../../src/batch/salvage-batch.mjs";
import { createInitialBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260921T101500";
const BATCH_STATE_REL = path.join(".spine", "batch-state.json");

/** Salvageable failure: worker finished the lane (`.DONE` committed) but the task was marked failed afterwards (#292 / SP-762 family). */
function salvageableFailedTask(overrides = {}) {
	return {
		taskId: "SP-770",
		laneNumber: 1,
		status: "failed",
		taskFolder: "SP-770-fixture",
		doneFileFound: true,
		exitReason: "plan_review_spawn_failed",
		...overrides,
	};
}

/** Unresolved failure: no done evidence and a non-salvageable exit reason. */
function unresolvedFailedTask(overrides = {}) {
	return {
		taskId: "SP-771",
		laneNumber: 2,
		status: "failed",
		taskFolder: "SP-771-fixture",
		doneFileFound: false,
		exitReason: "contract_failed",
		...overrides,
	};
}

/**
 * #374 dogfood variant: the land loop merged wave work into the batch orch
 * branch before dying, so the orch branch has commits that never reached base
 * (`orchMergedToBase` false, `mergeResults` empty) even though salvage later
 * landed the lane task branches onto base directly.
 *
 * @param {string} projectRoot
 */
function advanceOrchBranchWithOrphanCommit(projectRoot) {
	execFileSync("git", ["checkout", `orch/spine-${BATCH_ID}`], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(
		path.join(projectRoot, "orch-orphan.txt"),
		"wave 0 lane merge landed on orch before the land loop died\n",
		"utf-8",
	);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "wave 0 land loop merge (engine died before orch to base)"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Write an ACTIVE (not archived) failed batch state — the #292 precondition for
 * `spine batch complete` to be reachable at all.
 *
 * @param {string} projectRoot
 * @param {object[]} tasks
 */
function writeActiveFailedBatch(projectRoot, tasks) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [tasks.map((task) => task.taskId)],
		tasks,
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-770"] },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-771"] },
		],
	});
	state.phase = "failed";
	state.endedAt = Date.now();
	state.lastError = "plan review spawn failed after .DONE";
	// Failed-task bits as the engine records them on failure (#292).
	for (const segment of state.segments ?? []) {
		if (tasks.some((task) => task.taskId === segment.taskId && task.status === "failed")) {
			segment.status = "failed";
		}
	}

	// The engine creates the orch branch from base at batch start; salvage must
	// land it on main for `orchMergedToBase` to hold after integrate.
	execFileSync("git", ["branch", `orch/spine-${BATCH_ID}`, "main"], { cwd: projectRoot, stdio: "ignore" });

	fs.mkdirSync(path.dirname(path.join(projectRoot, BATCH_STATE_REL)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, BATCH_STATE_REL), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	return state;
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.includeSecondTask]
 */
function seedSalvageJournal(projectRoot, options = {}) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-770", laneNumber: 1 });
	appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
		taskId: "SP-770",
		laneNumber: 1,
		commitSha: "lane1sha",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
		taskId: "SP-770",
		exitReason: "plan_review_spawn_failed",
		classification: "plan_review_spawn_failed",
	});
	if (options.includeSecondTask) {
		const exitReason = options.secondTaskSalvageable ? "plan_review_spawn_failed" : "contract_failed";
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-771", laneNumber: 2 });
		if (options.secondTaskSalvageable) {
			appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
				taskId: "SP-771",
				laneNumber: 2,
				commitSha: "lane2sha",
			});
		}
		appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
			taskId: "SP-771",
			exitReason,
			classification: exitReason,
		});
	}
	appendJournalEvent(projectRoot, BATCH_ID, "batch.failed", { reason: "task_failed", taskId: "SP-770" });
}

/**
 * Commit lane work — including the task `.DONE` marker — on the lane task branch.
 *
 * @param {string} projectRoot
 * @param {number} laneNumber
 * @param {string} fileName
 * @param {string} taskFolder
 */
function commitLaneBranchWork(projectRoot, laneNumber, fileName, taskFolder) {
	const branch = laneTaskBranch(BATCH_ID, laneNumber);
	execFileSync("git", ["branch", branch, "main"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", branch], { cwd: projectRoot, stdio: "ignore" });
	fs.mkdirSync(path.join(projectRoot, "spine-tasks", taskFolder), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, "spine-tasks", taskFolder, ".DONE"), `done lane ${laneNumber}\n`, "utf-8");
	fs.writeFileSync(path.join(projectRoot, fileName), `lane ${laneNumber} work\n`, "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", `lane ${laneNumber} salvage work`], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {object} batchState
 */
function approveGateForSalvage(projectRoot, batchState) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId: BATCH_ID, batchState, config });
	approveIntegrateGate({ projectRoot, batchId: BATCH_ID });
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function readActiveState(projectRoot) {
	return JSON.parse(fs.readFileSync(path.join(projectRoot, BATCH_STATE_REL), "utf-8"));
}

test("salvage integrate heals the salvaged task and complete succeeds (#292)", async () => {
	const projectRoot = await initGitRepo("salvage-complete-ok-");
	try {
		const batchState = writeActiveFailedBatch(projectRoot, [salvageableFailedTask()]);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-complete-ok.txt", "SP-770-fixture");
		approveGateForSalvage(projectRoot, batchState);

		// Pre-salvage: complete refuses while the failed-task bits are set.
		const before = completeBatch({ projectRoot });
		assert.equal(before.ok, false);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(result.healedTaskIds, ["SP-770"]);

		// Batch state healed: task, segment, and counters.
		const healed = readActiveState(projectRoot);
		assert.equal(healed.tasks.find((task) => task.taskId === "SP-770")?.status, "succeeded");
		assert.equal(healed.segments.find((segment) => segment.taskId === "SP-770")?.status, "succeeded");
		assert.equal(healed.failedTasks, 0);
		assert.equal(healed.succeededTasks, 1);

		// Journal records the heal so rebuilds agree with the persisted state.
		const events = readJournalEvents(projectRoot, BATCH_ID);
		const healedEvent = events.find(
			(event) =>
				event.type === "task.completed" &&
				(event.taskId ?? event.payload?.taskId) === "SP-770" &&
				event.payload?.reconcileReason === "salvage_integrated",
		);
		assert.ok(healedEvent, "expected reconciled task.completed journal event");

		// The #292 contract: complete succeeds without dismiss --force.
		const completed = completeBatch({ projectRoot });
		assert.equal(completed.ok, true);
		assert.equal(completed.diagnosis, "completed");
		assert.ok(!fs.existsSync(path.join(projectRoot, BATCH_STATE_REL)));
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, BATCH_ID)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("salvage integrate heals the salvaged task and complete --detect-manual-merge succeeds", async () => {
	const projectRoot = await initGitRepo("salvage-complete-manual-");
	try {
		const batchState = writeActiveFailedBatch(projectRoot, [salvageableFailedTask()]);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-complete-manual.txt", "SP-770-fixture");
		approveGateForSalvage(projectRoot, batchState);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(result.ok, true);

		const completed = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(completed.ok, true);
		assert.equal(completed.diagnosis, "completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("complete still refuses when unresolved failed tasks remain after salvage integrate", async () => {
	const projectRoot = await initGitRepo("salvage-complete-blocked-");
	try {
		const batchState = writeActiveFailedBatch(projectRoot, [
			salvageableFailedTask(),
			unresolvedFailedTask(),
		]);
		seedSalvageJournal(projectRoot, { includeSecondTask: true });
		commitLaneBranchWork(projectRoot, 1, "salvage-complete-blocked.txt", "SP-770-fixture");
		approveGateForSalvage(projectRoot, batchState);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(result.ok, true);
		assert.deepEqual(result.healedTaskIds, ["SP-770"]);

		// SP-770 healed, SP-771 untouched.
		const healed = readActiveState(projectRoot);
		assert.equal(healed.tasks.find((task) => task.taskId === "SP-770")?.status, "succeeded");
		assert.equal(healed.tasks.find((task) => task.taskId === "SP-771")?.status, "failed");
		assert.equal(healed.failedTasks, 1);

		// Unresolved failure still blocks complete.
		const refused = completeBatch({ projectRoot });
		assert.equal(refused.ok, false);
		assert.match(refused.headline ?? "", /complete refused/i);
		assert.ok(fs.existsSync(path.join(projectRoot, BATCH_STATE_REL)));
		assert.ok(!fs.existsSync(archiveBatchStatePath(projectRoot, BATCH_ID)));

		// Unresolved failure still blocks non-force dismiss (SP-862 fail-closed).
		const dismissRefused = dismissBatch({ projectRoot });
		assert.equal(dismissRefused.ok, false);
		assert.match(dismissRefused.headline ?? "", /dismiss refused/i);
		assert.ok(fs.existsSync(path.join(projectRoot, BATCH_STATE_REL)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * #374 core scenario: salvageable-only failed batch whose orch branch has
 * orphan land-loop commits (never merged to base). Runs salvage integrate and
 * asserts the heal + salvage-land evidence.
 *
 * @param {string} projectRoot
 * @param {object} [options]
 * @param {boolean} [options.includeSecondSalvageableLane] seed a second salvageable lane 2 task (not salvaged here)
 */
async function runOrchOrphanSalvageScenario(projectRoot, options = {}) {
	const tasks = [salvageableFailedTask()];
	if (options.includeSecondSalvageableLane) {
		tasks.push(
			salvageableFailedTask({
				taskId: "SP-771",
				laneNumber: 2,
				taskFolder: "SP-771-fixture",
			}),
		);
	}
	const batchState = writeActiveFailedBatch(projectRoot, tasks);
	advanceOrchBranchWithOrphanCommit(projectRoot);
	seedSalvageJournal(projectRoot, { includeSecondTask: options.includeSecondSalvageableLane === true });
	commitLaneBranchWork(projectRoot, 1, "salvage-orch-orphan.txt", "SP-770-fixture");
	if (options.includeSecondSalvageableLane) {
		commitLaneBranchWork(projectRoot, 2, "salvage-orch-orphan-lane2.txt", "SP-771-fixture");
	}
	approveGateForSalvage(projectRoot, batchState);

	// #374 step 5: complete refuses before salvage (lane merges pending).
	const before = completeBatch({ projectRoot });
	assert.equal(before.ok, false);

	return integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
		yes: true,
		confirmFn: async () => true,
	});
}

test("salvage integrate lands merge evidence and complete succeeds even when the orch branch never merged (#374)", async () => {
	const projectRoot = await initGitRepo("salvage-complete-orch-orphan-");
	try {
		const result = await runOrchOrphanSalvageScenario(projectRoot);
		assert.equal(result.ok, true);
		assert.deepEqual(result.healedTaskIds, ["SP-770"]);

		// Salvage-land evidence: heal left zero unresolved tasks.
		const healed = readActiveState(projectRoot);
		assert.ok(healed.salvageLandedAllTasks, "expected salvageLandedAllTasks evidence");
		assert.deepEqual(healed.salvageLandedAllTasks.tasks, ["SP-770"]);
		assert.ok(healed.salvageLandedAllTasks.mergeCommit);
		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(
			events.find((event) => event.type === "batch.salvage_landed_all_tasks"),
			"expected batch.salvage_landed_all_tasks journal event",
		);

		// The #374 contract: complete succeeds without --force even though the
		// orch branch never merged (needs_merge diagnosis pre-fix).
		const completed = completeBatch({ projectRoot });
		assert.equal(completed.ok, true);
		assert.equal(completed.diagnosis, "completed");
		assert.ok(!fs.existsSync(path.join(projectRoot, BATCH_STATE_REL)));
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, BATCH_ID)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("complete --detect-manual-merge succeeds after salvage land when the orch branch never merged (#374)", async () => {
	const projectRoot = await initGitRepo("salvage-complete-orch-manual-");
	try {
		const result = await runOrchOrphanSalvageScenario(projectRoot);
		assert.equal(result.ok, true);

		const completed = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(completed.ok, true);
		assert.equal(completed.diagnosis, "completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("dismiss without --force succeeds after salvage land when the orch branch never merged (#374)", async () => {
	const projectRoot = await initGitRepo("salvage-dismiss-after-salvage-");
	try {
		const result = await runOrchOrphanSalvageScenario(projectRoot);
		assert.equal(result.ok, true);
		assert.deepEqual(result.healedTaskIds, ["SP-770"]);

		// needs_merge diagnosis is outside DISMISS_ALLOWED — the salvage-land
		// evidence must clear the gate without --force (SP-862).
		const dismissed = dismissBatch({ projectRoot });
		assert.equal(dismissed.ok, true);
		assert.ok(!fs.existsSync(path.join(projectRoot, BATCH_STATE_REL)));
		assert.ok(fs.existsSync(archiveBatchStatePath(projectRoot, BATCH_ID)));
		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.find((event) => event.type === "batch.dismissed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("multi-lane salvage: complete stays blocked until every salvageable lane is landed, then succeeds (#374)", async () => {
	const projectRoot = await initGitRepo("salvage-complete-multilane-");
	try {
		const batchState = writeActiveFailedBatch(projectRoot, [
			salvageableFailedTask(),
			salvageableFailedTask({
				taskId: "SP-771",
				laneNumber: 2,
				taskFolder: "SP-771-fixture",
			}),
		]);
		seedSalvageJournal(projectRoot, { includeSecondTask: true, secondTaskSalvageable: true });
		commitLaneBranchWork(projectRoot, 1, "salvage-multilane-1.txt", "SP-770-fixture");
		commitLaneBranchWork(projectRoot, 2, "salvage-multilane-2.txt", "SP-771-fixture");
		approveGateForSalvage(projectRoot, batchState);

		// Land lane 1 only: SP-771 is salvageable but still unlanded — block.
		const lane1 = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(lane1.ok, true);
		assert.deepEqual(lane1.healedTaskIds, ["SP-770"]);
		let midway = readActiveState(projectRoot);
		assert.equal(midway.salvageLandedAllTasks, undefined, "no evidence while a salvageable task is unresolved");
		const blocked = completeBatch({ projectRoot });
		assert.equal(blocked.ok, false);

		// Land lane 2: zero unresolved tasks remain — evidence + complete.
		const lane2 = await integrateSalvageableLane(projectRoot, BATCH_ID, 2, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(lane2.ok, true);
		assert.deepEqual(lane2.healedTaskIds, ["SP-771"]);
		midway = readActiveState(projectRoot);
		assert.deepEqual(midway.salvageLandedAllTasks?.tasks, ["SP-771"]);

		const completed = completeBatch({ projectRoot });
		assert.equal(completed.ok, true);
		assert.equal(completed.diagnosis, "completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
