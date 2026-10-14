/**
 * SP-824 — gate streak reset failure fails closed and is journaled (#314).
 *
 * A failed streak reset must never leave a stale consecutive-approval count
 * that could unlock auto-approval, and both streak I/O failure paths
 * (increment on approve, reset on reject) must be journaled as
 * `gate.streak_io_failed`. Uses the `ctx.streakIo` injection seam — no
 * `SPINE_TEST_*` environment hooks.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	approveIntegrateGate,
	loadGateRecord,
	maybeAutoApproveIntegrateGate,
	openIntegrateGate,
	rejectIntegrateGate,
} from "../../src/batch/gate.mjs";
import { getCategoryStreak } from "../../src/batch/gate-posture-streak.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function completedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "TP-012", status: "succeeded", taskFolder: "TP-012", doneFileFound: true }],
	};
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} orchBranch
 * @param {object|null} config
 */
function openPendingGate(projectRoot, batchId, orchBranch, config = null) {
	createOrchWithWork(projectRoot, orchBranch);
	return openIntegrateGate({
		projectRoot,
		batchId,
		batchState: completedFixture(batchId, orchBranch),
		config,
	});
}

/** Config with the `write` category opted in for auto-approval after 2 approvals. */
function writePostureConfig() {
	return {
		gates: {
			integrateCategory: "write",
			postures: {
				write: { posture: "permissive", autoApproveAfterN: 2 },
			},
		},
	};
}

/** Streak I/O stub whose reset operations always throw. */
function throwingResetIo() {
	return {
		resetCategoryStreak() {
			throw new Error("injected reset failure");
		},
		resetKindStreak() {
			throw new Error("injected reset failure");
		},
	};
}

/** Streak I/O stub whose increment operations always throw. */
function throwingIncrementIo() {
	return {
		incrementCategoryStreak() {
			throw new Error("injected increment failure");
		},
		incrementKindStreak() {
			throw new Error("injected increment failure");
		},
	};
}

/**
 * First streak_io_failed event in a batch journal, if any.
 * @param {string} projectRoot
 * @param {string} batchId
 */
function findStreakIoFailedEvent(projectRoot, batchId) {
	return readJournalEvents(projectRoot, batchId).find(
		(event) => event?.type === "gate.streak_io_failed",
	);
}

test("failed streak reset with working recovery: journaled recovered:true, next gate not auto-approved (streak zero)", async () => {
	const projectRoot = await initGitRepo("spine-gate-streak-reset-ok-");
	try {
		const config = writePostureConfig();

		// Two human approvals bring the consecutive-approval streak to 2.
		const batchA = "20261014T120001";
		openPendingGate(projectRoot, batchA, "orch/spine-gate-streak-reset-ok-a", config);
		approveIntegrateGate({ projectRoot, batchId: batchA });
		assert.equal(getCategoryStreak(projectRoot, "write"), 1);

		const batchB = "20261014T120002";
		openPendingGate(projectRoot, batchB, "orch/spine-gate-streak-reset-ok-b", config);
		approveIntegrateGate({ projectRoot, batchId: batchB });
		assert.equal(getCategoryStreak(projectRoot, "write"), 2);

		// Reject with a throwing reset — fail-closed recovery (file removal) works.
		const batchC = "20261014T120003";
		openPendingGate(projectRoot, batchC, "orch/spine-gate-streak-reset-ok-c", config);
		const rejected = rejectIntegrateGate({
			projectRoot,
			batchId: batchC,
			reason: "break streak",
			streakIo: throwingResetIo(),
		});
		assert.equal(rejected.ok, true);
		assert.equal(loadGateRecord(projectRoot, batchC).status, "rejected");

		const failureEvent = findStreakIoFailedEvent(projectRoot, batchC);
		assert.ok(failureEvent, "gate.streak_io_failed journaled");
		assert.equal(failureEvent.payload.op, "reset");
		assert.equal(failureEvent.payload.category, "write");
		assert.equal(failureEvent.payload.kind, "integrate");
		assert.match(failureEvent.payload.error, /injected reset failure/);
		assert.equal(failureEvent.payload.recovered, true);

		// Fail-closed recovery removed the streak file → zero counts.
		assert.equal(getCategoryStreak(projectRoot, "write"), 0);

		// The next gate must NOT auto-approve on the failed-closed zero streak.
		const batchD = "20261014T120004";
		openPendingGate(projectRoot, batchD, "orch/spine-gate-streak-reset-ok-d", config);
		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId: batchD, config });
		assert.equal(result.approved, false);
		assert.notEqual(result.reason, "streak_unreliable");
		assert.equal(loadGateRecord(projectRoot, batchD).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("failed streak reset with failing recovery: journaled recovered:false, next gate returns streak_unreliable before reading streak", async () => {
	const projectRoot = await initGitRepo("spine-gate-streak-reset-dead-");
	try {
		const config = writePostureConfig();

		const batchA = "20261014T120011";
		openPendingGate(projectRoot, batchA, "orch/spine-gate-streak-dead-a", config);
		approveIntegrateGate({ projectRoot, batchId: batchA });

		const batchB = "20261014T120012";
		openPendingGate(projectRoot, batchB, "orch/spine-gate-streak-dead-b", config);
		approveIntegrateGate({ projectRoot, batchId: batchB });
		assert.equal(getCategoryStreak(projectRoot, "write"), 2);

		// Reject with throwing resets AND a throwing streak-file removal.
		const batchC = "20261014T120013";
		openPendingGate(projectRoot, batchC, "orch/spine-gate-streak-dead-c", config);
		const rejected = rejectIntegrateGate({
			projectRoot,
			batchId: batchC,
			reason: "break streak",
			streakIo: {
				...throwingResetIo(),
				removeStreakFile() {
					throw new Error("injected recovery failure");
				},
			},
		});
		assert.equal(rejected.ok, true);

		const failureEvent = findStreakIoFailedEvent(projectRoot, batchC);
		assert.ok(failureEvent, "gate.streak_io_failed journaled");
		assert.equal(failureEvent.payload.op, "reset");
		assert.equal(failureEvent.payload.recovered, false);
		assert.match(failureEvent.payload.recoveryError, /injected recovery failure/);

		// The stale streak (2) survives on disk — the early return must fire
		// BEFORE reading it, returning streak_unreliable instead of auto-approving.
		const batchD = "20261014T120014";
		openPendingGate(projectRoot, batchD, "orch/spine-gate-streak-dead-d", config);
		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId: batchD, config });
		assert.equal(result.approved, false);
		assert.equal(result.reason, "streak_unreliable");
		assert.equal(result.evaluation?.decision, "require-manual");
		assert.equal(result.consecutiveApprovals, null);
		assert.equal(loadGateRecord(projectRoot, batchD).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("failed streak increment on approve: approval persists, increment failure journaled", async () => {
	const projectRoot = await initGitRepo("spine-gate-streak-inc-fail-");
	try {
		const batchA = "20261014T120021";
		openPendingGate(
			projectRoot,
			batchA,
			"orch/spine-gate-streak-inc-fail-a",
			writePostureConfig(),
		);
		const approved = approveIntegrateGate({
			projectRoot,
			batchId: batchA,
			streakIo: throwingIncrementIo(),
		});
		assert.equal(approved.ok, true);

		// A streak I/O failure never reverses a persisted approve.
		const gate = loadGateRecord(projectRoot, batchA);
		assert.equal(gate.status, "approved");
		assert.equal(gate.decidedBy, "human");

		const failureEvent = findStreakIoFailedEvent(projectRoot, batchA);
		assert.ok(failureEvent, "gate.streak_io_failed journaled");
		assert.equal(failureEvent.payload.op, "increment");
		assert.equal(failureEvent.payload.category, "write");
		assert.equal(failureEvent.payload.kind, "integrate");
		assert.match(failureEvent.payload.error, /injected increment failure/);
		assert.equal(failureEvent.payload.recovered, undefined);

		// Increment failure only delays auto-approval (safe direction): streak is 0.
		assert.equal(getCategoryStreak(projectRoot, "write"), 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("happy path unchanged: reject with working I/O resets streak and journals no failure", async () => {
	const projectRoot = await initGitRepo("spine-gate-streak-happy-");
	try {
		const config = writePostureConfig();

		const batchA = "20261014T120031";
		openPendingGate(projectRoot, batchA, "orch/spine-gate-streak-happy-a", config);
		approveIntegrateGate({ projectRoot, batchId: batchA });
		assert.equal(getCategoryStreak(projectRoot, "write"), 1);

		const batchB = "20261014T120032";
		openPendingGate(projectRoot, batchB, "orch/spine-gate-streak-happy-b", config);
		const rejected = rejectIntegrateGate({
			projectRoot,
			batchId: batchB,
			reason: "break streak",
		});
		assert.equal(rejected.ok, true);

		assert.equal(getCategoryStreak(projectRoot, "write"), 0);
		const failureEvent = findStreakIoFailedEvent(projectRoot, batchB);
		assert.equal(failureEvent, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
