import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildWorktreeHealthDoctorCheck } from "../../src/doctor/worktree-health.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("buildWorktreeHealthDoctorCheck passes with no worktrees", async () => {
	const projectRoot = await initGitRepo("spine-worktree-health-empty-");
	try {
		const check = buildWorktreeHealthDoctorCheck({ projectRoot, config: {} });
		assert.equal(check.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildWorktreeHealthDoctorCheck flags absolute gitdir", async () => {
	const projectRoot = await initGitRepo("spine-worktree-health-abs-");
	try {
		const laneDir = path.join(projectRoot, ".worktrees", "batch-1", "lane-1");
		fs.mkdirSync(laneDir, { recursive: true });
		fs.writeFileSync(
			path.join(laneDir, ".git"),
			"gitdir: /workspace/.git/worktrees/lane-1\n",
			"utf-8",
		);
		const check = buildWorktreeHealthDoctorCheck({ projectRoot, config: {} });
		assert.equal(check.ok, false);
		assert.match(check.detail, /absolute gitdir/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
