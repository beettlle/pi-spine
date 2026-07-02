import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveTaskStartCommit } from "../../src/batch/contract-task-start.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260701T020526";

/**
 * @param {string} projectRoot
 * @param {string} message
 * @param {string} [commitDateIso]
 */
function gitCommitAll(projectRoot, message, commitDateIso) {
	const env =
		commitDateIso != null
			? {
					...process.env,
					GIT_AUTHOR_DATE: commitDateIso,
					GIT_COMMITTER_DATE: commitDateIso,
				}
			: process.env;
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore", env });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore", env });
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function headSha(projectRoot) {
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

test("resolveTaskStartCommit returns distinct start commits for serialized lane tasks", () => {
	const commitTask1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
	const commitBetween = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
	const journal = [
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-001",
			timestamp: "2026-07-01T02:10:00.000Z",
			payload: { laneNumber: 1, taskId: "SP-001" },
		},
		{
			type: "lane.committed",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-001",
			payload: { laneNumber: 1, commitSha: commitTask1 },
		},
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-002",
			timestamp: "2026-07-01T02:20:00.000Z",
			payload: { laneNumber: 1, taskId: "SP-002" },
		},
		{
			type: "lane.committed",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-002",
			payload: { laneNumber: 1, commitSha: commitBetween },
		},
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-003",
			timestamp: "2026-07-01T02:30:00.000Z",
			payload: { laneNumber: 1, taskId: "SP-003" },
		},
	];

	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-001",
			laneId: "lane-1",
			batchId: BATCH_ID,
		}),
		null,
	);
	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-002",
			laneId: "lane-1",
			batchId: BATCH_ID,
		}),
		commitTask1,
	);
	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-003",
			laneId: "lane-1",
			batchId: BATCH_ID,
		}),
		commitBetween,
	);
});

test("resolveTaskStartCommit prefers task.started payload commit over prior lane.committed", () => {
	const payloadCommit = "cccccccccccccccccccccccccccccccccccccccc";
	const priorCommit = "dddddddddddddddddddddddddddddddddddddddd";
	const journal = [
		{
			type: "lane.committed",
			laneId: "lane-2",
			payload: { laneNumber: 2, commitSha: priorCommit },
		},
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-2",
			taskId: "SP-005",
			timestamp: "2026-07-01T02:40:00.000Z",
			payload: { laneNumber: 2, taskId: "SP-005", taskStartCommit: payloadCommit },
		},
	];

	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-005",
			laneId: "lane-2",
			batchId: BATCH_ID,
		}),
		payloadCommit,
	);
});

test("resolveTaskStartCommit returns null when task.started is missing (main...HEAD fallback)", () => {
	const journal = [
		{
			type: "task.started",
			batchId: BATCH_ID,
			laneId: "lane-1",
			taskId: "SP-001",
			payload: { laneNumber: 1 },
		},
	];

	assert.equal(
		resolveTaskStartCommit({
			journal,
			taskId: "SP-999",
			laneId: "lane-1",
			batchId: BATCH_ID,
		}),
		null,
	);
});

test("resolveTaskStartCommit resolves git HEAD at task.started timestamp when journal lacks commit", async () => {
	const projectRoot = await initGitRepo("spine-contract-task-start-");
	try {
		const initSha = headSha(projectRoot);
		const initTimestamp = execFileSync("git", ["log", "-1", "--format=%aI"], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		const initMs = Date.parse(initTimestamp);
		const startedAt = new Date(initMs + 1_000).toISOString();
		const taskOneCommitAt = new Date(initMs + 5_000).toISOString();

		const journal = [
			{
				type: "task.started",
				batchId: BATCH_ID,
				laneId: "lane-1",
				taskId: "SP-001",
				timestamp: startedAt,
				payload: { laneNumber: 1, taskId: "SP-001" },
			},
		];

		fs.writeFileSync(path.join(projectRoot, "task-one.txt"), "one\n", "utf-8");
		gitCommitAll(projectRoot, "task one", taskOneCommitAt);

		assert.equal(
			resolveTaskStartCommit({
				journal,
				taskId: "SP-001",
				laneId: "lane-1",
				batchId: BATCH_ID,
				worktreePath: projectRoot,
			}),
			initSha,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
