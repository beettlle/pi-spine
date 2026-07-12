import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import {
	approveIntegrateGate,
	checkIntegrateGate,
	openIntegrateGate,
	rejectIntegrateGate,
} from "../../src/batch/gate.mjs";
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

/**
 * @param {object} result
 * @param {string} code
 * @param {string} [headlinePattern]
 */
function assertBlockerCode(result, code, headlinePattern) {
	assert.ok(Array.isArray(result.blockers), "expected blockers array");
	assert.equal(result.blockers.length, 1);
	assert.equal(result.blockers[0].code, code);
	assert.equal(typeof result.blockers[0].message, "string");
	assert.ok(result.blockers[0].message.trim().length > 0);
	assert.equal(result.blockers[0].message, result.error);
	if (headlinePattern) {
		assert.match(result.headline, headlinePattern);
	}
}

test("checkIntegrateGate exposes missing_gate blocker when gate absent", async () => {
	const projectRoot = await initGitRepo("spine-blocker-missing-");
	const batchId = "20260712T140000";
	try {
		const config = loadSpineConfig(projectRoot).config;
		const blocked = checkIntegrateGate({ projectRoot, batchId, config });
		assert.equal(blocked.ok, false);
		assert.equal(blocked.exitCode, 2);
		assertBlockerCode(
			blocked,
			"missing_gate",
			/Integrate blocked — no gate record/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate exposes gate_pending blocker for pending gate", async () => {
	const projectRoot = await initGitRepo("spine-blocker-pending-");
	const batchId = "20260712T140100";
	const orchBranch = "orch/spine-blocker-pending";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			batchState: fixture,
		});
		assert.equal(blocked.ok, false);
		assertBlockerCode(blocked, "gate_pending", /gate pending approval/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate exposes gate_rejected blocker for rejected gate", async () => {
	const projectRoot = await initGitRepo("spine-blocker-rejected-");
	const batchId = "20260712T140200";
	const orchBranch = "orch/spine-blocker-rejected";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		rejectIntegrateGate({ projectRoot, batchId, reason: "evidence incomplete" });
		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			batchState: fixture,
		});
		assert.equal(blocked.ok, false);
		assertBlockerCode(blocked, "gate_rejected", /gate rejected/);
		assert.equal(blocked.blockers[0].message, "evidence incomplete");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate exposes stale_revision blocker on targetRevision drift", async () => {
	const projectRoot = await initGitRepo("spine-blocker-stale-");
	const batchId = "20260712T140300";
	const orchBranch = "orch/spine-blocker-stale";
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
		assertBlockerCode(blocked, "stale_revision", /stale/);
		assert.match(blocked.error, /targetRevision drifted/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate exposes force_integrate_blocked without SPINE_ALLOW_FORCE", async () => {
	const projectRoot = await initGitRepo("spine-blocker-force-");
	const batchId = "20260712T140400";
	const previous = process.env.SPINE_ALLOW_FORCE;
	try {
		delete process.env.SPINE_ALLOW_FORCE;
		const config = loadSpineConfig(projectRoot).config;
		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			forceIntegrate: true,
		});
		assert.equal(blocked.ok, false);
		assertBlockerCode(
			blocked,
			"force_integrate_blocked",
			/Force integrate blocked/,
		);
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_ALLOW_FORCE;
		} else {
			process.env.SPINE_ALLOW_FORCE = previous;
		}
		await destroyGitRepo(projectRoot);
	}
});

test("approveIntegrateGate exposes missing_gate blocker when gate absent", async () => {
	const projectRoot = await initGitRepo("spine-blocker-approve-missing-");
	const batchId = "20260712T140500";
	try {
		const result = approveIntegrateGate({ projectRoot, batchId });
		assert.equal(result.ok, false);
		assertBlockerCode(result, "missing_gate", /Cannot approve — gate not opened/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("approveIntegrateGate exposes gate_rejected blocker for rejected gate", async () => {
	const projectRoot = await initGitRepo("spine-blocker-approve-rejected-");
	const batchId = "20260712T140600";
	const orchBranch = "orch/spine-blocker-approve-rejected";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;

		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		rejectIntegrateGate({ projectRoot, batchId });
		const result = approveIntegrateGate({ projectRoot, batchId });
		assert.equal(result.ok, false);
		assertBlockerCode(result, "gate_rejected", /Cannot approve a rejected gate/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
