/**
 * SP-431 — sequence --auto-approve-gate CLI flag (GitHub #79).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseSequenceArgs } from "../../src/cli/sequence.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

const TASK_W0 = "SP-701";
const TASK_W1 = "SP-702";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string[]} deps
 */
function writeSequenceTask(projectRoot, taskId, slug, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((dep) => `- **${dep}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: slug,
			fileScope: `src/${slug}.txt`,
			mission: `Sequence auto-approve CLI fixture ${slug}.`,
		}).replace("## Dependencies\n- **None**", `## Dependencies\n${depLines}`),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeSequenceDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_W0]: [],
					[TASK_W1]: [TASK_W0],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, "run", ...argv], {
		cwd: options.cwd ?? process.cwd(),
		encoding: "utf-8",
		env: { ...process.env, ...options.env },
	});
}

/**
 * @param {string|undefined} prev
 */
function restoreStubEnv(prev) {
	if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
	else process.env.SPINE_WORKER_STUB = prev;
}

test("parseSequenceArgs honors --auto-approve-gate and --force", () => {
	const parsed = parseSequenceArgs(["pending", "--auto-approve-gate", "--force", "--dry-run"]);
	assert.equal(parsed.autoApproveGate, true);
	assert.equal(parsed.force, true);
	assert.equal(parsed.dryRun, true);
});

test("spine run sequence --auto-approve-gate dry-run succeeds under stub", async () => {
	const projectRoot = await initGitRepo("spine-cli-auto-approve-stub-");
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-auto");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-auto", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence auto-approve tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(
			["sequence", "pending", "--dry-run", "--auto-approve-gate", "--skip-preflight"],
			{ cwd: projectRoot, env: { SPINE_WORKER_STUB: "1" } },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /spine gate approve/);
		assert.doesNotMatch(result.stdout, /when integrate gate is open/);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("spine run sequence --auto-approve-gate refused for real pi without --force", async () => {
	const projectRoot = await initGitRepo("spine-cli-auto-approve-real-");
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-real");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-real", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence auto-approve tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(
			["sequence", "pending", "--dry-run", "--auto-approve-gate", "--skip-preflight"],
			{ cwd: projectRoot, env: { SPINE_WORKER_STUB: undefined } },
		);
		assert.notEqual(result.status, 0, "expected refusal without stub or force");
		assert.match(result.stdout + result.stderr, /--auto-approve-gate/);
		assert.match(result.stdout + result.stderr, /SPINE_WORKER_STUB=1/);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});

test("spine run sequence --auto-approve-gate --force dry-run succeeds for real pi", async () => {
	const projectRoot = await initGitRepo("spine-cli-auto-approve-force-");
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-force");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-force", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence auto-approve tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(
			["sequence", "pending", "--dry-run", "--auto-approve-gate", "--force", "--skip-preflight"],
			{ cwd: projectRoot, env: { SPINE_WORKER_STUB: undefined } },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /spine gate approve/);
	} finally {
		restoreStubEnv(prev);
		await destroyGitRepo(projectRoot);
	}
});
