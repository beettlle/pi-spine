import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { listChangedFiles } from "../../src/batch/contract-verify.mjs";

test("listChangedFiles with sinceCommit scopes diff to commits after anchor", async () => {
	const worktreePath = await initGitRepo("spine-contract-scoped-");
	try {
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "src/task-one.mjs"), "export const one = 1;\n");
		execFileSync("git", ["add", "src/task-one.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task one"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["checkout", "-b", "lane-serialized"], { cwd: worktreePath, stdio: "ignore" });

		fs.writeFileSync(path.join(worktreePath, "src/task-one.mjs"), "export const one = 2;\n");
		execFileSync("git", ["add", "src/task-one.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane task 1"], { cwd: worktreePath, stdio: "ignore" });
		const taskOneCommit = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			encoding: "utf-8",
		}).trim();

		fs.writeFileSync(path.join(worktreePath, "src/task-two.mjs"), "export const two = 1;\n");
		execFileSync("git", ["add", "src/task-two.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane task 2"], { cwd: worktreePath, stdio: "ignore" });

		const cumulative = listChangedFiles(worktreePath, "main");
		assert.ok(cumulative.includes("src/task-one.mjs"));
		assert.ok(cumulative.includes("src/task-two.mjs"));

		const scoped = listChangedFiles(worktreePath, "main", taskOneCommit);
		assert.deepEqual(scoped, ["src/task-two.mjs"]);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});

test("listChangedFiles without sinceCommit preserves baseBranch...HEAD", async () => {
	const worktreePath = await initGitRepo("spine-contract-scoped-default-");
	try {
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		execFileSync("git", ["checkout", "-b", "lane-default"], { cwd: worktreePath, stdio: "ignore" });
		fs.writeFileSync(path.join(worktreePath, "src/only.mjs"), "export const x = 1;\n");
		execFileSync("git", ["add", "src/only.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane change"], { cwd: worktreePath, stdio: "ignore" });

		const changed = listChangedFiles(worktreePath, "main");
		assert.deepEqual(changed, ["src/only.mjs"]);

		const explicitCumulative = execFileSync(
			"git",
			["diff", "--name-only", "main...HEAD"],
			{ cwd: worktreePath, encoding: "utf-8" },
		)
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		assert.deepEqual(changed, explicitCumulative);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});
