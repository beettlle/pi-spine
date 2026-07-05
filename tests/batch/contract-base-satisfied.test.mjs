import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	verifyContract,
	verifyStubFileScopeMustChange,
} from "../../src/batch/contract-verify.mjs";
import { isBaseScopeSatisfied } from "../../src/batch/contract-prelanded.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BASE_SATISFIED_PROMPT = `# Task: SP-462 — Base satisfied fixture

## Mission
Verify base-satisfied scope when lane has zero diff for implementation path.

## Dependencies
- **None**

## File Scope
- \`src/consumer_feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/consumer_feature.mjs\` |
| artifactsMustExist | \`tests/batch/contract-base-satisfied.test.mjs\` |

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
 */
function writeArtifact(projectRoot) {
	const artifactPath = path.join(projectRoot, "tests", "batch", "contract-base-satisfied.test.mjs");
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	fs.writeFileSync(artifactPath, "export const fixture = true;\n", "utf-8");
}

/**
 * @param {string} projectRoot
 */
function writePendingTask(projectRoot) {
	const folder = path.join(projectRoot, "spine-tasks", "SP-462-base-satisfied-fixture");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), BASE_SATISFIED_PROMPT, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	writeArtifact(projectRoot);
	return folder;
}

/**
 * @param {string} projectRoot
 */
function landImplementationOnBase(projectRoot) {
	const featurePath = path.join(projectRoot, "src", "consumer_feature.mjs");
	fs.mkdirSync(path.dirname(featurePath), { recursive: true });
	fs.writeFileSync(featurePath, "export const integrated = true;\n", "utf-8");
	gitCommitAll(projectRoot, "implementation already on base from prior batch");
}

/**
 * @param {string} projectRoot
 */
function createLaneWithDeliveryOnly(projectRoot) {
	execFileSync("git", ["checkout", "-b", "lane-base-satisfied"], { cwd: projectRoot, stdio: "ignore" });
	const statusPath = path.join(projectRoot, "spine-tasks", "SP-462-base-satisfied-fixture", "STATUS.md");
	fs.writeFileSync(statusPath, "# Status\n\n- [x] complete on base\n", "utf-8");
	gitCommitAll(projectRoot, "delivery STATUS only");
}

test("verifyContract uses base-satisfied when scope predates task PROMPT on base", async () => {
	const projectRoot = await initGitRepo("contract-base-satisfied-predate-");
	try {
		landImplementationOnBase(projectRoot);
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task after implementation on base");
		createLaneWithDeliveryOnly(projectRoot);

		const parsed = parseContract(BASE_SATISFIED_PROMPT);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, true, result.checks.map((check) => check.message).join("\n"));
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /satisfied on main/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract passes when scope is on base and lane has zero implementation diff", async () => {
	const projectRoot = await initGitRepo("contract-base-satisfied-verify-");
	try {
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");
		landImplementationOnBase(projectRoot);
		createLaneWithDeliveryOnly(projectRoot);

		const parsed = parseContract(BASE_SATISFIED_PROMPT);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, true, result.checks.map((check) => check.message).join("\n"));
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(
			scopeCheck?.message ?? "",
			/(satisfied on main|pre-landed on main)/,
			"scope should pass via base-satisfied or pre-landed path",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyContract fails base-satisfied scope when testCommand fails", async () => {
	const projectRoot = await initGitRepo("contract-base-satisfied-test-fail-");
	try {
		const prompt = BASE_SATISFIED_PROMPT.replace("| testCommand | `true` |", "| testCommand | `false` |");
		const folder = path.join(projectRoot, "spine-tasks", "SP-462-base-satisfied-fixture");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), prompt, "utf-8");
		fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
		writeArtifact(projectRoot);
		gitCommitAll(projectRoot, "add pending task");
		landImplementationOnBase(projectRoot);
		createLaneWithDeliveryOnly(projectRoot);

		const parsed = parseContract(prompt);
		const result = verifyContract(projectRoot, parsed, { baseBranch: "main" });

		assert.equal(result.ok, false);
		const scopeCheck = result.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /no matching changes/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("verifyStubFileScopeMustChange passes when base already satisfies scope", async () => {
	const projectRoot = await initGitRepo("contract-base-satisfied-stub-");
	try {
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");
		landImplementationOnBase(projectRoot);
		createLaneWithDeliveryOnly(projectRoot);

		const parsed = parseContract(BASE_SATISFIED_PROMPT);
		const result = verifyStubFileScopeMustChange(projectRoot, parsed, "main", [
			"spine-tasks/SP-462-base-satisfied-fixture/.DONE",
		]);
		assert.equal(result.ok, true, result.failures.join("; "));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("isBaseScopeSatisfied is false when base lacks scope changes", async () => {
	const projectRoot = await initGitRepo("contract-base-satisfied-negative-");
	try {
		writePendingTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");
		createLaneWithDeliveryOnly(projectRoot);

		const changedFiles = execFileSync("git", ["diff", "--name-only", "main...HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		})
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);

		assert.equal(
			isBaseScopeSatisfied(projectRoot, "src/consumer_feature.mjs", changedFiles, "main"),
			false,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
