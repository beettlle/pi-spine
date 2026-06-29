import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { commitLaneWorktree } from "../../src/batch/lane-commit.mjs";
import {
	hasReleaseCriticalContract,
	isLegacyStubDoneMarker,
	shouldEnforceStubContractAtLaneCommit,
	verifyStubFileScopeMustChange,
} from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const IMPLEMENTATION_PROMPT = `# Task: SP-900 — Stub contract enforcement fixture

**Size:** M

## Mission
Change required source file.

## Dependencies
- **None**

## File Scope
- \`src/batch/retry.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/batch/retry.mjs\` |

## Steps
### Step 1: Work
- [ ] change file

## Completion Criteria
- [ ] done

## Do NOT
- skip contract
`;

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} taskId
 */
function provisionLaneWorktree(projectRoot, batchId, taskId) {
	const taskBranch = `task/spine-lane-1-${batchId}`;
	const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
	const taskFolder = path.join(worktreePath, "spine-tasks", `${taskId}-fixture`);

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
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), IMPLEMENTATION_PROMPT, "utf-8");

	return { worktreePath, taskBranch, taskFolder };
}

test("verifyStubFileScopeMustChange fails when contract paths are unchanged", async () => {
	const projectRoot = await initGitRepo("spine-stub-contract-verify-");
	try {
		const { worktreePath } = provisionLaneWorktree(projectRoot, "20260629T100000", "SP-900");
		const parsed = parseContract(IMPLEMENTATION_PROMPT);

		const result = verifyStubFileScopeMustChange(worktreePath, parsed, "main", [
			"spine-tasks/SP-900-fixture/.DONE",
		]);
		assert.equal(result.ok, false);
		assert.match(result.failures[0], /fileScopeMustChange/);
		assert.match(result.failures[0], /retry\.mjs/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyStubFileScopeMustChange passes when contract path changed", async () => {
	const projectRoot = await initGitRepo("spine-stub-contract-pass-");
	try {
		const { worktreePath } = provisionLaneWorktree(projectRoot, "20260629T100001", "SP-901");
		const target = path.join(worktreePath, "src/batch/retry.mjs");
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, "// stub contract pass\n", "utf-8");
		execFileSync("git", ["add", target], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "implement"], { cwd: worktreePath, stdio: "ignore" });

		const parsed = parseContract(IMPLEMENTATION_PROMPT);
		const result = verifyStubFileScopeMustChange(worktreePath, parsed, "main");
		assert.equal(result.ok, true);
		assert.deepEqual(result.failures, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree rejects stub completion without fileScopeMustChange diffs", async () => {
	const projectRoot = await initGitRepo("spine-stub-lane-commit-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260629T100002";
		const taskId = "SP-902";
		const { worktreePath, taskBranch, taskFolder } = provisionLaneWorktree(
			projectRoot,
			batchId,
			taskId,
		);
		fs.writeFileSync(
			path.join(taskFolder, ".DONE"),
			JSON.stringify({ taskId, completedAt: "2026-06-29T10:00:00.000Z" }),
			"utf-8",
		);

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
			projectRoot,
		});

		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "stub");
		assert.match(result.error, /file-scope changes/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("commitLaneWorktree allows stub completion when fileScopeMustChange is satisfied", async () => {
	const projectRoot = await initGitRepo("spine-stub-lane-commit-pass-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const batchId = "20260629T100003";
		const taskId = "SP-903";
		const { worktreePath, taskBranch, taskFolder } = provisionLaneWorktree(
			projectRoot,
			batchId,
			taskId,
		);
		const target = path.join(worktreePath, "src/batch/retry.mjs");
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, "// implemented\n", "utf-8");
		fs.writeFileSync(
			path.join(taskFolder, ".DONE"),
			"Completed: 2026-06-29\nTask: stub\n",
			"utf-8",
		);

		const result = commitLaneWorktree({
			worktreePath,
			taskBranch,
			taskId,
			batchId,
			taskFolder,
			projectRoot,
		});

		assert.equal(result.ok, true);
		assert.equal(result.committed, true);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("stub contract helpers detect release-critical contracts and legacy markers", () => {
	const parsed = parseContract(IMPLEMENTATION_PROMPT);
	assert.equal(hasReleaseCriticalContract(parsed), true);
	assert.equal(isLegacyStubDoneMarker("Completed: 2026-06-29\nTask: stub\n"), true);
	assert.equal(isLegacyStubDoneMarker('{"taskId":"SP-334"}'), false);
});

test("shouldEnforceStubContractAtLaneCommit uses env or legacy .DONE marker", async () => {
	const projectRoot = await initGitRepo("spine-stub-enforce-detect-");
	try {
		const donePath = path.join(projectRoot, ".DONE");
		fs.writeFileSync(donePath, "Completed\nTask: stub\n", "utf-8");

		const prevStub = process.env.SPINE_WORKER_STUB;
		delete process.env.SPINE_WORKER_STUB;
		assert.equal(shouldEnforceStubContractAtLaneCommit(donePath), true);

		fs.writeFileSync(donePath, '{"taskId":"SP-334","completedAt":"2026-06-29T00:00:00.000Z"}', "utf-8");
		assert.equal(shouldEnforceStubContractAtLaneCommit(donePath), false);

		process.env.SPINE_WORKER_STUB = "1";
		assert.equal(shouldEnforceStubContractAtLaneCommit(donePath), true);

		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
