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
import { readJournalEvents } from "../../src/batch/journal.mjs";

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
		assert.deepEqual(result.skipped, [
			{ path: "docs/c.md", reason: "byte_cap", sizeBytes: Buffer.byteLength("cccccccccc\n", "utf-8") },
		]);
		assert.equal(result.bytesUsed, Buffer.byteLength("alpha\n", "utf-8"));
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

test("loadContextDocEntries skips an oversize entry and keeps loading at byte cap", async () => {
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
		assert.deepEqual(loaded.skipped, [
			{ path: "two.md", reason: "byte_cap", sizeBytes: 100 },
		]);
		assert.equal(loaded.bytesUsed, 100);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("DEFAULT_WORKER_CONTEXT_BYTE_CAP is 32KiB", () => {
	assert.equal(DEFAULT_WORKER_CONTEXT_BYTE_CAP, 32_768);
});

test("loadContextDocEntries skips an oversize first rule and loads later rules (worker cap)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-skip-first-"));
	try {
		const oversize = "x".repeat(DEFAULT_WORKER_CONTEXT_BYTE_CAP + 1);
		fs.writeFileSync(path.join(root, "big.md"), oversize, "utf-8");
		fs.writeFileSync(path.join(root, "small.md"), "small rule\n", "utf-8");

		const loaded = loadContextDocEntries({
			projectRoot: root,
			paths: ["big.md", "small.md"],
		});

		assert.equal(loaded.ok, true);
		assert.equal(loaded.truncated, true);
		assert.equal(loaded.byteCap, DEFAULT_WORKER_CONTEXT_BYTE_CAP);
		assert.deepEqual(loaded.entries.map((entry) => entry.relPath), ["small.md"]);
		assert.deepEqual(loaded.skipped, [
			{ path: "big.md", reason: "byte_cap", sizeBytes: DEFAULT_WORKER_CONTEXT_BYTE_CAP + 1 },
		]);
		assert.equal(loaded.bytesUsed, Buffer.byteLength("small rule\n", "utf-8"));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("loadContextDocEntries skips an oversize middle rule and loads both neighbors (worker cap)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-skip-mid-"));
	try {
		const oversize = "x".repeat(DEFAULT_WORKER_CONTEXT_BYTE_CAP + 1);
		fs.writeFileSync(path.join(root, "a.md"), "a\n", "utf-8");
		fs.writeFileSync(path.join(root, "big.md"), oversize, "utf-8");
		fs.writeFileSync(path.join(root, "b.md"), "b\n", "utf-8");

		const loaded = loadContextDocEntries({
			projectRoot: root,
			paths: ["a.md", "big.md", "b.md"],
		});

		assert.equal(loaded.ok, true);
		assert.equal(loaded.truncated, true);
		assert.deepEqual(loaded.entries.map((entry) => entry.relPath), ["a.md", "b.md"]);
		assert.deepEqual(loaded.skipped, [
			{ path: "big.md", reason: "byte_cap", sizeBytes: DEFAULT_WORKER_CONTEXT_BYTE_CAP + 1 },
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("loadContextDocEntries reports nothing skipped when all paths fit (worker cap)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-all-fit-"));
	try {
		fs.writeFileSync(path.join(root, "a.md"), "a\n", "utf-8");
		fs.writeFileSync(path.join(root, "b.md"), "b\n", "utf-8");

		const loaded = loadContextDocEntries({
			projectRoot: root,
			paths: ["a.md", "b.md"],
		});

		assert.equal(loaded.ok, true);
		assert.equal(loaded.truncated, false);
		assert.deepEqual(loaded.skipped, []);
		assert.deepEqual(loaded.entries.map((entry) => entry.relPath), ["a.md", "b.md"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync journals over-cap selection as truncated with skipped path (SP-853)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-cap-"));
	const journalRoot = await mkdtemp(path.join(os.tmpdir(), "spine-ctx-cap-journal-"));
	const batchId = "batch-sp853-cap";
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });
		const smallBody = "---\nalwaysApply: true\n---\n# Small\n";
		const bigBody = `---\nalwaysApply: true\n---\n# Big\n${"x".repeat(4096)}`;
		fs.writeFileSync(path.join(rulesDir, "a-small.mdc"), smallBody, "utf-8");
		fs.writeFileSync(path.join(rulesDir, "z-big.mdc"), bigBody, "utf-8");
		fs.mkdirSync(path.join(journalRoot, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		const byteCap = Buffer.byteLength(smallBody, "utf-8") + 1;
		await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: [],
			byteCap,
			journal: {
				projectRoot: journalRoot,
				batchId,
				taskId: "SP-853",
				laneNumber: 1,
				correlationId: "corr-sp853",
			},
		});

		const events = readJournalEvents(journalRoot, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "worker.rules_selected");
		const payload = events[0].payload;
		assert.equal(payload.mode, "auto");
		assert.equal(payload.byteCap, byteCap);
		assert.equal(payload.truncated, true);
		assert.ok(payload.bytesUsed <= byteCap);
		const capSkip = payload.skipped.find((entry) => entry.reason === "byte_cap");
		assert.ok(capSkip);
		assert.ok(capSkip.path.endsWith(".mdc"));
	} finally {
		await rm(journalRoot, { recursive: true, force: true });
		await rm(root, { recursive: true, force: true });
	}
});
