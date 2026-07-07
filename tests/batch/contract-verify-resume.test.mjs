import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { verifyContract } from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const RESUME_PRELANDED_PROMPT = `# Task: SP-526 — Resume pre-landed fixture

## Mission
Verify fileScopeMustChange passes on resume when scope predates sinceCommit.

## Dependencies
- **None**

## File Scope
- \`src/consumer_feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/consumer_feature.mjs\` |

## Steps
### Step 1: Work
- [ ] delivery only

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
 * @returns {string}
 */
function headSha(projectRoot) {
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {string} projectRoot
 */
function landImplementationOnMain(projectRoot) {
	const featurePath = path.join(projectRoot, "src", "consumer_feature.mjs");
	fs.mkdirSync(path.dirname(featurePath), { recursive: true });
	fs.writeFileSync(featurePath, "export const integrated = true;\n", "utf-8");
	gitCommitAll(projectRoot, "implementation already on main before task start");
}

/**
 * @param {string} projectRoot
 */
function writePendingTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-526-resume-prelanded-fixture");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), RESUME_PRELANDED_PROMPT, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
}

test("verifyContract passes pre-landed fileScopeMustChange with resume sinceCommit (M-CTR-02)", async () => {
	const projectRoot = await initGitRepo("contract-verify-resume-prelanded-");
	try {
		landImplementationOnMain(projectRoot);
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task after implementation on main");

		execFileSync("git", ["checkout", "-b", "lane-resume-prelanded"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		const sinceCommit = headSha(projectRoot);

		fs.writeFileSync(path.join(projectRoot, "src/unrelated.mjs"), "export const unrelated = 1;\n");
		gitCommitAll(projectRoot, "unrelated lane change since task start");

		const parsed = parseContract(RESUME_PRELANDED_PROMPT);
		const result = verifyContract(projectRoot, parsed, {
			baseBranch: "main",
			sinceCommit,
		});

		assert.equal(result.ok, true, result.checks.map((check) => check.message).join("\n"));
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /pre-landed at resume baseline/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract without sinceCommit still requires spine delivery for pre-landed scope", async () => {
	const projectRoot = await initGitRepo("contract-verify-resume-no-since-");
	try {
		landImplementationOnMain(projectRoot);
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task after implementation on main");

		execFileSync("git", ["checkout", "-b", "lane-no-since"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		fs.writeFileSync(path.join(projectRoot, "src/unrelated.mjs"), "export const unrelated = 1;\n");
		gitCommitAll(projectRoot, "unrelated lane change without delivery");

		const parsed = parseContract(RESUME_PRELANDED_PROMPT);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, false);
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /no matching changes/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract resume baseline does not satisfy scope changed on lane since task start", async () => {
	const projectRoot = await initGitRepo("contract-verify-resume-lane-change-");
	try {
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");

		execFileSync("git", ["checkout", "-b", "lane-resume-change"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		const sinceCommit = headSha(projectRoot);

		const featurePath = path.join(projectRoot, "src", "consumer_feature.mjs");
		fs.mkdirSync(path.dirname(featurePath), { recursive: true });
		fs.writeFileSync(featurePath, "export const laneWork = true;\n");
		gitCommitAll(projectRoot, "lane implementation after task start");

		const parsed = parseContract(RESUME_PRELANDED_PROMPT);
		const result = verifyContract(projectRoot, parsed, {
			baseBranch: "main",
			sinceCommit,
		});

		assert.equal(result.ok, true);
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /fileScopeMustChange matched/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
