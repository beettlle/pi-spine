import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readJournalEvents } from "../../src/batch/journal.mjs";
import { buildWorkerTailPrompt } from "../../src/batch/worker-prompt.mjs";
import { buildWorkerContextAsync } from "../../src/config/worker-context.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const JS_FILE_SCOPE = [
	"src/config/worker-context.mjs",
	"src/batch/worker-prompt.mjs",
	"bin/spine-worker-runner.mjs",
	"tests/batch/worker-prompt-rules.test.mjs",
];

test("buildWorkerTailPrompt includes critical-rules for JS-scoped task", async () => {
	const tail = await buildWorkerTailPrompt({
		worktreePath: PROJECT_ROOT,
		taskFolder: path.join(PROJECT_ROOT, "spine-tasks", "SP-092-cursor-rules-worker-integration"),
		donePath: path.join(
			PROJECT_ROOT,
			"spine-tasks",
			"SP-092-cursor-rules-worker-integration",
			".DONE",
		),
		reviewLevel: 0,
		includePromptInclude: false,
		config: {},
		projectRoot: PROJECT_ROOT,
		taskFileScope: JS_FILE_SCOPE,
	});

	assert.match(tail, /Project standards & reference/);
	assert.match(tail, /critical-rules-quick-reference\.mdc/);

	const context = await buildWorkerContextAsync({
		config: {},
		projectRoot: PROJECT_ROOT,
		taskFileScope: JS_FILE_SCOPE,
	});
	assert.ok(
		context.selection?.paths?.includes(
			".cursor/rules/javascript-3-development-standards.mdc",
		),
		"JS glob rule selected for file scope",
	);
});

test("buildWorkerContextAsync appends config.standards end-to-end", async () => {
	const standardPath = ".cursor/rules/general-llm-anti-patterns.mdc";
	const result = await buildWorkerContextAsync({
		config: {
			standards: [standardPath, standardPath],
		},
		projectRoot: PROJECT_ROOT,
		taskFileScope: JS_FILE_SCOPE,
	});

	const pathMatches = result.selection?.paths?.filter((entry) => entry === standardPath) ?? [];
	assert.equal(pathMatches.length, 1, "standards append is deduped in selection paths");
	assert.ok(
		result.selection?.entries?.some((entry) => entry.contextPath === standardPath),
		"standard path present in selection entries",
	);
});

test("buildWorkerContextAsync emits worker.rules_selected journal event", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-journal-"));
	const batchId = "batch-rules-test";
	try {
		fs.mkdirSync(path.join(root, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		await buildWorkerContextAsync({
			config: {},
			projectRoot: PROJECT_ROOT,
			taskFileScope: JS_FILE_SCOPE,
			journal: {
				projectRoot: root,
				batchId,
				taskId: "SP-092",
				laneNumber: 1,
				correlationId: "corr-rules",
			},
		});

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "worker.rules_selected");
		assert.equal(events[0].taskId, "SP-092");
		assert.equal(events[0].payload.mode, "auto");
		assert.ok(Array.isArray(events[0].payload.paths));
		assert.ok(events[0].payload.paths.length > 0);
		assert.ok(Array.isArray(events[0].payload.entries));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync falls back to static context without .cursor/rules", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-fallback-"));
	try {
		const standardPath = path.join(root, "standards", "rule.md");
		fs.mkdirSync(path.dirname(standardPath), { recursive: true });
		fs.writeFileSync(standardPath, "Static standard body.\n", "utf-8");

		const result = await buildWorkerContextAsync({
			config: { standards: ["standards/rule.md"] },
			projectRoot: root,
			taskFileScope: ["src/a.mjs"],
		});

		assert.equal(result.selection?.mode, "static");
		assert.match(result.text, /Static standard body/);
		assert.doesNotMatch(result.text, /critical-rules-quick-reference/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
