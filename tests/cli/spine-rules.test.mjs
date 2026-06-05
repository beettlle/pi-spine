import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runSpineRules } from "../../src/cli/rules.mjs";
import { initGitRepo, destroyGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");
const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string[]} argv
 * @param {{ cwd?: string }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, ...argv], {
		cwd: options.cwd ?? process.cwd(),
		encoding: "utf-8",
	});
}

test("spine rules --help lists subcommands", () => {
	const result = runSpine(["rules", "--help"]);
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /spine rules discover/);
	assert.match(result.stdout, /spine rules select/);
	assert.match(result.stdout, /spine rules sync/);
});

test("runSpineRules discover writes manifest in initialized project", async () => {
	const projectRoot = await initGitRepo("spine-rules-discover-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "sample.mdc"),
			"---\nalwaysApply: true\n---\n# Sample\n",
			"utf-8",
		);

		const result = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(result.exitCode, 0, result.output);
		assert.match(result.output, /Discovered/);
		assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "rules-manifest.json")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select rejects invalid PROMPT before manifest check", async () => {
	const projectRoot = await initGitRepo("spine-rules-invalid-prompt-");
	try {
		const taskDir = path.join(projectRoot, "spine-tasks", "TP-802-invalid-prompt");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			`# Task: TP-802 - Invalid heading

## Mission
x

## Dependencies
- **None**

## File Scope
- \`README.md\`

## Steps
### Step 0: Work
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
			"utf-8",
		);

		const result = runSpineRules({ projectRoot, args: ["select", "--task", "TP-802"] });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /em dash/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select uses validated file scope", async () => {
	const projectRoot = await initGitRepo("spine-rules-valid-prompt-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "sample.mdc"),
			"---\nalwaysApply: true\n---\n# Sample\n",
			"utf-8",
		);

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-803-valid-prompt");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-803", {
				title: "Rules select valid",
				fileScope: "README.md",
			}),
			"utf-8",
		);

		const discover = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(discover.exitCode, 0, discover.output);

		const result = runSpineRules({ projectRoot, args: ["select", "--task", "TP-803"] });
		assert.equal(result.exitCode, 0, result.output);
		assert.match(result.output, /file scope: 1 path\(s\)/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select requires manifest", async () => {
	const projectRoot = await initGitRepo("spine-rules-select-");
	try {
		const manifestPath = path.join(projectRoot, ".spine", "rules-manifest.json");
		if (fs.existsSync(manifestPath)) {
			fs.unlinkSync(manifestPath);
		}

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-801-rules-select");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			`# Task: TP-801 — Rules select smoke

## Dependencies
- **None**

## File Scope
- \`README.md\`
`,
			"utf-8",
		);

		const result = runSpineRules({ projectRoot, args: ["select", "--task", "TP-801"] });
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /rules-manifest\.json missing/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine rules sync via CLI exits zero in pi-spine repo", () => {
	const result = runSpine(["rules", "sync"], { cwd: REPO_ROOT });
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(result.stdout, /Discovered/);
});
