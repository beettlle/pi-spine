import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { initGitRepo, destroyGitRepo } from "./helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "spine.mjs");

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {boolean} done
 */
function writeTask(projectRoot, taskId, done = false) {
	const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-test`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Run CLI

## Dependencies
- **None**

## File Scope
- \`README.md\`
`,
		"utf-8",
	);
	if (done) {
		fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
	}
}

test("spine run pending is alias for batch start pending", async () => {
	const projectRoot = await initGitRepo("spine-run-pending-");
	try {
		writeTask(projectRoot, "TP-901", true);
		writeTask(projectRoot, "TP-902", false);
		fs.writeFileSync(
			path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "TP-901": [], "TP-902": [] } }, null, 2),
			"utf-8",
		);

		const runResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "run", "pending", "--dry-run", "--skip-preflight", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(runResult.status, 0, runResult.stderr || runResult.stdout);

		const batchResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "batch", "start", "pending", "--dry-run", "--skip-preflight", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(batchResult.status, 0, batchResult.stderr || batchResult.stdout);

		const runPayload = JSON.parse(runResult.stdout);
		const batchPayload = JSON.parse(batchResult.stdout);
		assert.deepEqual(runPayload.taskIds, batchPayload.taskIds);
		assert.deepEqual(runPayload.taskIds, ["TP-902"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine run all dry-run matches pending-filtered batch start", async () => {
	const projectRoot = await initGitRepo("spine-run-all-");
	try {
		writeTask(projectRoot, "TP-911", true);
		writeTask(projectRoot, "TP-912", false);
		fs.writeFileSync(
			path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "TP-911": [], "TP-912": [] } }, null, 2),
			"utf-8",
		);

		const runResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "run", "all", "--dry-run", "--skip-preflight", "--json"],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.equal(runResult.status, 0, runResult.stderr || runResult.stdout);
		const payload = JSON.parse(runResult.stdout);
		assert.deepEqual(payload.taskIds, ["TP-912"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
