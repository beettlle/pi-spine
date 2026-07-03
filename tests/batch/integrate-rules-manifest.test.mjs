import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { approveIntegrateGate, openIntegrateGate } from "../../src/batch/gate.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveRulesManifestIntegrateDrift } from "../../src/batch/engine-lanes.mjs";
import { integrateOrchToBase } from "../../src/batch/integrate.mjs";
import { RULES_MANIFEST_REL_PATH } from "../../src/config/cursor-rules/discover.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const sampleRules = [
	{
		relPath: "taskplane-worker-cursor.mdc",
		spineClass: "manual",
		alwaysApply: false,
		description: "worker",
		globs: [],
		parseStatus: "ok",
	},
];

function writeRulesManifest(projectRoot, generatedAt, rules = sampleRules) {
	const manifest = {
		generatedAt,
		rulesRoot: ".cursor/rules",
		rules,
		excluded: [],
	};
	fs.mkdirSync(path.dirname(path.join(projectRoot, RULES_MANIFEST_REL_PATH)), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, RULES_MANIFEST_REL_PATH),
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf-8",
	);
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

function completedBatchFixture(orchBranch, batchId = "20260611T225006") {
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
		tasks: [{ taskId: "SP-193", status: "succeeded", doneFileFound: true }],
	};
}

function setupIntegrateManifestFixture(projectRoot) {
	const batchId = "20260611T225006";
	const orchBranch = `orch/spine-${batchId}`;

	writeRulesManifest(projectRoot, "2026-06-11T20:00:00.000Z");
	execCommit(projectRoot, "base manifest");
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execCommit(projectRoot, "base work");

	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, "2026-06-11T22:30:00.000Z");
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "orch batch work\n", "utf-8");
	execCommit(projectRoot, "orch manifest and work");

	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
	writeRulesManifest(projectRoot, "2026-06-11T23:00:00.000Z");

	return { batchId, orchBranch };
}

test("resolveRulesManifestIntegrateDrift clears generatedAt-only dirty manifest on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-drift-");
	try {
		const { orchBranch } = setupIntegrateManifestFixture(projectRoot);
		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch: "main",
			orchBranch,
		});
		assert.equal(drift.ok, true, drift.error);
		assert.equal(drift.resolved, true);
		assert.equal(
			JSON.parse(fs.readFileSync(path.join(projectRoot, RULES_MANIFEST_REL_PATH), "utf-8"))
				.generatedAt,
			"2026-06-11T20:00:00.000Z",
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateOrchToBase succeeds with dirty generatedAt-only rules-manifest on main", async () => {
	const projectRoot = await initGitRepo("spine-integrate-manifest-merge-");
	try {
		const { batchId, orchBranch } = setupIntegrateManifestFixture(projectRoot);
		const fixture = completedBatchFixture(orchBranch, batchId);
		writeSpineBatchState(projectRoot, fixture);
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId, batchState: fixture, config });
		approveIntegrateGate({ projectRoot, batchId });

		const result = integrateOrchToBase({ projectRoot });
		assert.equal(result.ok, true, result.error ?? result.headline);

		const merged = readRulesManifestFromRef(projectRoot, "main");
		assert.equal(merged.generatedAt, "2026-06-11T22:30:00.000Z");
		assert.ok(gitRefHasPath(projectRoot, "main", "orch-work.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
