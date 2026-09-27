import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	compareTaskIds,
	discoverTasks,
	TASK_FOLDER_RE,
	TASK_ID_RE,
	taskIdFromFolderName,
} from "../../src/tasks/packet/discover.mjs";
import {
	discoverTaskFolders,
	discoverTaskIds,
	taskIdFromFolder,
} from "../../src/config/preflight/discovery.mjs";
import { taskIdFromFolder as workerTaskIdFromFolder } from "../../src/batch/worker-prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** SP-785 (#300) fixture: 2/3/4-digit boundary IDs, single-letter-digits prefix, non-task folder. */
const BOUNDARY_FOLDERS = ["SP-099-baz", "SP-999-foo", "SP-1000-bar", "X-001-single", "_explore"];
const EXPECTED_IDS = ["SP-099", "SP-999", "SP-1000", "X-001"];

function makeBoundaryTasksRoot() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sp785-boundary-"));
	const tasksRoot = path.join(root, "spine-tasks");
	for (const folder of BOUNDARY_FOLDERS) {
		fs.mkdirSync(path.join(tasksRoot, folder), { recursive: true });
		fs.writeFileSync(path.join(tasksRoot, folder, "PROMPT.md"), "# Task\n", "utf-8");
	}
	return tasksRoot;
}

test("shared regexes accept SP-1000+ and keep the planner prefix rule", () => {
	assert.ok(TASK_ID_RE.test("SP-099"));
	assert.ok(TASK_ID_RE.test("SP-999"));
	assert.ok(TASK_ID_RE.test("SP-1000"));
	assert.ok(TASK_ID_RE.test("X-001"));
	assert.ok(!TASK_ID_RE.test("_explore"));
	assert.ok(!TASK_ID_RE.test("SP-99"));
	assert.ok(TASK_FOLDER_RE.test("SP-1000-bar"));
	assert.ok(!TASK_FOLDER_RE.test("_explore"));
});

test("compareTaskIds orders numerically: SP-099 < SP-999 < SP-1000", () => {
	assert.equal(compareTaskIds("SP-099", "SP-999") < 0, true);
	assert.equal(compareTaskIds("SP-999", "SP-1000") < 0, true);
	assert.equal(compareTaskIds("SP-1000", "SP-999") > 0, true);
	assert.equal(compareTaskIds("SP-099", "SP-1000") < 0, true);
	assert.equal(compareTaskIds("X-001", "SP-099") > 0, true);
	assert.equal(compareTaskIds("SP-500", "SP-500"), 0);
});

test("taskIdFromFolderName extracts IDs and rejects non-task folders", () => {
	assert.equal(taskIdFromFolderName("SP-1000-bar"), "SP-1000");
	assert.equal(taskIdFromFolderName("SP-099-baz"), "SP-099");
	assert.equal(taskIdFromFolderName("SP-1000"), "SP-1000");
	assert.equal(taskIdFromFolderName("_explore"), null);
	assert.equal(taskIdFromFolderName("notes"), null);
});

test("planner, preflight, and worker helpers agree on the boundary fixture", () => {
	const tasksRoot = makeBoundaryTasksRoot();

	const planned = discoverTasks(tasksRoot);
	const plannedIds = planned.map((task) => task.taskId);
	const preflightFolders = discoverTaskFolders(tasksRoot);
	const preflightIds = discoverTaskIds(tasksRoot);
	const workerIds = planned.map((task) =>
		workerTaskIdFromFolder(path.join(tasksRoot, task.folderName)),
	);

	// Numeric order everywhere, and every site returns the same IDs.
	assert.deepEqual(plannedIds, EXPECTED_IDS);
	assert.deepEqual(preflightIds, EXPECTED_IDS);
	assert.deepEqual(workerIds, EXPECTED_IDS);

	// Preflight folders mirror the planner's folder names (no `_explore`).
	assert.deepEqual(
		preflightFolders,
		EXPECTED_IDS.map((id) => discoverTasks(tasksRoot).find((t) => t.taskId === id).folderName),
	);
	assert.ok(!preflightFolders.includes("_explore"));
});

test("preflight taskIdFromFolder delegates to the shared helper", () => {
	assert.equal(taskIdFromFolder("SP-1000-bar"), "SP-1000");
	assert.equal(taskIdFromFolder("_explore"), null);
});

test("guard: no private task-ID regex literals in discovery consumers (SP-785)", () => {
	const consumerFiles = [
		"../../src/config/preflight/discovery.mjs",
		"../../src/planner/scope.mjs",
		"../../src/batch/worker-prompt.mjs",
		"../../bin/spine-worker-runner.mjs",
	];
	// A task-ID literal: `[A-Z]` char class followed by `-` + `\d` on the same line
	// (covers `-\d{3}`, `-\d{3,}`, `-\d+`, string sources, and `[A-Z]{2,}` variants).
	const privateIdLiteral = /\[A-Z\][^\n]*-\\d/;

	for (const rel of consumerFiles) {
		const filePath = path.join(__dirname, rel);
		const lines = fs.readFileSync(filePath, "utf-8").split("\n");
		const offenders = lines
			.map((line, i) => ({ line: i + 1, text: line }))
			.filter(({ text }) => privateIdLiteral.test(text));
		assert.deepEqual(
			offenders,
			[],
			`${rel} must import the shared task-ID pattern from src/tasks/packet/discover.mjs, found private literal(s) at lines ${offenders.map((o) => o.line).join(", ")}`,
		);
	}
});
