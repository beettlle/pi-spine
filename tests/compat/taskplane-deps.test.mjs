import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
	loadDependenciesJson,
	mergeDeps,
	mergeTaskDeps,
	parsePrompt,
} from "../../src/compat/taskplane/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.join(__dirname, "../../test/fixtures/taskplane");

test("mergeDeps unions identical sets from PROMPT and JSON", () => {
	const merged = mergeDeps(
		"FX-003",
		["FX-001", "FX-002"],
		{ tasks: { "FX-003": ["FX-001", "FX-002"] } },
	);
	assert.deepEqual(merged, ["FX-001", "FX-002"]);
});

test("mergeDeps JSON wins when PROMPT and JSON disagree", () => {
	const merged = mergeDeps(
		"FX-002",
		["FX-001"],
		{ tasks: { "FX-002": ["FX-003"] } },
	);
	assert.deepEqual(merged, ["FX-003"]);
});

test("mergeTaskDeps uses golden fixtures end-to-end", () => {
	const depsJson = loadDependenciesJson(FIXTURES_ROOT);
	const promptMarkdown = fs.readFileSync(
		path.join(FIXTURES_ROOT, "FX-002-medium-feature/PROMPT.md"),
		"utf-8",
	);
	const prompt = parsePrompt(promptMarkdown);

	const merged = mergeTaskDeps({ taskId: prompt.taskId, prompt }, depsJson);
	assert.deepEqual(merged, ["FX-003"]);
});

test("mergeDeps returns PROMPT deps when JSON has no entry", () => {
	const merged = mergeDeps("FX-UNKNOWN", ["FX-001"], { tasks: {} });
	assert.deepEqual(merged, ["FX-001"]);
});
