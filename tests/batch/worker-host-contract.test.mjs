// @ts-check
/**
 * SP-877 (#319): audit-leftover coverage for the worker contract path.
 *
 * 1. `resolveTaskFileScope` must validate `SPINE_TASK_FILE_SCOPE` instead of
 *    silently falling back to a PROMPT.md re-parse on malformed JSON.
 * 2. worker-host must surface `parseContract().errors` instead of converting a
 *    malformed Contract table into the guaranteed-failing `echo … && exit 1`
 *    command on execute tasks (classification `contract_parse_failed`).
 * 3. Regression: a valid execute contract still runs and writes .DONE.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";

import { runWorker } from "../../src/batch/worker-host.mjs";
import { buildWorkerPiArgs, resolveTaskFileScope } from "../../bin/spine-worker-runner.mjs";

const BOUNDED_STALL_CONFIG = {
	lanes: {
		stallTimeoutMinutes: 0.5,
		stallGraceAfterProgressMinutes: 0.1,
		heartbeatIntervalMinutes: 60,
	},
};

/**
 * Write a minimal task prompt with the given File Scope entries.
 * @param {string} taskFolder
 * @param {string[]} fileScope
 */
function writePromptWithFileScope(taskFolder, fileScope) {
	const bullets = fileScope.map((entry) => `- \`${entry}\``).join("\n");
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: FIX-1 — file scope fixture\n\n## Review Level: 0\n\n## Mission\nScope fixture.\n\n## File Scope\n${bullets}\n`,
		"utf-8",
	);
}

/**
 * @param {string} taskFolder
 * @param {string} contractBody
 */
function writeExecutePrompt(taskFolder, contractBody) {
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: FIX-2 — execute fixture\n\n**Size:** S\n**Type:** execute\n\n## Review Level: 0\n\n## Mission\nRun the command.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`contract-out.txt\`\n\n## Contract\n${contractBody}\n\n## Steps\n### Step 0\n- [ ] run\n`,
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function readJournalEvents(projectRoot, batchId) {
	const journalFile = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"journal",
		"events.jsonl",
	);
	assert.equal(fs.existsSync(journalFile), true, "journal file must exist");
	return fs
		.readFileSync(journalFile, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

test("resolveTaskFileScope returns the env array when SPINE_TASK_FILE_SCOPE is valid", () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-env-"));
	try {
		delete process.env.SPINE_TASK_FILE_SCOPE;
		writePromptWithFileScope(root, ["prompt-only.txt"]);
		process.env.SPINE_TASK_FILE_SCOPE = JSON.stringify(["src/a.ts", "src/b.ts"]);

		assert.deepEqual(resolveTaskFileScope(root), ["src/a.ts", "src/b.ts"]);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveTaskFileScope throws on malformed SPINE_TASK_FILE_SCOPE JSON", () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-badjson-"));
	try {
		writePromptWithFileScope(root, ["fallback.txt"]);
		process.env.SPINE_TASK_FILE_SCOPE = "{not valid json";

		assert.throws(() => resolveTaskFileScope(root), /SPINE_TASK_FILE_SCOPE is not valid JSON/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveTaskFileScope throws when SPINE_TASK_FILE_SCOPE is not an array", () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-notarray-"));
	try {
		writePromptWithFileScope(root, ["fallback.txt"]);
		process.env.SPINE_TASK_FILE_SCOPE = JSON.stringify({ paths: ["src/a.ts"] });

		assert.throws(() => resolveTaskFileScope(root), /must be a JSON array/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveTaskFileScope throws when SPINE_TASK_FILE_SCOPE has non-string entries", () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-nonstring-"));
	try {
		writePromptWithFileScope(root, ["fallback.txt"]);
		process.env.SPINE_TASK_FILE_SCOPE = JSON.stringify(["src/a.ts", 3]);

		assert.throws(() => resolveTaskFileScope(root), /SPINE_TASK_FILE_SCOPE\[1\] must be a string/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("resolveTaskFileScope falls back to PROMPT.md when SPINE_TASK_FILE_SCOPE is unset", () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-fallback-"));
	try {
		delete process.env.SPINE_TASK_FILE_SCOPE;
		writePromptWithFileScope(root, ["src/a.ts", "src/b.ts"]);

		assert.deepEqual(resolveTaskFileScope(root), ["src/a.ts", "src/b.ts"]);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("buildWorkerPiArgs rejects with a clear message on malformed file-scope env", async () => {
	const prev = process.env.SPINE_TASK_FILE_SCOPE;
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-scope-piargs-"));
	try {
		writePromptWithFileScope(root, ["fallback.txt"]);
		process.env.SPINE_TASK_FILE_SCOPE = "]] broken";

		await assert.rejects(
			() => buildWorkerPiArgs({ taskFolder: root, donePath: path.join(root, ".DONE") }),
			/SPINE_TASK_FILE_SCOPE is not valid JSON/,
		);
	} finally {
		if (prev === undefined) delete process.env.SPINE_TASK_FILE_SCOPE;
		else process.env.SPINE_TASK_FILE_SCOPE = prev;
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("runWorker fails execute tasks at preflight with contract_parse_failed instead of the echo fallback", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-contract-bad-"));
	const prevStub = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const batchId = "20261119T120000";
		const taskId = "SP-877A";
		const taskFolder = path.join(root, "spine-tasks", `${taskId}-bad-contract`);
		fs.mkdirSync(taskFolder, { recursive: true });
		// Contract section present but no Markdown table: parseContract pushes an
		// error and leaves runCommand/testCommand null. The old behavior ran the
		// guaranteed-failing echo command; the fix must fail at preflight instead.
		writeExecutePrompt(taskFolder, "No table here — just prose.");

		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			projectRoot: root,
			batchId,
			laneNumber: 1,
			taskId,
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, false);
		assert.equal(result.classification, "contract_parse_failed");
		assert.equal(result.exitCode, 1);
		assert.equal(result.doneFound, false);
		assert.match(result.output, /Contract parse failed/);
		assert.match(result.output, /Markdown table/);
		assert.equal(
			fs.existsSync(path.join(taskFolder, ".DONE")),
			false,
			"no .DONE may be written",
		);

		const events = readJournalEvents(root, batchId);
		const parseFailed = events.find((event) => event.type === "worker.contract_parse_failed");
		assert.ok(parseFailed, "worker.contract_parse_failed event must be journaled");
		assert.equal(parseFailed.taskId, taskId);
		assert.ok(Array.isArray(parseFailed.payload.errors));
		assert.ok(parseFailed.payload.errors.length > 0);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker still runs execute tasks with a valid contract to .DONE", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-contract-ok-"));
	const prevStub = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const batchId = "20261119T120001";
		const taskId = "SP-877B";
		const taskFolder = path.join(root, "spine-tasks", `${taskId}-ok-contract`);
		fs.mkdirSync(taskFolder, { recursive: true });
		writeExecutePrompt(
			taskFolder,
			"| Field | Value |\n|-------|-------|\n| runCommand | `printf 'contract-ok' > contract-out.txt` |\n| testCommand | `grep contract-ok contract-out.txt` |",
		);

		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			projectRoot: root,
			batchId,
			laneNumber: 1,
			taskId,
			config: BOUNDED_STALL_CONFIG,
		});

		assert.equal(result.ok, true);
		assert.equal(
			fs.existsSync(path.join(taskFolder, ".DONE")),
			true,
			".DONE must be written by the execute path",
		);
		assert.equal(
			fs.readFileSync(path.join(root, "contract-out.txt"), "utf-8"),
			"contract-ok",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});
