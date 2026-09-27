import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import {
	casUpdateBaseRef,
	mergeOrchIntoBaseIsolated,
	plumbingMergeOrchIntoBase,
} from "../../src/batch/integrate-worktree.mjs";
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

function completedBatchFixture(orchBranch, batchId) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
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

function git(projectRoot, args) {
	return execFileSync("git", args, { cwd: projectRoot, encoding: "utf-8" }).trim();
}

function commitFile(projectRoot, filePath, content, message) {
	fs.mkdirSync(path.dirname(path.join(projectRoot, filePath)), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, filePath), content, "utf-8");
	execFileSync("git", ["add", filePath], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Diverged history: main gains base-only.txt after orch branched, so integrate
 * cannot fast-forward and must take a merge path.
 */
function createDivergedOrch(projectRoot, orchBranch) {
	commitFile(projectRoot, "base-only.txt", "on main\n", "main diverges");
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["reset", "--hard", "HEAD~1"], { cwd: projectRoot, stdio: "ignore" });
	commitFile(projectRoot, "orch-work.txt", "lane merge landed on orch\n", "orch work");
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Orch strictly ahead of main (same tree base), so integrate fast-forwards.
 */
function createFastForwardOrch(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	commitFile(projectRoot, "orch-work.txt", "lane merge landed on orch\n", "orch work");
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * Git PATH shim: forwards every invocation to the real git binary while logging argv
 * and, at the configured interception point, landing a concurrent commit on base.
 *
 * - mode "update-ref": right before `git update-ref refs/heads/<base> <new> <expected>`,
 *   i.e. between the SHA capture and the compare-and-swap update itself.
 * - mode "worktree": right after the first `git rev-parse <base>` that follows
 *   `git worktree add` (the pre-merge base SHA capture in mergeInIntegrateWorktree).
 */
function installGitShim() {
	const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-cas-shim-"));
	const realGit = execFileSync("which", ["git"], { encoding: "utf-8" }).trim();
	const statePath = path.join(shimDir, "state.json");
	const logPath = path.join(shimDir, "argv.log");
	const state = { base: "main", mode: "update-ref", armed: false, moved: "" };
	fs.writeFileSync(statePath, JSON.stringify(state), "utf-8");
	fs.writeFileSync(logPath, "", "utf-8");

	const shim = `#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const REAL_GIT = ${JSON.stringify(realGit)};
const STATE_PATH = ${JSON.stringify(statePath)};
const LOG_PATH = ${JSON.stringify(logPath)};
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
fs.appendFileSync(LOG_PATH, JSON.stringify(args) + "\\n");

function runReal(gitArgs) {
	return spawnSync(REAL_GIT, gitArgs, { encoding: "utf-8", env: { ...process.env } });
}

function saveState() {
	fs.writeFileSync(STATE_PATH, JSON.stringify(state), "utf-8");
}

function concurrentCommitOnBase(ref) {
	const oldTip = runReal(["rev-parse", ref]).stdout.trim();
	const treeSha = runReal(["rev-parse", oldTip + "^{tree}"]).stdout.trim();
	const newTip = runReal(["commit-tree", treeSha, "-p", oldTip, "-m", "concurrent commit on base"]).stdout.trim();
	runReal(["update-ref", ref, newTip]);
	state.moved = newTip;
	saveState();
}

const isWorktreeAdd = args[0] === "worktree" && args[1] === "add" && args[args.length - 1] === state.base;
if (isWorktreeAdd && state.mode === "worktree" && !state.armed) {
	state.armed = true;
	saveState();
}

const isArmedCapture =
	state.armed && !state.moved && args[0] === "rev-parse" && args[1] === state.base;
const isCasUpdateRef =
	state.mode === "update-ref" &&
	!state.moved &&
	args[0] === "update-ref" &&
	args[1] === "refs/heads/" + state.base &&
	args.length >= 4;

if (isCasUpdateRef) {
	concurrentCommitOnBase("refs/heads/" + state.base);
}

const res = runReal(args);
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);

if (isArmedCapture) {
	concurrentCommitOnBase("refs/heads/" + state.base);
}

process.exit(res.status === null ? 1 : res.status);
`;
	const shimPath = path.join(shimDir, "git");
	fs.writeFileSync(shimPath, shim, "utf-8");
	fs.chmodSync(shimPath, 0o755);
	return { shimDir, statePath, logPath };
}

/**
 * Runs fn with the git shim first on PATH; all git subprocesses spawned inside fn
 * (and only those) go through the shim.
 */
function withGitShim(shimDir, fn) {
	const originalPath = process.env.PATH ?? "";
	process.env.PATH = `${shimDir}:${originalPath}`;
	try {
		return fn();
	} finally {
		process.env.PATH = originalPath;
	}
}

function readArgvLog(logPath) {
	return fs
		.readFileSync(logPath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

test("casUpdateBaseRef moves the ref when expected old SHA matches", async () => {
	const projectRoot = await initGitRepo("spine-cas-happy-");
	try {
		const oldTip = git(projectRoot, ["rev-parse", "main"]);
		const newTip = execFileSync("git", ["commit-tree", `${oldTip}^{tree}`, "-m", "next"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = casUpdateBaseRef({
			projectRoot,
			baseBranch: "main",
			newSha: newTip,
			expectedOldSha: oldTip,
		});

		assert.deepEqual(result, { ok: true });
		assert.equal(git(projectRoot, ["rev-parse", "main"]), newTip);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("casUpdateBaseRef returns BaseMoved and leaves the concurrent commit on base", async () => {
	const projectRoot = await initGitRepo("spine-cas-moved-");
	try {
		const oldTip = git(projectRoot, ["rev-parse", "main"]);
		// Simulate a commit landing on base after the SHA was captured.
		const concurrentTip = execFileSync(
			"git",
			["commit-tree", `${oldTip}^{tree}`, "-p", oldTip, "-m", "concurrent commit on base"],
			{ cwd: projectRoot, encoding: "utf-8" },
		).trim();
		execFileSync("git", ["update-ref", "refs/heads/main", concurrentTip], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		const staleTip = execFileSync("git", ["commit-tree", `${oldTip}^{tree}`, "-m", "stale"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = casUpdateBaseRef({
			projectRoot,
			baseBranch: "main",
			newSha: staleTip,
			expectedOldSha: oldTip,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "BaseMoved");
		assert.equal(
			result.error,
			`main moved during integrate (expected ${oldTip}, found ${concurrentTip}) — re-run spine integrate`,
		);
		// The concurrent commit is still the base tip — nothing was clobbered.
		assert.equal(git(projectRoot, ["rev-parse", "main"]), concurrentTip);
		execFileSync("git", ["merge-base", "--is-ancestor", concurrentTip, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("plumbingMergeOrchIntoBase lands a merge commit with the captured base as first parent", async () => {
	const projectRoot = await initGitRepo("spine-cas-plumbing-happy-");
	try {
		createDivergedOrch(projectRoot, "orch/spine-cas-direct");
		const baseBefore = git(projectRoot, ["rev-parse", "main"]);

		const result = plumbingMergeOrchIntoBase({
			projectRoot,
			baseBranch: "main",
			orchBranch: "orch/spine-cas-direct",
			mergeMessage: "integrate orch/spine-cas-direct into main",
		});

		assert.deepEqual(result, { ok: true, mergeCommit: result.mergeCommit, mode: "plumbing" });
		assert.equal(git(projectRoot, ["rev-parse", "main"]), result.mergeCommit);
		assert.equal(git(projectRoot, ["rev-parse", `${result.mergeCommit}^1`]), baseBefore);
		const files = execFileSync("git", ["ls-tree", "--name-only", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(files, /base-only\.txt/);
		assert.match(files, /orch-work\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("fast-forward integrate fails with BaseMoved when base moves before the ref update", async () => {
	const projectRoot = await initGitRepo("spine-cas-race-ff-");
	const orchBranch = "orch/spine-cas-race-ff";
	const batchId = "20260927T010000";
	const { shimDir, statePath, logPath } = installGitShim();
	try {
		createFastForwardOrch(projectRoot, orchBranch);
		const baseBefore = git(projectRoot, ["rev-parse", "main"]);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		let result;
		withGitShim(shimDir, () => {
			result = integrateOrchToBase({ projectRoot });
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "BaseMoved");
		assert.match(result.error ?? "", /^main moved during integrate \(expected [0-9a-f]{40}, found [0-9a-f]{40}\) — re-run spine integrate$/);
		assert.ok(result.error?.includes(baseBefore), "error names the expected pre-move SHA");
		assert.match(result.headline, /re-run spine integrate/);

		// The concurrent commit survived: it is the base tip the CAS found.
		const movedTip = JSON.parse(fs.readFileSync(statePath, "utf-8")).moved;
		assert.match(movedTip, /^[0-9a-f]{40}$/);
		assert.equal(git(projectRoot, ["rev-parse", "main"]), movedTip);
		execFileSync("git", ["merge-base", "--is-ancestor", movedTip, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const events = readJournalEvents(projectRoot, batchId);
		const failed = events.find((event) => event.type === "integrate.failed");
		assert.ok(failed, "integrate.failed journaled");
		assert.equal(failed.payload.conflict, false, "BaseMoved is not a merge conflict");

		// Re-run (no shim) succeeds — orch now needs a plumbing merge over the concurrent commit.
		const rerun = integrateOrchToBase({ projectRoot });
		assert.equal(rerun.ok, true, rerun.error ?? rerun.headline);
	} finally {
		await destroyGitRepo(projectRoot);
		fs.rmSync(shimDir, { recursive: true, force: true, maxRetries: 3 });
	}
});

test("plumbing integrate fails with BaseMoved when base moves before the ref update", async () => {
	const projectRoot = await initGitRepo("spine-cas-race-plumbing-");
	const orchBranch = "orch/spine-cas-race-plumbing";
	const batchId = "20260927T020000";
	const { shimDir, statePath, logPath } = installGitShim();
	try {
		createDivergedOrch(projectRoot, orchBranch);
		// main checked out with a human edit → isolated plumbing merge (no checkout churn).
		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "operator draft\n", "utf-8");
		const baseBefore = git(projectRoot, ["rev-parse", "main"]);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		approveGateForIntegrate(projectRoot, fixture, batchId);

		let result;
		withGitShim(shimDir, () => {
			result = integrateOrchToBase({ projectRoot });
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "BaseMoved");
		assert.match(result.error ?? "", /main moved during integrate \(expected [0-9a-f]{40}, found [0-9a-f]{40}\) — re-run spine integrate/);
		assert.ok(result.error?.includes(baseBefore), "error names the expected pre-move SHA");

		// merge-tree ran on captured SHAs, not branch names.
		const argvLines = readArgvLog(logPath);
		const mergeTree = argvLines.find((args) => args[0] === "merge-tree");
		assert.ok(mergeTree, "merge-tree invoked");
		assert.equal(mergeTree[1], "--write-tree");
		assert.equal(mergeTree[2], baseBefore, "merge-tree base arg is the captured SHA");
		assert.match(mergeTree[3], /^[0-9a-f]{40}$/, "merge-tree orch arg is a SHA");
		const commitTree = argvLines.find((args) => args[0] === "commit-tree");
		assert.ok(commitTree, "commit-tree invoked");
		assert.equal(commitTree[2], "-p");
		assert.equal(commitTree[3], baseBefore, "merge commit first parent is the captured base SHA");

		// Nothing orphaned: the concurrent commit is still the base tip.
		const movedTip = JSON.parse(fs.readFileSync(statePath, "utf-8")).moved;
		assert.equal(git(projectRoot, ["rev-parse", "main"]), movedTip);
		execFileSync("git", ["merge-base", "--is-ancestor", movedTip, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const events = readJournalEvents(projectRoot, batchId);
		assert.ok(events.some((event) => event.type === "integrate.failed"));

		// Re-run (no shim) lands the merge over the concurrent commit.
		const rerun = integrateOrchToBase({ projectRoot });
		assert.equal(rerun.ok, true, rerun.error ?? rerun.headline);
		assert.equal(git(projectRoot, ["rev-parse", `${rerun.mergeCommit}^1`]), movedTip);
	} finally {
		await destroyGitRepo(projectRoot);
		fs.rmSync(shimDir, { recursive: true, force: true, maxRetries: 3 });
	}
});

test("worktree merge fails with BaseMoved when base moves after the pre-merge SHA capture", async () => {
	const projectRoot = await initGitRepo("spine-cas-race-worktree-");
	const orchBranch = "orch/spine-cas-race-worktree";
	const { shimDir, statePath } = installGitShim();
	fs.writeFileSync(
		statePath,
		JSON.stringify({ base: "main", mode: "worktree", armed: false, moved: "" }),
		"utf-8",
	);
	try {
		createDivergedOrch(projectRoot, orchBranch);
		// Operator on a feature branch → base is not checked out in projectRoot →
		// mergeOrchIntoBaseIsolated merges inside the integrate worktree (salvage route).
		execFileSync("git", ["checkout", "-b", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });
		fs.writeFileSync(path.join(projectRoot, "human-wip.txt"), "feature draft\n", "utf-8");
		const baseBefore = git(projectRoot, ["rev-parse", "main"]);

		let result;
		withGitShim(shimDir, () => {
			result = mergeOrchIntoBaseIsolated({
				projectRoot,
				baseBranch: "main",
				orchBranch,
				batchId: "20260927T030000",
			});
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "BaseMoved");
		assert.match(result.error ?? "", /main moved during integrate \(expected [0-9a-f]{40}, found [0-9a-f]{40}\) — re-run spine integrate/);
		assert.ok(result.error?.includes(baseBefore), "error names the expected pre-move SHA");

		// The concurrent commit is reachable from main (the merge commit built on it).
		const movedTip = JSON.parse(fs.readFileSync(statePath, "utf-8")).moved;
		assert.match(movedTip, /^[0-9a-f]{40}$/);
		assert.ok(
			execFileSync("git", ["merge-base", "--is-ancestor", movedTip, "main"], {
				cwd: projectRoot,
				stdio: ["ignore", "pipe", "pipe"],
			}),
		);
		// orch work also landed on main (the worktree merge advanced the ref before the check).
		assert.ok(
			execFileSync("git", ["merge-base", "--is-ancestor", orchBranch, "main"], {
				cwd: projectRoot,
				stdio: ["ignore", "pipe", "pipe"],
			}),
		);
	} finally {
		await destroyGitRepo(projectRoot);
		fs.rmSync(shimDir, { recursive: true, force: true, maxRetries: 3 });
	}
});
