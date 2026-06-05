import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chmodSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { validateSpineConfig } from "../../bin/spine-config.mjs";
import { checkWorktreeSetupHook } from "../../bin/spine-preflight.mjs";
import { runWorktreeSetupHook } from "../../src/batch/worktree.mjs";
import {
	resolveWorktreeSetupHook,
	validateWorktreeSetupHookPath,
} from "../../src/config/worktree-setup-hook.mjs";

const MINIMAL_CONFIG = {
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
	referenceDocs: [],
	standards: [],
	neverLoad: [],
};

/**
 * @param {string} root
 * @param {string} relPath
 * @param {string} body
 */
async function writeExecutableHook(root, relPath, body) {
	const hookPath = path.join(root, relPath);
	await fs.promises.mkdir(path.dirname(hookPath), { recursive: true });
	writeFileSync(hookPath, body, "utf-8");
	chmodSync(hookPath, 0o755);
	return hookPath;
}

test("validateWorktreeSetupHookPath accepts ./scripts/ prefix when file exists", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-dot-"));
	try {
		const hookPath = path.join(root, "scripts", "spine-worktree-setup.sh");
		fs.mkdirSync(path.dirname(hookPath), { recursive: true });
		fs.writeFileSync(hookPath, "#!/bin/sh\n", "utf-8");

		const dotResult = validateWorktreeSetupHookPath(root, "./scripts/spine-worktree-setup.sh");
		const plainResult = validateWorktreeSetupHookPath(root, "scripts/spine-worktree-setup.sh");

		assert.equal(dotResult.ok, true);
		assert.equal(plainResult.ok, true);
		assert.equal(dotResult.scriptPath, plainResult.scriptPath);
		assert.equal(dotResult.relPath, plainResult.relPath);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateWorktreeSetupHookPath rejects ./scripts/../ traversal", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-traversal-"));
	try {
		const result = validateWorktreeSetupHookPath(root, "./scripts/../outside.sh");
		assert.equal(result.ok, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("validateSpineConfig rejects unsafe worktreeSetupHook", () => {
	const error = validateSpineConfig({
		...MINIMAL_CONFIG,
		worktreeSetupHook: "/etc/passwd",
	});
	assert.ok(error);
	assert.match(error.message, /relative|scripts/i);
});

test("checkWorktreeSetupHook fails preflight for unsafe hook path", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-preflight-"));
	try {
		const check = checkWorktreeSetupHook({
			projectRoot: root,
			configResult: {
				config: {
					...MINIMAL_CONFIG,
					worktreeSetupHook: "/etc/passwd",
				},
				error: null,
			},
		});
		assert.equal(check.ok, false);
		assert.equal(check.id, "worktree-setup-hook");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runWorktreeSetupHook succeeds with JSON stdout", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-run-ok-"));
	const worktree = await mkdtemp(path.join(os.tmpdir(), "spine-hook-wt-"));
	try {
		const hookRel = "scripts/spine-worktree-setup.sh";
		await writeExecutableHook(
			root,
			hookRel,
			`#!/usr/bin/env node
console.log("setting up worktree");
console.log(JSON.stringify({ ok: true }));
process.exit(0);
`,
		);

		const config = { ...MINIMAL_CONFIG, worktreeSetupHook: hookRel };
		const result = runWorktreeSetupHook({
			projectRoot: root,
			worktreePath: worktree,
			batchId: "batch-test",
			laneNumber: 1,
			config,
		});

		assert.equal(result.ok, true);
		assert.ok(result.durationMs >= 0);
		assert.equal(
			resolveWorktreeSetupHook(root, config),
			fs.realpathSync(path.join(root, hookRel)),
		);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(worktree, { recursive: true, force: true });
	}
});

test("runWorktreeSetupHook throws when hook returns ok false", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-run-fail-"));
	const worktree = await mkdtemp(path.join(os.tmpdir(), "spine-hook-wt-fail-"));
	try {
		const hookRel = "scripts/spine-worktree-setup.sh";
		await writeExecutableHook(
			root,
			hookRel,
			`#!/usr/bin/env node
console.log(JSON.stringify({ ok: false, error: "symlink failed" }));
process.exit(0);
`,
		);

		assert.throws(
			() =>
				runWorktreeSetupHook({
					projectRoot: root,
					worktreePath: worktree,
					batchId: "batch-test",
					laneNumber: 2,
					config: { ...MINIMAL_CONFIG, worktreeSetupHook: hookRel },
				}),
			(err) => {
				assert.match(err.message, /symlink failed/);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(worktree, { recursive: true, force: true });
	}
});

test("runWorktreeSetupHook throws on malformed JSON stdout", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-run-badjson-"));
	const worktree = await mkdtemp(path.join(os.tmpdir(), "spine-hook-wt-badjson-"));
	try {
		const hookRel = "scripts/spine-worktree-setup.sh";
		await writeExecutableHook(
			root,
			hookRel,
			`#!/usr/bin/env node
console.log("not-json");
process.exit(0);
`,
		);

		assert.throws(
			() =>
				runWorktreeSetupHook({
					projectRoot: root,
					worktreePath: worktree,
					batchId: "batch-test",
					laneNumber: 1,
					config: { ...MINIMAL_CONFIG, worktreeSetupHook: hookRel },
				}),
			(err) => {
				assert.match(err.message, /invalid JSON/);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(worktree, { recursive: true, force: true });
	}
});

test("runWorktreeSetupHook is no-op when hook not configured", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-hook-skip-"));
	const worktree = await mkdtemp(path.join(os.tmpdir(), "spine-hook-wt-skip-"));
	try {
		const result = runWorktreeSetupHook({
			projectRoot: root,
			worktreePath: worktree,
			batchId: "batch-test",
			laneNumber: 1,
			config: { ...MINIMAL_CONFIG, worktreeSetupHook: "" },
		});
		assert.equal(result.skipped, true);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(worktree, { recursive: true, force: true });
	}
});
