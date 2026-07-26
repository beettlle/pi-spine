// @ts-nocheck
/**
 * SP-671 — matrix sub-lane execution in parallel worktrees.
 *
 * Unit tests cover the helper module (provisioning naming, concurrency limit,
 * aggregation, shell runner, matrix-row loading). End-to-end tests drive the
 * batch engine with a real `Type: execute` matrix task and assert that each row
 * runs in its own worktree, produces its own output, and that a failing row
 * fails the whole matrix task.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startBatch } from "../../src/batch/engine.mjs";
import { expandMatrixFileScopePatterns } from "../../src/batch/lane-commit.mjs";
import { matrixRowConcurrencyLimit } from "../../src/batch/engine-lanes.mjs";
import {
	aggregateMatrixOutcomes,
	isMatrixSubLaneWorktreeDir,
	loadMatrixTaskRows,
	matrixSubLaneBranch,
	matrixWorktreeDir,
	matrixWorktreePath,
	runConcurrent,
	runMatrixSubLaneSetupHook,
	runShellInDir,
	slugifyMatrixToken,
} from "../../src/batch/engine-lanes/matrix.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/* ------------------------------------------------------------------ */
/* Unit: slug + worktree/branch naming determinism                     */
/* ------------------------------------------------------------------ */

test("slugifyMatrixToken sanitizes to filesystem/ref-safe tokens", () => {
	assert.equal(slugifyMatrixToken("a shell a"), "a_shell_a");
	assert.equal(slugifyMatrixToken("SP-669"), "sp_669");
	assert.equal(slugifyMatrixToken("  Mixed.Case!! "), "mixed_case");
	assert.equal(slugifyMatrixToken(""), "row");
	assert.equal(slugifyMatrixToken(null), "row");
});

test("matrixWorktreeDir matches the PROMPT example shape lane-1-sp-669-a_shell_a", () => {
	assert.equal(matrixWorktreeDir(1, "SP-669", "a shell a"), "lane-1-sp_669-a_shell_a");
	assert.equal(matrixWorktreeDir(2, "SP-100", "run-b"), "lane-2-sp_100-run_b");
});

test("matrixWorktreePath nests under the batch worktree dir", () => {
	const p = matrixWorktreePath("/proj", "20260719T1", 1, "SP-669", "a");
	assert.equal(p, path.join("/proj", ".worktrees", "spine-20260719T1", "lane-1-sp_669-a"));
});

test("matrixSubLaneBranch is deterministic and ref-safe", () => {
	const branch = matrixSubLaneBranch("20260719T1", 1, "SP-669", "a shell a");
	assert.match(branch, /^task\/spine-matrix-1-20260719T1-sp_669-a_shell_a$/);
	assert.equal(
		matrixSubLaneBranch("20260719T1", 1, "SP-669", "a shell a"),
		matrixSubLaneBranch("20260719T1", 1, "SP-669", "a shell a"),
		"same inputs produce the same branch",
	);
});

test("isMatrixSubLaneWorktreeDir distinguishes sub-lanes from plain lanes", () => {
	assert.equal(isMatrixSubLaneWorktreeDir("lane-1-sp_669-a"), true);
	assert.equal(isMatrixSubLaneWorktreeDir("lane-1"), false);
	assert.equal(isMatrixSubLaneWorktreeDir("lane-12"), false);
});

/* ------------------------------------------------------------------ */
/* Unit: lane-commit matrix pattern expansion (stub-check safety net)  */
/* ------------------------------------------------------------------ */

test("expandMatrixFileScopePatterns substitutes {matrix.*} across every row", () => {
	const expanded = expandMatrixFileScopePatterns(
		["out/{matrix.run_id}.txt", "src/shared.mjs"],
		[{ run_id: "a" }, { run_id: "b" }],
	);
	assert.deepEqual([...expanded].sort(), ["out/a.txt", "out/b.txt", "src/shared.mjs"]);
});

test("expandMatrixFileScopePatterns passes non-matrix tasks through unchanged", () => {
	const expanded = expandMatrixFileScopePatterns(["src/a.mjs", "src/b.mjs"], []);
	assert.deepEqual(expanded, ["src/a.mjs", "src/b.mjs"]);
});

/* ------------------------------------------------------------------ */
/* Unit: loadMatrixTaskRows                                            */
/* ------------------------------------------------------------------ */

test("loadMatrixTaskRows returns null for a non-matrix task folder", async () => {
	const projectRoot = await initGitRepo("spine-matrix-unit-");
	try {
		const folder = path.join(projectRoot, "spine-tasks", "TP-1-plain");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			plainPrompt("TP-1"),
			"utf-8",
		);
		assert.equal(loadMatrixTaskRows(folder), null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("loadMatrixTaskRows returns rows for a matrix task folder", async () => {
	const projectRoot = await initGitRepo("spine-matrix-unit-");
	try {
		const folder = path.join(projectRoot, "spine-tasks", "TP-2-matrix");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			matrixPrompt("TP-2"),
			"utf-8",
		);
		const matrix = loadMatrixTaskRows(folder);
		assert.ok(matrix, "matrix rows should be detected");
		assert.equal(matrix.type, "execute");
		assert.equal(matrix.rows.length, 2);
		assert.deepEqual(
			matrix.rows.map((r) => r.rowId).sort(),
			["a", "b"],
		);
		assert.equal(matrix.rows[0].values.run_id, "a");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* Unit: runConcurrent peak concurrency                                */
/* ------------------------------------------------------------------ */

test("runConcurrent caps in-flight workers at the limit (peak === limit)", async () => {
	const items = [1, 2, 3, 4, 5];
	let active = 0;
	let peak = 0;
	const worker = async (n) => {
		active += 1;
		peak = Math.max(peak, active);
		await new Promise((r) => setTimeout(r, 10));
		active -= 1;
		return n * 10;
	};
	const { results, peakConcurrency } = await runConcurrent(items, 2, worker);
	assert.equal(peakConcurrency, 2, "peak concurrency should equal the limit");
	assert.deepEqual(results, [10, 20, 30, 40, 50]);
});

test("runConcurrent with limit 1 never overlaps", async () => {
	const items = [1, 2, 3];
	let active = 0;
	const worker = async () => {
		active += 1;
		if (active > 1) throw new Error("overlap detected");
		await new Promise((r) => setTimeout(r, 5));
		active -= 1;
		return active;
	};
	const { peakConcurrency } = await runConcurrent(items, 1, worker);
	assert.equal(peakConcurrency, 1);
});

test("runConcurrent tolerates a throwing worker (error in result slot)", async () => {
	const { results } = await runConcurrent(
		["ok", "boom", "ok2"],
		2,
		async (x) => {
			if (x === "boom") throw new Error("fail");
			return x;
		},
	);
	assert.equal(results[0], "ok");
	assert.ok(results[1] instanceof Error);
	assert.equal(results[2], "ok2");
});

/* ------------------------------------------------------------------ */
/* Unit: aggregateMatrixOutcomes                                       */
/* ------------------------------------------------------------------ */

test("aggregateMatrixOutcomes: all succeed → ok", () => {
	const out = aggregateMatrixOutcomes([
		{ rowId: "a", ok: true },
		{ rowId: "b", ok: true },
	]);
	assert.equal(out.ok, true);
	assert.deepEqual(out.failedRowIds, []);
});

test("aggregateMatrixOutcomes: any failure surfaces failing row ids", () => {
	const out = aggregateMatrixOutcomes([
		{ rowId: "a", ok: true },
		{ rowId: "b", ok: false },
		{ rowId: "c", ok: false },
	]);
	assert.equal(out.ok, false);
	assert.deepEqual(out.failedRowIds, ["b", "c"]);
});

/* ------------------------------------------------------------------ */
/* Unit: matrixRowConcurrencyLimit (SP-690 / #227)                     */
/* ------------------------------------------------------------------ */

test("matrixRowConcurrencyLimit reserves the parent lane slot (default 1)", () => {
	// global maxParallel 2 with the parent lane held => rows get the 1 remaining slot.
	assert.equal(matrixRowConcurrencyLimit(2), 1);
	assert.equal(matrixRowConcurrencyLimit(2, 1), 1);
});

test("matrixRowConcurrencyLimit scales remaining slots with maxParallel", () => {
	assert.equal(matrixRowConcurrencyLimit(4, 1), 3);
	assert.equal(matrixRowConcurrencyLimit(8, 1), 7);
	assert.equal(matrixRowConcurrencyLimit(3, 2), 1);
});

test("matrixRowConcurrencyLimit never drops below 1 (forward progress)", () => {
	assert.equal(matrixRowConcurrencyLimit(1, 1), 1, "single lane: still 1 row at a time");
	assert.equal(matrixRowConcurrencyLimit(2, 5), 1, "more occupied slots than lanes: clamp to 1");
	assert.equal(matrixRowConcurrencyLimit(0), 1, "missing/zero config: clamp to 1");
	assert.equal(matrixRowConcurrencyLimit(undefined), 1);
});

/* ------------------------------------------------------------------ */
/* Unit: runShellInDir                                                 */
/* ------------------------------------------------------------------ */

test("runShellInDir resolves exit code and output", async () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-shell-"));
	try {
		const ok = await runShellInDir(tmp, "echo hello && exit 0");
		assert.equal(ok.exitCode, 0);
		assert.match(ok.output, /hello/);

		const fail = await runShellInDir(tmp, "exit 7");
		assert.equal(fail.exitCode, 7);
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

/* ------------------------------------------------------------------ */
/* Unit: runMatrixSubLaneSetupHook (SP-688 / #224)                     */
/* ------------------------------------------------------------------ */

/**
 * Write an executable hook script under <root>/scripts/ and return its rel path.
 *
 * @param {string} root
 * @param {string} body
 * @returns {string}
 */
function writeExecutableHook(root, body) {
	const rel = "scripts/spine-worktree-setup.sh";
	const hookPath = path.join(root, rel);
	fs.mkdirSync(path.dirname(hookPath), { recursive: true });
	fs.writeFileSync(hookPath, body, "utf-8");
	fs.chmodSync(hookPath, 0o755);
	return rel;
}

test("runMatrixSubLaneSetupHook is a no-op when no hook is configured", async () => {
	const projectRoot = await initGitRepo("spine-matrix-hook-skip-");
	try {
		const result = runMatrixSubLaneSetupHook({
			projectRoot,
			worktreePath: projectRoot,
			batchId: "batch-test",
			laneNumber: 1,
			taskId: "TP-900",
			rowId: "a",
			correlationId: "corr",
			config: {}, // no worktreeSetupHook configured
		});
		assert.equal(result.ok, true);
		assert.equal(result.skipped, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runMatrixSubLaneSetupHook fail-closed: throws and journals failed when hook returns ok:false", async () => {
	const projectRoot = await initGitRepo("spine-matrix-hook-fail-");
	const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "spine-matrix-hook-wt-"));
	try {
		const hookRel = writeExecutableHook(
			projectRoot,
			'#!/bin/sh\necho \'{"ok":false,"error":"venv link failed"}\'\n',
		);

		assert.throws(
			() =>
				runMatrixSubLaneSetupHook({
					projectRoot,
					worktreePath: worktree,
					batchId: "batch-test",
					laneNumber: 1,
					taskId: "TP-901",
					rowId: "a",
					correlationId: "corr",
					config: { worktreeSetupHook: hookRel },
				}),
			(err) => {
				assert.match(err.message, /venv link failed/);
				return true;
			},
		);

		// Fail-closed evidence: the failed lifecycle event is journaled with the row id.
		const journalPath = path.join(
			projectRoot,
			".spine",
			"runtime",
			"batch-test",
			"journal",
			"events.jsonl",
		);
		const events = fs.readFileSync(journalPath, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const failed = events.find((e) => e.type === "matrix.sub_lane.setup_hook.failed");
		assert.ok(failed, "matrix.sub_lane.setup_hook.failed should be journaled");
		assert.equal(failed.payload.rowId, "a");
		assert.match(failed.payload.error, /venv link failed/);
	} finally {
		await destroyGitRepo(projectRoot);
		fs.rmSync(worktree, { recursive: true, force: true });
	}
});

/* ------------------------------------------------------------------ */
/* E2E: matrix execute task produces one output per row                */
/* ------------------------------------------------------------------ */

test("E2E: matrix task runs two rows and produces two output files", async () => {
	const projectRoot = await initGitRepo("spine-matrix-e2e-");
	try {
		const taskId = "TP-301";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), matrixPrompt(taskId), "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		configureForBatch(projectRoot, { maxParallel: 2 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(
			batchResult.ok,
			`batch should succeed; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
		);

		const fileA = execFileSync("git", ["show", `${batchResult.orchBranch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const fileB = execFileSync("git", ["show", `${batchResult.orchBranch}:out/b.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(fileA, /alpha/, "row a output present in orch branch");
		assert.match(fileB, /beta/, "row b output present in orch branch");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* E2E: a failing row fails the whole matrix task                     */
/* ------------------------------------------------------------------ */

test("E2E: a failing row fails the whole matrix task and surfaces the row id", async () => {
	const projectRoot = await initGitRepo("spine-matrix-fail-");
	try {
		const taskId = "TP-302";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix`);
		fs.mkdirSync(folder, { recursive: true });
		// Row b's runCommand exits non-zero (test "beta" != "beta" is false).
		fs.writeFileSync(path.join(folder, "PROMPT.md"), failingMatrixPrompt(taskId), "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		configureForBatch(projectRoot, { maxParallel: 2 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.equal(batchResult.ok, false, "batch should fail when a matrix row fails");

		// The failing row id must be observable: check the journal for the
		// matrix.task_failed event carrying the failing row id.
		const journalPath = path.join(
			projectRoot,
			".spine",
			"runtime",
			batchResult.batchId,
			"journal",
			"events.jsonl",
		);
		const events = fs.readFileSync(journalPath, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const matrixFailed = events.find((e) => e.type === "matrix.task_failed");
		assert.ok(matrixFailed, "matrix.task_failed event should be recorded");
		assert.ok(
			matrixFailed.payload.failedRowIds.includes("b"),
			`failing row id 'b' should be surfaced; got ${JSON.stringify(matrixFailed.payload.failedRowIds)}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* E2E: maxParallel limits concurrent sub-lanes                        */
/* ------------------------------------------------------------------ */

test("E2E: maxParallel=1 runs rows serially (still produces both outputs)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-serial-");
	try {
		const taskId = "TP-303";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), matrixPrompt(taskId), "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		// maxParallel=1 forces the two rows to run one at a time.
		configureForBatch(projectRoot, { maxParallel: 1 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(batchResult.ok, `serial matrix batch should succeed: ${batchResult.output}`);
		const fileA = execFileSync("git", ["show", `${batchResult.orchBranch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const fileB = execFileSync("git", ["show", `${batchResult.orchBranch}:out/b.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(fileA, /alpha/);
		assert.match(fileB, /beta/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* E2E: mixed wave (matrix + sibling) throttles rows to remaining      */
/* slots so global in-flight <= lanes.maxParallel (SP-690 / #227)      */
/* ------------------------------------------------------------------ */

test("E2E: mixed wave throttles matrix rows to remaining slots (#227)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-throttle-");
	try {
		const matrixTaskId = "TP-400";
		const siblingTaskId = "TP-401";
		const matrixFolder = path.join(projectRoot, "spine-tasks", `${matrixTaskId}-matrix`);
		const siblingFolder = path.join(projectRoot, "spine-tasks", `${siblingTaskId}-sibling`);
		fs.mkdirSync(matrixFolder, { recursive: true });
		fs.mkdirSync(siblingFolder, { recursive: true });
		fs.writeFileSync(path.join(matrixFolder, "PROMPT.md"), matrixPrompt(matrixTaskId), "utf-8");
		// Sibling is a plain execute task with a non-overlapping file scope so the
		// planner assigns it to a different lane in the same tick (maxParallel 2).
		fs.writeFileSync(
			path.join(siblingFolder, "PROMPT.md"),
			siblingPrompt(siblingTaskId),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({
				version: 1,
				tasks: { [matrixTaskId]: [], [siblingTaskId]: [] },
			}),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		// Two lanes run concurrently: the matrix lane (2 rows) and the sibling
		// lane. Without the throttle the matrix would claim both slots (2 rows) on
		// top of the sibling = 3 in-flight > maxParallel. SP-690 reserves the
		// parent lane's slot so the matrix fans out into the 1 remaining slot.
		configureForBatch(projectRoot, { maxParallel: 2 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({
			projectRoot,
			scope: [matrixTaskId, siblingTaskId],
			skipPreflight: true,
		});
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(
			batchResult.ok,
			`mixed wave should succeed; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
		);

		// Both lanes produced output: the matrix rows AND the sibling task.
		const fileA = execFileSync("git", ["show", `${batchResult.orchBranch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const fileB = execFileSync("git", ["show", `${batchResult.orchBranch}:out/b.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const sibling = execFileSync(
			"git",
			["show", `${batchResult.orchBranch}:out2/sibling.txt`],
			{ cwd: projectRoot, encoding: "utf-8" },
		);
		assert.match(fileA, /alpha/);
		assert.match(fileB, /beta/);
		assert.match(sibling, /sibling-ran/);

		// Production-wiring proof: the matrix task_started event records the
		// THROTTLED maxParallel (1), not the configured global maxParallel (2),
		// so the parent lane's slot is reserved for the sibling.
		const journalPath = path.join(
			projectRoot,
			".spine",
			"runtime",
			batchResult.batchId,
			"journal",
			"events.jsonl",
		);
		const events = fs
			.readFileSync(journalPath, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const matrixStarted = events.find((e) => e.type === "matrix.task_started");
		assert.ok(matrixStarted, "matrix.task_started should be recorded");
		assert.equal(
			matrixStarted.payload.maxParallel,
			1,
			`matrix rows must be throttled to the 1 remaining slot (global maxParallel 2, parent lane held); got ${matrixStarted.payload.maxParallel}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* E2E: matrix sub-lanes run worktreeSetupHook before the row command  */
/* (SP-688 / #224)                                                     */
/* ------------------------------------------------------------------ */

test("E2E: matrix sub-lanes run worktreeSetupHook before the row command", async () => {
	const projectRoot = await initGitRepo("spine-matrix-hook-e2e-");
	try {
		const taskId = "TP-304";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), hookMatrixPrompt(taskId), "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);

		// The hook materializes a gitignored marker (the `.venv` analogue). The row
		// command consumes it. Because the marker is gitignored it never dirties a
		// worktree, and because the lane branch never commits it, the marker can
		// only appear in a row's output if the hook ran in THAT sub-lane worktree
		// before the row command read it.
		fs.writeFileSync(path.join(projectRoot, ".gitignore"), "hook-marker.txt\n", "utf-8");
		const hookRel = writeExecutableHook(
			projectRoot,
			'#!/bin/sh\nprintf "HOOK_OK" > "$SPINE_WORKTREE/hook-marker.txt"\necho \'{"ok":true}\'\n',
		);

		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		configureForBatch(projectRoot, {
			maxParallel: 2,
			worktreeSetupHook: hookRel,
		});

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(
			batchResult.ok,
			`batch should succeed with hook; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
		);

		// Each row's output carries hook evidence: the marker is only present when
		// the hook ran in that sub-lane worktree before the row command consumed it.
		const fileA = execFileSync("git", ["show", `${batchResult.orchBranch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		const fileB = execFileSync("git", ["show", `${batchResult.orchBranch}:out/b.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(fileA, /HOOK_OK.*alpha/, "row a output must carry hook marker evidence");
		assert.match(fileB, /HOOK_OK.*beta/, "row b output must carry hook marker evidence");

		// Direct journal evidence the hook ran on the production matrix sub-lane path.
		const journalPath = path.join(
			projectRoot,
			".spine",
			"runtime",
			batchResult.batchId,
			"journal",
			"events.jsonl",
		);
		const events = fs.readFileSync(journalPath, "utf-8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));
		const hookCompleted = events.filter(
			(e) => e.type === "matrix.sub_lane.setup_hook.completed",
		);
		assert.ok(
			hookCompleted.length >= 2,
			`setup_hook.completed should fire for each matrix row; got ${hookCompleted.length}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* Fixtures + helpers                                                  */
/* ------------------------------------------------------------------ */

function configureForBatch(projectRoot, { maxParallel, worktreeSetupHook } = {}) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	fs.writeFileSync(
		configPath,
		JSON.stringify({
			...existing,
			workerBackend: "agentSession",
			lanes: { ...existing.lanes, maxParallel },
			integrate: { requireGate: false, enforceCoverageLimit: false },
			...(worktreeSetupHook ? { worktreeSetupHook } : {}),
		}),
		"utf-8",
	);
}

function matrixPrompt(taskId) {
	return `# Task: ${taskId} — Matrix exec
**Size:** S
**Type:** execute

## Mission
Produce one output file per matrix row.

## Dependencies
**None**

## File Scope
- \`out/\`

## Matrix
| run_id | value |
|-------|-------|
| a | alpha |
| b | beta |

## Steps
### Step 1: Run per row

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`mkdir -p out && echo {matrix.value} > out/{matrix.run_id}.txt\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row writes a distinct output file.

## Completion Criteria
- [ ] Both rows produce output

## Do NOT
- Fail
`;
}

function failingMatrixPrompt(taskId) {
	return `# Task: ${taskId} — Matrix fail
**Size:** S
**Type:** execute

## Mission
One row fails so the whole matrix task fails.

## Dependencies
**None**

## File Scope
- \`out/\`

## Matrix
| run_id | value |
|-------|-------|
| a | alpha |
| b | beta |

## Steps
### Step 1: Run per row

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`mkdir -p out && echo {matrix.value} > out/{matrix.run_id}.txt && test "{matrix.value}" != "beta"\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Row b exits non-zero.

## Completion Criteria
- [ ] Matrix task fails when row b fails

## Do NOT
- Succeed when a row fails
`;
}

function hookMatrixPrompt(taskId) {
	return `# Task: ${taskId} — Matrix hook
**Size:** S
**Type:** execute

## Mission
Each row consumes a worktreeSetupHook-provided marker, proving the hook runs
in the matrix sub-lane worktree before the row command (SP-688 / #224).

## Dependencies
**None**

## File Scope
- \`out/\`

## Matrix
| run_id | value |
|-------|-------|
| a | alpha |
| b | beta |

## Steps
### Step 1: Run per row

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`test -f hook-marker.txt && mkdir -p out && echo "$(cat hook-marker.txt) {matrix.value}" > out/{matrix.run_id}.txt\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row reads the hook-provided marker into its output.

## Completion Criteria
- [ ] Both rows carry hook evidence

## Do NOT
- Fail
`;
}

function plainPrompt(taskId) {
	return `# Task: ${taskId} — Plain
**Size:** S
**Type:** execute

## Mission
Not a matrix task.

## Dependencies
**None**

## File Scope
- \`out/\`

## Steps
### Step 1: Run

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`mkdir -p out && echo plain > out/plain.txt\` |
| fileScopeMustChange | \`out/plain.txt\` |
| testCommand | \`test -f out/plain.txt\` |

## Testing
Run it.

## Completion Criteria
- [ ] Done

## Do NOT
- Fail
`;
}

function siblingPrompt(taskId) {
	return `# Task: ${taskId} — Sibling
**Size:** S
**Type:** execute

## Mission
A non-matrix sibling task that runs on its own lane in the same wave as a
matrix task. Non-overlapping file scope (out2/) so the planner assigns it to a
distinct lane, exercising the SP-690 mixed-wave throttle.

## Dependencies
**None**

## File Scope
- \`out2/\`

## Steps
### Step 1: Run

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`mkdir -p out2 && echo sibling-ran > out2/sibling.txt\` |
| fileScopeMustChange | \`out2/sibling.txt\` |
| testCommand | \`test -f out2/sibling.txt\` |

## Testing
Write the sibling marker.

## Completion Criteria
- [ ] Done

## Do NOT
- Fail
`;
}
