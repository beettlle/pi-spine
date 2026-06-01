import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { reconcileBatch, runReconciliationCheck } from "../../src/batch/reconcile.mjs";
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
		assert.equal(result.suggestedCommand, "/spine-retry-task TP-002");
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

test("runReconciliationCheck matches reconcileBatch output shape", () => {
	const fixture = loadFixture("running-batch.json");
	const result = runReconciliationCheck({
		projectRoot: process.cwd(),
		batchState: fixture,
		batchStatePath: ".pi/batch-state.json",
	});

	assert.equal(result.diagnosis, "running");
	assert.ok(result.headline);
	assert.ok(result.suggestedCommand);
});
