import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveTaskStartCommit } from "../../src/batch/contract-task-start.mjs";
import { verifyContract } from "../../src/batch/contract-verify.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260702T212435";

/**
 * @param {string} worktreePath
 * @returns {string}
 */
function headSha(worktreePath) {
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

test("resolveTaskStartCommit ignores resumed task.started after same-task lane.committed", () => {
	const priorTaskCommit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
	const taskLaneCommit = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
	const journal = [
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-2",
			taskId: "SP-017",
			timestamp: "2026-07-02T21:30:00.000Z",
			payload: { laneNumber: 2, taskId: "SP-017", taskStartCommit: priorTaskCommit },
		},
		{
			type: "lane.committed",
			batchId: BATCH_ID,
			laneId: "lane-2",
			taskId: "SP-017",
			payload: { laneNumber: 2, commitSha: taskLaneCommit },
		},
		{
			type: "contract.verified",
			batchId: BATCH_ID,
			taskId: "SP-017",
			payload: { ok: true },
		},
		{
			type: "task.retry_requested",
			batchId: BATCH_ID,
			taskId: "SP-017",
		},
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-2",
			taskId: "SP-017",
			timestamp: "2026-07-02T21:45:00.000Z",
			payload: { laneNumber: 2, taskId: "SP-017", resumed: true },
		},
	];

	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-017",
			laneId: "lane-2",
			batchId: BATCH_ID,
		}),
		priorTaskCommit,
	);
});

test("verifyContract passes fileScopeMustChange after pause/retry/resume when lane commit exists", async () => {
	const worktreePath = await initGitRepo("spine-contract-resume-baseline-");
	try {
		const scopePath = "lib/src/home_feature/forms/steam_form.dart";
		fs.mkdirSync(path.join(worktreePath, path.dirname(scopePath)), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, scopePath), "class SteamForm {}\n");
		execFileSync("git", ["add", "-A"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "base"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["checkout", "-b", "task/spine-lane-2"], { cwd: worktreePath, stdio: "ignore" });

		const taskStartCommit = headSha(worktreePath);

		fs.writeFileSync(
			path.join(worktreePath, scopePath),
			"class SteamForm { void stopAtTemperature() {} }\n",
		);
		execFileSync("git", ["add", scopePath], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "feat(SP-017): steam form"], {
			cwd: worktreePath,
			stdio: "ignore",
		});
		const laneCommit = headSha(worktreePath);

		const journal = [
			{
				type: "task.started",
				batchId: BATCH_ID,
				laneId: "lane-2",
				taskId: "SP-017",
				timestamp: "2026-07-02T21:30:00.000Z",
				payload: { laneNumber: 2, taskId: "SP-017", taskStartCommit },
			},
			{
				type: "lane.committed",
				batchId: BATCH_ID,
				laneId: "lane-2",
				taskId: "SP-017",
				payload: { laneNumber: 2, commitSha: laneCommit },
			},
			{
				type: "task.started",
				batchId: BATCH_ID,
				laneId: "lane-2",
				taskId: "SP-017",
				timestamp: "2026-07-02T21:45:00.000Z",
				payload: { laneNumber: 2, taskId: "SP-017", resumed: true },
			},
		];

		const sinceCommit = resolveTaskStartCommit({
			journal,
			taskId: "SP-017",
			laneId: "lane-2",
			batchId: BATCH_ID,
			worktreePath,
		});
		assert.equal(sinceCommit, taskStartCommit);

		const falseNegativeBaseline = laneCommit;
		const broken = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: [scopePath],
				fileScopeMustNotChange: [],
				artifactsMustExist: [],
			},
			{ baseBranch: "main", sinceCommit: falseNegativeBaseline },
		);
		assert.equal(broken.ok, false);
		const brokenScope = broken.checks.find(
			(check) => check.field === "fileScopeMustChange" && !check.ok,
		);
		assert.ok(brokenScope);

		const fixed = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: [scopePath],
				fileScopeMustNotChange: [],
				artifactsMustExist: [],
			},
			{ baseBranch: "main", sinceCommit },
		);
		assert.equal(fixed.ok, true);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});
