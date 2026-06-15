import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	filterReviewScopeNoise,
	isNoiseReviewScopePath,
	resolveCodeReviewScopePaths,
	resolvePlanReviewScopePaths,
	resolveReviewScopePaths,
} from "../../src/batch/review-scope.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} root
 */
function writeScopeTask(root) {
	const folder = path.join(root, "spine-tasks", "SP-249-scope");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: SP-249 — Scope test

## Mission
Scope resolver test task.

## Dependencies
- **None**

## File Scope
- \`src/batch/review-scope.mjs\`
- \`tests/batch/review-scope.test.mjs\`
- \`spine-tasks/SP-249-scope/.reviews/1.md\`
- \`spine-tasks/SP-249-scope/.DONE\`
- \`.spine/runtime/batch/journal.jsonl\`

## Steps
### Step 1: Work
- [ ] one

## Completion Criteria
- [ ] done

## Do NOT
- nothing
`,
		"utf-8",
	);
	return folder;
}

test("isNoiseReviewScopePath matches runtime artifact paths", () => {
	assert.equal(isNoiseReviewScopePath("spine-tasks/TP-1/.reviews/1.md"), true);
	assert.equal(isNoiseReviewScopePath(".reviews/final.md"), true);
	assert.equal(isNoiseReviewScopePath("spine-tasks/TP-1/.DONE"), true);
	assert.equal(isNoiseReviewScopePath(".DONE"), true);
	assert.equal(isNoiseReviewScopePath(".spine/runtime/20260615/journal/events.jsonl"), true);
	assert.equal(isNoiseReviewScopePath("src/batch/review-scope.mjs"), false);
});

test("filterReviewScopeNoise dedupes and drops noise", () => {
	const filtered = filterReviewScopeNoise([
		"src/a.mjs",
		"src/a.mjs",
		"spine-tasks/TP/.DONE",
		".spine/runtime/x/log.txt",
		"src/b.mjs",
	]);
	assert.deepEqual(filtered, ["src/a.mjs", "src/b.mjs"]);
});

test("resolvePlanReviewScopePaths returns PROMPT File Scope minus noise", () => {
	const root = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "spine-scope-plan-"));
	try {
		const taskFolder = writeScopeTask(root);
		const paths = resolvePlanReviewScopePaths(taskFolder);
		assert.deepEqual(paths, [
			"src/batch/review-scope.mjs",
			"tests/batch/review-scope.test.mjs",
		]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveReviewScopePaths plan uses task PROMPT file scope", () => {
	const root = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "spine-scope-resolve-plan-"));
	try {
		const taskFolder = writeScopeTask(root);
		const result = resolveReviewScopePaths({
			worktreePath: root,
			reviewType: "plan",
			taskFolder,
		});
		assert.deepEqual(result, {
			scopePaths: ["src/batch/review-scope.mjs", "tests/batch/review-scope.test.mjs"],
		});
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveReviewScopePaths final returns empty scope", () => {
	const result = resolveReviewScopePaths({
		worktreePath: "/tmp/worktree",
		reviewType: "final",
		taskFolder: "/tmp/task",
	});
	assert.deepEqual(result, { scopePaths: [] });
});

test("resolveCodeReviewScopePaths uses baseline..HEAD when baseline provided", async () => {
	const projectRoot = await initGitRepo("spine-scope-code-baseline-");
	try {
		const baseline = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "src", "changed.mjs"), "export const x = 1;\n", "utf-8");
		fs.mkdirSync(path.join(projectRoot, "spine-tasks", "TP-1", ".reviews"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "TP-1", ".reviews", "1.md"),
			"review\n",
			"utf-8",
		);
		fs.writeFileSync(path.join(projectRoot, "spine-tasks", "TP-1", ".DONE"), "", "utf-8");
		fs.mkdirSync(path.join(projectRoot, ".spine", "runtime", "batch"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, ".spine", "runtime", "batch", "log.txt"), "log\n", "utf-8");
		execCommit(projectRoot, "lane work");

		const paths = resolveCodeReviewScopePaths(projectRoot, baseline);
		assert.deepEqual(paths, ["src/changed.mjs"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveCodeReviewScopePaths falls back to git diff --name-only without baseline", async () => {
	const projectRoot = await initGitRepo("spine-scope-code-fallback-");
	try {
		fs.writeFileSync(path.join(projectRoot, "tracked.mjs"), "export const v = 1;\n", "utf-8");
		execCommit(projectRoot, "add tracked file");
		fs.writeFileSync(path.join(projectRoot, "tracked.mjs"), "export const v = 2;\n", "utf-8");

		const paths = resolveCodeReviewScopePaths(projectRoot);
		assert.deepEqual(paths, ["tracked.mjs"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveReviewScopePaths code honors injectable git runner", () => {
	const calls = [];
	const result = resolveReviewScopePaths({
		worktreePath: "/tmp/wt",
		baseline: "abc123",
		reviewType: "code",
		taskFolder: "/tmp/task",
		runGit: (command, args, cwd) => {
			calls.push({ command, args, cwd });
			return "src/a.mjs\nspine-tasks/TP/.reviews/x.md\n";
		},
	});
	assert.deepEqual(calls, [
		{
			command: "git",
			args: ["diff", "--name-only", "abc123..HEAD"],
			cwd: "/tmp/wt",
		},
	]);
	assert.deepEqual(result, { scopePaths: ["src/a.mjs"] });
});

test("resolveCodeReviewScopePaths returns empty array when git fails", () => {
	const paths = resolveCodeReviewScopePaths("/nonexistent", "bad", () => {
		throw new Error("git failed");
	});
	assert.deepEqual(paths, []);
});
