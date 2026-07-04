import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "./helpers/git-fixture.mjs";
import {
	RULES_MANIFEST_REL_PATH,
} from "../src/config/cursor-rules/discover.mjs";
import { loadSpineConfig } from "../bin/spine-config.mjs";
import {
	checkDependenciesJson,
	checkDoctor,
	checkGitClean,
	checkNoActiveBatch,
	checkStalePathSpine,
	checkTasksRoot,
	checkTasksValidate,
	discoverTaskIds,
	runBatchPreflight,
	runPreflightPlanCheck,
} from "../bin/spine-preflight.mjs";
import { runReconciliationCheck } from "../src/batch/reconcile.mjs";

function writeTask(projectRoot, taskId, slug = "task") {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
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
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks }, null, 2),
		"utf-8",
	);
}

test("runPreflightPlanCheck builds wave plan during preflight", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
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

		const waveLines = String(planCheck.message).match(/Wave \d+ ·/g) ?? [];
		assert.equal(waveLines.length, 2);
		assert.ok(String(planCheck.message).includes("Wave 0 ·"));
		assert.ok(String(planCheck.message).includes("Wave 1 ·"));
	} finally {
		await destroyGitRepo(projectRoot);
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

test("checkStalePathSpine fails when PATH spine version is stale", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-preflight-stale-"));
	try {
		const staleBin = path.join(tmp, "stale-spine.mjs");
		fs.writeFileSync(staleBin, "#!/usr/bin/env node\n", "utf-8");
		const result = checkStalePathSpine(
			{},
			{
				stalePathCheckArgs: {
					which: () => staleBin,
					spawn: () => ({
						status: 0,
						stdout: "pi-spine v0.0.0\n",
						stderr: "",
					}),
					stat: (p) => ({
						mtimeMs: p === staleBin ? Date.now() - 1000 : Date.now(),
					}),
					realpath: (p) => path.resolve(p),
				},
			},
		);
		assert.equal(result.ok, false);
		assert.equal(result.id, "stale-path-spine");
		assert.match(result.message, /PATH v0\.0\.0/);
		assert.ok(result.suggestedCommand?.includes("npm link"));
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
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
	const projectRoot = await initGitRepo("spine-preflight-");
	try {
		const result = checkNoActiveBatch({ projectRoot });
		assert.equal(result.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkNoActiveBatch calls reconciliation when batch-state exists", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
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
		await destroyGitRepo(projectRoot);
	}
});

test("checkTasksRoot validates discoverable task folders", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		const result = checkTasksRoot({ projectRoot });
		assert.equal(result.ok, true);
		assert.ok(result.details.taskFolders.some((folder) => folder.startsWith("TP-001")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkDependenciesJson validates version and task IDs", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeTask(projectRoot, "TP-002", "beta");
		writeDependencies(projectRoot, { "TP-001": [], "TP-002": ["TP-001"] });

		const result = checkDependenciesJson({ projectRoot });
		assert.equal(result.ok, true);
		assert.deepEqual(discoverTaskIds(path.join(projectRoot, "spine-tasks")), ["TP-001", "TP-002"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight passes on initialized clean fixture", { concurrency: false }, async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
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
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight fails when git working tree is dirty", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
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
		await destroyGitRepo(projectRoot);
	}
});

test("runPreflightPlanCheck validates pending scope only (SP-122)", async () => {
	const projectRoot = await initGitRepo("spine-preflight-pending-");
	try {
		const tasksRoot = path.join(projectRoot, "spine-tasks");

		// Done task with invalid PROMPT (missing Testing) — must not fail preflight plan check.
		const doneFolder = path.join(tasksRoot, "TP-001-done-invalid");
		fs.mkdirSync(doneFolder, { recursive: true });
		fs.writeFileSync(
			path.join(doneFolder, "PROMPT.md"),
			`# Task: TP-001 — done invalid

## Mission
Legacy done task.

## Dependencies
- **None**

## File Scope
- \`src/legacy.txt\`

## Steps
### Step 0: Implement
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- do not expand scope
`,
			"utf-8",
		);
		fs.writeFileSync(path.join(doneFolder, ".DONE"), "2026-06-01T00:00:00.000Z", "utf-8");

		writeTask(projectRoot, "TP-002", "pending-valid");
		writeDependencies(projectRoot, { "TP-001": [], "TP-002": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const configResult = loadSpineConfig(projectRoot);
		const plan = runPreflightPlanCheck({ projectRoot, configResult });
		assert.equal(plan.status, "ok");
		assert.ok(String(plan.message).includes("TP-002"));
		assert.ok(!String(plan.message).includes("TP-001"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkTasksValidate exposes distinct tasks-validate check id", async () => {
	const projectRoot = await initGitRepo("spine-preflight-validate-");
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeDependencies(projectRoot, { "TP-001": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const ok = checkTasksValidate({ projectRoot, configResult: loadSpineConfig(projectRoot) });
		assert.equal(ok.id, "tasks-validate");
		assert.equal(ok.ok, true);
		assert.equal(ok.suggestedCommand, undefined);

		const invalidFolder = path.join(projectRoot, "spine-tasks", "TP-002-invalid");
		fs.mkdirSync(invalidFolder, { recursive: true });
		fs.writeFileSync(
			path.join(invalidFolder, "PROMPT.md"),
			`# Task: TP-002 - invalid heading

## Mission
Broken packet.

## Dependencies
- **None**

## File Scope
- \`src/x.txt\`

## Steps
### Step 0: Implement
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- do not expand scope
`,
			"utf-8",
		);
		writeDependencies(projectRoot, { "TP-001": [], "TP-002": [] });

		const failed = checkTasksValidate({ projectRoot, configResult: loadSpineConfig(projectRoot) });
		assert.equal(failed.id, "tasks-validate");
		assert.equal(failed.ok, false);
		assert.equal(failed.suggestedCommand, "spine tasks validate pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight includes tasks-validate check distinct from plan", async () => {
	const projectRoot = await initGitRepo("spine-preflight-validate-batch-");
	try {
		writeTask(projectRoot, "TP-001", "alpha");
		writeDependencies(projectRoot, { "TP-001": [] });
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const result = runBatchPreflight({ projectRoot, skipDoctor: true });
		const tasksValidate = result.checks.find((check) => check.id === "tasks-validate");
		const plan = result.checks.find((check) => check.id === "plan");
		assert.ok(tasksValidate);
		assert.ok(plan);
		assert.equal(tasksValidate.ok, true);
		assert.notEqual(tasksValidate.id, plan.id);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight fails on limbo fixture with dismiss suggestion", async () => {
	const projectRoot = await initGitRepo("spine-preflight-");
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
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight passes when all tasks have .DONE (zero pending)", async () => {
	const projectRoot = await initGitRepo("spine-preflight-zero-pending-");
	try {
		writeTask(projectRoot, "TP-001", "done-task");
		writeDependencies(projectRoot, { "TP-001": [] });
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "TP-001-done-task", ".DONE"),
			"2026-06-01T00:00:00.000Z",
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "tasks"], { cwd: projectRoot, stdio: "ignore" });

		const configResult = loadSpineConfig(projectRoot);
		const tasksValidate = checkTasksValidate({ projectRoot, configResult });
		assert.equal(tasksValidate.ok, true);
		assert.match(tasksValidate.message, /no pending tasks/i);

		const plan = runPreflightPlanCheck({ projectRoot, configResult });
		assert.equal(plan.status, "ok");
		assert.match(plan.message, /0 task\(s\)/);

		const result = runBatchPreflight({ projectRoot, skipDoctor: true });
		assert.equal(result.ok, true);
		const planCheck = result.checks.find((check) => check.id === "plan");
		assert.equal(planCheck?.ok, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkGitClean passes when only rules-manifest generatedAt drifted", async () => {
	const projectRoot = await initGitRepo("spine-preflight-manifest-");
	try {
		const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
		fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
		const manifest = {
			generatedAt: "2026-06-12T20:00:00.000Z",
			rulesRoot: ".cursor/rules",
			rules: [{ relPath: "a.mdc", spineClass: "manual", alwaysApply: false, description: null, globs: [], parseStatus: "ok" }],
			excluded: [],
		};
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "manifest"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(
			manifestPath,
			`${JSON.stringify({ ...manifest, generatedAt: "2026-06-12T21:00:00.000Z" }, null, 2)}\n`,
			"utf-8",
		);

		const check = checkGitClean({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /generatedAt-only drift ignored/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkGitClean still fails when rules-manifest rules[] differ", async () => {
	const projectRoot = await initGitRepo("spine-preflight-manifest-rules-");
	try {
		const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
		fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
		const manifest = {
			generatedAt: "2026-06-12T20:00:00.000Z",
			rulesRoot: ".cursor/rules",
			rules: [{ relPath: "a.mdc", spineClass: "manual", alwaysApply: false, description: null, globs: [], parseStatus: "ok" }],
			excluded: [],
		};
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "manifest"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(
			manifestPath,
			`${JSON.stringify({
				...manifest,
				generatedAt: "2026-06-12T21:00:00.000Z",
				rules: [{ relPath: "b.mdc", spineClass: "manual", alwaysApply: false, description: null, globs: [], parseStatus: "ok" }],
			}, null, 2)}\n`,
			"utf-8",
		);

		const check = checkGitClean({ projectRoot });
		assert.equal(check.ok, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
