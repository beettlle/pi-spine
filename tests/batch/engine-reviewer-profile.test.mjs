/**
 * SP-834 (#355) — engine reviews use the per-task effective reviewer with a runtime family guard.
 *
 * Run with SPINE_IS_WORKER / SPINE_WORKER_RUNNER unset.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { startBatch } from "../../src/batch/engine.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { runStepReview } from "../../src/batch/review-step-run.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const GEMINI_WORKER = "google/gemini-2.5-pro";
const GEMINI_REVIEWER = "google/gemini-3.1-pro";
const CLAUDE_REVIEWER = "anthropic/claude-sonnet-4-5";

const ENV_KEYS = ["SPINE_WORKER_STUB", "SPINE_REVIEW_STUB"];

/** @returns {() => void} restore function */
function setStubEnv() {
	const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	return () => {
		for (const key of ENV_KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	};
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
function writeReviewedTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-reviewer-profile`);
	fs.mkdirSync(folder, { recursive: true });
	const body = minimalValidPromptMarkdown(taskId, {
		fileScope: `src/${taskId}.txt`,
		mission: "SP-834 engine reviewer profile fixture.",
	}).replace("## Mission", "## Review Level: 1 (Plan Only)\n\n## Mission");
	fs.writeFileSync(path.join(folder, "PROMPT.md"), body, "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }, null, 2),
		"utf-8",
	);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "add task"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {Record<string, any>} agents
 */
function writeAgents(projectRoot, agents) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.agents = { ...config.agents, ...agents };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "agents config", "--allow-empty"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
}

test("same-family worker and reviewer: review.blocked, task fails, no reviewer spawn", async () => {
	const projectRoot = await initGitRepo("spine-reviewer-blocked-");
	const restore = setStubEnv();
	try {
		writeAgents(projectRoot, {
			worker: { model: GEMINI_WORKER, thinking: "high" },
			reviewer: { model: GEMINI_REVIEWER, thinking: "high" },
		});
		writeReviewedTask(projectRoot, "TP-841");

		const result = await startBatch({ projectRoot, scope: "TP-841", skipPreflight: true });
		assert.equal(result.ok, false);

		const events = readJournalEvents(projectRoot, result.batchId);
		const blocked = events.filter((event) => event.type === "review.blocked");
		// Review Level 1 runs plan + final reviews; code review (RL 2) is not blocked.
		assert.deepEqual(
			blocked.map((event) => event.payload.reviewType),
			["plan", "final"],
		);
		assert.equal(blocked[0].payload.reason, "same_model_family");
		assert.equal(blocked[0].payload.workerModel, GEMINI_WORKER);
		assert.equal(blocked[0].payload.reviewerModel, GEMINI_REVIEWER);
		assert.equal(
			events.filter((event) => event.type === "review.started").length,
			0,
			"no reviewer may spawn for a blocked pairing",
		);

		const failed = events.find((event) => event.type === "task.failed");
		assert.equal(failed?.payload.classification, "review_blocked");
		assert.match(failed?.payload.output, /agents\.reviewerProfile/);
		assert.match(failed?.payload.output, /another model family/);

		const task = loadSpineBatchState(projectRoot).raw?.tasks?.find(
			(/** @type {any} */ entry) => entry.taskId === "TP-841",
		);
		assert.equal(task?.status, "failed");
		assert.equal(task?.exitReason, "plan_review_blocked");
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("cross-family reviewer profile: resolution journaled once, task completes", async () => {
	const projectRoot = await initGitRepo("spine-reviewer-resolved-");
	const restore = setStubEnv();
	try {
		writeAgents(projectRoot, {
			worker: { model: GEMINI_WORKER, thinking: "high" },
			reviewer: { model: GEMINI_REVIEWER, thinking: "high" },
			reviewerProfile: "claude-rev",
			profiles: {
				"claude-rev": { reviewer: { model: CLAUDE_REVIEWER, thinking: "medium" } },
			},
		});
		writeReviewedTask(projectRoot, "TP-842");

		const result = await startBatch({ projectRoot, scope: "TP-842", skipPreflight: true });
		assert.equal(result.ok, true, result.output ?? result.error);

		const events = readJournalEvents(projectRoot, result.batchId);
		assert.equal(events.filter((event) => event.type === "review.blocked").length, 0);
		const resolved = events.filter((event) => event.type === "review.reviewer_resolved");
		assert.equal(resolved.length, 1);
		for (const reviewType of ["plan", "code", "final"]) {
			assert.equal(resolved[0].payload[reviewType].model, CLAUDE_REVIEWER);
			assert.equal(resolved[0].payload[reviewType].thinking, "medium");
			assert.equal(resolved[0].payload[reviewType].profile, "claude-rev");
		}
	} finally {
		restore();
		await destroyGitRepo(projectRoot);
	}
});

test("review.started payload carries the effective reviewer model and thinking", async () => {
	const projectRoot = await initGitRepo("spine-reviewer-started-");
	try {
		const taskId = "TP-843";
		writeReviewedTask(projectRoot, taskId);
		const taskFolder = path.join(projectRoot, "spine-tasks", `${taskId}-reviewer-profile`);
		const batchId = "20261018T000000";
		const config = {
			agents: {
				reviewer: {
					model: "inherit",
					plan: { model: CLAUDE_REVIEWER, thinking: "high" },
					code: { model: GEMINI_REVIEWER, thinking: "inherit" },
				},
			},
		};
		const journal = { projectRoot, batchId, taskId, laneNumber: 1, correlationId: "corr" };

		for (const [reviewType, model, thinking] of [
			["plan", CLAUDE_REVIEWER, "high"],
			["code", GEMINI_REVIEWER, null],
		]) {
			const level = reviewType === "code" ? 2 : 1;
			fs.writeFileSync(
				path.join(taskFolder, "PROMPT.md"),
				fs
					.readFileSync(path.join(taskFolder, "PROMPT.md"), "utf-8")
					.replace(/## Review Level: \d[^\n]*/, `## Review Level: ${level}`),
				"utf-8",
			);
			await runStepReview({
				taskFolder,
				worktreePath: projectRoot,
				stepNumber: 0,
				reviewType,
				config,
				journal,
				stub: true,
			});
			const started = readJournalEvents(projectRoot, batchId)
				.filter((event) => event.type === "review.started" && event.payload.reviewType === reviewType)
				.at(-1);
			assert.equal(started?.payload.reviewerModel, model);
			assert.equal(started?.payload.reviewerThinking, thinking);
		}
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
