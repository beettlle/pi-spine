import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import {
	approveIntegrateGate,
	checkIntegrateGate,
	gateRecordPath,
	openIntegrateGate,
	reopenIntegrateGateForCompletedBatch,
} from "../../src/batch/gate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { validateGateTargetRevision } from "../../src/batch/gate-revision.mjs";
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

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

function tipSha(projectRoot, ref) {
	return execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function advanceOrch(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-drift.txt"), "post-approve orch drift", "utf-8");
	execFileSync("git", ["add", "orch-drift.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch drift"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("validateGateTargetRevision matches pinned orch tip", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-match-");
	const orchBranch = "orch/spine-rev-match";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const pinned = tipSha(projectRoot, orchBranch);
		const result = validateGateTargetRevision(
			projectRoot,
			{ targetRevision: pinned },
			{ orchBranch },
		);
		assert.equal(result.ok, true);
		assert.equal(result.currentRevision, pinned);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("validateGateTargetRevision fails closed on mismatch", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-mismatch-");
	const orchBranch = "orch/spine-rev-mismatch";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const pinned = tipSha(projectRoot, orchBranch);
		advanceOrch(projectRoot, orchBranch);
		const current = tipSha(projectRoot, orchBranch);
		assert.notEqual(pinned, current);

		const result = validateGateTargetRevision(
			projectRoot,
			{ targetRevision: pinned },
			{ orchBranch },
		);
		assert.equal(result.ok, false);
		assert.equal(result.reason, "mismatch");
		assert.equal(result.pinnedRevision, pinned);
		assert.equal(result.currentRevision, current);
		assert.match(result.error, /re-open and re-approve/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate allows approved gate when targetRevision matches", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-check-ok-");
	const batchId = "20260712T130000";
	const orchBranch = "orch/spine-rev-check-ok";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		approveIntegrateGate({ projectRoot, batchId });

		const allowed = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			batchState: fixture,
		});
		assert.equal(allowed.ok, true);
		assert.equal(allowed.required, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate blocks approved gate when targetRevision drifts", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-check-drift-");
	const batchId = "20260712T130100";
	const orchBranch = "orch/spine-rev-check-drift";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		const pinned = opened.gate.targetRevision;
		approveIntegrateGate({ projectRoot, batchId });

		advanceOrch(projectRoot, orchBranch);
		const current = tipSha(projectRoot, orchBranch);
		assert.notEqual(pinned, current);

		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			batchState: fixture,
		});
		assert.equal(blocked.ok, false);
		assert.equal(blocked.exitCode, 2);
		assert.equal(blocked.failureClass, "GateBlocked");
		assert.equal(blocked.pinnedRevision, pinned);
		assert.equal(blocked.currentRevision, current);
		assert.match(blocked.error, /targetRevision drifted/i);
		assert.match(blocked.headline, /stale/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate blocks approved gate with missing targetRevision pin", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-check-missing-");
	const batchId = "20260712T130200";
	const orchBranch = "orch/spine-rev-check-missing";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		approveIntegrateGate({ projectRoot, batchId });

		const gatePath = gateRecordPath(projectRoot, batchId);
		const gate = JSON.parse(fs.readFileSync(gatePath, "utf-8"));
		delete gate.targetRevision;
		fs.writeFileSync(gatePath, JSON.stringify(gate, null, 2), "utf-8");

		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			batchState: fixture,
		});
		assert.equal(blocked.ok, false);
		assert.equal(blocked.exitCode, 2);
		assert.equal(blocked.failureClass, "GateBlocked");
		assert.match(blocked.error, /no targetRevision pin/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reopenIntegrateGateForCompletedBatch re-pins stale gate and re-collects evidence (#275)", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-drift-");
	const batchId = "20260712T130300";
	const orchBranch = "orch/spine-reopen-drift";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture });
		approveIntegrateGate({ projectRoot, batchId });
		advanceOrch(projectRoot, orchBranch);

		const reopened = reopenIntegrateGateForCompletedBatch({ projectRoot, batchId });
		assert.equal(reopened.ok, true, reopened.error);
		assert.equal(reopened.reopened, true);
		assert.equal(reopened.reason, "reopened");
		assert.notEqual(reopened.gate.gateId, opened.gate.gateId);
		assert.equal(reopened.gate.status, "pending");
		assert.equal(reopened.gate.targetRevision, tipSha(projectRoot, orchBranch));
		assert.equal(reopened.suggestedCommand, "spine gate approve");
		assert.ok(Array.isArray(reopened.gate.evidenceRefs));

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "gate.reopened"));
		assert.ok(events.some((event) => event.type === "gate.opened"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reopenIntegrateGateForCompletedBatch refuses to invalidate a current approval", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-current-");
	const batchId = "20260712T130301";
	const orchBranch = "orch/spine-reopen-current";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture });
		approveIntegrateGate({ projectRoot, batchId });

		const result = reopenIntegrateGateForCompletedBatch({ projectRoot, batchId });
		assert.equal(result.ok, true);
		assert.equal(result.reopened, false);
		assert.equal(result.reason, "gate_current");
		assert.equal(result.suggestedCommand, "spine integrate");

		const onDisk = JSON.parse(fs.readFileSync(gateRecordPath(projectRoot, batchId), "utf-8"));
		assert.equal(onDisk.gateId, opened.gate.gateId);
		assert.equal(onDisk.status, "approved");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reopenIntegrateGateForCompletedBatch leaves pending gate with current pin untouched", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-pending-");
	const batchId = "20260712T130302";
	const orchBranch = "orch/spine-reopen-pending";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture });

		const result = reopenIntegrateGateForCompletedBatch({ projectRoot, batchId });
		assert.equal(result.ok, true);
		assert.equal(result.reopened, false);
		assert.equal(result.reason, "gate_pending");
		assert.equal(result.suggestedCommand, "spine gate approve");

		const onDisk = JSON.parse(fs.readFileSync(gateRecordPath(projectRoot, batchId), "utf-8"));
		assert.equal(onDisk.gateId, opened.gate.gateId);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reopenIntegrateGateForCompletedBatch opens a fresh gate when record is missing", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-missing-");
	const batchId = "20260712T130303";
	const orchBranch = "orch/spine-reopen-missing";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, batchId)), false);

		const result = reopenIntegrateGateForCompletedBatch({ projectRoot, batchId });
		assert.equal(result.ok, true, result.error);
		assert.equal(result.reopened, true);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));
		assert.equal(result.gate.status, "pending");
		assert.equal(result.gate.targetRevision, tipSha(projectRoot, orchBranch));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reopenIntegrateGateForCompletedBatch refuses non-completed batch", async () => {
	const projectRoot = await initGitRepo("spine-gate-reopen-paused-");
	const batchId = "20260712T130304";
	const orchBranch = "orch/spine-reopen-paused";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = { ...completedFixture(batchId, orchBranch), phase: "paused" };

		const result = reopenIntegrateGateForCompletedBatch({
			projectRoot,
			batchId,
			batchState: fixture,
		});
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.equal(result.reason, "batch_not_completed");
		assert.match(result.error, /phase paused/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
