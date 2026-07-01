import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	collectStaleFileScopeMustChangeWarnings,
	STALE_FILE_SCOPE_AMENDMENT_HINT,
} from "../../src/tasks/packet/validate-prompt.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const PRELANDED_PROMPT = `# Task: SP-900 — Prelanded fixture

## Mission
Smoke prelanded contract warning.

## Dependencies
- **None**

## File Scope
- \`src/feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`src/feature.mjs\` |

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
	const folder = path.join(projectRoot, "spine-tasks", "SP-900-prelanded-fixture");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), PRELANDED_PROMPT, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
}

test("collectStaleFileScopeMustChangeWarnings is quiet when scope paths unchanged since task intro", async () => {
	const projectRoot = await initGitRepo("validate-prelanded-quiet-");
	try {
		writePendingPrelandedTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");

		const promptRel = "spine-tasks/SP-900-prelanded-fixture/PROMPT.md";
		const parsed = parseContract(PRELANDED_PROMPT);
		const warnings = collectStaleFileScopeMustChangeWarnings(projectRoot, parsed, promptRel);
		assert.deepEqual(warnings, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("collectStaleFileScopeMustChangeWarnings warns when scope paths changed on main after task intro", async () => {
	const projectRoot = await initGitRepo("validate-prelanded-warn-");
	try {
		writePendingPrelandedTask(projectRoot);
		gitCommitAll(projectRoot, "add pending task");

		const featurePath = path.join(projectRoot, "src", "feature.mjs");
		fs.mkdirSync(path.dirname(featurePath), { recursive: true });
		fs.writeFileSync(featurePath, "export const ready = true;\n", "utf-8");
		gitCommitAll(projectRoot, "preland implementation on main");

		const promptRel = "spine-tasks/SP-900-prelanded-fixture/PROMPT.md";
		const parsed = parseContract(PRELANDED_PROMPT);
		const warnings = collectStaleFileScopeMustChangeWarnings(projectRoot, parsed, promptRel);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /fileScopeMustChange path\(s\) \(src\/feature\.mjs\)/);
		assert.match(warnings[0], /pre-landed/);
		assert.match(warnings[0], new RegExp(STALE_FILE_SCOPE_AMENDMENT_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("collectStaleFileScopeMustChangeWarnings ignores tasks without fileScopeMustChange", async () => {
	const projectRoot = await initGitRepo("validate-prelanded-empty-");
	try {
		const prompt = PRELANDED_PROMPT.replace(
			"| fileScopeMustChange | `src/feature.mjs` |",
			"| fileScopeMustChange | — |",
		);
		const folder = path.join(projectRoot, "spine-tasks", "SP-901-no-scope");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), prompt, "utf-8");
		gitCommitAll(projectRoot, "task without scope contract");

		const featurePath = path.join(projectRoot, "src", "feature.mjs");
		fs.mkdirSync(path.dirname(featurePath), { recursive: true });
		fs.writeFileSync(featurePath, "export const ready = true;\n", "utf-8");
		gitCommitAll(projectRoot, "unrelated implementation");

		const promptRel = "spine-tasks/SP-901-no-scope/PROMPT.md";
		const parsed = parseContract(prompt);
		const warnings = collectStaleFileScopeMustChangeWarnings(projectRoot, parsed, promptRel);
		assert.deepEqual(warnings, []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
