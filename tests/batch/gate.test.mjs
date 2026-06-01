import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runSpineGate } from "../../bin/spine-gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import {
	approveIntegrateGate,
	checkIntegrateGate,
	gateRecordPath,
	loadGateRecord,
	openIntegrateGate,
	openIntegrateGateAfterBatchComplete,
	rejectIntegrateGate,
} from "../../src/batch/gate.mjs";
import { buildTaskScorecard, collectEvidenceBundle, evidenceDir } from "../../src/batch/evidence.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

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

test("buildTaskScorecard lists task rows", () => {
	const md = buildTaskScorecard({
		batchId: "20260601T120000",
		phase: "completed",
		tasks: [{ taskId: "TP-001", status: "succeeded", doneFileFound: true }],
	});
	assert.match(md, /TP-001/);
	assert.match(md, /succeeded/);
});

test("openIntegrateGate persists pending gate and journals gate.opened", async () => {
	const projectRoot = await initGitRepo("spine-gate-");
	const batchId = "20260601T120000";
	const orchBranch = "orch/spine-gate";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		const config = loadSpineConfig(projectRoot).config;

		const opened = openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		assert.equal(opened.gate.status, "pending");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		const again = openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		assert.equal(again.opened, false);

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "gate.opened"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("collectEvidenceBundle writes summary and diff-stat", async () => {
	const projectRoot = await initGitRepo("spine-gate-ev-");
	const batchId = "20260601T120000";
	const orchBranch = "orch/spine-evidence";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		const config = loadSpineConfig(projectRoot).config;

		const { evidenceRefs } = collectEvidenceBundle({
			projectRoot,
			batchId,
			batchState: fixture,
			config,
		});

		const dir = evidenceDir(projectRoot, batchId);
		assert.ok(fs.existsSync(path.join(dir, "summary.md")));
		assert.ok(fs.existsSync(path.join(dir, "diff-stat.txt")));
		assert.ok(evidenceRefs.includes("evidence/summary.md"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("approve and reject enforce gate FSM", async () => {
	const projectRoot = await initGitRepo("spine-gate-fsm-");
	const batchId = "20260601T120000";
	try {
		writeSpineBatchState(projectRoot, completedFixture(batchId, "orch/x"));
		openIntegrateGate({ projectRoot, batchId, batchState: completedFixture(batchId, "orch/x") });

		const approved = approveIntegrateGate({ projectRoot, batchId });
		assert.equal(approved.ok, true);
		assert.equal(loadGateRecord(projectRoot, batchId).status, "approved");

		const rejectAfterApprove = rejectIntegrateGate({ projectRoot, batchId });
		assert.equal(rejectAfterApprove.ok, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("rejectIntegrateGate journals gate.rejected", async () => {
	const projectRoot = await initGitRepo("spine-gate-rej-");
	const batchId = "20260601T120000";
	try {
		openIntegrateGate({ projectRoot, batchId, batchState: completedFixture(batchId, "orch/x") });
		const rejected = rejectIntegrateGate({ projectRoot, batchId, reason: "needs more tests" });
		assert.equal(rejected.ok, true);
		assert.equal(loadGateRecord(projectRoot, batchId).status, "rejected");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "gate.rejected"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkIntegrateGate blocks until approved (exit 2)", async () => {
	const projectRoot = await initGitRepo("spine-gate-block-");
	const batchId = "20260601T120000";
	try {
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId, batchState: completedFixture(batchId, "orch/x") });

		const blocked = checkIntegrateGate({ projectRoot, batchId, config });
		assert.equal(blocked.ok, false);
		assert.equal(blocked.exitCode, 2);

		approveIntegrateGate({ projectRoot, batchId });
		const allowed = checkIntegrateGate({ projectRoot, batchId, config });
		assert.equal(allowed.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase fails with exit 2 when gate pending", async () => {
	const projectRoot = await initGitRepo("spine-gate-int-block-");
	const batchId = "20260601T120000";
	const orchBranch = "orch/spine-gate-block";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedFixture(batchId, orchBranch));
		openIntegrateGate({
			projectRoot,
			batchId,
			batchState: completedFixture(batchId, orchBranch),
		});

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 2);
		assert.equal(result.failureClass, "GateBlocked");

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "integrate.failed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase succeeds after gate approval", async () => {
	const projectRoot = await initGitRepo("spine-gate-int-ok-");
	const batchId = "20260601T120000";
	const orchBranch = "orch/spine-gate-ok";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedFixture(batchId, orchBranch));
		openIntegrateGate({
			projectRoot,
			batchId,
			batchState: completedFixture(batchId, orchBranch),
		});
		approveIntegrateGate({ projectRoot, batchId });

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true);
		assert.ok(fs.existsSync(path.join(projectRoot, "orch-work.txt")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("force integrate requires SPINE_ALLOW_FORCE=1", async () => {
	const projectRoot = await initGitRepo("spine-gate-force-");
	const batchId = "20260601T120000";
	const orchBranch = "orch/spine-force";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedFixture(batchId, orchBranch));
		const config = loadSpineConfig(projectRoot).config;

		const blocked = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			forceIntegrate: true,
		});
		assert.equal(blocked.ok, false);

		const prev = process.env.SPINE_ALLOW_FORCE;
		process.env.SPINE_ALLOW_FORCE = "1";
		const allowed = checkIntegrateGate({
			projectRoot,
			batchId,
			config,
			forceIntegrate: true,
		});
		if (prev === undefined) delete process.env.SPINE_ALLOW_FORCE;
		else process.env.SPINE_ALLOW_FORCE = prev;
		assert.equal(allowed.ok, true);
		assert.equal(allowed.forced, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("openIntegrateGateAfterBatchComplete skips non-completed batches", async () => {
	const projectRoot = await initGitRepo("spine-gate-skip-");
	const batchId = "20260601T120000";
	try {
		const skipped = openIntegrateGateAfterBatchComplete({
			projectRoot,
			batchId,
			batchState: { phase: "running", orchBranch: "orch/x" },
		});
		assert.equal(skipped.skipped, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineGate CLI approve updates gate record", async () => {
	const projectRoot = await initGitRepo("spine-gate-cli-");
	const batchId = "20260601T120000";
	try {
		writeSpineBatchState(projectRoot, completedFixture(batchId, "orch/x"));
		openIntegrateGate({ projectRoot, batchId, batchState: completedFixture(batchId, "orch/x") });

		const cli = runSpineGate({ projectRoot, args: ["approve"] });
		assert.equal(cli.exitCode, 0);
		assert.equal(loadGateRecord(projectRoot, batchId).status, "approved");
		assert.match(cli.output, /approved/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
