import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateWorkerLaunchScriptPath } from "../../src/config/worker-launch-script.mjs";

test("validateWorkerLaunchScriptPath accepts ./scripts/ prefix when file exists", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-dot-"));
	try {
		const scriptPath = path.join(root, "scripts", "spine-worker-launch.sh");
		fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
		fs.writeFileSync(scriptPath, "#!/bin/sh\n", "utf-8");

		const dotResult = validateWorkerLaunchScriptPath(root, "./scripts/spine-worker-launch.sh");
		const plainResult = validateWorkerLaunchScriptPath(root, "scripts/spine-worker-launch.sh");

		assert.equal(dotResult.ok, true);
		assert.equal(plainResult.ok, true);
		assert.equal(dotResult.scriptPath, plainResult.scriptPath);
		assert.equal(dotResult.relPath, plainResult.relPath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateWorkerLaunchScriptPath rejects ./scripts/../ traversal", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-launch-dot-traversal-"));
	try {
		const result = validateWorkerLaunchScriptPath(root, "./scripts/../outside.sh");
		assert.equal(result.ok, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
