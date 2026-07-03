import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const TEMPLATE_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../templates",
);

/**
 * Create a fixture where all discovered tasks have .DONE markers.
 */
async function createAllDoneFixture(taskCount = 3) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-plan-empty-"));
	const tasksRoot = path.join(root, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });

	for (let i = 1; i <= taskCount; i++) {
		const id = `TP-${String(i).padStart(3, "0")}`;
		const folder = path.join(tasksRoot, `${id}-task`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			minimalValidPromptMarkdown(id, { title: "Done task", fileScope: `src/${id}.mjs` }),
			"utf-8",
		);
		fs.writeFileSync(path.join(folder, ".DONE"), "", "utf-8");
	}

	const spineDir = path.join(root, ".spine");
	fs.mkdirSync(spineDir, { recursive: true });
	const templateConfig = JSON.parse(
		fs.readFileSync(path.join(TEMPLATE_DIR, "spine-config.json"), "utf-8"),
	);
	templateConfig.lanes.maxParallel = 2;
	fs.writeFileSync(
		path.join(spineDir, "spine-config.json"),
		JSON.stringify(templateConfig, null, 2),
		"utf-8",
	);

	return { root, tasksRoot };
}

test("runSpinePlan pending with all .DONE returns exit 0 informational output", async () => {
	const { runSpinePlan } = await import("../../bin/spine-plan.mjs");
	const { root } = await createAllDoneFixture(5);
	try {
		const result = await runSpinePlan({ projectRoot: root, scope: "pending", json: false });
		assert.ok(result.output, "output should be non-empty");
		assert.match(result.output, /0 task\(s\)/);
		assert.match(result.output, /0 wave\(s\)/);
		assert.match(result.output, /5 excluded \(\.DONE on disk\)/);
		assert.match(result.output, /No pending tasks/);
		assert.match(result.output, /spine plan all/);
		assert.equal(result.artifactPath, null, "no plan artifact for empty pending");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpinePlan pending JSON with all .DONE returns synthetic plan", async () => {
	const { runSpinePlan } = await import("../../bin/spine-plan.mjs");
	const { root } = await createAllDoneFixture(3);
	try {
		const result = await runSpinePlan({ projectRoot: root, scope: "pending", json: true });
		const plan = JSON.parse(result.output);
		assert.equal(plan.scope.mode, "pending");
		assert.deepEqual(plan.scope.taskIds, []);
		assert.deepEqual(plan.waves, []);
		assert.equal(plan.metadata.tasksSelected, 0);
		assert.equal(plan.metadata.tasksExcluded, 3);
		assert.equal(plan.metadata.tasksDiscovered, 3);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpinePlan pending with all .DONE does not throw", async () => {
	const { runSpinePlan } = await import("../../bin/spine-plan.mjs");
	const { root } = await createAllDoneFixture(1);
	try {
		await assert.doesNotReject(
			() => runSpinePlan({ projectRoot: root, scope: "pending" }),
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("parseScope pending empty error carries structured metadata", async () => {
	const { parseScope, NO_PENDING_TASKS_ERROR } = await import("../../src/planner/scope.mjs");
	const { discoverTasks } = await import("../../src/tasks/packet/index.mjs");
	const { root, tasksRoot } = await createAllDoneFixture(4);
	try {
		const discovered = discoverTasks(tasksRoot);
		try {
			parseScope("pending", { tasksRoot, discoveredTasks: discovered });
			assert.fail("expected parseScope to throw");
		} catch (err) {
			assert.equal(err.message, NO_PENDING_TASKS_ERROR);
			assert.equal(err.code, "NO_PENDING_TASKS");
			assert.equal(err.excludedCount, 4);
			assert.equal(err.discoveredCount, 4);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpinePlan pending output includes maxParallel from config", async () => {
	const { runSpinePlan } = await import("../../bin/spine-plan.mjs");
	const { root } = await createAllDoneFixture(2);
	try {
		const result = await runSpinePlan({ projectRoot: root, scope: "pending" });
		assert.match(result.output, /maxParallel 2/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
