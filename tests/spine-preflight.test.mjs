import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runInit } from "../bin/spine-init.mjs";
import {
	checkDependenciesJson,
	checkDoctor,
	checkGitClean,
	checkNoActiveBatch,
	checkTasksRoot,
	discoverTaskIds,
	runBatchPreflight,
	runPreflightPlanCheck,
} from "../bin/spine-preflight.mjs";
import { runReconciliationCheck } from "../src/batch/reconcile.mjs";

async function createProjectFixture() {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-preflight-"));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	runInit(projectRoot, ["--tasks-root", "taskplane-tasks"]);
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

function writeTask(projectRoot, taskId, slug = "task") {
	const folder = path.join(projectRoot, "taskplane-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });

	const title = `${taskId} ${slug}`;
	const prompt = `# Task: ${taskId} — ${title}

## Mission
Write something.

## Dependencies
- **None**

## File Scope
- \`src/${slug}/${taskId}.txt\`

## Steps
### Step 0: Implement
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- do not change files outside File Scope
`;

	fs.writeFileSync(path.join(folder, "PROMPT.md"), prompt, "utf-8");
}

function writeDependencies(projectRoot, tasks) {
	fs.writeFileSync(
		path.join(projectRoot, "taskplane-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

test("runPreflightPlanCheck builds wave plan during preflight", async () => {
	const projectRoot = await createProjectFixture();
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeTask(projectRoot, "TP-002", "beta");
		writeDependencies(projectRoot, { "TP-001": [], "TP-002": ["TP-001"] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runBatchPreflight({
			projectRoot,
			skipDoctor: true,
		});

		assert.equal(result.ok, true);
		const planCheck = result.checks.find((check) => check.id === "plan");
		assert.ok(planCheck);
		assert.equal(planCheck.ok, true);

		const waveLines = String(planCheck.message).match(/Wave \d+:/g) ?? [];
		assert.equal(waveLines.length, 2);
		assert.ok(String(planCheck.message).includes("Wave 0:"));
		assert.ok(String(planCheck.message).includes("Wave 1:"));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runReconciliationCheck returns real diagnosis for running batch", () => {
	const fixture = JSON.parse(
		fs.readFileSync(
			path.join(process.cwd(), "tests/fixtures/batch-state/running-batch.json"),
			"utf-8",
		),
	);
	const result = runReconciliationCheck({
		projectRoot: process.cwd(),
		batchState: fixture,
		batchStatePath: ".pi/batch-state.json",
	});
	assert.equal(result.diagnosis, "running");
	assert.ok(result.headline);
	assert.equal(result.suggestedCommand, "/spine-status --diagnose");
});

test("checkDoctor fails when doctor reports issues", () => {
	const result = checkDoctor({
		projectRoot: process.cwd(),
		runDoctor: () => ({
			ok: false,
			issueCount: 2,
			checks: [
				{ label: "config", ok: false },
				{ label: "agents", ok: false },
			],
		}),
	});
	assert.equal(result.ok, false);
	assert.equal(result.id, "doctor");
	assert.equal(result.suggestedCommand, "spine doctor");
});

test("checkGitClean lists up to 20 dirty paths", () => {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-preflight-git-"));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "dirty.txt"), "x", "utf-8");

	try {
		const result = checkGitClean({ projectRoot });
		assert.equal(result.ok, false);
		assert.ok(result.details.dirtyPaths.includes("dirty.txt"));
		assert.equal(result.details.totalDirty, 1);
	} finally {
		fs.rmSync(projectRoot, { recursive: true, force: true });
	}
});

test("checkNoActiveBatch passes when no batch-state file exists", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const result = checkNoActiveBatch({ projectRoot });
		assert.equal(result.ok, true);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("checkNoActiveBatch calls reconciliation when batch-state exists", async () => {
	const projectRoot = await createProjectFixture();
	const calls = [];
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "batch-state.json"),
			JSON.stringify({ batchId: "20260531T120000", phase: "running", endedAt: null }),
			"utf-8",
		);

		const result = checkNoActiveBatch({
			projectRoot,
			runReconciliation: (ctx) => {
				calls.push(ctx.batchState?.batchId);
				return {
					diagnosis: "limbo_stale",
					headline: "Batch finished but state is stale",
					suggestedCommand: "spine batch dismiss",
				};
			},
		});

		assert.deepEqual(calls, ["20260531T120000"]);
		assert.equal(result.ok, false);
		assert.equal(result.suggestedCommand, "spine batch dismiss");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("checkTasksRoot validates discoverable task folders", async () => {
	const projectRoot = await createProjectFixture();
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		const result = checkTasksRoot({ projectRoot });
		assert.equal(result.ok, true);
		assert.ok(result.details.taskFolders.some((folder) => folder.startsWith("TP-001")));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("checkDependenciesJson validates version and task IDs", async () => {
	const projectRoot = await createProjectFixture();
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeTask(projectRoot, "TP-002", "beta");
		writeDependencies(projectRoot, { "TP-001": [], "TP-002": ["TP-001"] });

		const result = checkDependenciesJson({ projectRoot });
		assert.equal(result.ok, true);
		assert.deepEqual(discoverTaskIds(path.join(projectRoot, "taskplane-tasks")), ["TP-001", "TP-002"]);
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runBatchPreflight passes on initialized clean fixture", async () => {
	const projectRoot = await createProjectFixture();
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeDependencies(projectRoot, { "TP-001": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runBatchPreflight({
			projectRoot,
			skipDoctor: true,
		});

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.ok(result.checks.some((check) => check.id === "plan" && check.ok));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runBatchPreflight fails when git working tree is dirty", async () => {
	const projectRoot = await createProjectFixture();
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeDependencies(projectRoot, { "TP-001": [] });
		fs.writeFileSync(path.join(projectRoot, "untracked.txt"), "dirty", "utf-8");

		const result = runBatchPreflight({
			projectRoot,
			skipDoctor: true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.ok(result.checks.find((check) => check.id === "git-clean" && !check.ok));
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});

test("runBatchPreflight fails on limbo fixture with dismiss suggestion", async () => {
	const projectRoot = await createProjectFixture();
	try {
		const fixture = JSON.parse(
			fs.readFileSync(
				path.join(process.cwd(), "tests/fixtures/batch-state/limbo-stale-20260531T165700.json"),
				"utf-8",
			),
		);
		fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".pi", "batch-state.json"),
			JSON.stringify(fixture, null, 2),
			"utf-8",
		);

		const result = runBatchPreflight({
			projectRoot,
			skipDoctor: true,
		});

		assert.equal(result.ok, false);
		const batchCheck = result.checks.find((check) => check.id === "no-active-batch");
		assert.ok(batchCheck);
		assert.equal(batchCheck.ok, false);
		assert.equal(batchCheck.suggestedCommand, "spine batch dismiss");
		assert.equal(batchCheck.details.diagnosis, "limbo_stale");
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
