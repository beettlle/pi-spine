import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runSpineRules, parseRulesArgv } from "../../src/cli/rules.mjs";
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
			minimalValidPromptMarkdown("TP-801", {
				title: "Rules select smoke",
				fileScope: "README.md",
			}),
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

test("parseRulesArgv defaults role to worker", () => {
	const parsed = parseRulesArgv(["--task", "TP-1"]);
	assert.equal(parsed.role, "worker");
	assert.equal(parsed.reviewType, undefined);
	assert.equal(parsed.baseline, undefined);
});

test("parseRulesArgv requires review-type for reviewer role", () => {
	assert.throws(
		() => parseRulesArgv(["--task", "TP-1", "--role", "reviewer"]),
		/review-type/i,
	);
});

test("runSpineRules select worker default unchanged", async () => {
	const projectRoot = await initGitRepo("spine-rules-worker-default-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "sample.mdc"),
			"---\nalwaysApply: true\n---\n# Sample\n",
			"utf-8",
		);

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-804-worker-default");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-804", {
				title: "Worker default",
				fileScope: "README.md",
			}),
			"utf-8",
		);

		const discover = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(discover.exitCode, 0, discover.output);

		const result = runSpineRules({
			projectRoot,
			args: ["select", "--task", "TP-804", "--json"],
		});
		assert.equal(result.exitCode, 0, result.output);
		const payload = JSON.parse(result.output);
		assert.equal(payload.ok, true);
		assert.equal(payload.role, undefined);
		assert.equal(payload.reviewType, undefined);
		assert.deepEqual(payload.fileScope, ["README.md"]);
		assert.ok(payload.selection?.paths?.length >= 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select reviewer plan uses PROMPT file scope", async () => {
	const projectRoot = await initGitRepo("spine-rules-reviewer-plan-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "sample.mdc"),
			"---\nalwaysApply: true\n---\n# Sample\n",
			"utf-8",
		);

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-805-reviewer-plan");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-805", {
				title: "Reviewer plan",
				fileScope: "src/cli/rules.mjs",
			}),
			"utf-8",
		);

		const discover = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(discover.exitCode, 0, discover.output);

		const result = runSpineRules({
			projectRoot,
			args: ["select", "--task", "TP-805", "--role", "reviewer", "--review-type", "plan", "--json"],
		});
		assert.equal(result.exitCode, 0, result.output);
		const payload = JSON.parse(result.output);
		assert.equal(payload.role, "reviewer");
		assert.equal(payload.reviewType, "plan");
		assert.deepEqual(payload.scopePaths, ["src/cli/rules.mjs"]);
		assert.ok(payload.selection);
		assert.ok(
			!payload.selection.paths.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
			"reviewer excludes worker execution rules",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select reviewer final returns empty scope", async () => {
	const projectRoot = await initGitRepo("spine-rules-reviewer-final-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "always-rule.mdc"),
			"---\nalwaysApply: true\n---\n# Always\n",
			"utf-8",
		);
		fs.writeFileSync(
			path.join(rulesRoot, "glob-rule.mdc"),
			"---\nglobs: ['**/*.mjs']\n---\n# Glob\n",
			"utf-8",
		);

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-806-reviewer-final");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-806", {
				title: "Reviewer final",
				fileScope: "src/cli/rules.mjs",
			}),
			"utf-8",
		);

		const discover = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(discover.exitCode, 0, discover.output);

		const result = runSpineRules({
			projectRoot,
			args: ["select", "--task", "TP-806", "--role", "reviewer", "--review-type", "final", "--json"],
		});
		assert.equal(result.exitCode, 0, result.output);
		const payload = JSON.parse(result.output);
		assert.equal(payload.reviewType, "final");
		assert.deepEqual(payload.scopePaths, []);
		assert.ok(payload.selection.paths.includes(".cursor/rules/always-rule.mdc"));
		assert.ok(!payload.selection.paths.includes(".cursor/rules/glob-rule.mdc"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineRules select reviewer code honors baseline", async () => {
	const projectRoot = await initGitRepo("spine-rules-reviewer-code-");
	try {
		const rulesRoot = path.join(projectRoot, ".cursor", "rules");
		fs.mkdirSync(rulesRoot, { recursive: true });
		fs.writeFileSync(
			path.join(rulesRoot, "sample.mdc"),
			"---\nalwaysApply: true\n---\n# Sample\n",
			"utf-8",
		);

		const taskDir = path.join(projectRoot, "spine-tasks", "TP-807-reviewer-code");
		fs.mkdirSync(taskDir, { recursive: true });
		fs.writeFileSync(
			path.join(taskDir, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-807", {
				title: "Reviewer code",
				fileScope: "README.md",
			}),
			"utf-8",
		);

		const discover = runSpineRules({ projectRoot, args: ["discover"] });
		assert.equal(discover.exitCode, 0, discover.output);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "seed rules and task"], { cwd: projectRoot, stdio: "ignore" });

		const baseline = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
		fs.writeFileSync(path.join(projectRoot, "src", "changed.mjs"), "export const x = 1;\n", "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "lane work"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpineRules({
			projectRoot,
			args: [
				"select",
				"--task",
				"TP-807",
				"--role",
				"reviewer",
				"--review-type",
				"code",
				"--baseline",
				baseline,
				"--json",
			],
		});
		assert.equal(result.exitCode, 0, result.output);
		const payload = JSON.parse(result.output);
		assert.equal(payload.reviewType, "code");
		assert.deepEqual(payload.scopePaths, ["src/changed.mjs"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
