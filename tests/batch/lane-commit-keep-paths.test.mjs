import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneWorktree } from "../../src/batch/lane-commit.mjs";
import {
	isKeptArtifactRoot,
	normalizeKeepPath,
	partitionArtifactRootsByKeepPaths,
} from "../../src/batch/lane-commit-keep-paths.mjs";
import { sanitizeGitignoredArtifactsBeforeLaneCommit } from "../../src/batch/lane-dirty-check.mjs";
import {
	DEFAULT_LANE_COMMIT_KEEP_PATHS,
	resolveLaneCommitKeepPaths,
} from "../../src/config/spine-config-schema.mjs";
import { validateSettingValue } from "../../src/config/settings-fields.mjs";
import { gitPorcelain } from "../../src/batch/lane-commit.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * Lane worktree fixture shared by the keep-paths tests (#349): an orch branch
 * plus a task branch checked out as a linked worktree, exactly as the engine
 * creates lanes for `lanes.maxParallel` >= 2.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {{ worktreePath: string, taskBranch: string }}
 */
function setupLaneWorktree(projectRoot, batchId) {
	const taskBranch = `task/spine-lane-1-${batchId}`;
	const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
	execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	execFileSync("git", ["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	return { worktreePath, taskBranch };
}

/**
 * Mirror the adoption-repo stet ignore rules: `.review/*` is gitignored except
 * the tracked `config.toml`, so `session.json` and the baseline ref are
 * worktree-only gitignored files — the state the lane-commit sanitizer treats
 * as cleanable artifact roots today (#349).
 *
 * @param {string} worktreePath
 */
function seedStetState(worktreePath) {
	fs.writeFileSync(
		path.join(worktreePath, ".gitignore"),
		".review/*\n!.review/config.toml\n.pi-smart-router/\n",
		"utf-8",
	);
	fs.mkdirSync(path.join(worktreePath, ".review"), { recursive: true });
	fs.writeFileSync(path.join(worktreePath, ".review", "config.toml"), "# stet config\n", "utf-8");
	fs.writeFileSync(path.join(worktreePath, ".review", "session.json"), '{"open":true}\n', "utf-8");
	fs.writeFileSync(
		path.join(worktreePath, ".review", "spine-stet-baseline.ref"),
		"abc123\n",
		"utf-8",
	);
	execFileSync("git", ["add", ".gitignore", ".review/config.toml"], {
		cwd: worktreePath,
		stdio: "ignore",
	});
	execFileSync("git", ["commit", "-m " + "chore: stet state"], { cwd: worktreePath, stdio: "ignore" });
}

/**
 * @param {string} worktreePath
 * @param {string} taskId
 */
function seedCompletedTask(worktreePath, taskId) {
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(worktreePath, `feature-${taskId}.txt`), `${taskId}\n`, "utf-8");
	fs.writeFileSync(path.join(taskFolder, ".DONE"), "done\n", "utf-8");
	return taskFolder;
}

/**
 * @param {string} worktreePath
 * @param {string} taskId
 */
function gitLsFiles(worktreePath, taskId) {
	return execFileSync("git", ["ls-files", "--", `spine-tasks/${taskId}-smoke/`], {
		cwd: worktreePath,
		encoding: "utf-8",
	});
}
test("normalizeKeepPath strips trailing slashes, ./, and backslashes", () => {
	assert.equal(normalizeKeepPath(".review/"), ".review");
	assert.equal(normalizeKeepPath(".review//"), ".review");
	assert.equal(normalizeKeepPath("./.review/"), ".review");
	assert.equal(normalizeKeepPath(".spine\\runtime\\"), ".spine/runtime");
	assert.equal(normalizeKeepPath("  "), "");
});

test("isKeptArtifactRoot matches the root and everything under it", () => {
	assert.equal(isKeptArtifactRoot(".review", [".review/"]), true);
	assert.equal(isKeptArtifactRoot(".review/worktrees/x", [".review/"]), true);
	assert.equal(isKeptArtifactRoot(".pi-smart-router", [".review/"]), false);
	assert.equal(isKeptArtifactRoot(".reviewer-notes", [".review/"]), false, "prefix must not match partial segments");
	assert.equal(isKeptArtifactRoot(".review", []), false);
});

test("partitionArtifactRootsByKeepPaths splits cleanable from kept roots", () => {
	const { cleanableRoots, keptRoots } = partitionArtifactRootsByKeepPaths(
		[".pi-smart-router", ".review", "node_modules"],
		[".review/"],
	);
	assert.deepEqual(cleanableRoots, [".pi-smart-router", "node_modules"]);
	assert.deepEqual(keptRoots, [".review"]);
});

test("resolveLaneCommitKeepPaths defaults to .review/ and replaces on explicit arrays", () => {
	assert.deepEqual(resolveLaneCommitKeepPaths({}), [...DEFAULT_LANE_COMMIT_KEEP_PATHS]);
	assert.deepEqual(resolveLaneCommitKeepPaths({ config: {} }), [...DEFAULT_LANE_COMMIT_KEEP_PATHS]);
	assert.deepEqual(resolveLaneCommitKeepPaths({ config: { lanes: {} } }), [
		...DEFAULT_LANE_COMMIT_KEEP_PATHS,
	]);
	assert.deepEqual(resolveLaneCommitKeepPaths({ config: { lanes: { laneCommitKeepPaths: [] } } }), []);
	assert.deepEqual(
		resolveLaneCommitKeepPaths({ config: { lanes: { laneCommitKeepPaths: [".review/", " ", ".cache/"] } } }),
		[".review/", ".cache/"],
	);
	assert.deepEqual(
		resolveLaneCommitKeepPaths({ config: { lanes: { laneCommitKeepPaths: [1, null] } } }),
		[],
	);
});

test("lanes.laneCommitKeepPaths validates as a comma-separated string list", () => {
	const parsed = validateSettingValue("lanes.laneCommitKeepPaths", ".review/, .cache/");
	assert.equal(parsed.ok, true);
	assert.deepEqual(parsed.normalizedValue, [".review/", ".cache/"]);
	const empty = validateSettingValue("lanes.laneCommitKeepPaths", "");
	assert.equal(empty.ok, true);
	assert.deepEqual(empty.normalizedValue, []);
	const bad = validateSettingValue("lanes.laneCommitKeepPaths", ["ok", ""]);
	assert.equal(bad.ok, false);
});

test("sanitizer cleans .pi-smart-router but preserves keep-path roots", async () => {
	const projectRoot = await initGitRepo("spine-keep-paths-sanitize-");
	try {
		fs.writeFileSync(
			path.join(projectRoot, ".gitignore"),
			".review/*\n!.review/config.toml\n.pi-smart-router/\n",
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "gitignore"], { cwd: projectRoot, stdio: "ignore" });

		fs.mkdirSync(path.join(projectRoot, ".review"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".review", "session.json"), "{}\n", "utf-8");
		const routerDir = path.join(projectRoot, ".pi-smart-router");
		fs.mkdirSync(routerDir, { recursive: true });
		fs.writeFileSync(path.join(routerDir, "state.db"), "db\n", "utf-8");

		const { cleanedRoots, keptRoots } = sanitizeGitignoredArtifactsBeforeLaneCommit(projectRoot, {
			porcelain: gitPorcelain(projectRoot),
			keepPaths: [".review/"],
		});
		assert.deepEqual(cleanedRoots, [".pi-smart-router"]);
		assert.deepEqual(keptRoots, [".review"]);
		assert.equal(fs.existsSync(path.join(projectRoot, ".review", "session.json")), true);
		assert.equal(fs.existsSync(path.join(routerDir, "state.db")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("two tasks serialized on one lane keep .review state and both .DONE markers (#349)", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-keep-paths-");
	try {
		const batchId = "20261023T120000";
		const { worktreePath, taskBranch } = setupLaneWorktree(projectRoot, batchId);
		seedStetState(worktreePath);

		// Task A completes and auto-commits on the lane branch.
		const taskAFolder = seedCompletedTask(worktreePath, "TP-901");
		const resultA = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId: "TP-901",
			batchId,
			taskFolder: taskAFolder,
			projectRoot,
		});
		assert.equal(resultA.ok, true);
		assert.equal(resultA.committed, true);

		// Task B serializes onto the same lane worktree and auto-commits.
		const taskBFolder = seedCompletedTask(worktreePath, "TP-902");
		const resultB = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId: "TP-902",
			batchId,
			taskFolder: taskBFolder,
			projectRoot,
		});
		assert.equal(resultB.ok, true);
		assert.equal(resultB.committed, true);

		// Both completion markers survive the second lane commit.
		assert.equal(fs.existsSync(path.join(taskAFolder, ".DONE")), true, "task A .DONE deleted");
		assert.equal(fs.existsSync(path.join(taskBFolder, ".DONE")), true, "task B .DONE deleted");
		assert.match(gitLsFiles(worktreePath, "TP-901"), /TP-901-smoke\/\.DONE/);
		assert.match(gitLsFiles(worktreePath, "TP-902"), /TP-902-smoke\/\.DONE/);

		// Stet session state the worktreeSetupHook created survives both commits.
		assert.equal(
			fs.existsSync(path.join(worktreePath, ".review", "session.json")),
			true,
			".review/session.json deleted by lane commit",
		);
		assert.equal(
			fs.existsSync(path.join(worktreePath, ".review", "spine-stet-baseline.ref")),
			true,
			".review/spine-stet-baseline.ref deleted by lane commit",
		);
		assert.equal(fs.existsSync(path.join(worktreePath, ".review", "config.toml")), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("lane commit preserves .review state and still cleans .pi-smart-router (#349)", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-keep-router-");
	try {
		const batchId = "20261023T120100";
		const { worktreePath, taskBranch } = setupLaneWorktree(projectRoot, batchId);
		seedStetState(worktreePath);
		const taskFolder = seedCompletedTask(worktreePath, "TP-903");
		const routerDir = path.join(worktreePath, ".pi-smart-router");
		fs.mkdirSync(routerDir, { recursive: true });
		fs.writeFileSync(path.join(routerDir, "state.db"), "db\n", "utf-8");

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId: "TP-903",
			batchId,
			taskFolder,
			projectRoot,
		});

		assert.equal(result.ok, true, result.error);
		assert.equal(result.committed, true);
		assert.equal(
			fs.existsSync(path.join(worktreePath, ".review", "session.json")),
			true,
			".review/session.json must survive the lane commit",
		);
		assert.equal(
			fs.existsSync(path.join(worktreePath, ".review", "spine-stet-baseline.ref")),
			true,
			".review/spine-stet-baseline.ref must survive the lane commit",
		);
		assert.equal(fs.existsSync(path.join(routerDir, "state.db")), false, ".pi-smart-router must still be cleaned");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("lane commit with only kept-path residue succeeds without staging", async () => {
	const projectRoot = await initGitRepo("spine-lane-commit-kept-residue-");
	try {
		const batchId = "20261023T120200";
		const { worktreePath, taskBranch } = setupLaneWorktree(projectRoot, batchId);
		seedStetState(worktreePath);
		// No worker changes — only stet state (kept) is present in the worktree.
		const taskFolder = path.join(worktreePath, "spine-tasks", "TP-904-smoke");
		fs.mkdirSync(taskFolder, { recursive: true });

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId: "TP-904",
			batchId,
			taskFolder,
			projectRoot,
		});

		assert.equal(result.ok, true, result.error);
		assert.equal(result.committed, false);
		assert.equal(fs.existsSync(path.join(worktreePath, ".review", "session.json")), true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
