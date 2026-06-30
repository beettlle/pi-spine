import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";
import { loadSpineConfig } from "../../src/config/spine-config-load.mjs";
import {
	checkOrchMergeConflictWarn,
	isMergeOriginMainTask,
	predictOrchMergeConflictRisk,
	runBatchPreflight,
	runPreflightPlanCheck,
} from "../../src/config/spine-preflight-lib.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PRD_REL_PATH = "docs/PRD.md";

const sampleRules = [
	{
		relPath: "taskplane-worker-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "worker",
		globs: [],
		parseStatus: "ok",
	},
];

const MERGE_ORIGIN_MAIN_PROMPT = `# Task: SP-137 — Merge origin/main

## Mission
Merge origin/main into the lane worktree for release recovery.

## Dependencies
- **None**

## File Scope
- \`docs/PRD.md\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |

## Steps
### Step 1: Merge
- [ ] merge origin/main

### Step 2: Testing & Verification
- [ ] verify merge

## Completion Criteria
- [ ] merged

## Do NOT
- skip merge
`;

/**
 * @param {string} projectRoot
 * @param {string} generatedAt
 * @param {string} prdBody
 */
function writePrdAndManifest(projectRoot, generatedAt, prdBody) {
	const prdPath = path.join(projectRoot, PRD_REL_PATH);
	fs.mkdirSync(path.dirname(prdPath), { recursive: true });
	fs.writeFileSync(prdPath, prdBody, "utf-8");

	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules: sampleRules,
		excluded: [],
	};
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

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
function writeMergeOriginMainTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-137-merge-origin-main");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), MERGE_ORIGIN_MAIN_PROMPT, "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { "SP-137": [] } }),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
async function setupOriginMainDivergenceFixture(projectRoot) {
	writePrdAndManifest(projectRoot, "2026-06-28T06:00:00.000Z", "# PRD base\n");
	gitCommitAll(projectRoot, "base prd and manifest");

	const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: projectRoot,
		encoding: "utf-8",
	}).trim();

	execFileSync("git", ["branch", "sim-origin-main", baseSha], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["checkout", "sim-origin-main"], { cwd: projectRoot, stdio: "ignore" });
	writePrdAndManifest(projectRoot, "2026-06-28T06:30:00.000Z", "# PRD origin/main\n");
	gitCommitAll(projectRoot, "origin/main versions");
	const originSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: projectRoot,
		encoding: "utf-8",
	}).trim();

	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
	writePrdAndManifest(projectRoot, "2026-06-28T06:45:00.000Z", "# PRD local main\n");
	gitCommitAll(projectRoot, "local main divergence");

	execFileSync("git", ["update-ref", "refs/remotes/origin/main", originSha], {
		cwd: projectRoot,
		stdio: "ignore",
	});
}

test("isMergeOriginMainTask detects merge-origin-main packet shapes", () => {
	assert.equal(
		isMergeOriginMainTask({
			title: "Merge origin/main",
			missionText: "Release recovery.",
			folderName: "SP-137-merge-origin-main",
		}),
		true,
	);
	assert.equal(
		isMergeOriginMainTask({
			title: "Docs update",
			missionText: "Edit README only.",
			folderName: "SP-200-docs",
		}),
		false,
	);
});

test("checkOrchMergeConflictWarn passes without pending merge-origin-main tasks", async () => {
	const projectRoot = await initGitRepo("spine-preflight-orch-quiet-");
	try {
		await setupOriginMainDivergenceFixture(projectRoot);

		const check = checkOrchMergeConflictWarn({ projectRoot });
		assert.equal(check.ok, true);
		assert.notEqual(check.warning, true);
		assert.match(check.message, /no pending merge-origin-main tasks/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkOrchMergeConflictWarn warns on PRD + manifest divergence with merge-origin-main pending", async () => {
	const projectRoot = await initGitRepo("spine-preflight-orch-warn-");
	try {
		await setupOriginMainDivergenceFixture(projectRoot);
		writeMergeOriginMainTask(projectRoot);
		gitCommitAll(projectRoot, "merge-origin-main task");

		const check = checkOrchMergeConflictWarn({ projectRoot });
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.message, /SP-137/);
		assert.match(check.message, /docs\/PRD\.md/);
		assert.match(check.message, /rules-manifest\.json/);
		assert.match(check.message, /multi-file conflicts/i);
		assert.ok(check.suggestedCommand);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight and plan check surface orch merge conflict warning", async () => {
	const projectRoot = await initGitRepo("spine-preflight-orch-batch-");
	try {
		await setupOriginMainDivergenceFixture(projectRoot);
		writeMergeOriginMainTask(projectRoot);
		gitCommitAll(projectRoot, "merge-origin-main task");

		const preflight = runBatchPreflight({ projectRoot, skipDoctor: true });
		assert.equal(preflight.ok, true);
		const orchCheck = preflight.checks.find((check) => check.id === "orch-merge-conflict");
		assert.ok(orchCheck);
		assert.equal(orchCheck.warning, true);

		const plan = runPreflightPlanCheck({
			projectRoot,
			configResult: loadSpineConfig(projectRoot),
		});
		assert.equal(plan.status, "ok");
		assert.match(plan.message, /Orch merge risk/i);
		assert.match(plan.message, /SP-137/);

		const risk = predictOrchMergeConflictRisk({ projectRoot });
		assert.equal(risk.risky, true);
		assert.deepEqual(risk.divergentPaths, [PRD_REL_PATH, RULES_MANIFEST_REL_PATH]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
