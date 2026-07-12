import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import {
	gateRecordPath,
	loadGateRecord,
	openIntegrateGate,
} from "../../src/batch/gate.mjs";
import { resolveGateTargetRevision } from "../../src/batch/gate-revision.mjs";
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

function orchTipSha(projectRoot, orchBranch) {
	return execFileSync("git", ["rev-parse", "--verify", `${orchBranch}^{commit}`], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

test("resolveGateTargetRevision returns orch tip SHA", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-");
	const orchBranch = "orch/spine-rev";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const sha = resolveGateTargetRevision(projectRoot, { orchBranch });
		assert.equal(sha, orchTipSha(projectRoot, orchBranch));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveGateTargetRevision fails closed when orchBranch missing", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-miss-");
	try {
		assert.throws(
			() => resolveGateTargetRevision(projectRoot, {}),
			/orchBranch is missing/,
		);
		assert.throws(
			() => resolveGateTargetRevision(projectRoot, null),
			/orchBranch is missing/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveGateTargetRevision fails closed when orch tip unreadable", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-bad-");
	try {
		assert.throws(
			() => resolveGateTargetRevision(projectRoot, { orchBranch: "orch/does-not-exist" }),
			/failed to read tip/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("openIntegrateGate persists targetRevision on gate record", async () => {
	const projectRoot = await initGitRepo("spine-gate-rev-persist-");
	const batchId = "20260712T120000";
	const orchBranch = "orch/spine-rev-persist";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const expected = orchTipSha(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		const config = loadSpineConfig(projectRoot).config;

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		assert.equal(opened.opened, true);
		assert.equal(opened.gate.targetRevision, expected);

		const onDisk = loadGateRecord(projectRoot, batchId);
		assert.ok(onDisk);
		assert.equal(onDisk.targetRevision, expected);
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
