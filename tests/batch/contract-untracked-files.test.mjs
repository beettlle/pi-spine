import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { initGitRepo, destroyGitRepo } from "../helpers/git-fixture.mjs";
import { verifyContract } from "../../src/batch/contract-verify.mjs";

async function withWorktree(run) {
	const worktreePath = await initGitRepo("spine-contract-verify-untracked-");
	try {
		await run(worktreePath);
	} finally {
		await destroyGitRepo(worktreePath);
	}
}

test("verifyContract auto-stages untracked files matching fileScopeMustChange", async () => {
	await withWorktree(async (worktreePath) => {
		// initGitRepo already creates an initial commit on main with spine-tasks/

		// Create a new untracked file that matches fileScopeMustChange
		const inScopeFile = "src/new-feature.js";
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, inScopeFile), "console.log('in scope');");

		// Run verifyContract without explicitly staging
		const parsedContract = {
			fileScopeMustChange: ["src/*.js"],
		};

		const result = verifyContract(worktreePath, parsedContract);

		// It should auto-stage and pass the fileScopeMustChange check
		assert.equal(result.ok, true, `Expected verifyContract to pass, got: ${JSON.stringify(result.checks)}`);

		// Verify the file is actually staged
		const status = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		assert.match(status, /^A\s+src\/new-feature\.js/m, "File should be staged (added to index)");
	});
});

test("verifyContract does NOT stage untracked files outside fileScopeMustChange", async () => {
	await withWorktree(async (worktreePath) => {
		// Create untracked file out of scope
		const outOfScopeFile = "docs/notes.txt";
		fs.mkdirSync(path.join(worktreePath, "docs"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, outOfScopeFile), "out of scope");

		// Run verifyContract
		const parsedContract = {
			fileScopeMustChange: ["src/*.js"],
		};

		const result = verifyContract(worktreePath, parsedContract);

		// It should fail because the required file is not changed
		assert.equal(result.ok, false);
		const check = result.checks.find(c => c.field === "fileScopeMustChange");
		assert.match(check.message, /no matching changes/);

		// Verify the file remains untracked
		const status = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		assert.match(status, /^\?\?\s+docs\/notes\.txt/m, "File should remain untracked");
	});
});

test("verifyContract preserves behavior when no untracked files exist", async () => {
	await withWorktree(async (worktreePath) => {
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "src/existing.js"), "console.log('existing');");
		execFileSync("git", ["add", "src/existing.js"], { cwd: worktreePath });
		execFileSync("git", ["commit", "-m", "add existing"], { cwd: worktreePath });

		// Modify tracked file
		fs.writeFileSync(path.join(worktreePath, "src/existing.js"), "console.log('modified');");

		const parsedContract = {
			fileScopeMustChange: ["src/*.js"],
		};

		// The file is tracked but unstaged, listChangedFiles compares working tree vs index/HEAD
		// wait, listChangedFiles checks diff-index HEAD, so unstaged changes to tracked files are included.
		const result = verifyContract(worktreePath, parsedContract);

		assert.equal(result.ok, true, `Expected verifyContract to pass, got: ${JSON.stringify(result.checks)}`);

		// Verify no untracked files somehow appeared
		const status = execFileSync("git", ["status", "--porcelain"], {
			cwd: worktreePath,
			encoding: "utf-8",
		});
		assert.match(status, /^\s*M\s+src\/existing\.js/m, "File should still be modified");
	});
});
