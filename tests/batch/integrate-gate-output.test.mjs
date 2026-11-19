import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { formatIntegrateHuman, runSpineIntegrate } from "../../bin/spine-integrate.mjs";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

// #359: `gateRequired` means "gates are configured", not "still needs approval".
// After a successful approved merge the output must not claim approval is
// still required; blocked integrates must keep the blocked messaging.

const BATCH_ID = "20260601T120000";
const ORCH_BRANCH = "orch/spine-20260601T120000";

function successResult(overrides = {}) {
	return {
		ok: true,
		exitCode: 0,
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: ORCH_BRANCH,
		mergeCommit: "deadbeef",
		commitsAhead: 1,
		headline: `Integrated ${ORCH_BRANCH} into main`,
		suggestedCommand: "spine batch complete",
		alternatives: ["spine status --diagnose"],
		...overrides,
	};
}

test("success with a required, approved gate prints Gate: approved (#359)", () => {
	const output = formatIntegrateHuman(successResult({ gateRequired: true }));
	assert.match(output, /Gate: approved/);
	assert.ok(!output.includes("approval required"));
});

test("success with a forced gate bypass does not claim approval (#359)", () => {
	const output = formatIntegrateHuman(
		successResult({ gateRequired: true, gateForced: true }),
	);
	assert.ok(!output.includes("approval required"));
	assert.ok(!output.includes("Gate: approved"));
});

test("success without gate config omits the Gate line (#359)", () => {
	const output = formatIntegrateHuman(successResult());
	assert.ok(!output.includes("Gate:"));
});

test("blocked integrate keeps gate-blocked messaging (#359)", () => {
	const output = formatIntegrateHuman(
		successResult({
			ok: false,
			exitCode: 2,
			failureClass: "GateBlocked",
			headline: "Integrate blocked by gate",
			suggestedCommand: "spine gate approve",
		}),
	);
	assert.match(output, /Gate: integrate blocked until approved/);
	assert.ok(!output.includes("Gate: approved"));
});

test("dry-run with a pending gate mentions approval required (#359)", () => {
	const output = formatIntegrateHuman(
		successResult({
			dryRun: true,
			gateRequired: true,
			gatePending: true,
			mergePlan: "isolated ref merge orch → main",
			headline: `Would merge ${ORCH_BRANCH} → main after gate approval (1 commit(s))`,
		}),
	);
	assert.match(output, /Gate: approval required before integrate/);
});

test("dry-run with a satisfied gate does not claim approval required (#359)", () => {
	const output = formatIntegrateHuman(
		successResult({
			dryRun: true,
			gateRequired: true,
			gatePending: false,
			mergePlan: "isolated ref merge orch → main",
			headline: `Would merge ${ORCH_BRANCH} → main (1 commit(s))`,
		}),
	);
	assert.ok(!output.includes("approval required"));
});

// configVersion (not `version`) — loadSpineConfig rejects configs without it
// and silently falls back to defaults (gate not required).
const GATE_REQUIRED_CONFIG = {
	configVersion: 1,
	project: { name: "x", description: "" },
	paths: { tasksRoot: "spine-tasks" },
	baseBranch: "main",
	testing: { build: "", test: "", testWithCoverage: "" },
	agents: {
		worker: { model: "inherit", thinking: "high" },
		reviewer: { model: "inherit", thinking: "medium" },
		supervisor: { model: "inherit", thinking: "off" },
	},
	lanes: { maxParallel: 3, queueExcess: true, workerBackend: "subprocess" },
	gates: { requireBeforeIntegrate: true },
	referenceDocs: [],
	standards: [],
	neverLoad: [],
};

function writeGateConfig(projectRoot) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "spine-config.json"),
		`${JSON.stringify(GATE_REQUIRED_CONFIG, null, 2)}\n`,
		"utf-8",
	);
}

function writeBatchState(projectRoot, fixture) {
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

function completedBatchFixture(orchBranch, batchId = BATCH_ID) {
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
		mergeResults: [
			{
				waveIndex: 0,
				status: "succeeded",
				failedLane: null,
				failureReason: null,
				mergeCommit: "deadbeef",
			},
		],
		tasks: [
			{
				taskId: "TP-012",
				status: "succeeded",
				taskFolder: "TP-012-single-lane-worker",
				doneFileFound: true,
			},
		],
		segments: [{ segmentId: "TP-012::default", taskId: "TP-012", status: "succeeded" }],
	};
}

function approveGateForIntegrate(projectRoot, fixture, batchId) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
	approveIntegrateGate({ projectRoot, batchId });
}

test("CLI integrate with an approved required gate prints Gate: approved (#359)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-gate-output-");
	try {
		createOrchWithWork(projectRoot, ORCH_BRANCH);
		writeGateConfig(projectRoot);
		const fixture = completedBatchFixture(ORCH_BRANCH);
		writeBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, BATCH_ID);

		const cli = runSpineIntegrate({ projectRoot, args: [] });
		assert.equal(cli.exitCode, 0);
		assert.match(cli.output, /Gate: approved/);
		assert.ok(!cli.output.includes("approval required"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("CLI integrate with a pending required gate stays blocked (#359)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-gate-blocked-");
	const batchId = "20260601T120001";
	try {
		createOrchWithWork(projectRoot, ORCH_BRANCH);
		writeGateConfig(projectRoot);
		writeBatchState(projectRoot, completedBatchFixture(ORCH_BRANCH, batchId));

		const cli = runSpineIntegrate({ projectRoot, args: [] });
		assert.equal(cli.exitCode, 2);
		assert.match(cli.output, /Gate: integrate blocked until approved/);
		assert.ok(!cli.output.includes("Gate: approved"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
