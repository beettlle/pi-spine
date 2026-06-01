import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runInit } from "../../bin/spine-init.mjs";
import { runSpineIntegrate } from "../../bin/spine-integrate.mjs";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { assertOrchIntegratable, integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { completeBatch } from "../../src/batch/lifecycle.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { countCommitsAhead } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
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

function approveGateForIntegrate(projectRoot, fixture, batchId) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
	approveIntegrateGate({ projectRoot, batchId });
}

function completedBatchFixture(orchBranch, batchId = "20260601T120000") {
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

test("assertOrchIntegratable refuses empty orch when mergeResults claim success", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-test-empty";
	try {
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const result = assertOrchIntegratable(projectRoot, {
			baseBranch: "main",
			orchBranch,
			mergeResultsEmpty: false,
			orchMergedToBase: false,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "EmptyMerge");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assertOrchIntegratable requires integrate when orch is ahead of base", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-test-ahead";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		assert.equal(countCommitsAhead(projectRoot, "main", orchBranch), 1);

		const result = assertOrchIntegratable(projectRoot, {
			baseBranch: "main",
			orchBranch,
			mergeResultsEmpty: false,
			orchMergedToBase: false,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "NeedsIntegrate");
		assert.equal(result.suggestedCommand, "spine integrate");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch reports needs_integrate when batch completed but orch not on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "needs_integrate");
		assert.equal(result.suggestedCommand, "spine integrate");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch refuses when orch is ahead but not integrated", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));

		const result = completeBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "NeedsIntegrate");
		assert.equal(result.suggestedCommand, "spine integrate");
		assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase merges orch into main and journals events", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	const batchId = "20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true);
		assert.ok(result.mergeCommit);

		const onMain = execFileSync("git", ["branch", "--show-current"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(onMain, "main");
		assert.ok(fs.existsSync(path.join(projectRoot, "orch-work.txt")));

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "integrate.started"));
		assert.ok(events.some((event) => event.type === "integrate.completed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase dry-run does not change main HEAD", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));

		const mainBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = integrateOrchToBase({ projectRoot, dryRun: true });
		assert.equal(result.ok, true);
		assert.equal(result.dryRun, true);
		assert.match(result.mergePlan ?? "", /merge --no-ff/);

		const mainAfter = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(mainAfter, mainBefore);
		assert.ok(!fs.existsSync(path.join(projectRoot, "orch-work.txt")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completeBatch succeeds after integrate lands orch on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-");
	const orchBranch = "orch/spine-20260601T120000";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		writeSpineBatchState(projectRoot, completedBatchFixture(orchBranch));

		const fixture = completedBatchFixture(orchBranch);
		approveGateForIntegrate(projectRoot, fixture, fixture.batchId);
		const integrate = integrateOrchToBase({ projectRoot });
		assert.equal(integrate.ok, true);

		const complete = completeBatch({ projectRoot });
		assert.equal(complete.ok, true);
		assert.equal(complete.diagnosis, "completed");
		assert.ok(!fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIntegrate CLI succeeds when orch tip already matches main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-cli-");
	const orchBranch = "orch/spine-empty";
	try {
		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		fixture.orchBranch = orchBranch;
		fixture.mergeResults = [
			{ waveIndex: 0, status: "succeeded", failedLane: null, failureReason: null },
		];
		writeSpineBatchState(projectRoot, fixture);

		const cli = runSpineIntegrate({ projectRoot, args: [] });
		assert.equal(cli.exitCode, 0);
		assert.match(cli.output, /already merged/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
