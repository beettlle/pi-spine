import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildWorkerChildEnv } from "../../src/batch/worker-host.mjs";
import { resolvePiSpineRoot } from "../../src/config/pi-spine-root.mjs";

const PACKAGE_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("resolvePiSpineRoot defaults to pi-spine package root", () => {
	const root = resolvePiSpineRoot({}, PACKAGE_ROOT);
	assert.equal(root, fs.realpathSync(PACKAGE_ROOT));
	assert.ok(fs.existsSync(path.join(root, "package.json")));
	assert.ok(fs.existsSync(path.join(root, "bin", "spine.mjs")));
});

test("resolvePiSpineRoot honors development.piSpineRoot override", async () => {
	const customRoot = await mkdtemp(path.join(os.tmpdir(), "pi-spine-custom-root-"));
	try {
		fs.writeFileSync(path.join(customRoot, "package.json"), "{}", "utf-8");
		fs.mkdirSync(path.join(customRoot, "bin"), { recursive: true });
		fs.writeFileSync(path.join(customRoot, "bin", "spine.mjs"), "", "utf-8");

		const resolved = resolvePiSpineRoot(
			{ development: { piSpineRoot: customRoot } },
			PACKAGE_ROOT,
		);
		assert.equal(resolved, fs.realpathSync(customRoot));
	} finally {
		await rm(customRoot, { recursive: true, force: true });
	}
});

test("buildWorkerChildEnv sets PI_SPINE_ROOT for worker spawn", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-worker-env-"));
	try {
		const taskFolder = path.join(projectRoot, "spine-tasks", "SP-103-test");
		const worktreePath = path.join(projectRoot, "worktree");
		const expectedRoot = resolvePiSpineRoot({}, projectRoot);

		const env = buildWorkerChildEnv({
			taskFolder,
			worktreePath,
			projectRoot,
			batchId: "batch-103",
			laneNumber: 2,
			taskId: "SP-103",
			config: {},
		});

		assert.equal(env.PI_SPINE_ROOT, expectedRoot);
		assert.equal(env.SPINE_PROJECT_ROOT, projectRoot);
		assert.equal(env.SPINE_TASK_FOLDER, taskFolder);
		assert.equal(env.SPINE_WORKTREE, worktreePath);
		assert.equal(env.SPINE_BATCH_ID, "batch-103");
		assert.equal(env.SPINE_LANE_NUMBER, "2");
		assert.equal(env.SPINE_TASK_ID, "SP-103");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
