import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startBatch } from "../../src/batch/engine.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

test("startBatch fails closed on invalid PROMPT before batch starts", async () => {
	const projectRoot = await initGitRepo("spine-prompt-parse-");
	try {
		const taskId = "TP-998";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Invalid\n\n## Mission\nMissing required sections.\n`,
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		const result = await assert.rejects(
			() => startBatch({ projectRoot, scope: taskId, skipPreflight: true }),
			(err) => {
				assert.match(err.message, /Invalid PROMPT for TP-998/);
				assert.match(err.message, /Missing required sections/);
				return true;
			},
		);
		assert.equal(result, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
