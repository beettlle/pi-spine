import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { buildPlan } from "../../src/planner/index.mjs";
import { discoverTasks } from "../../src/tasks/packet/index.mjs";
import { filterPendingTaskIds, summarizePendingScope } from "../../src/planner/pending.mjs";
import { NO_PENDING_TASKS_ERROR, parseScope } from "../../src/planner/scope.mjs";

async function createPendingFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pending-"));
	const tasksRoot = path.join(root, "taskplane-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });

	function writeTask(folderName, taskId, done = false) {
		const folder = path.join(tasksRoot, folderName);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Test\n\n## Dependencies\n- **None**\n`,
			"utf-8",
		);
		if (done) {
			fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
		}
	}

	writeTask("TP-001-alpha", "TP-001", true);
	writeTask("TP-002-beta", "TP-002", false);
	writeTask("TP-003-gamma", "TP-003", false);

	return { root, tasksRoot };
}

test("filterPendingTaskIds excludes tasks with .DONE marker", async () => {
	const { root, tasksRoot } = await createPendingFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const pending = filterPendingTaskIds(discovered, tasksRoot);
		assert.deepEqual(pending, ["TP-002", "TP-003"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope pending mode returns pending IDs and excluded count", async () => {
	const { root, tasksRoot } = await createPendingFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const res = parseScope("pending", { tasksRoot, discoveredTasks: discovered });
		assert.equal(res.mode, "pending");
		assert.deepEqual(res.taskIds, ["TP-002", "TP-003"]);
		assert.equal(res.excludedCount, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope pending throws when all tasks are done", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pending-empty-"));
	const tasksRoot = path.join(root, "taskplane-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	const folder = path.join(tasksRoot, "TP-001-done");
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), "# Task: TP-001 — Done\n", "utf-8");
	fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");

	try {
		const discovered = discoverTasks(tasksRoot);
		assert.throws(
			() => parseScope("pending", { tasksRoot, discoveredTasks: discovered }),
			(err) => err.message === NO_PENDING_TASKS_ERROR,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildPlan pending scope preserves dependency waves", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-pending-plan-"));
	const tasksRoot = path.join(root, "taskplane-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });

	function writeTask(folderName, taskId, depsLine, done = false) {
		const folder = path.join(tasksRoot, folderName);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			`# Task: ${taskId} — Test\n\n## Dependencies\n${depsLine}\n`,
			"utf-8",
		);
		if (done) {
			fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
		}
	}

	writeTask("TP-010-root", "TP-010", "- **None**", true);
	writeTask("TP-011-child", "TP-011", "- **TP-010**", false);

	fs.writeFileSync(
		path.join(tasksRoot, "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { "TP-010": [], "TP-011": ["TP-010"] } }, null, 2),
		"utf-8",
	);

	try {
		const plan = buildPlan({
			scope: "pending",
			config: { lanes: { maxParallel: 1, queueExcess: true } },
			tasksRoot,
		});

		assert.equal(plan.scope.mode, "pending");
		assert.deepEqual(plan.scope.taskIds, ["TP-011"]);
		assert.equal(plan.metadata.tasksExcluded, 1);
		assert.equal(plan.waves.length, 1);
		assert.deepEqual(plan.waves[0].taskIds, ["TP-011"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("summarizePendingScope counts excluded tasks", async () => {
	const { root, tasksRoot } = await createPendingFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const summary = summarizePendingScope(discovered, tasksRoot);
		assert.deepEqual(summary.pendingIds, ["TP-002", "TP-003"]);
		assert.equal(summary.excludedCount, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
