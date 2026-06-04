import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { runInit } from "../../bin/spine-init.mjs";
import {
	buildWorkerContext,
	buildWorkerContextAsync,
	cursorRulesRootExists,
	DEFAULT_SPINE_INIT_STANDARDS,
	DEFAULT_WORKER_CONTEXT_BYTE_CAP,
	loadContextDocEntries,
	normalizeContextPathList,
} from "../../src/config/worker-context.mjs";
import { buildWorkerTailPrompt } from "../../src/batch/worker-prompt.mjs";

test("normalizeContextPathList rejects non-arrays", () => {
	assert.deepEqual(normalizeContextPathList(["a.md"]), ["a.md"]);
	assert.equal(normalizeContextPathList("bad"), null);
});

test("buildWorkerContext honors neverLoad and byte cap", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-ctx-"));
	try {
		const docA = path.join(root, "docs", "a.md");
		const docB = path.join(root, "docs", "b.md");
		fs.mkdirSync(path.dirname(docA), { recursive: true });
		fs.writeFileSync(docA, "alpha\n", "utf-8");
		fs.writeFileSync(docB, "beta\n", "utf-8");

		const docC = path.join(root, "docs", "c.md");
		fs.writeFileSync(docC, "cccccccccc\n", "utf-8");
		const result = buildWorkerContext(
			{
				referenceDocs: ["docs/a.md", "docs/c.md"],
				neverLoad: ["docs/b.md"],
			},
			root,
			Buffer.byteLength("alpha\n", "utf-8") + 2,
		);

		assert.match(result.text, /docs\/a\.md/);
		assert.doesNotMatch(result.text, /docs\/b\.md/);
		assert.doesNotMatch(result.text, /cccccccccc/);
		assert.equal(result.truncated, true);
		assert.ok(result.skipped.some((entry) => /docs\/c\.md/.test(entry)));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerTailPrompt injects configured standards", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-tail-"));
	try {
		const standardPath = path.join(root, "standards", "rule.md");
		fs.mkdirSync(path.dirname(standardPath), { recursive: true });
		fs.writeFileSync(standardPath, "Always run npm test.\n", "utf-8");

		const tail = await buildWorkerTailPrompt({
			worktreePath: root,
			taskFolder: path.join(root, "spine-tasks", "SP-073-test"),
			donePath: path.join(root, "spine-tasks", "SP-073-test", ".DONE"),
			config: { standards: ["standards/rule.md"] },
			projectRoot: root,
		});

		assert.match(tail, /Project standards & reference/);
		assert.match(tail, /Always run npm test/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync uses auto selection when cursor rules exist", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-auto-"));
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });
		fs.writeFileSync(
			path.join(rulesDir, "taskplane-worker-cursor.mdc"),
			"---\nalwaysApply: true\n---\n# Worker\n",
			"utf-8",
		);
		fs.writeFileSync(
			path.join(rulesDir, "critical-rules-quick-reference.mdc"),
			"---\nalwaysApply: true\n---\n# Critical\n",
			"utf-8",
		);

		assert.equal(cursorRulesRootExists(root), true);

		const result = await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: ["src/worker.mjs"],
		});

		assert.equal(result.selection?.mode, "auto");
		assert.ok(result.selection?.paths?.length > 0);
		assert.match(result.text, /taskplane-worker-cursor\.mdc/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("spine init defaults standards to [] for auto-discovery (SP-093)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-init-standards-"));
	try {
		for (const rel of DEFAULT_SPINE_INIT_STANDARDS) {
			const full = path.join(root, rel);
			fs.mkdirSync(path.dirname(full), { recursive: true });
			fs.writeFileSync(full, `# ${path.basename(rel)}\n`, "utf-8");
		}

		const result = runInit(root, ["--force"]);
		assert.equal(result.ok, true);
		assert.deepEqual(result.config.standards, []);
		assert.equal(validateSpineConfig(result.config), null);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateSpineConfig rejects invalid referenceDocs", () => {
	const error = validateSpineConfig({
		configVersion: 1,
		project: { name: "x", description: "" },
		paths: { tasksRoot: "spine-tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
		},
		lanes: { maxParallel: 3, queueExcess: true, workerBackend: "subprocess" },
		gates: {
			requireBeforeIntegrate: true,
			collectBuildEvidence: true,
			collectTestEvidence: true,
		},
		referenceDocs: "not-an-array",
		standards: [],
		neverLoad: [],
	});
	assert.equal(error?.code, "CONFIG_WORKER_CONTEXT_INVALID");
});

test("loadContextDocEntries stops at byte cap", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-cap-"));
	try {
		fs.writeFileSync(path.join(root, "one.md"), "x".repeat(100), "utf-8");
		fs.writeFileSync(path.join(root, "two.md"), "y".repeat(100), "utf-8");
		const loaded = loadContextDocEntries({
			projectRoot: root,
			paths: ["one.md", "two.md"],
			byteCap: 150,
		});
		assert.equal(loaded.ok, true);
		assert.equal(loaded.truncated, true);
		assert.equal(loaded.entries.length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("DEFAULT_WORKER_CONTEXT_BYTE_CAP is 32KiB", () => {
	assert.equal(DEFAULT_WORKER_CONTEXT_BYTE_CAP, 32_768);
});
