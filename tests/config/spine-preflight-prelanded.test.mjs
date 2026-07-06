import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadSpineConfig } from "../../src/config/spine-config-load.mjs";
import {
	checkPrelandedFileScopeWarn,
	listPrelandedFileScopeStaleTasks,
	runBatchPreflight,
	runPreflightPlanCheck,
} from "../../src/config/spine-preflight-lib.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PRELANDED_PROMPT = `# Task: SP-902 — Preflight prelanded fixture

## Mission
Preflight stale fileScopeMustChange warning.

## Dependencies
- **None**

## File Scope
- \`src/preflight-feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/preflight-feature.mjs\` |

## Steps
### Step 1: Work
- [ ] one

### Step 2: Testing & Verification
- [ ] verify

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

/**
 * @param {string} projectRoot
 * @param {string} message
 */
function gitCommitAll(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 */
function writePendingPrelandedTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-902-preflight-prelanded");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), PRELANDED_PROMPT, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { "SP-902": [] } }),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function prelandImplementation(projectRoot) {
	const featurePath = path.join(projectRoot, "src", "preflight-feature.mjs");
	fs.mkdirSync(path.dirname(featurePath), { recursive: true });
	fs.writeFileSync(featurePath, "export const prelanded = true;\n", "utf-8");
	gitCommitAll(projectRoot, "preland implementation on main");
}

test("checkPrelandedFileScopeWarn passes when no stale pending tasks", async () => {
	const projectRoot = await initGitRepo("spine-preflight-preland-quiet-");
	try {
		writePendingPrelandedTask(projectRoot);
		gitCommitAll(projectRoot, "pending task only");

		const check = checkPrelandedFileScopeWarn({ projectRoot });
		assert.equal(check.ok, true);
		assert.notEqual(check.warning, true);
		assert.match(check.message, /no pending tasks with stale fileScopeMustChange/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkPrelandedFileScopeWarn warns for prelanded fileScopeMustChange", async () => {
	const projectRoot = await initGitRepo("spine-preflight-preland-warn-");
	try {
		writePendingPrelandedTask(projectRoot);
		gitCommitAll(projectRoot, "pending task");
		prelandImplementation(projectRoot);

		const staleTasks = listPrelandedFileScopeStaleTasks({ projectRoot });
		assert.equal(staleTasks.length, 1);
		assert.equal(staleTasks[0].taskId, "SP-902");

		const check = checkPrelandedFileScopeWarn({ projectRoot });
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.message, /SP-902/);
		assert.match(check.message, /already changed on main/i);
		assert.match(check.suggestedCommand, /spine tasks validate pending --warnings-only/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("listPrelandedFileScopeStaleTasks reports multiple stale pending tasks", async () => {
	const projectRoot = await initGitRepo("spine-preflight-preland-batch-read-");
	try {
		writePendingPrelandedTask(projectRoot);
		const secondFolder = path.join(projectRoot, "spine-tasks", "SP-903-preflight-prelanded-two");
		fs.mkdirSync(secondFolder, { recursive: true });
		fs.writeFileSync(
			path.join(secondFolder, "PROMPT.md"),
			PRELANDED_PROMPT.replaceAll("SP-902", "SP-903"),
			"utf-8",
		);
		fs.writeFileSync(path.join(secondFolder, "STATUS.md"), "# Status\n", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "SP-902": [], "SP-903": [] } }),
			"utf-8",
		);
		gitCommitAll(projectRoot, "pending tasks");
		prelandImplementation(projectRoot);

		const staleTasks = listPrelandedFileScopeStaleTasks({ projectRoot });
		assert.equal(staleTasks.length, 2);
		const staleIds = staleTasks.map((entry) => entry.taskId).sort();
		assert.deepEqual(staleIds, ["SP-902", "SP-903"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight and plan check surface prelanded file-scope warning", async () => {
	const projectRoot = await initGitRepo("spine-preflight-preland-batch-");
	try {
		writePendingPrelandedTask(projectRoot);
		gitCommitAll(projectRoot, "pending task");
		prelandImplementation(projectRoot);

		const preflight = runBatchPreflight({ projectRoot, skipDoctor: true });
		assert.equal(preflight.ok, true);
		const prelandCheck = preflight.checks.find((check) => check.id === "prelanded-file-scope");
		assert.ok(prelandCheck);
		assert.equal(prelandCheck.warning, true);
		assert.match(prelandCheck.message, /SP-902/);

		const plan = runPreflightPlanCheck({
			projectRoot,
			configResult: loadSpineConfig(projectRoot),
		});
		assert.equal(plan.status, "ok");
		assert.match(plan.message, /Pre-landed contract risk/i);
		assert.match(plan.message, /SP-902/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
