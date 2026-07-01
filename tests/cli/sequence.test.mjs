/**
 * SP-388 — spine run sequence CLI (GitHub #54 Tier 2).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	formatSequenceResult,
	parseSequenceArgs,
	runSpineSequence,
} from "../../src/cli/sequence.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

const TASK_W0 = "SP-601";
const TASK_W1 = "SP-602";

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
			mission: `Sequence CLI fixture ${slug}.`,
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
 * @param {{ cwd?: string }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, "run", ...argv], {
		cwd: options.cwd ?? process.cwd(),
		encoding: "utf-8",
		env: { ...process.env, SPINE_WORKER_STUB: "1" },
	});
}

test("parseSequenceArgs defaults scope to pending and stopOnFailure to true", () => {
	const parsed = parseSequenceArgs(["pending", "--dry-run", "--json"]);
	assert.equal(parsed.scope, "pending");
	assert.equal(parsed.dryRun, true);
	assert.equal(parsed.json, true);
	assert.equal(parsed.stopOnFailure, true);
	assert.equal(parsed.fromWave, 0);
	assert.equal(parsed.throughWave, null);
	assert.equal(parsed.attached, false);
});

test("parseSequenceArgs honors wave and attached flags", () => {
	const parsed = parseSequenceArgs([
		"pending",
		"--from-wave",
		"1",
		"--through-wave",
		"2",
		"--attached",
		"--no-stop-on-failure",
	]);
	assert.equal(parsed.fromWave, 1);
	assert.equal(parsed.throughWave, 2);
	assert.equal(parsed.attached, true);
	assert.equal(parsed.stopOnFailure, false);
});

test("formatSequenceResult emits JSON when requested", () => {
	const output = formatSequenceResult({ ok: true, commands: ["a"], output: "human\n" }, true);
	const payload = JSON.parse(output);
	assert.equal(payload.ok, true);
	assert.deepEqual(payload.commands, ["a"]);
});

test("spine run sequence pending --dry-run prints per-wave land loop commands", async () => {
	const projectRoot = await initGitRepo("spine-cli-sequence-dry-");
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-cli");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-cli", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence cli tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(["sequence", "pending", "--dry-run", "--skip-preflight"], {
			cwd: projectRoot,
		});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, new RegExp(`spine batch start ${TASK_W0}`));
		assert.match(result.stdout, new RegExp(`spine batch start ${TASK_W1}`));
		assert.match(result.stdout, /spine gate approve/);
		assert.match(result.stdout, /spine integrate/);
		assert.match(result.stdout, /spine batch complete/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine run sequence pending --dry-run --json returns structured payload", async () => {
	const projectRoot = await initGitRepo("spine-cli-sequence-json-");
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-json");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-json", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence cli tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(["sequence", "pending", "--dry-run", "--json", "--skip-preflight"], {
			cwd: projectRoot,
		});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const payload = JSON.parse(result.stdout);
		assert.equal(payload.ok, true);
		assert.equal(payload.dryRun, true);
		assert.equal(payload.waves?.length, 2);
		assert.ok(Array.isArray(payload.commands));
		assert.ok(payload.commands.length >= 6);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine run sequence pending --from-wave 1 limits dry-run to later waves", async () => {
	const projectRoot = await initGitRepo("spine-cli-sequence-from-");
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-from");
		writeSequenceTask(projectRoot, TASK_W1, "wave-1-from", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence cli tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runSpine(
			["sequence", "pending", "--dry-run", "--from-wave", "1", "--skip-preflight"],
			{ cwd: projectRoot },
		);
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.doesNotMatch(result.stdout, new RegExp(`spine batch start ${TASK_W0}`));
		assert.match(result.stdout, new RegExp(`spine batch start ${TASK_W1}`));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineSequence rejects invalid through-wave with non-zero exit", async () => {
	const projectRoot = await initGitRepo("spine-cli-sequence-invalid-");
	try {
		writeSequenceTask(projectRoot, TASK_W0, "wave-0-invalid");
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence cli tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = await runSpineSequence({
			projectRoot,
			args: ["pending", "--dry-run", "--through-wave", "9", "--skip-preflight"],
		});
		assert.equal(result.exitCode, 1);
		assert.match(result.output ?? "", /through-wave|out of range/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine run pending still aliases batch start", async () => {
	const projectRoot = await initGitRepo("spine-cli-run-alias-");
	try {
		const folder = path.join(projectRoot, "spine-tasks", "TP-801-alias");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			minimalValidPromptMarkdown("TP-801", {
				title: "alias",
				fileScope: "README.md",
			}),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "TP-801": [] } }, null, 2),
			"utf-8",
		);

		const result = runSpine(["pending", "--dry-run", "--skip-preflight", "--json"], { cwd: projectRoot });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const payload = JSON.parse(result.stdout);
		assert.deepEqual(payload.taskIds, ["TP-801"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
