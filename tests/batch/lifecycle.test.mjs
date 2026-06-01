import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runInit } from "../../bin/spine-init.mjs";
import {
	archiveBatchStatePath,
	completeBatch,
	dismissBatch,
} from "../../src/batch/lifecycle.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

async function createProjectFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-lifecycle-"));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	runInit(projectRoot, ["--tasks-root", "taskplane-tasks"]);
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test("dismiss archives batch-state before clearing active file", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);
		const activePath = path.join(projectRoot, ".pi", "batch-state.json");

		const result = dismissBatch({ projectRoot, reason: "test" });
		assert.equal(result.ok, true);
		assert.equal(result.batchId, fixture.batchId);

		const archivePath = archiveBatchStatePath(projectRoot, fixture.batchId);
		assert.ok(fs.existsSync(archivePath), "archive must exist");
		assert.ok(!fs.existsSync(activePath), "active batch-state must be cleared");

		const archived = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		assert.equal(archived.batchId, fixture.batchId);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("complete with --detect-manual-merge succeeds when orch merged to main", async () => {
	const projectRoot = await createProjectFixture();
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

		const result = completeBatch({ projectRoot, detectManualMerge: true });
		assert.equal(result.ok, true);
		assert.equal(result.diagnosis, "completed");

		const archivePath = archiveBatchStatePath(projectRoot, fixture.batchId);
		assert.ok(fs.existsSync(archivePath));
		assert.ok(!fs.existsSync(path.join(projectRoot, ".pi", "batch-state.json")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("dismiss refused when diagnosis is running without --force", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const result = dismissBatch({ projectRoot });
		assert.equal(result.ok, false);
		assert.match(result.headline, /force/i);
		assert.ok(fs.existsSync(path.join(projectRoot, ".pi", "batch-state.json")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
