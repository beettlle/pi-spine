import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	buildHeadline,
	buildSuggestedCommand,
} from "../../src/batch/diagnosis.mjs";
import { inferStubExitReasonFromDoneMarker } from "../../src/batch/diagnosis-stub.mjs";
import { commitLaneWorktree } from "../../src/batch/lane-commit.mjs";
import { checkStubReleaseCritical } from "../../src/config/spine-preflight-lib.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const RELEASE_TASK_PROMPT = `# Task: SP-140 — Version bump

**Size:** M

## Mission
Bump package version to 1.2.0.

## Dependencies
- **None**

## File Scope
- \`package.json\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`package.json\` |

## Steps
### Step 1: Bump
- [ ] update version

## Completion Criteria
- [ ] version bumped

## Do NOT
- skip version change
`;

/**
 * @param {string} projectRoot
 */
function writeReleaseTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-140-version-bump");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), RELEASE_TASK_PROMPT, "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { "SP-140": [] } }),
		"utf-8",
	);
}

test("stub cannot succeed merge/version task without file-scope changes", async () => {
	const projectRoot = await initGitRepo("spine-stub-release-guard-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeReleaseTask(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "release task fixture"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		const batchId = "20260628T051158";
		const taskId = "SP-140";
		const taskBranch = `task/spine-lane-1-${batchId}`;
		const worktreePath = path.join(projectRoot, ".worktrees", `spine-${batchId}`, "lane-1");
		const taskFolder = path.join(worktreePath, "spine-tasks", "SP-140-version-bump");

		execFileSync("git", ["branch", `orch/spine-${batchId}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
		execFileSync(
			"git",
			["worktree", "add", "-b", taskBranch, worktreePath, `orch/spine-${batchId}`],
			{ cwd: projectRoot, stdio: "ignore" },
		);

		fs.writeFileSync(
			path.join(taskFolder, ".DONE"),
			"Completed: 2026-06-28T05:12:28.871Z\nTask: stub\n",
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
		assert.match(result.error, /package\.json/);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("checkStubReleaseCritical warns when stub mode has pending fileScopeMustChange tasks", async () => {
	const projectRoot = await initGitRepo("spine-stub-preflight-warn-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeReleaseTask(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "release task"], { cwd: projectRoot, stdio: "ignore" });

		const check = checkStubReleaseCritical({ projectRoot });
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.message, /SPINE_WORKER_STUB=1/);
		assert.match(check.message, /SP-140/);
		assert.equal(check.suggestedCommand, "unset SPINE_WORKER_STUB");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("diagnosis surfaces exitReason stub for M/L legacy stub .DONE markers", () => {
	const exitReason = inferStubExitReasonFromDoneMarker(
		RELEASE_TASK_PROMPT,
		"Completed: 2026-06-28\nTask: stub\n",
	);
	assert.equal(exitReason, "stub");

	const smallPrompt = RELEASE_TASK_PROMPT.replace("**Size:** M", "**Size:** S");
	assert.equal(
		inferStubExitReasonFromDoneMarker(smallPrompt, "Completed\nTask: stub\n"),
		null,
	);

	const headline = buildHeadline("needs_retry", {
		batchId: "20260629T021550",
		failedTaskId: "SP-334",
		exitReason: "stub",
	});
	assert.match(headline, /stub-completed without file-scope changes/);
	assert.match(headline, /SP-334/);

	const command = buildSuggestedCommand("needs_retry", {
		failedTaskId: "SP-334",
		exitReason: "stub",
	});
	assert.match(command, /unset SPINE_WORKER_STUB/);
	assert.match(command, /retry SP-334/);
});
