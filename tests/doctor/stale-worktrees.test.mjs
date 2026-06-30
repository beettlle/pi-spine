import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	buildStaleWorktreesDoctorCheck,
	listStaleSpineWorktreeBatchIds,
	resolveInProgressSpineBatchId,
} from "../../src/doctor/stale-worktrees.mjs";
import { runDoctorChecks } from "../../src/doctor/run-doctor-checks.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("resolveInProgressSpineBatchId returns batchId for running batch", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-active-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260630T120000", phase: "running" }),
			"utf-8",
		);

		assert.equal(resolveInProgressSpineBatchId(projectRoot), "20260630T120000");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("resolveInProgressSpineBatchId returns null for completed batch", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-terminal-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260630T120000", phase: "completed" }),
			"utf-8",
		);

		assert.equal(resolveInProgressSpineBatchId(projectRoot), null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("listStaleSpineWorktreeBatchIds flags dirs without matching active batch", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-list-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T100000"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T110000"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T120000"), {
			recursive: true,
		});

		const stale = listStaleSpineWorktreeBatchIds(projectRoot, "20260630T120000");
		assert.deepEqual(stale, ["20260630T100000", "20260630T110000"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildStaleWorktreesDoctorCheck warns on stale worktree dirs", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-warn-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T100000"), {
			recursive: true,
		});

		const check = buildStaleWorktreesDoctorCheck({
			projectRoot,
			activeBatchId: "20260630T120000",
		});

		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.detail, /1 leftover batch dir/);
		assert.match(check.detail, /spine-20260630T100000/);
		assert.ok(check.suggestedCommand?.includes("cleanupWorktreesOnComplete"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildStaleWorktreesDoctorCheck passes when only active batch dir exists", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-ok-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T120000"), {
			recursive: true,
		});

		const check = buildStaleWorktreesDoctorCheck({
			projectRoot,
			activeBatchId: "20260630T120000",
		});

		assert.equal(check.ok, true);
		assert.equal(check.warning, undefined);
		assert.match(check.detail, /active batch 20260630T120000/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks includes stale worktrees warning", async () => {
	const projectRoot = await initGitRepo("spine-stale-wt-doctor-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".worktrees", "spine-20260630T100000"), {
			recursive: true,
		});
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260630T120000", phase: "running" }),
			"utf-8",
		);

		const result = runDoctorChecks(projectRoot);
		const check = result.checks.find((entry) => entry.label === "stale worktrees");
		assert.ok(check, "stale worktrees check expected in doctor output");
		assert.equal(check.warning, true);
		assert.match(check.detail, /spine-20260630T100000/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
