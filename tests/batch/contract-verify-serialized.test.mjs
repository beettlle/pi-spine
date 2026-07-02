import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { verifyContract } from "../../src/batch/contract-verify.mjs";

/**
 * @param {string} worktreePath
 * @returns {string}
 */
function headSha(worktreePath) {
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

test("verifyContract with sinceCommit ignores prior same-lane task fileScopeMustNotChange violations", async () => {
	const worktreePath = await initGitRepo("spine-contract-serialized-");
	try {
		fs.mkdirSync(path.join(worktreePath, "src", "task-one"), { recursive: true });
		fs.mkdirSync(path.join(worktreePath, "src", "task-two"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "src/task-one/a.mjs"), "export const a = 1;\n");
		execFileSync("git", ["add", "-A"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "base"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["checkout", "-b", "lane-serialized"], { cwd: worktreePath, stdio: "ignore" });

		fs.writeFileSync(path.join(worktreePath, "src/task-one/a.mjs"), "export const a = 2;\n");
		execFileSync("git", ["add", "src/task-one/a.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane task 1"], { cwd: worktreePath, stdio: "ignore" });
		const taskOneCommit = headSha(worktreePath);

		fs.writeFileSync(path.join(worktreePath, "src/task-two/b.mjs"), "export const b = 1;\n");
		execFileSync("git", ["add", "src/task-two/b.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane task 2"], { cwd: worktreePath, stdio: "ignore" });

		const cumulative = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: ["src/task-two/**"],
				fileScopeMustNotChange: ["src/task-one/**"],
				artifactsMustExist: [],
			},
			{ baseBranch: "main" },
		);
		assert.equal(cumulative.ok, false);
		const cumulativeForbidden = cumulative.checks.filter(
			(check) => check.field === "fileScopeMustNotChange" && !check.ok,
		);
		assert.ok(cumulativeForbidden.length > 0);

		const scoped = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: ["src/task-two/**"],
				fileScopeMustNotChange: ["src/task-one/**"],
				artifactsMustExist: [],
			},
			{ baseBranch: "main", sinceCommit: taskOneCommit },
		);
		assert.equal(scoped.ok, true);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});

test("verifyContract without sinceCommit preserves cumulative lane branch behavior", async () => {
	const worktreePath = await initGitRepo("spine-contract-parallel-");
	try {
		fs.mkdirSync(path.join(worktreePath, "src", "only"), { recursive: true });
		execFileSync("git", ["checkout", "-b", "lane-parallel"], { cwd: worktreePath, stdio: "ignore" });
		fs.writeFileSync(path.join(worktreePath, "src/only/x.mjs"), "export const x = 1;\n");
		execFileSync("git", ["add", "-A"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "single task lane"], { cwd: worktreePath, stdio: "ignore" });

		const result = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: ["src/only/**"],
				fileScopeMustNotChange: [],
				artifactsMustExist: [],
			},
			{ baseBranch: "main" },
		);
		assert.equal(result.ok, true);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});
