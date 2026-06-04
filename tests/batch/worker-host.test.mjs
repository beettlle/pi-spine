import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
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
