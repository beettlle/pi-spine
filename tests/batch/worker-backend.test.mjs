import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { rm, mkdtemp } from "node:fs/promises";

import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { validateSettingValue } from "../../src/config/settings-fields.mjs";
import {
	DEFAULT_WORKER_BACKEND,
	resolveWorkerBackend,
	validateWorkerBackendConfig,
	WORKER_BACKENDS,
} from "../../src/config/worker-backend.mjs";
import {
	buildAgentSessionWorkerPrompt,
	createStubAgentSession,
	startAgentSessionWorker,
} from "../../src/batch/agent-session-worker.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";

function writeTaskFolder(root, reviewLevel = 0) {
	const taskFolder = path.join(root, "taskplane-tasks", "TP-900-mock");
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task\n\n## Review Level: ${reviewLevel}\n\nDo work.\n`,
		"utf-8",
	);
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\n", "utf-8");
	return taskFolder;
}

test("resolveWorkerBackend defaults to subprocess", () => {
	assert.equal(resolveWorkerBackend({}), DEFAULT_WORKER_BACKEND);
	assert.equal(resolveWorkerBackend({ lanes: {} }), DEFAULT_WORKER_BACKEND);
	assert.equal(resolveWorkerBackend({ lanes: { workerBackend: "bogus" } }), DEFAULT_WORKER_BACKEND);
});

test("resolveWorkerBackend honors agentSession flag", () => {
	assert.equal(resolveWorkerBackend({ lanes: { workerBackend: "agentSession" } }), "agentSession");
	assert.equal(resolveWorkerBackend({ lanes: { workerBackend: "subprocess" } }), "subprocess");
});

test("validateWorkerBackendConfig rejects invalid values", () => {
	assert.equal(validateWorkerBackendConfig({ lanes: { workerBackend: "agentSession" } }), null);
	const err = validateWorkerBackendConfig({ lanes: { workerBackend: "rpc" } });
	assert.ok(err);
	assert.equal(err.code, "CONFIG_WORKER_BACKEND_INVALID");
});

test("validateSpineConfig accepts optional workerBackend", () => {
	const base = {
		configVersion: 1,
		project: { name: "p", description: "" },
		paths: { tasksRoot: "tasks" },
		baseBranch: "main",
		testing: { build: "", test: "", testWithCoverage: "" },
		agents: {
			worker: { model: "inherit", thinking: "high" },
			reviewer: { model: "inherit", thinking: "medium" },
			supervisor: { model: "inherit", thinking: "off" },
		},
		lanes: { maxParallel: 1, workerBackend: "agentSession" },
		gates: { requireBeforeIntegrate: true, collectBuildEvidence: true, collectTestEvidence: true },
	};
	assert.equal(validateSpineConfig(base), null);
	assert.equal(
		validateSpineConfig({ ...base, lanes: { maxParallel: 1, workerBackend: "invalid" } })?.code,
		"CONFIG_WORKER_BACKEND_INVALID",
	);
});

test("settings registry validates workerBackend enum case-sensitively", () => {
	const ok = validateSettingValue("lanes.workerBackend", "agentSession");
	assert.equal(ok.ok, true);
	if (ok.ok) assert.equal(ok.normalizedValue, "agentSession");

	const bad = validateSettingValue("lanes.workerBackend", "agentsession");
	assert.equal(bad.ok, false);
});

test("buildAgentSessionWorkerPrompt includes PROMPT reference and review hint", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-asw-prompt-"));
	const taskFolder = writeTaskFolder(root, 2);
	const prompt = buildAgentSessionWorkerPrompt({ worktreePath: root, taskFolder });
	assert.match(prompt, /@.*PROMPT\.md/);
	assert.match(prompt, /spine_review_step/);
	assert.match(prompt, /feat\(TP-900\)/);
	fs.rmSync(root, { recursive: true, force: true });
});

test("createStubAgentSession writes .DONE", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-asw-stub-"));
	const taskFolder = writeTaskFolder(root);
	const session = createStubAgentSession({ worktreePath: root, taskFolder });
	await session.prompt("work");
	assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true);
	fs.rmSync(root, { recursive: true, force: true });
});

test("startAgentSessionWorker completes with injected mock session", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "spine-asw-start-"));
	const taskFolder = writeTaskFolder(root);
	const handle = startAgentSessionWorker(
		{ worktreePath: root, taskFolder, config: { agents: { worker: { thinking: "medium" } } } },
		{
			createAgentSession: async () => ({
				session: createStubAgentSession({ worktreePath: root, taskFolder }),
			}),
		},
	);
	const result = await handle.wait();
	assert.equal(result.exitCode, 0);
	assert.equal(fs.existsSync(path.join(taskFolder, ".DONE")), true);
	fs.rmSync(root, { recursive: true, force: true });
});

test("runWorker uses agentSession backend with mock factory", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-asw-run-"));
	const taskFolder = writeTaskFolder(root, 0);
	const prevWorkerStub = process.env.SPINE_WORKER_STUB;
	const prevAgentStub = process.env.SPINE_AGENT_SESSION_STUB;
	delete process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_AGENT_SESSION_STUB;
	try {
		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			config: { lanes: { workerBackend: "agentSession" } },
			workerBackendDeps: {
				createAgentSession: async () => ({
					session: createStubAgentSession({ worktreePath: root, taskFolder }),
				}),
			},
		});
		assert.equal(result.ok, true);
		assert.equal(result.mode, "agentSession");
		assert.equal(result.exitCode, 0);
	} finally {
		if (prevWorkerStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevWorkerStub;
		if (prevAgentStub === undefined) delete process.env.SPINE_AGENT_SESSION_STUB;
		else process.env.SPINE_AGENT_SESSION_STUB = prevAgentStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorker keeps subprocess default when workerBackend unset", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-asw-default-"));
	const taskFolder = writeTaskFolder(root, 0);
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const result = await runWorker({
			worktreePath: root,
			taskFolder,
			config: { lanes: { maxParallel: 1 } },
		});
		assert.equal(result.ok, true);
		assert.equal(result.mode, "stub");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(root, { recursive: true, force: true });
	}
});

test("WORKER_BACKENDS lists supported values", () => {
	assert.deepEqual(WORKER_BACKENDS, ["subprocess", "agentSession"]);
});
