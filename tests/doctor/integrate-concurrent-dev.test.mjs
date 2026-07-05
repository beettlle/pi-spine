import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runDoctorChecks } from "../../bin/spine.mjs";
import { applyConfigDefaults } from "../../src/config/merge-defaults.mjs";
import { INTEGRATE_DEFAULTS } from "../../src/config/defaults.mjs";
import { buildConcurrentDevDoctorCheck } from "../../src/config/spine-preflight-lib.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function activeSpineBatchFixture(batchId = "20260602T140000") {
	return {
		schemaVersion: 1,
		batchId,
		phase: "running",
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		startedAt: Date.now(),
		endedAt: null,
		wavePlan: [],
		resilience: {},
		tasks: [{ taskId: "SP-001", status: "running" }],
		segments: [],
		mergeResults: [],
	};
}

test("INTEGRATE_DEFAULTS match issue #91 config sketch", () => {
	assert.deepEqual(INTEGRATE_DEFAULTS, {
		isolatedWorktree: true,
		allowHumanOnBaseBranch: "warn",
	});
});

test("applyConfigDefaults merges integrate section", () => {
	const config = {};
	applyConfigDefaults(config);
	assert.equal(config.integrate.isolatedWorktree, true);
	assert.equal(config.integrate.allowHumanOnBaseBranch, "warn");
});

test("buildConcurrentDevDoctorCheck passes with no active batch", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		const check = buildConcurrentDevDoctorCheck({
			projectRoot,
			config: { baseBranch: "main", integrate: INTEGRATE_DEFAULTS },
		});
		assert.equal(check.ok, true);
		assert.match(check.detail, /no active pi-spine batch/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildConcurrentDevDoctorCheck passes when human is on a feature branch", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		writeSpineBatchState(projectRoot, activeSpineBatchFixture());
		fs.writeFileSync(path.join(projectRoot, "wip.txt"), "draft\n", "utf-8");
		const { execFileSync } = await import("node:child_process");
		execFileSync("git", ["checkout", "-b", "feature/wip"], { cwd: projectRoot, stdio: "ignore" });

		const check = buildConcurrentDevDoctorCheck({
			projectRoot,
			config: { baseBranch: "main", integrate: INTEGRATE_DEFAULTS },
		});
		assert.equal(check.ok, true);
		assert.match(check.detail, /not main/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildConcurrentDevDoctorCheck warns on active batch + dirty main (warn mode)", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		writeSpineBatchState(projectRoot, activeSpineBatchFixture());
		fs.writeFileSync(path.join(projectRoot, "notes.txt"), "operator wip\n", "utf-8");

		const check = buildConcurrentDevDoctorCheck({
			projectRoot,
			config: { baseBranch: "main", integrate: INTEGRATE_DEFAULTS },
		});
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /active batch/i);
		assert.match(check.detail, /uncommitted edits on main/i);
		assert.match(check.detail, /notes\.txt/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildConcurrentDevDoctorCheck fails on active batch + dirty main (block mode)", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		writeSpineBatchState(projectRoot, activeSpineBatchFixture());
		fs.writeFileSync(path.join(projectRoot, "notes.txt"), "operator wip\n", "utf-8");

		const check = buildConcurrentDevDoctorCheck({
			projectRoot,
			config: {
				baseBranch: "main",
				integrate: { ...INTEGRATE_DEFAULTS, allowHumanOnBaseBranch: "block" },
			},
		});
		assert.equal(check.ok, false);
		assert.match(check.detail, /active batch/i);
		assert.ok(check.suggestedCommand);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildConcurrentDevDoctorCheck passes when allowHumanOnBaseBranch=allow", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		writeSpineBatchState(projectRoot, activeSpineBatchFixture());
		fs.writeFileSync(path.join(projectRoot, "notes.txt"), "operator wip\n", "utf-8");

		const check = buildConcurrentDevDoctorCheck({
			projectRoot,
			config: {
				baseBranch: "main",
				integrate: { ...INTEGRATE_DEFAULTS, allowHumanOnBaseBranch: "allow" },
			},
		});
		assert.equal(check.ok, true);
		assert.equal(check.warning, undefined);
		assert.match(check.detail, /allowHumanOnBaseBranch=allow/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks surfaces concurrent-dev warning when configured", async () => {
	const projectRoot = await initGitRepo("spine-concurrent-dev-");
	try {
		writeSpineBatchState(projectRoot, activeSpineBatchFixture());
		fs.writeFileSync(path.join(projectRoot, "notes.txt"), "operator wip\n", "utf-8");

		const result = runDoctorChecks(projectRoot);
		const concurrent = result.checks.find(
			(check) => check.label === "concurrent development on base branch",
		);
		assert.ok(concurrent);
		assert.equal(concurrent.ok, true);
		assert.equal(concurrent.warning, true);
		assert.match(concurrent.detail, /uncommitted edits on main/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
