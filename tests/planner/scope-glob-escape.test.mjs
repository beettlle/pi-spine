import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { discoverTasks } from "../../src/tasks/packet/index.mjs";
import { parseScope } from "../../src/planner/scope.mjs";

function makeDiscovered(tasksRoot, relFolder, taskId) {
	return {
		taskId,
		slug: "test",
		folderName: path.basename(relFolder),
		folderPath: path.join(tasksRoot, relFolder),
		promptPath: path.join(tasksRoot, relFolder, "PROMPT.md"),
	};
}

async function createTasksRoot() {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-scope-glob-escape-"));
	const tasksRoot = path.join(root, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	return { root, tasksRoot };
}

test("parseScope glob escapes literal dots in path patterns", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		const discoveredTasks = [
			makeDiscovered(tasksRoot, "src/foo.bar/TP-101", "TP-101"),
			makeDiscovered(tasksRoot, "src/other/TP-104", "TP-104"),
		];
		const res = parseScope("src/foo.bar/**", { tasksRoot, discoveredTasks });
		assert.deepEqual(res.taskIds, ["TP-101"]);
		assert.equal(res.mode, "glob");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope glob escapes literal parentheses in path patterns", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		const discoveredTasks = [makeDiscovered(tasksRoot, "docs/(api)/TP-102", "TP-102")];
		const res = parseScope("docs/(api)/**", { tasksRoot, discoveredTasks });
		assert.deepEqual(res.taskIds, ["TP-102"]);
		assert.equal(res.mode, "glob");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope glob with plus in path pattern matches literally", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		const discoveredTasks = [makeDiscovered(tasksRoot, "pkg/v1+2/TP-105", "TP-105")];
		const res = parseScope("pkg/v1+2/**", { tasksRoot, discoveredTasks });
		assert.deepEqual(res.taskIds, ["TP-105"]);
		assert.equal(res.mode, "glob");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope TP-* glob scopes remain unchanged", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		fs.mkdirSync(path.join(tasksRoot, "TP-003-alpha"), { recursive: true });
		fs.writeFileSync(
			path.join(tasksRoot, "TP-003-alpha", "PROMPT.md"),
			"# Task: TP-003 — Test\n",
			"utf-8",
		);

		const discovered = discoverTasks(tasksRoot);
		const token = `${path.basename(tasksRoot)}/TP-003-*`;
		const res = parseScope(token, { tasksRoot, discoveredTasks: discovered });
		assert.deepEqual(res.taskIds, ["TP-003"]);
		assert.equal(res.mode, "glob");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
