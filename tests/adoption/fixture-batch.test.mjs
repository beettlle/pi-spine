/**
 * Adoption fixture integration: copy consumer layout, init, plan, stub batch AD-001.
 * No network or real pi required (SPINE_WORKER_STUB=1).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSpineBatchState } from "../../src/batch/state.mjs";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");
const FIXTURE_ROOT = path.join(PACKAGE_ROOT, "tests/fixtures/adoption-repo");
const SPINE_BIN = path.join(PACKAGE_ROOT, "bin/spine.mjs");
const TASK_ID = "AD-001";
const TASK_FOLDER = path.join("taskplane-tasks", `${TASK_ID}-smoke`);

function findTaskDoneMarker(projectRoot, taskFolderRel = TASK_FOLDER) {
	const direct = path.join(projectRoot, taskFolderRel, ".DONE");
	if (fs.existsSync(direct)) {
		return direct;
	}

	const worktreesRoot = path.join(projectRoot, ".worktrees");
	if (!fs.existsSync(worktreesRoot)) {
		return null;
	}

	for (const batchDir of fs.readdirSync(worktreesRoot)) {
		const candidate = path.join(worktreesRoot, batchDir, "lane-1", taskFolderRel, ".DONE");
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

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
 * @returns {Promise<string>} projectRoot
 */
async function provisionAdoptionFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-adoption-fixture-"));
	await cp(FIXTURE_ROOT, projectRoot, { recursive: true });

	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.email", "adoption-fixture@test"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.name", "Adoption Fixture"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "adoption fixture seed"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["branch", "-M", "main"], { cwd: projectRoot, stdio: "ignore" });

	return projectRoot;
}

function ensureSpineInit(projectRoot) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	if (fs.existsSync(configPath)) {
		return;
	}
	runSpine(projectRoot, ["init", "--tasks-root", "taskplane-tasks"]);
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "spine init"], { cwd: projectRoot, stdio: "ignore" });
}

test("adoption fixture: init, plan, stub batch AD-001 creates .DONE", async () => {
	const projectRoot = await provisionAdoptionFixture();
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		ensureSpineInit(projectRoot);

		const planOutput = runSpine(projectRoot, ["plan", TASK_ID], { SPINE_WORKER_STUB: "1" });
		assert.match(planOutput, new RegExp(TASK_ID));

		runSpine(projectRoot, ["batch", "start", TASK_ID, "--skip-preflight", "--attached"], {
			SPINE_WORKER_STUB: "1",
		});

		const donePath = findTaskDoneMarker(projectRoot);
		assert.ok(donePath, `expected ${TASK_FOLDER}/.DONE after stub batch`);

		const state = loadSpineBatchState(projectRoot);
		assert.equal(state.raw?.phase, "completed");
		assert.equal(state.raw?.succeededTasks, 1);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await rm(projectRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});
