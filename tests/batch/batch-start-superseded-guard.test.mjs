import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveBatchStartScope, startBatch } from "../../src/batch/engine.mjs";
import {
	assertBatchStartTasksNotSuperseded,
	parseSupersededReplacementIds,
} from "../../src/planner/pending.mjs";
import { discoverTasks } from "../../src/tasks/packet/discover.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {{ supersededBy?: string, done?: boolean }} [options]
 */
function writeTaskFolder(projectRoot, taskId, options = {}) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			fileScope: `src/${taskId.toLowerCase()}.mjs`,
			mission: "Smoke task for superseded guard tests.",
		}),
		"utf-8",
	);
	if (options.supersededBy) {
		fs.writeFileSync(
			path.join(folder, ".SUPERSEDED"),
			`Superseded by ${options.supersededBy}\nStaged: 2026-06-18\n`,
			"utf-8",
		);
	}
	if (options.done) {
		fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
	}
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

test("parseSupersededReplacementIds extracts child task IDs", () => {
	assert.deepEqual(parseSupersededReplacementIds("Superseded by SP-263, SP-264\n"), [
		"SP-263",
		"SP-264",
	]);
	assert.deepEqual(parseSupersededReplacementIds("Superseded by TP-100\n"), ["TP-100"]);
	assert.deepEqual(parseSupersededReplacementIds(""), []);
});

test("assertBatchStartTasksNotSuperseded rejects superseded IDs", async () => {
	const projectRoot = await initGitRepo("spine-superseded-guard-");
	try {
		writeTaskFolder(projectRoot, "TP-099", { supersededBy: "TP-100" });
		writeTaskFolder(projectRoot, "TP-100");
		writeDependencies(projectRoot, { "TP-099": [], "TP-100": [] });
		execCommit(projectRoot, "tasks");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const discovered = discoverTasks(tasksRoot);
		const guard = assertBatchStartTasksNotSuperseded(["TP-099"], tasksRoot, discovered);
		assert.equal(guard.ok, false);
		assert.equal(guard.error, "superseded_tasks");
		assert.match(guard.output, /TP-099/);
		assert.match(guard.output, /TP-100/);
		assert.match(guard.output, /spine plan pending/);
		assert.match(guard.output, /--force-superseded/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assertBatchStartTasksNotSuperseded allows pending IDs", async () => {
	const projectRoot = await initGitRepo("spine-superseded-pending-");
	try {
		writeTaskFolder(projectRoot, "TP-101");
		writeDependencies(projectRoot, { "TP-101": [] });
		execCommit(projectRoot, "tasks");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const discovered = discoverTasks(tasksRoot);
		const guard = assertBatchStartTasksNotSuperseded(["TP-101"], tasksRoot, discovered);
		assert.equal(guard.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assertBatchStartTasksNotSuperseded honors --force-superseded", async () => {
	const projectRoot = await initGitRepo("spine-superseded-force-");
	try {
		writeTaskFolder(projectRoot, "TP-102", { supersededBy: "TP-103" });
		writeDependencies(projectRoot, { "TP-102": [] });
		execCommit(projectRoot, "tasks");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const discovered = discoverTasks(tasksRoot);
		const guard = assertBatchStartTasksNotSuperseded(["TP-102"], tasksRoot, discovered, {
			forceSuperseded: true,
		});
		assert.equal(guard.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveBatchStartScope rejects explicit superseded task IDs", async () => {
	const projectRoot = await initGitRepo("spine-resolve-superseded-");
	try {
		writeTaskFolder(projectRoot, "TP-104", { supersededBy: "TP-105" });
		writeTaskFolder(projectRoot, "TP-105");
		writeDependencies(projectRoot, { "TP-104": [], "TP-105": [] });
		execCommit(projectRoot, "tasks");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const resolved = resolveBatchStartScope("TP-104", tasksRoot);
		assert.equal(resolved.ok, false);
		assert.equal(resolved.error, "superseded_tasks");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveBatchStartScope allows superseded IDs with forceSuperseded", async () => {
	const projectRoot = await initGitRepo("spine-resolve-force-");
	try {
		writeTaskFolder(projectRoot, "TP-106", { supersededBy: "TP-107" });
		writeDependencies(projectRoot, { "TP-106": [] });
		execCommit(projectRoot, "tasks");

		const tasksRoot = path.join(projectRoot, "spine-tasks");
		const resolved = resolveBatchStartScope("TP-106", tasksRoot, { forceSuperseded: true });
		assert.equal(resolved.ok, true);
		assert.equal(resolved.scope, "TP-106");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch dry-run rejects superseded explicit scope", async () => {
	const projectRoot = await initGitRepo("spine-start-superseded-");
	try {
		writeTaskFolder(projectRoot, "TP-108", { supersededBy: "TP-109" });
		writeDependencies(projectRoot, { "TP-108": [] });
		execCommit(projectRoot, "tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-108",
			dryRun: true,
			skipPreflight: true,
		});
		assert.equal(result.ok, false);
		assert.equal(result.error, "superseded_tasks");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("startBatch dry-run allows superseded scope with forceSuperseded", async () => {
	const projectRoot = await initGitRepo("spine-start-force-");
	try {
		writeTaskFolder(projectRoot, "TP-110", { supersededBy: "TP-111" });
		writeDependencies(projectRoot, { "TP-110": [] });
		execCommit(projectRoot, "tasks");

		const result = await startBatch({
			projectRoot,
			scope: "TP-110",
			dryRun: true,
			skipPreflight: true,
			forceSuperseded: true,
		});
		assert.equal(result.ok, true, result.output ?? result.error);
		assert.deepEqual(result.taskIds, ["TP-110"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}
