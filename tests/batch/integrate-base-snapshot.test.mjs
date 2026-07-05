import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
	readBaseBranchHeadAtStart,
	readIntegrateWorktreePath,
} from "../../src/batch/batch-state-io.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeSmokeTask(projectRoot, taskId = "TP-474") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: "Base snapshot smoke",
			fileScope: "README.md",
		}),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} tasks
 */
function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

test("startBatch persists baseBranchHeadAtStart and journals batch.base_snapshot", async () => {
	const projectRoot = await initGitRepo("spine-integrate-base-snapshot-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevWorker = process.env.SPINE_IS_WORKER;
	process.env.SPINE_WORKER_STUB = "1";
	delete process.env.SPINE_IS_WORKER;
	try {
		writeSmokeTask(projectRoot, "TP-474");
		writeDependencies(projectRoot, { "TP-474": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "add smoke task"], { cwd: projectRoot, stdio: "ignore" });

		const mainHead = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = await startBatch({
			projectRoot,
			scope: "TP-474",
			skipPreflight: true,
		});

		assert.equal(result.ok, true, result.output ?? result.error);
		const batchId = String(result.batchId ?? "");
		assert.ok(batchId);

		const loaded = loadSpineBatchState(projectRoot);
		assert.ok(loaded.raw);
		assert.equal(readBaseBranchHeadAtStart(loaded.raw), mainHead);
		assert.equal(
			readIntegrateWorktreePath(loaded.raw),
			path.join(".spine", "worktrees", `integrate-${batchId}`),
		);

		const events = readJournalEvents(projectRoot, batchId);
		const snapshot = events.find((event) => event.type === "batch.base_snapshot");
		assert.ok(snapshot);
		assert.equal(snapshot.payload.baseBranch, "main");
		assert.equal(snapshot.payload.baseBranchHeadAtStart, mainHead);
		assert.equal(
			snapshot.payload.integrateWorktreePath,
			path.join(".spine", "worktrees", `integrate-${batchId}`),
		);
	} finally {
		if (prevStub === undefined) {
			delete process.env.SPINE_WORKER_STUB;
		} else {
			process.env.SPINE_WORKER_STUB = prevStub;
		}
		if (prevWorker === undefined) {
			delete process.env.SPINE_IS_WORKER;
		} else {
			process.env.SPINE_IS_WORKER = prevWorker;
		}
		await destroyGitRepo(projectRoot);
	}
});
