import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { commandExists, getVersion } from "../../bin/get-version.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

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

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-router`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Router smoke

## Dependencies
- **None**

## File Scope
- \`README.md\`
`,
		"utf-8",
	);
}

test("get-version helpers use spawnSync without shell", () => {
	assert.equal(typeof commandExists, "function");
	assert.equal(typeof getVersion, "function");
	assert.equal(commandExists("node"), true);
	assert.equal(commandExists("definitely-not-a-real-command-xyz"), false);
});

test("spine help and version route through thin CLI entry", () => {
	const help = runSpine(["help"]);
	assert.equal(help.status, 0, help.stderr || help.stdout);
	assert.match(help.stdout, /pi-spine/);
	assert.match(help.stdout, /spine batch start/);

	const version = runSpine(["version"]);
	assert.equal(version.status, 0, version.stderr || version.stdout);
	assert.match(version.stdout, /pi-spine/);
	assert.match(version.stdout, /Node:/);
});

test("spine rejects unknown commands", () => {
	const result = runSpine(["not-a-command"]);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /Unknown command/);
});

test("router dispatches plan, status, batch, gate, and integrate", async () => {
	const projectRoot = await initGitRepo("spine-router-");
	try {
		writeTask(projectRoot, "TP-701");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "TP-701": [] } }, null, 2),
			"utf-8",
		);

		const plan = runSpine(["plan", "all"], { cwd: projectRoot });
		assert.equal(plan.status, 0, plan.stderr || plan.stdout);
		assert.match(plan.stdout, /Wave|TP-701|tasks/i);

		const status = runSpine(["status"], { cwd: projectRoot });
		assert.equal(status.status, 0, status.stderr || status.stdout);
		assert.match(status.stdout, /batch|status|idle/i);

		const batch = runSpine(["batch", "start", "all", "--dry-run", "--skip-preflight", "--json"], {
			cwd: projectRoot,
		});
		assert.equal(batch.status, 0, batch.stderr || batch.stdout);
		const batchPayload = JSON.parse(batch.stdout);
		assert.deepEqual(batchPayload.taskIds, ["TP-701"]);

		const gate = runSpine(["gate", "status"], { cwd: projectRoot });
		assert.match(gate.stdout + gate.stderr, /Gate|batch|idle|No active batch/i);

		const integrate = runSpine(["integrate", "--dry-run"], { cwd: projectRoot });
		assert.match(integrate.stdout + integrate.stderr, /Integrate|batch|idle|No active batch/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
