import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	isFileScopePatternPrelanded,
	resolvePromptRelPath,
	verifyContract,
	verifyStubFileScopeMustChange,
} from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PRELANDED_SOURCE_PROMPT = `# Task: SP-900 — Prelanded delivery fixture

## Mission
Verify pre-landed scope satisfaction.

## Dependencies
- **None**

## File Scope
- \`src/feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/feature.mjs\` |
| artifactsMustExist | \`tests/batch/contract-prelanded.test.mjs\` |

## Steps
### Step 1: Work
- [ ] delivery only

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

const DELIVERY_STATUS_PROMPT = PRELANDED_SOURCE_PROMPT.replace(
	"| fileScopeMustChange | `src/feature.mjs` |",
	"| fileScopeMustChange | `spine-tasks/SP-900-prelanded-delivery/STATUS.md` |",
);

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
function writeDeliveryArtifact(projectRoot) {
	const artifactPath = path.join(projectRoot, "tests", "batch", "contract-prelanded.test.mjs");
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	fs.writeFileSync(artifactPath, "export const fixture = true;\n", "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} promptMarkdown
 */
function writePendingTask(projectRoot, promptMarkdown) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-900-prelanded-delivery");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), promptMarkdown, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	writeDeliveryArtifact(projectRoot);
	return folder;
}

/**
 * @param {string} projectRoot
 */
function prelandFeatureOnMain(projectRoot) {
	const featurePath = path.join(projectRoot, "src", "feature.mjs");
	fs.mkdirSync(path.dirname(featurePath), { recursive: true });
	fs.writeFileSync(featurePath, "export const ready = true;\n", "utf-8");
	gitCommitAll(projectRoot, "preland implementation on main");
}

/**
 * @param {string} projectRoot
 */
function createLaneWithStatusDelivery(projectRoot) {
	execFileSync("git", ["checkout", "-b", "lane-prelanded"], { cwd: projectRoot, stdio: "ignore" });
	const statusPath = path.join(projectRoot, "spine-tasks", "SP-900-prelanded-delivery", "STATUS.md");
	fs.writeFileSync(statusPath, "# Status\n\n- [x] delivery complete\n", "utf-8");
	execFileSync("git", ["add", statusPath], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "delivery STATUS"], { cwd: projectRoot, stdio: "ignore" });
}

test("verifyContract satisfies pre-landed fileScopeMustChange when testCommand and artifacts pass", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-verify-");
	try {
		writePendingTask(projectRoot, PRELANDED_SOURCE_PROMPT);
		gitCommitAll(projectRoot, "add pending task");
		prelandFeatureOnMain(projectRoot);
		createLaneWithStatusDelivery(projectRoot);

		const parsed = parseContract(PRELANDED_SOURCE_PROMPT);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, true, result.checks.map((check) => check.message).join("\n"));
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /pre-landed on main/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract still fails pre-landed scope when testCommand fails", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-test-fail-");
	try {
		const prompt = PRELANDED_SOURCE_PROMPT.replace("| testCommand | `true` |", "| testCommand | `false` |");
		writePendingTask(projectRoot, prompt);
		gitCommitAll(projectRoot, "add pending task");
		prelandFeatureOnMain(projectRoot);
		createLaneWithStatusDelivery(projectRoot);

		const parsed = parseContract(prompt);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, false);
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /no matching changes/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyStubFileScopeMustChange passes delivery-only STATUS when source scope pre-landed", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-stub-");
	try {
		writePendingTask(projectRoot, PRELANDED_SOURCE_PROMPT);
		gitCommitAll(projectRoot, "add pending task");
		prelandFeatureOnMain(projectRoot);
		createLaneWithStatusDelivery(projectRoot);

		const parsed = parseContract(PRELANDED_SOURCE_PROMPT);
		const result = verifyStubFileScopeMustChange(projectRoot, parsed, "main", [
			"spine-tasks/SP-900-prelanded-delivery/.DONE",
		]);
		assert.equal(result.ok, true, result.failures.join("; "));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract passes delivery-only STATUS.md fileScopeMustChange contract", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-status-scope-");
	try {
		writePendingTask(projectRoot, DELIVERY_STATUS_PROMPT);
		gitCommitAll(projectRoot, "add pending task");
		prelandFeatureOnMain(projectRoot);
		createLaneWithStatusDelivery(projectRoot);

		const parsed = parseContract(DELIVERY_STATUS_PROMPT);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, true, result.checks.map((check) => check.message).join("\n"));
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /fileScopeMustChange matched/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolvePromptRelPath derives task PROMPT from spine-tasks delivery changes", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-resolve-");
	try {
		writePendingTask(projectRoot, PRELANDED_SOURCE_PROMPT);
		gitCommitAll(projectRoot, "add pending task");

		const resolved = resolvePromptRelPath(projectRoot, [
			"spine-tasks/SP-900-prelanded-delivery/STATUS.md",
		]);
		assert.equal(resolved, "spine-tasks/SP-900-prelanded-delivery/PROMPT.md");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("isFileScopePatternPrelanded detects scope changed on main after task intro", async () => {
	const projectRoot = await initGitRepo("contract-prelanded-detect-");
	try {
		writePendingTask(projectRoot, PRELANDED_SOURCE_PROMPT);
		gitCommitAll(projectRoot, "add pending task");
		prelandFeatureOnMain(projectRoot);

		const promptRel = "spine-tasks/SP-900-prelanded-delivery/PROMPT.md";
		assert.equal(isFileScopePatternPrelanded(projectRoot, "src/feature.mjs", promptRel, "main"), true);
		assert.equal(isFileScopePatternPrelanded(projectRoot, "src/missing.mjs", promptRel, "main"), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
