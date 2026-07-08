/**
 * Adoption integration: REPLAN final verdict → needs_replan diagnosis (SP-165).
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");
const SPINE_BIN = path.join(PACKAGE_ROOT, "bin/spine.mjs");
const REPLAN_FIXTURE = path.join(PACKAGE_ROOT, "test/fixtures/taskplane/FX-final-replan");
const TASK_ID = "FX-153";
const TASK_FOLDER = path.join("spine-tasks", "FX-153-final-replan");

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
function runSpine(projectRoot, args, extraEnv = {}) {
	return execFileSync(process.execPath, [SPINE_BIN, ...args], {
		cwd: projectRoot,
		encoding: "utf-8",
		env: { ...process.env, ...extraEnv },
	});
}

/**
 * @returns {Promise<string>}
 */
async function provisionReplanProject() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-adoption-replan-"));
	fs.writeFileSync(path.join(projectRoot, "README.md"), "# replan adoption fixture\n", "utf-8");

	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "adoption-replan@test"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.name", "Adoption Replan"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "replan fixture seed"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["branch", "-M", "main"], { cwd: projectRoot, stdio: "ignore" });

	runSpine(projectRoot, ["init"]);
	const destFixture = path.join(projectRoot, TASK_FOLDER);
	fs.mkdirSync(destFixture, { recursive: true });
	await cp(path.join(REPLAN_FIXTURE, "PROMPT.md"), path.join(destFixture, "PROMPT.md"));
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [TASK_ID]: [] } }, null, 2),
	);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "spine init + replan deps"], {
		cwd: projectRoot,
		stdio: "ignore",
	});

	return projectRoot;
}

test("adoption integration: REPLAN final verdict surfaces needs_replan diagnosis", async () => {
	const projectRoot = await provisionReplanProject();
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevReviewStub = process.env.SPINE_REVIEW_STUB;
	const prevFinalVerdict = process.env.SPINE_ENGINE_FINAL_STUB_VERDICT;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_REVIEW_STUB = "1";
	process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = "REPLAN";

	try {
		const batchResult = spawnSync(
			process.execPath,
			[SPINE_BIN, "batch", "start", TASK_ID, "--skip-preflight", "--attached"],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					SPINE_WORKER_STUB: "1",
					SPINE_REVIEW_STUB: "1",
					SPINE_ENGINE_FINAL_STUB_VERDICT: "REPLAN",
					SPINE_ALLOW_ATTACHED_HARNESS: "1",
				},
			},
		);
		assert.equal(batchResult.status, 1, batchResult.stderr || batchResult.stdout);
		assert.match(batchResult.stdout, /Failed task\(s\): FX-153/);

		const state = loadSpineBatchState(projectRoot);
		const task = state.raw?.tasks?.find((entry) => entry.taskId === TASK_ID);
		assert.ok(task, "expected replan task in batch state");
		assert.equal(task.status, "failed");
		assert.equal(task.exitReason, "needs_replan");

		const reconcile = reconcileBatch({
			projectRoot,
			batchState: state.raw,
			batchStatePath: ".spine/batch-state.json",
			verbose: true,
		});
		assert.equal(reconcile.diagnosis, "needs_replan");
		assert.match(reconcile.suggestedCommand, /edit .*PROMPT\.md/);
		assert.match(reconcile.suggestedCommand, /spine batch retry/);

		const statusJson = runSpine(projectRoot, ["status", "--json"], {
			SPINE_WORKER_STUB: "1",
		});
		const status = JSON.parse(statusJson.trim());
		assert.equal(status.diagnosis, "needs_replan");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevReviewStub === undefined) delete process.env.SPINE_REVIEW_STUB;
		else process.env.SPINE_REVIEW_STUB = prevReviewStub;
		if (prevFinalVerdict === undefined) delete process.env.SPINE_ENGINE_FINAL_STUB_VERDICT;
		else process.env.SPINE_ENGINE_FINAL_STUB_VERDICT = prevFinalVerdict;
		await rm(projectRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});
