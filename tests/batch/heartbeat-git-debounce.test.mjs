import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { configureGitIdentity } from "../helpers/git-fixture.mjs";
import {
	clearGitPorcelainDebounceCache,
	collectProgressSignals,
	getGitPorcelainCallCount,
	resetGitPorcelainCallCount,
} from "../../src/batch/heartbeat.mjs";

test("collectProgressSignals skips git porcelain when file-scope mtimes are stable", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-git-debounce-"));
	const taskFolder = path.join(dir, "spine-tasks", "SP-455");
	const scoped = path.join(dir, "src", "scoped.txt");
	fs.mkdirSync(path.dirname(scoped), { recursive: true });
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(scoped, "a", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "step 0", "utf-8");

	execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
	configureGitIdentity(dir);
	execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });
	fs.writeFileSync(scoped, "dirty", "utf-8");

	try {
		clearGitPorcelainDebounceCache();
		resetGitPorcelainCallCount();

		const first = collectProgressSignals({
			worktreePath: dir,
			taskFolder,
			fileScopePaths: ["src/scoped.txt"],
		});
		assert.equal(getGitPorcelainCallCount(), 1);
		assert.ok(first.dirtyPaths.includes("src/scoped.txt"));

		const second = collectProgressSignals({
			worktreePath: dir,
			taskFolder,
			fileScopePaths: ["src/scoped.txt"],
		});
		assert.equal(getGitPorcelainCallCount(), 1, "git porcelain should be debounced");
		assert.deepEqual(second.dirtyPaths, first.dirtyPaths);
	} finally {
		clearGitPorcelainDebounceCache();
		resetGitPorcelainCallCount();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("collectProgressSignals runs git porcelain when a scoped file is touched", () => {
	const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "hb-git-debounce-touch-"));
	const taskFolder = path.join(dir, "spine-tasks", "SP-455");
	const scoped = path.join(dir, "src", "scoped.txt");
	fs.mkdirSync(path.dirname(scoped), { recursive: true });
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(scoped, "a", "utf-8");
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "step 0", "utf-8");

	execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
	configureGitIdentity(dir);
	execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });

	try {
		clearGitPorcelainDebounceCache();
		resetGitPorcelainCallCount();

		collectProgressSignals({
			worktreePath: dir,
			taskFolder,
			fileScopePaths: ["src/scoped.txt"],
		});
		assert.equal(getGitPorcelainCallCount(), 1);

		fs.writeFileSync(scoped, "touched", "utf-8");

		const afterTouch = collectProgressSignals({
			worktreePath: dir,
			taskFolder,
			fileScopePaths: ["src/scoped.txt"],
		});
		assert.equal(getGitPorcelainCallCount(), 2, "mtime change should refresh git porcelain");
		assert.ok(afterTouch.dirtyPaths.includes("src/scoped.txt"));
	} finally {
		clearGitPorcelainDebounceCache();
		resetGitPorcelainCallCount();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
