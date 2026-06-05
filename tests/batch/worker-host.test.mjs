import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { runWorker } from "../../src/batch/worker-host.mjs";
import {
	DEFAULT_WORKER_LAUNCH_SCRIPT,
	resolveSafeWorkerLaunchScript,
	validateWorkerLaunchScriptPath,
} from "../../src/config/worker-launch-script.mjs";

test("validateWorkerLaunchScriptPath requires scripts/ prefix", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-"));
	try {
		const result = validateWorkerLaunchScriptPath(root, "bin/evil.sh");
		assert.equal(result.ok, false);
		assert.match(result.message, /scripts\//);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateWorkerLaunchScriptPath rejects traversal", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-"));
	try {
		const result = validateWorkerLaunchScriptPath(root, "scripts/../outside.sh");
		assert.equal(result.ok, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateWorkerLaunchScriptPath rejects symlink escape", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-symlink-"));
	try {
		fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
		const outside = path.join(root, "outside.sh");
		fs.writeFileSync(outside, "#!/bin/sh\n", "utf-8");
		fs.symlinkSync(outside, path.join(root, "scripts", "escape.sh"));

		const result = validateWorkerLaunchScriptPath(root, "scripts/escape.sh");
		assert.equal(result.ok, false);
		assert.match(result.message, /symlink/i);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("resolveSafeWorkerLaunchScript returns default when present", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-ok-"));
	try {
		const scriptPath = path.join(root, "scripts", "spine-worker-launch.sh");
		fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
		fs.writeFileSync(scriptPath, "#!/bin/sh\n", "utf-8");

		const resolved = resolveSafeWorkerLaunchScript(root, {});
		assert.equal(resolved, fs.realpathSync(scriptPath));
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateSpineConfig rejects unsafe development.workerLaunchScript", () => {
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
		development: { workerLaunchScript: "/etc/passwd" },
		referenceDocs: [],
		standards: [],
		neverLoad: [],
	});
	assert.ok(error);
	assert.match(error.message, /relative|scripts/i);
});

test("DEFAULT_WORKER_LAUNCH_SCRIPT matches conventional path", () => {
	assert.equal(DEFAULT_WORKER_LAUNCH_SCRIPT, "scripts/spine-worker-launch.sh");
});

test("runWorker classifies launch script fast-fail as launch_failed", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-launch-fail-"));
	try {
		const taskId = "TP-104L";
		const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-launch`);
		fs.mkdirSync(taskFolder, { recursive: true });
		fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
		const launchScript = path.join(projectRoot, "scripts", "spine-worker-launch.sh");
		fs.writeFileSync(launchScript, "#!/bin/sh\nexit 1\n", { encoding: "utf-8", mode: 0o755 });
		fs.writeFileSync(
			path.join(taskFolder, "PROMPT.md"),
			`# Task: ${taskId}\n\n## Review Level: 0\n\n## Mission\nLaunch fail.\n\n## Dependencies\n- **None**\n\n## File Scope\n- \`README.md\`\n\n## Steps\n### Step 0\n- [ ] one\n`,
			"utf-8",
		);

		const prevStub = process.env.SPINE_WORKER_STUB;
		process.env.SPINE_WORKER_STUB = "1";
		try {
			const result = await runWorker({
				worktreePath: projectRoot,
				taskFolder,
				projectRoot,
				batchId: "20260605T140000",
				laneNumber: 1,
				taskId,
				config: {
					development: { workerLaunchScript: "scripts/spine-worker-launch.sh" },
					lanes: {
						heartbeatIntervalMinutes: 10,
						stallTimeoutMinutes: 10,
						stallGraceAfterProgressMinutes: 5,
					},
				},
			});

			assert.equal(result.ok, false);
			assert.equal(result.classification, "launch_failed");
		} finally {
			if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
			else process.env.SPINE_WORKER_STUB = prevStub;
		}
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
