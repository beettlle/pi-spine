import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	applyStubDeliveryStatusBlock,
	writeStubDeliveryStatusIfNeeded,
} from "../../bin/spine-worker-runner.mjs";
import { verifyStubFileScopeMustChange } from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNNER = path.join(PACKAGE_ROOT, "bin", "spine-worker-runner.mjs");

const DELIVERY_STATUS_PROMPT = `# Task: SP-910 — Stub runner delivery fixture

## Mission
Delivery-only stub contract.

## Dependencies
- **None**

## File Scope
- \`spine-tasks/SP-910-stub-runner-delivery/STATUS.md\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`spine-tasks/SP-910-stub-runner-delivery/STATUS.md\` |

## Steps
### Step 1: Work
- [ ] delivery

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

const IMPLEMENTATION_PROMPT = `# Task: SP-911 — Stub runner implementation fixture

## Mission
Implementation scope still requires real changes.

## Dependencies
- **None**

## File Scope
- \`src/stub-runner-fixture.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/stub-runner-fixture.mjs\` |

## Steps
### Step 1: Work
- [ ] implement

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

/**
 * @param {string} root
 * @param {string} promptMarkdown
 * @param {string} folderName
 */
function writeTaskFixture(root, promptMarkdown, folderName) {
	const taskFolder = path.join(root, "spine-tasks", folderName);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(path.join(taskFolder, "PROMPT.md"), promptMarkdown, "utf-8");
	fs.writeFileSync(
		path.join(taskFolder, "STATUS.md"),
		`# ${folderName} — Status\n\n**Current Step:** Not Started\n**Status:** 🔵 Ready\n`,
		"utf-8",
	);
	return taskFolder;
}

/**
 * @param {string} taskFolder
 * @param {string} worktreePath
 */
function runStubWorker(taskFolder, worktreePath) {
	const env = {
		...process.env,
		SPINE_TASK_FOLDER: taskFolder,
		SPINE_WORKTREE: worktreePath,
		SPINE_TASK_ID: "SP-910",
	};
	delete env.SPINE_WORKER_STUB_ENFORCE_REVIEW;
	execFileSync(process.execPath, [RUNNER, "--stub"], {
		cwd: worktreePath,
		env,
		stdio: "pipe",
	});
}

test("applyStubDeliveryStatusBlock updates existing header lines", () => {
	const input = `# Task — Status

**Current Step:** Step 2
**Status:** 🟡 In Progress
`;
	const output = applyStubDeliveryStatusBlock(input);
	assert.match(output, /\*\*Current Step:\*\* Complete/);
	assert.match(output, /\*\*Status:\*\* ✅ Complete/);
	assert.doesNotMatch(output, /Step 2/);
	assert.doesNotMatch(output, /In Progress/);
});

test("applyStubDeliveryStatusBlock appends block when header lines are missing", () => {
	const output = applyStubDeliveryStatusBlock("# Title only\n");
	assert.match(output, /\*\*Current Step:\*\* Complete/);
	assert.match(output, /\*\*Status:\*\* ✅ Complete/);
});

test("writeStubDeliveryStatusIfNeeded updates STATUS for delivery-only contracts", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "stub-runner-delivery-write-"));
	try {
		const taskFolder = writeTaskFixture(root, DELIVERY_STATUS_PROMPT, "SP-910-stub-runner-delivery");
		const wrote = writeStubDeliveryStatusIfNeeded({ taskFolder });
		assert.equal(wrote, true);
		const status = fs.readFileSync(path.join(taskFolder, "STATUS.md"), "utf-8");
		assert.match(status, /\*\*Current Step:\*\* Complete/);
		assert.match(status, /\*\*Status:\*\* ✅ Complete/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("writeStubDeliveryStatusIfNeeded skips implementation scopes", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "stub-runner-delivery-skip-"));
	try {
		const taskFolder = writeTaskFixture(root, IMPLEMENTATION_PROMPT, "SP-911-stub-runner-impl");
		const wrote = writeStubDeliveryStatusIfNeeded({ taskFolder });
		assert.equal(wrote, false);
		const status = fs.readFileSync(path.join(taskFolder, "STATUS.md"), "utf-8");
		assert.match(status, /Not Started/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("stub worker auto-writes STATUS for delivery-only fileScopeMustChange", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "stub-runner-delivery-runner-"));
	try {
		const taskFolder = writeTaskFixture(root, DELIVERY_STATUS_PROMPT, "SP-910-stub-runner-delivery");
		runStubWorker(taskFolder, root);

		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true);
		const status = fs.readFileSync(path.join(taskFolder, "STATUS.md"), "utf-8");
		assert.match(status, /\*\*Current Step:\*\* Complete/);
		assert.match(status, /\*\*Status:\*\* ✅ Complete/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("stub worker does not auto-write STATUS for implementation fileScopeMustChange", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "stub-runner-impl-runner-"));
	try {
		const taskFolder = writeTaskFixture(root, IMPLEMENTATION_PROMPT, "SP-911-stub-runner-impl");
		runStubWorker(taskFolder, root);

		assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true);
		const status = fs.readFileSync(path.join(taskFolder, "STATUS.md"), "utf-8");
		assert.match(status, /Not Started/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("stub worker STATUS delivery satisfies verifyStubFileScopeMustChange", async () => {
	const projectRoot = await initGitRepo("stub-runner-delivery-verify-");
	try {
		const taskFolder = writeTaskFixture(
			projectRoot,
			DELIVERY_STATUS_PROMPT,
			"SP-910-stub-runner-delivery",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed task"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["checkout", "-b", "lane-stub-delivery"], {
			cwd: projectRoot,
			stdio: "ignore",
		});

		runStubWorker(taskFolder, projectRoot);

		const parsed = parseContract(DELIVERY_STATUS_PROMPT);
		const pending = [
			"spine-tasks/SP-910-stub-runner-delivery/STATUS.md",
			"spine-tasks/SP-910-stub-runner-delivery/.DONE",
		];
		const result = verifyStubFileScopeMustChange(projectRoot, parsed, "main", pending);
		assert.equal(result.ok, true, result.failures.join("; "));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
