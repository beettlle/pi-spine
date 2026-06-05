import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { deriveDiagnosis, inspectGitState, reconcileBatch } from "../../src/batch/reconcile.mjs";
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

test("inspectGitState records gitInspectionError when merged-branch scan fails", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	try {
		const git = inspectGitState({
			projectRoot,
			batchId: "20260531T165700",
			baseBranch: "missing-base-branch",
			orchBranch: null,
		});

		assert.equal(git.inGitRepo, true);
		assert.match(git.gitInspectionError ?? "", /list_merged_branches:/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("deriveDiagnosis returns git_unavailable when git inspection failed", () => {
	const result = deriveDiagnosis({
		phase: "stopped",
		endedAt: null,
		failedTasks: 0,
		allTasksTerminalSuccess: true,
		hasRunningTasks: false,
		hasPendingTasks: false,
		hasFailedTasks: false,
		hasSegmentDrift: false,
		failedTaskId: null,
		mergeResultsEmpty: true,
		git: { gitInspectionError: "list_merged_branches: fatal: bad ref" },
		orphanRunning: null,
		raw: { tasks: [] },
	});

	assert.equal(result.diagnosis, "git_unavailable");
});

test("reconcileBatch surfaces git_unavailable instead of limbo_stale on git failure", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	const previous = process.env.SPINE_TEST_GIT_INSPECTION_THROW;
	process.env.SPINE_TEST_GIT_INSPECTION_THROW = "branch_merged_scan";
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		writePiBatchState(projectRoot, fixture);

		const result = reconcileBatch({ projectRoot });
		assert.equal(result.diagnosis, "git_unavailable");
		assert.equal(result.suggestedCommand, "spine doctor");
		assert.match(result.headline, /git inspection failed/i);
		assert.notEqual(result.diagnosis, "limbo_stale");
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_TEST_GIT_INSPECTION_THROW;
		} else {
			process.env.SPINE_TEST_GIT_INSPECTION_THROW = previous;
		}
		await destroyGitRepo(projectRoot);
	}
});

test("reconcileBatch records count_commits_ahead git errors from real git refs", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	try {
		const fixture = loadFixture("limbo-stale-20260531T165700.json");
		fixture.baseBranch = "missing-base-branch";
		writePiBatchState(projectRoot, fixture);

		execFileSync("git", ["checkout", "-b", fixture.orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "orch.txt"), "orch work", "utf-8");
		execFileSync("git", ["add", "orch.txt"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "orch lane"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(result.diagnosis, "git_unavailable");
		assert.equal(result.suggestedCommand, "spine doctor");
		assert.match(result.signals?.git?.gitInspectionError ?? "", /count_commits_ahead:|list_merged_branches:/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
