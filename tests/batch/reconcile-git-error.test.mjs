import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { deriveDiagnosis, inspectGitState, inspectHumanBaseSync, reconcileBatch } from "../../src/batch/reconcile.mjs";
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

/** A `git` on PATH that never answers — execFileSync hits the 5s probe timeout. */
function makeSlowGitShim(shimDir) {
	fs.writeFileSync(path.join(shimDir, "git"), "#!/bin/sh\nsleep 30\n", { mode: 0o755 });
	return shimDir;
}

function withGitShimOnPath(shimDir) {
	const previous = process.env.PATH ?? "";
	process.env.PATH = `${shimDir}${path.delimiter}${previous}`;
	return () => {
		process.env.PATH = previous;
	};
}

/** Fully replaces PATH — used to make the git binary unresolvable (spawnSync ENOENT). */
function withGitBinaryHidden(emptyDir) {
	const previous = process.env.PATH ?? "";
	process.env.PATH = emptyDir;
	return () => {
		process.env.PATH = previous;
	};
}

test("inspectGitState records fatal inspection error when git probes time out", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	const restorePath = withGitShimOnPath(makeSlowGitShim(fs.mkdtempSync(path.join(os.tmpdir(), "git-shim-slow-"))));
	try {
		const git = inspectGitState({
			projectRoot,
			batchId: "20260531T165700",
			baseBranch: "main",
			orchBranch: null,
		});

		assert.equal(git.inGitRepo, false); // probe failed → conservative false, but no longer silent
		assert.match(git.gitInspectionError ?? "", /inside_work_tree:/);
		assert.match(git.gitInspectionError ?? "", /ETIMEDOUT/i);
	} finally {
		restorePath();
		await destroyGitRepo(projectRoot);
	}
});

test("inspectGitState records fatal inspection error when the git binary is missing", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	// PATH with no git binary anywhere → spawnSync ENOENT → fatal, must surface.
	const restorePath = withGitBinaryHidden(fs.mkdtempSync(path.join(os.tmpdir(), "git-shim-empty-")));
	try {
		const git = inspectGitState({
			projectRoot,
			batchId: "20260531T165700",
			baseBranch: "main",
			orchBranch: null,
		});

		assert.equal(git.inGitRepo, false);
		assert.match(git.gitInspectionError ?? "", /inside_work_tree:/);
		assert.match(git.gitInspectionError ?? "", /ENOENT/i);
	} finally {
		restorePath();
		await destroyGitRepo(projectRoot);
	}
});

test("inspectHumanBaseSync records fatal probe errors on the git signals and returns null", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	const restorePath = withGitShimOnPath(makeSlowGitShim(fs.mkdtempSync(path.join(os.tmpdir(), "git-shim-slow-"))));
	try {
		const git = /** @type {Record<string, any>} */ ({
			inGitRepo: true,
			orchMergedToBase: false,
			mergedOrchBranch: null,
			gitInspectionError: null,
		});
		const result = inspectHumanBaseSync({
			projectRoot,
			baseBranch: "main",
			baseBranchHeadAtStart: "abc123",
			orchBranch: null,
			git,
			journalEvents: [],
		});

		assert.equal(result, null); // still no diagnosis — but the failure is now visible
		assert.match(git.gitInspectionError ?? "", /rev_parse\(main\):/);
		assert.match(git.gitInspectionError ?? "", /ETIMEDOUT/i);
	} finally {
		restorePath();
		await destroyGitRepo(projectRoot);
	}
});

test("orch branch candidates are generic — no personal username or operator hack", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-git-");
	try {
		const batchId = "20260531T165700";
		const git = inspectGitState({ projectRoot, batchId, baseBranch: "main", orchBranch: null });

		assert.ok(git.orchBranches.includes(`orch/spine-${batchId}`));
		for (const branch of git.orchBranches) {
			assert.ok(!branch.includes("cdelgado"), `candidate must not embed a personal username: ${branch}`);
			assert.ok(!branch.includes("operator"), `candidate must not embed the operator hack: ${branch}`);
		}
		assert.equal(git.gitInspectionError, null); // definitive "no" answers stay silent
	} finally {
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
