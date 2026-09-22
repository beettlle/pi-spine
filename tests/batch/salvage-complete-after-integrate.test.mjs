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
import { archiveBatchStatePath, completeBatch } from "../../src/batch/lifecycle.mjs";
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
		appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-771", laneNumber: 2 });
		appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
			taskId: "SP-771",
			exitReason: "contract_failed",
			classification: "contract_failed",
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
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
