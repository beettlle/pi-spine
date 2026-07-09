import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	buildSuggestedCommand,
	inferMergeGitignoredFailure,
} from "../../src/batch/diagnosis.mjs";
import { mergeLaneToOrch } from "../../src/batch/engine-lanes/merge.mjs";
import {
	commitLaneWorktree,
	filterPorcelain,
} from "../../src/batch/lane-commit.mjs";
import {
	filterGitignoredPaths,
	gitAddFilteredPaths,
} from "../../src/batch/git-helpers.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { appendJournalEvent } from "../../src/batch/journal.mjs";
import {
	createInitialBatchState,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function forceAdd(projectRoot, filePath) {
	execFileSync("git", ["add", "-f", "--", filePath], { cwd: projectRoot, stdio: "ignore" });
}

test("filterGitignoredPaths separates ignored and stageable paths", async () => {
	const projectRoot = await initGitRepo("spine-gitignore-filter-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "add gitignore");
		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "index.html"), "<html></html>", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "src.txt"), "tracked\n", "utf-8");

		const result = filterGitignoredPaths(projectRoot, [
			"coverage/index.html",
			"src.txt",
		]);
		assert.deepEqual(result.skipped, ["coverage/index.html"]);
		assert.deepEqual(result.stageable, ["src.txt"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("gitAddFilteredPaths skips gitignored paths without failing", async () => {
	const projectRoot = await initGitRepo("spine-gitignore-add-");
	try {
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "add gitignore");
		fs.mkdirSync(path.join(projectRoot, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "coverage", "index.html"), "<html></html>", "utf-8");
		fs.writeFileSync(path.join(projectRoot, "src.txt"), "tracked\n", "utf-8");

		const addResult = gitAddFilteredPaths(projectRoot, ["coverage/index.html", "src.txt"]);
		assert.deepEqual(addResult.skipped, ["coverage/index.html"]);
		assert.deepEqual(addResult.added, ["src.txt"]);

		const staged = execFileSync("git", ["diff", "--cached", "--name-only"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();
		assert.equal(staged, "src.txt");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("mergeLaneToOrch succeeds when task branch committed gitignored coverage", async () => {
	const projectRoot = await initGitRepo("spine-merge-gitignored-coverage-");
	try {
		const batchId = "20260619T234638";
		const orchBranch = `orch/spine-${batchId}`;
		const laneBranch = `task/spine-lane-3-${batchId}`;

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "extension/coverage/\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "extension/coverage/lcov-report"), { recursive: true });
		fs.mkdirSync(path.join(projectRoot, "extension/src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "extension/src/index.ts"), "export const v = 0;\n", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "extension/coverage/lcov-report/index.html"),
			"<html>base</html>\n",
			"utf-8",
		);
		forceAdd(projectRoot, "extension/coverage/lcov-report/index.html");
		execFileSync("git", ["add", "--", "extension/src/index.ts"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "base"], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["branch", orchBranch, "main"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["branch", laneBranch, orchBranch], { cwd: projectRoot, stdio: "ignore" });

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(
			path.join(projectRoot, "extension/coverage/lcov-report/index.html"),
			"<html>orch</html>\n",
			"utf-8",
		);
		forceAdd(projectRoot, "extension/coverage/lcov-report/index.html");
		execCommit(projectRoot, "orch coverage");

		execFileSync("git", ["checkout", laneBranch], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "extension/src/index.ts"), "export const v = 3;\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "extension/coverage/lcov-report"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, "extension/coverage/lcov-report/index.html"),
			"<html>lane stale</html>\n",
			"utf-8",
		);
		forceAdd(projectRoot, "extension/coverage/lcov-report/index.html");
		execFileSync("git", ["add", "--", "extension/src/index.ts"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		execFileSync("git", ["commit", "-m", "lane task + stale gitignored coverage"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch: "main",
			orchBranch,
			taskBranch: laneBranch,
			batchId,
			laneFileScopePaths: ["extension/src/**"],
		});

		assert.equal(merge.ok, true, merge.error);

		execFileSync("git", ["checkout", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		const indexSource = fs.readFileSync(path.join(projectRoot, "extension/src/index.ts"), "utf-8");
		assert.match(indexSource, /v = 3/);
		const coveragePath = path.join(projectRoot, "extension/coverage/lcov-report/index.html");
		if (fs.existsSync(coveragePath)) {
			const coverage = fs.readFileSync(coveragePath, "utf-8");
			assert.match(coverage, /orch/);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree refuses gitignored-only dirty paths", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-gitignored-");
	try {
		const batchId = "20260620T120000";
		const taskId = "SP-311";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		fs.mkdirSync(taskFolder, { recursive: true });
		fs.mkdirSync(path.join(worktreePath, "coverage"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		forceAdd(worktreePath, "coverage/lcov.info");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "done\n", "utf-8");
		forceAdd(worktreePath, "coverage/lcov.info");
		execFileSync("git", ["add", "--", "spine-tasks"], {
			cwd: worktreePath,
			stdio: "ignore",
		});
		execFileSync("git", ["commit", "-m", "seed tracked gitignored coverage and task folder"], {
			cwd: worktreePath,
			stdio: "ignore",
		});
		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:changed\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "GitignoredDirtyWorktree");
		assert.ok(Array.isArray(result.gitignoredPaths));
		assert.match(result.error, /gitignored dirty files only/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree commits tracked files while skipping gitignored dirty paths", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-mixed-");
	try {
		const batchId = "20260620T120001";
		const taskId = "SP-311";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);

		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "coverage/\n", "utf-8");
		execCommit(projectRoot, "gitignore");

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		fs.mkdirSync(path.join(worktreePath, "coverage"), { recursive: true });
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "coverage", "lcov.info"), "SF:src\n", "utf-8");
		fs.writeFileSync(path.join(worktreePath, "tracked.txt"), "work\n", "utf-8");
		fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");

		const before = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, true);
		assert.ok(Array.isArray(result.skippedGitignoredPaths));
		assert.ok(result.skippedGitignoredPaths.includes("coverage/lcov.info"));

		const after = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();
		assert.notEqual(before, after);

		const trackedInCommit = execFileSync(
			"git",
			["show", "--name-only", "--pretty=format:", "HEAD"],
			{ cwd: worktreePath, encoding: "utf-8" },
		);
		assert.match(trackedInCommit, /tracked\.txt/);
		assert.doesNotMatch(trackedInCommit, /coverage\/lcov\.info/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("inferMergeGitignoredFailure detects gitignored merge and lane commit failures", () => {
	assert.equal(
		inferMergeGitignoredFailure({
			exitReason: "GitignoredDirtyWorktree",
		}),
		true,
	);
	assert.equal(
		inferMergeGitignoredFailure({
			failureClass: "merge_failed_gitignored",
			lastError: "The following paths are ignored by one of your .gitignore files: coverage",
		}),
		true,
	);
	assert.equal(
		inferMergeGitignoredFailure({
			lastError: "merge conflict on src/index.ts",
		}),
		false,
	);
});

test("buildSuggestedCommand returns git rm --cached repair for gitignored merge failures", () => {
	const suggested = buildSuggestedCommand("needs_merge", {
		mergeGitignoredFailure: true,
		taskBranch: "task/spine-lane-3-20260619T234638",
		gitignoredPaths: ["extension/coverage/lcov-report/index.html"],
	});
	assert.match(suggested, /git checkout task\/spine-lane-3-20260619T234638/);
	assert.match(suggested, /git rm -r --cached/);
	assert.match(suggested, /spine batch resume --force/);
});

test("buildSuggestedCommand returns git clean repair for stet .review worktree-only failures", () => {
	const suggested = buildSuggestedCommand("needs_merge", {
		mergeGitignoredFailure: true,
		taskBranch: "task/spine-lane-1-20260709T183137",
		gitignoredPaths: [".review/lock", ".review/session.json", ".review/spine-stet-baseline.ref"],
	});
	assert.match(suggested, /git checkout task\/spine-lane-1-20260709T183137/);
	assert.match(suggested, /git clean -fdX -- \.review/);
	assert.doesNotMatch(suggested, /git rm -r --cached/);
	assert.match(suggested, /spine batch resume --force/);
});

test("reconcileBatch surfaces gitignored merge repair command from journal", async () => {
	const projectRoot = await initGitRepo("spine-diagnose-gitignored-merge-");
	try {
		const batchId = "20260619T234638";
		const taskId = "STET-099";
		const state = createInitialBatchState({
			batchId,
			baseBranch: "main",
			orchBranch: `orch/spine-${batchId}`,
			wavePlan: [[taskId]],
			tasks: [
				{
					taskId,
					laneNumber: 3,
					status: "succeeded",
					taskFolder: `spine-tasks/${taskId}-smoke`,
					startedAt: Date.now(),
					endedAt: Date.now(),
					doneFileFound: true,
					exitReason: null,
				},
			],
			lanes: [
				{
					laneNumber: 3,
					laneId: "lane-3",
					worktreePath: path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-3"),
					branch: `task/spine-lane-3-${batchId}`,
					taskIds: [taskId],
					lastHeartbeatAt: Date.now(),
					workerPid: null,
				},
			],
		});
		state.phase = "merging";
		state.lastError =
			"The following paths are ignored by one of your .gitignore files:\nextension/coverage/lcov-report/index.html";
		state.mergeResults = [
			{
				waveIndex: 0,
				status: "failed",
				failureClass: "merge_failed_gitignored",
				failureReason: state.lastError,
				failedLane: 3,
			},
		];
		saveSpineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "batch.merge_failed", {
			laneNumber: 3,
			failureClass: "merge_failed_gitignored",
			error: state.lastError,
		});

		const reconciliation = reconcileBatch({ projectRoot });
		assert.match(reconciliation.headline, /gitignored paths/i);
		assert.match(reconciliation.suggestedCommand, /git rm -r --cached/);
		assert.match(reconciliation.suggestedCommand, /spine batch resume --force/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("filterPorcelain remains unchanged for SP-104 ignore patterns", () => {
	const porcelain = [" M pi-spine", " M src/app.mjs"].join("\n");
	const filtered = filterPorcelain(porcelain, ["pi-spine"]);
	assert.equal(filtered, " M src/app.mjs");
});
