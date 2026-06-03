import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { discoverTasks } from "../../src/tasks/packet/index.mjs";
import { parseScope } from "../../src/planner/scope.mjs";

async function createTasksRootFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-scope-"));
	const tasksRoot = path.join(root, "taskplane-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });

	function writeTask(folderName, taskId) {
		const folder = path.join(tasksRoot, folderName);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), `# Task: ${taskId} — Test
`, "utf-8");
	}

	writeTask("TP-001-alpha", "TP-001");
	writeTask("TP-002-beta", "TP-002");

	return { root, tasksRoot };
}

test("parseScope('all') selects all discovered tasks", async () => {
	const { root, tasksRoot } = await createTasksRootFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const res = parseScope("all", { tasksRoot, discoveredTasks: discovered });
		assert.deepEqual(res.taskIds, ["TP-001", "TP-002"]);
		assert.equal(res.mode, "all");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope('TP-002') selects explicit task IDs", async () => {
	const { root, tasksRoot } = await createTasksRootFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const res = parseScope("TP-002", { tasksRoot, discoveredTasks: discovered });
		assert.deepEqual(res.taskIds, ["TP-002"]);
		assert.equal(res.mode, "ids");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope supports glob path patterns", async () => {
	const { root, tasksRoot } = await createTasksRootFixture();
	try {
		const discovered = discoverTasks(tasksRoot);
		const token = `${path.basename(tasksRoot)}/TP-002-*`;
		const res = parseScope(token, { tasksRoot, discoveredTasks: discovered });
		assert.deepEqual(res.taskIds, ["TP-002"]);
		assert.equal(res.mode, "glob");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

