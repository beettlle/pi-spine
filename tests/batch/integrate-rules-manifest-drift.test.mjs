import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveRulesManifestIntegrateDrift } from "../../src/batch/rules-manifest-drift.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const baseRules = [
	{
		relPath: "taskplane-worker-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "worker",
		globs: [],
		parseStatus: "ok",
	},
];

const workerAddedRules = [
	...baseRules,
	{
		relPath: "spine-operator-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "operator",
		globs: [],
		parseStatus: "ok",
	},
	{
		relPath: "spine-worker-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "spine worker",
		globs: [],
		parseStatus: "ok",
	},
];

function writeRulesManifest(projectRoot, generatedAt, rules = baseRules) {
	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function readRulesManifestFromRef(projectRoot, ref) {
	return JSON.parse(
		execFileSync("git", ["show", `${ref}:${RULES_MANIFEST_REL_PATH}`], {
			cwd: projectRoot,
			encoding: "utf-8",
		}),
	);
}

function gitRefHasPath(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["show", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function completedBatchFixture(orchBranch, batchId = "20260620T194352") {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "deadbeef" }],
		tasks: [{ taskId: "SP-317", status: "succeeded", doneFileFound: true }],
	};
}

/**
 * Reproduces GitHub #22: main dirty with worker manifest entries matching orch.
 */
function setupWorkerManifestDriftFixture(projectRoot) {
	const batchId = "20260620T194352";
	const orchBranch = `orch/spine-${batchId}`;

	writeRulesManifest(projectRoot, "2026-06-20T18:00:00.000Z", baseRules);
	execCommit(projectRoot, "base manifest");
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "base", "utf-8");
	execCommit(projectRoot, "base work");

	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, "2026-06-20T19:30:00.000Z", workerAddedRules);
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "orch batch work\n", "utf-8");
	execCommit(projectRoot, "orch manifest with worker rules");

	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, "2026-06-20T19:45:00.000Z", workerAddedRules);

	return { batchId, orchBranch };
}

test("resolveRulesManifestIntegrateDrift restores main when worker manifest matches orch (#22)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-worker-drift-");
	try {
		const { orchBranch } = setupWorkerManifestDriftFixture(projectRoot);
		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
		});
		assert.equal(drift.ok, true, drift.error);
		assert.equal(drift.resolved, true);
		assert.equal(drift.action, "restored_head_worker_manifest_drift");

		const onDisk = JSON.parse(
			fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"),
		);
		assert.equal(onDisk.rules.length, baseRules.length);
		assert.equal(onDisk.generatedAt, "2026-06-20T18:00:00.000Z");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase succeeds with worker manifest drift on main matching orch (#22)", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-worker-merge-");
	try {
		const { batchId, orchBranch } = setupWorkerManifestDriftFixture(projectRoot);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		approveIntegrateGate({ projectRoot, batchId });

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);

		const merged = readRulesManifestFromRef(projectRoot, "main");
		assert.equal(merged.rules.length, workerAddedRules.length);
		assert.equal(merged.generatedAt, "2026-06-20T19:30:00.000Z");
		assert.ok(gitRefHasPath(projectRoot, "main", "orch-work.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveRulesManifestIntegrateDrift blocks unrelated dirty files on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-unrelated-dirty-");
	try {
		const { orchBranch } = setupWorkerManifestDriftFixture(projectRoot);
		fs.writeFileSync(path.join(projectRoot, "unrelated.txt"), "dirty\n", "utf-8");

		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
		});
		assert.equal(drift.ok, false);
		assert.equal(drift.failureClass, "DirtyWorktree");
		assert.match(drift.error ?? "", /uncommitted changes/i);
		assert.match(drift.error ?? "", /unrelated\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveRulesManifestIntegrateDrift blocks substantive manifest drift not matching orch", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-mismatch-");
	try {
		const batchId = "20260620T194352";
		const orchBranch = `orch/spine-${batchId}`;

		writeRulesManifest(projectRoot, "2026-06-20T18:00:00.000Z", baseRules);
		execCommit(projectRoot, "base manifest");

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRulesManifest(projectRoot, "2026-06-20T19:30:00.000Z", workerAddedRules);
		execCommit(projectRoot, "orch manifest");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		writeRulesManifest(projectRoot, "2026-06-20T19:45:00.000Z", [
			...baseRules,
			{
				relPath: "orphan-rule.mdc",
				spineClass: "manual",
				alwaysApply: false,
				description: "only on main working tree",
				globs: [],
				parseStatus: "ok",
			},
		]);

		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
		});
		assert.equal(drift.ok, false);
		assert.match(drift.error ?? "", /uncommitted content changes beyond generatedAt/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveRulesManifestIntegrateDrift still clears generatedAt-only drift on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-generated-at-");
	try {
		const batchId = "20260611T225006";
		const orchBranch = `orch/spine-${batchId}`;

		writeRulesManifest(projectRoot, "2026-06-11T20:00:00.000Z", baseRules);
		execCommit(projectRoot, "base manifest");

		execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
		writeRulesManifest(projectRoot, "2026-06-11T22:30:00.000Z", baseRules);
		execCommit(projectRoot, "orch manifest");

		execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
		writeRulesManifest(projectRoot, "2026-06-11T23:00:00.000Z", baseRules);

		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
		});
		assert.equal(drift.ok, true, drift.error);
		assert.equal(drift.resolved, true);
		assert.equal(drift.action, "restored_head_for_merge");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
