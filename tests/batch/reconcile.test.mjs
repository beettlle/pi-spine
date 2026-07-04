import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { reconcileBatch, runReconciliationCheck } from "../../src/batch/reconcile.mjs";
import { macroPhaseLabel } from "../../src/batch/macro-phase.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("idle-no-batch returns healthy idle state", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-");
	try {
		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, null);
		assert.equal(result.macroPhase, "idle");
		assert.equal(result.macroPhaseLabel, macroPhaseLabel("idle"));
		assert.match(result.headline, /No active batch/i);
		assert.equal(result.suggestedCommand, "spine preflight");
		assert.ok(result.alternatives?.includes("spine plan all"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("limbo_stale detected from incident fixture", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "limbo_stale");
		assert.ok(result.headline);
		assert.equal(result.suggestedCommand, "spine batch dismiss");
		assert.equal(result.batchId, "20260531T165700");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("completed_manual when orch branch merged to main", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);

		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "merged.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "merged.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane merge"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["merge", "--no-ff", fixture.orchBranch, "-m", "merge orch"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "completed_manual");
		assert.equal(result.suggestedCommand, "spine batch dismiss");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("needs_retry when a task failed", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "needs_retry");
		assert.equal(result.suggestedCommand, "spine batch retry TP-002");
		assert.match(result.headline, /TP-002/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("running diagnosis for active batch", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-");
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "running");
		assert.match(result.headline, /running/i);
		assert.equal(result.suggestedCommand, "/spine-status --diagnose");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runReconciliationCheck matches reconcileBatch output shape", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-shape-");
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);
		const result = runReconciliationCheck({
			projectRoot,
			batchState: fixture,
			batchStatePath: ".pi/batch-state.json",
		});

		assert.equal(result.diagnosis, "running");
		assert.ok(result.headline);
		assert.ok(result.suggestedCommand);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch includes journal hints when journal exists", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-journal-");
	try {
		const fixture = loadFixture("needs-retry-batch.json");
		writePiBatchState(projectRoot, fixture);
		const { appendJournalEvent } = await import("../../src/batch/journal.mjs");
		appendJournalEvent(projectRoot, fixture.batchId, "task.failed", {
			taskId: "TP-002",
			classification: "worker_failed",
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.ok(result.signals?.journalHints?.length);
		assert.equal(result.signals.journalHints[0].type, "task.failed");
		assert.equal(result.macroPhase, "failed");
		assert.equal(result.signals.macroPhase, "failed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch exposes macroPhase for running batch", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-macro-");
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "running");
		assert.equal(result.macroPhase, "executing");
		assert.equal(result.macroPhaseLabel, "Executing");
		assert.equal(result.signals?.macroPhase, "executing");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch exposes macroPhase for limbo_stale", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-macro-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "limbo_stale");
		assert.equal(result.macroPhase, "completed");
		assert.equal(result.macroPhaseLabel, "Completed");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
