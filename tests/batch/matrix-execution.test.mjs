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
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startBatch } from "../../src/batch/engine.mjs";
import { expandMatrixFileScopePatterns } from "../../src/batch/lane-commit.mjs";
import {
	resolveMatrixRowConcurrency,
	runMatrixSubLane,
} from "../../src/batch/engine-lanes/matrix-run.mjs";
import { buildWorkerChildEnv } from "../../src/batch/worker-spawn.mjs";
import { applyMatrixRowToPrompt } from "../../src/planner/matrix.mjs";
import {
	acquireLaneSlot,
	aggregateMatrixOutcomes,
	buildMatrixRowEnv,
	isMatrixSubLaneWorktreeDir,
	loadMatrixTaskRows,
	matrixSubLaneBranch,
	matrixWorktreeDir,
	matrixWorktreePath,
	releaseLaneSlot,
	removeMatrixSubLaneWorktree,
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
/* Unit: lane slot pool (SP-697 / #228)                                */
/* ------------------------------------------------------------------ */

test("acquireLaneSlot hands out distinct slots up to maxParallel", async () => {
	const state = {};
	const slot1 = await acquireLaneSlot(state, 2);
	const slot2 = await acquireLaneSlot(state, 2);
	assert.equal(slot1, 1);
	assert.equal(slot2, 2);
	assert.notEqual(slot1, slot2, "concurrent holders must get distinct lane slots");
});

test("acquireLaneSlot blocks past maxParallel until a slot is released (global cap)", async () => {
	const state = {};
	const slot1 = await acquireLaneSlot(state, 2);
	const slot2 = await acquireLaneSlot(state, 2);

	let thirdAcquired = false;
	const third = acquireLaneSlot(state, 2).then((slot) => {
		thirdAcquired = true;
		return slot;
	});
	await new Promise((r) => setTimeout(r, 25));
	assert.equal(thirdAcquired, false, "third acquire must wait while both slots are held");

	releaseLaneSlot(state, slot1);
	const slot3 = await third;
	assert.equal(slot3, slot1, "released slot is reused by the waiter");
	releaseLaneSlot(state, slot2);
	releaseLaneSlot(state, slot3);
});

test("acquireLaneSlot releases wake waiters FIFO", async () => {
	const state = {};
	const held = await acquireLaneSlot(state, 1);
	const order = [];
	const w1 = acquireLaneSlot(state, 1).then(() => order.push("w1"));
	const w2 = acquireLaneSlot(state, 1).then(() => order.push("w2"));
	releaseLaneSlot(state, held);
	await w1;
	releaseLaneSlot(state, 1);
	await w2;
	assert.deepEqual(order, ["w1", "w2"]);
});

test("acquireLaneSlot clamps a missing/zero maxParallel to a single slot", async () => {
	const state = {};
	const only = await acquireLaneSlot(state, 0);
	assert.equal(only, 1);
	let secondAcquired = false;
	const second = acquireLaneSlot(state, undefined).then(() => {
		secondAcquired = true;
	});
	await new Promise((r) => setTimeout(r, 25));
	assert.equal(secondAcquired, false, "pool of 1 must serialize competitors");
	releaseLaneSlot(state, only);
	await second;
});

test("releaseLaneSlot ignores unknown slots and unknown state objects", () => {
	const state = {};
	assert.doesNotThrow(() => releaseLaneSlot(state, 99));
	assert.doesNotThrow(() => releaseLaneSlot({}, 1));
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
/* Unit: matrix row env + per-matrix throttle (SP-751 / #229)          */
/* ------------------------------------------------------------------ */

test("buildMatrixRowEnv emits the five matrix index vars with a 0-based index", () => {
	const env = buildMatrixRowEnv({ taskId: "SP-9", rowId: "row_b", rowIndex: 1, rowCount: 3 });
	assert.deepStrictEqual(env, {
		SPINE_MATRIX_JOB_ID: "SP-9",
		SPINE_MATRIX_TASK_ID: "row_b",
		SPINE_MATRIX_TASK_INDEX: "1",
		SPINE_MATRIX_TASK_COUNT: "3",
		// K8s indexed-job alias of SPINE_MATRIX_TASK_INDEX.
		JOB_COMPLETION_INDEX: "1",
	});
	const first = buildMatrixRowEnv({ taskId: "SP-9", rowId: "a", rowIndex: 0, rowCount: 2 });
	assert.equal(first.SPINE_MATRIX_TASK_INDEX, "0", "index is 0-based");
	assert.equal(first.JOB_COMPLETION_INDEX, "0", "alias matches the 0-based index");
});

test("buildMatrixRowEnv returns null when the row position is unknown", () => {
	assert.equal(buildMatrixRowEnv({ taskId: "SP-9", rowId: "a" }), null);
	assert.equal(buildMatrixRowEnv({ taskId: "SP-9", rowId: "a", rowCount: 2 }), null);
	assert.equal(buildMatrixRowEnv({}), null);
	assert.equal(
		buildMatrixRowEnv({ taskId: "SP-9", rowId: "a", rowIndex: -1, rowCount: 2 }),
		null,
		"negative index injects nothing",
	);
});

test("runShellInDir layers extraEnv over process.env (#229)", async () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-shell-env-"));
	try {
		const matrixEnv = buildMatrixRowEnv({ taskId: "SP-9", rowId: "a", rowIndex: 0, rowCount: 2 });
		const run = await runShellInDir(
			tmp,
			`printf '%s|%s|%s|%s|%s' "$SPINE_MATRIX_JOB_ID" "$SPINE_MATRIX_TASK_ID" "$SPINE_MATRIX_TASK_INDEX" "$SPINE_MATRIX_TASK_COUNT" "$JOB_COMPLETION_INDEX"`,
			matrixEnv,
		);
		assert.equal(run.exitCode, 0);
		assert.equal(run.output, "SP-9|a|0|2|0");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("runShellInDir without extraEnv injects nothing (back-compat)", async () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-shell-noenv-"));
	try {
		const run = await runShellInDir(tmp, "printf '%s' \"${SPINE_MATRIX_TASK_INDEX:-unset}\"");
		assert.equal(run.exitCode, 0);
		assert.equal(run.output, "unset");
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("resolveMatrixRowConcurrency caps the matrix throttle by the global pool", () => {
	// Throttle narrower than the pool narrows the matrix's share.
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: 1, maxParallel: 4 }), 1);
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: 2, maxParallel: 4 }), 2);
	// Throttle can never widen the global pool.
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: 8, maxParallel: 3 }), 3);
	// No throttle → global cap unchanged.
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: null, maxParallel: 3 }), 3);
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: undefined, maxParallel: 5 }), 5);
	// Invalid throttles fall back to the global cap (defense in depth past parse).
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: 0, maxParallel: 3 }), 3);
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: -2, maxParallel: 3 }), 3);
	// Missing/invalid globals clamp to a single slot (mirrors acquireLaneSlot).
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: null }), 1);
	assert.equal(resolveMatrixRowConcurrency({ matrixMaxParallel: 4, maxParallel: 0 }), 1);
});

test("buildWorkerChildEnv merges extraEnv; omits matrix vars without it", () => {
	const prevIndex = process.env.SPINE_MATRIX_TASK_INDEX;
	delete process.env.SPINE_MATRIX_TASK_INDEX;
	try {
		const base = {
			taskFolder: "/tmp/spine-tf",
			worktreePath: "/tmp/spine-wt",
			projectRoot: "/tmp/spine-root",
			batchId: "batch-env",
			laneNumber: 1,
			taskId: "SP-9",
			laneCorrelationId: "corr-env",
		};
		const bare = buildWorkerChildEnv(base);
		assert.equal(
			"SPINE_MATRIX_TASK_INDEX" in bare,
			false,
			"no matrix vars without extraEnv (back-compat)",
		);

		const withEnv = buildWorkerChildEnv({
			...base,
			extraEnv: buildMatrixRowEnv({ taskId: "SP-9", rowId: "a", rowIndex: 0, rowCount: 2 }),
		});
		assert.equal(withEnv.SPINE_MATRIX_JOB_ID, "SP-9");
		assert.equal(withEnv.SPINE_MATRIX_TASK_ID, "a");
		assert.equal(withEnv.SPINE_MATRIX_TASK_INDEX, "0");
		assert.equal(withEnv.SPINE_MATRIX_TASK_COUNT, "2");
		assert.equal(withEnv.JOB_COMPLETION_INDEX, "0");
		// Built-in worker identity survives the merge.
		assert.equal(withEnv.SPINE_TASK_ID, "SP-9");
		assert.equal(withEnv.SPINE_IS_WORKER, "1");
	} finally {
		if (prevIndex !== undefined) process.env.SPINE_MATRIX_TASK_INDEX = prevIndex;
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
/* E2E: rows run on DISTINCT lanes as first-class pool competitors     */
/* (SP-697 / #228): N rows with maxParallel=M run min(N,M) rows on     */
/* distinct lane numbers concurrently; the parent holds no slot.       */
/* ------------------------------------------------------------------ */

test("E2E: N-row matrix with maxParallel=M runs min(N,M) rows on distinct lanes concurrently", async () => {
	const projectRoot = await initGitRepo("spine-matrix-first-class-");
	try {
		const taskId = "TP-305";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			sleepMatrixPrompt(taskId, 1),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		// N=2 rows, M=2: both rows must run concurrently on distinct lanes.
		configureForBatch(projectRoot, { maxParallel: 2 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(
			batchResult.ok,
			`batch should succeed; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
		);

		const events = readJournalEvents(projectRoot, batchResult.batchId);
		const started = events.filter((e) => e.type === "matrix.sub_lane.started");
		assert.equal(started.length, 2, "both rows should start");

		// Distinct lanes: each active row holds a distinct pool slot, which the
		// journal hoists to the entry's laneId (lane-<slot>) identity.
		const laneIds = started.map((e) => e.laneId);
		assert.equal(
			new Set(laneIds).size,
			2,
			`rows must run on distinct lane ids; got ${JSON.stringify(laneIds)}`,
		);
		const worktrees = started.map((e) => e.payload.worktreePath);
		assert.equal(
			new Set(worktrees).size,
			2,
			`rows must run in distinct worktrees; got ${JSON.stringify(worktrees)}`,
		);

		// Concurrency proof (min(N,M) = 2): with each row sleeping 1s, a serial
		// schedule completes row 1 before row 2 starts. Both started events must
		// precede every completed event.
		const lastStart = Math.max(...started.map((e) => Date.parse(e.timestamp)));
		const completions = events.filter((e) => e.type === "matrix.sub_lane.completed");
		assert.equal(completions.length, 2, "both rows should complete");
		const firstCompletion = Math.min(...completions.map((e) => Date.parse(e.timestamp)));
		assert.ok(
			lastStart < firstCompletion,
			`both rows must be in flight before either completes (concurrent on distinct lanes); ` +
				`last start ${lastStart}, first completion ${firstCompletion}`,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/* ------------------------------------------------------------------ */
/* E2E: mixed wave (matrix + sibling) — rows compete with the sibling  */
/* for the global pool so in-flight <= lanes.maxParallel (SP-697/#228, */
/* supersedes the SP-690 nested throttle)                              */
/* ------------------------------------------------------------------ */

test("E2E: mixed wave keeps global in-flight <= lanes.maxParallel (#228)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-pool-");
	try {
		const matrixTaskId = "TP-400";
		const siblingTaskId = "TP-401";
		const matrixFolder = path.join(projectRoot, "spine-tasks", `${matrixTaskId}-matrix`);
		const siblingFolder = path.join(projectRoot, "spine-tasks", `${siblingTaskId}-sibling`);
		fs.mkdirSync(matrixFolder, { recursive: true });
		fs.mkdirSync(siblingFolder, { recursive: true });
		fs.writeFileSync(
			path.join(matrixFolder, "PROMPT.md"),
			sleepMatrixPrompt(matrixTaskId, 1),
			"utf-8",
		);
		// Sibling is a plain execute task with a non-overlapping file scope so the
		// planner assigns it to a different lane in the same tick (maxParallel 2).
		fs.writeFileSync(
			path.join(siblingFolder, "PROMPT.md"),
			sleepSiblingPrompt(siblingTaskId, 1),
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
		// lane. The sibling task holds one pool slot; the matrix parent holds none,
		// so its rows compete for the 2 global slots against the sibling. Any
		// schedule that double-counted the parent or nested full concurrency would
		// reach 3 in-flight.
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

		const events = readJournalEvents(projectRoot, batchResult.batchId);

		// Production-wiring proof: the matrix task_started event records the GLOBAL
		// maxParallel (the pool size rows compete for), not a throttled remainder.
		const matrixStarted = events.find((e) => e.type === "matrix.task_started");
		assert.ok(matrixStarted, "matrix.task_started should be recorded");
		assert.equal(
			matrixStarted.payload.maxParallel,
			2,
			`matrix rows must compete for the global pool (maxParallel 2), not a throttled remainder; got ${matrixStarted.payload.maxParallel}`,
		);

		// Global in-flight cap: build [started, completed] intervals for the
		// sibling task and every matrix row (each row sleeps 1s so intervals are
		// robust to ms jitter), then sweep for the maximum overlap. The matrix
		// parent's own task.started/completed are excluded — it holds no slot.
		const intervals = [];
		const rowStartByRowId = new Map();
		let siblingStart;
		let siblingEnd;
		for (const e of events) {
			const p = e.payload ?? {};
			if (e.type === "task.started" && e.taskId === siblingTaskId) {
				siblingStart = Date.parse(e.timestamp);
			}
			if (e.type === "task.completed" && e.taskId === siblingTaskId) {
				siblingEnd = Date.parse(e.timestamp);
			}
			if (e.type === "matrix.sub_lane.started") {
				rowStartByRowId.set(p.rowId, Date.parse(e.timestamp));
			}
			if (
				(e.type === "matrix.sub_lane.completed" || e.type === "matrix.sub_lane.failed") &&
				rowStartByRowId.has(p.rowId)
			) {
				intervals.push([rowStartByRowId.get(p.rowId), Date.parse(e.timestamp)]);
			}
		}
		assert.ok(siblingStart && siblingEnd, "sibling task interval should be journaled");
		intervals.push([siblingStart, siblingEnd]);
		assert.equal(intervals.length, 3, "sibling + 2 matrix rows should produce 3 intervals");
		const peak = maxConcurrentOverlap(intervals);
		assert.ok(
			peak <= 2,
			`global in-flight must stay <= lanes.maxParallel (2); observed peak ${peak}`,
		);
		assert.ok(
			peak === 2,
			`rows should genuinely compete concurrently with the sibling (peak 2); got ${peak}`,
		);

		// Rows still land on distinct lane ids while active.
		const rowStarted = events.filter((e) => e.type === "matrix.sub_lane.started");
		const rowLanes = rowStarted.map((e) => e.laneId);
		assert.equal(
			new Set(rowLanes).size,
			rowStarted.length,
			`each row must run on a distinct lane id; got ${JSON.stringify(rowLanes)}`,
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
/* LLM rows: per-row PROMPT substitution (#232 / SP-742)               */
/* ------------------------------------------------------------------ */

/**
 * LLM matrix task folder fixture: PROMPT.md + STATUS.md + dependencies.json,
 * committed so row worktrees provision with the authored packet.
 *
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} promptText
 * @returns {string} Task folder path relative to the repo root.
 */
function writeLlmMatrixTask(projectRoot, taskId, promptText) {
	const folderRel = path.join("spine-tasks", `${taskId}-matrix-llm`);
	const folder = path.join(projectRoot, folderRel);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), promptText, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# STATUS\n\n**Current Step:** Not Started\n", "utf-8");
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
		"utf-8",
	);
	return folderRel;
}

function commitAll(projectRoot) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "task packet"], { cwd: projectRoot, stdio: "ignore" });
}

function sha256(text) {
	return createHash("sha256").update(text, "utf-8").digest("hex");
}

/** Save/set/restore SPINE_WORKER_STUB around stub-worker tests. */
function withStubEnv(fn) {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	return Promise.resolve(fn()).finally(() => {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	});
}

test("runMatrixSubLane serves each LLM row its own substituted PROMPT.md (#232)", () =>
	withStubEnv(async () => {
		const projectRoot = await initGitRepo("spine-matrix-llm-served-");
		try {
			const taskId = "TP-320";
			const authored = llmMatrixPrompt(taskId);
			const folderRel = writeLlmMatrixTask(projectRoot, taskId, authored);
			commitAll(projectRoot);

			/** @type {Array<Record<string, any>>} */
			const results = [];
			for (const row of [
				{ rowId: "a", values: { run_id: "a", region: "us-east-1" } },
				{ rowId: "b", values: { run_id: "b", region: "eu-west-1" } },
			]) {
				const result = await runMatrixSubLane({
					projectRoot,
					batchId: "batch-llm-served",
					laneNumber: 1,
					taskId,
					laneBranch: "main",
					laneCorrelationId: "corr-llm-served",
					row,
					matrixType: "llm",
					parentTaskFolderAbs: path.join(projectRoot, folderRel),
					taskFolderRel: folderRel,
					config: {},
					baseBranch: "main",
				});
				results.push(result);
			}

			const [rowA, rowB] = results;
			assert.equal(rowA.ok, true, `row a should succeed: ${rowA.output}`);
			assert.equal(rowB.ok, true, `row b should succeed: ${rowB.output}`);

			// Each row's served PROMPT carries that row's values across steps
			// (title region, per-row output path) — never raw {matrix.*} refs.
			for (const result of results) {
				const region = result.rowId === "a" ? "us-east-1" : "eu-west-1";
				assert.match(result.servedPrompt, new RegExp(`Step 1: Report for ${region}`));
				assert.match(result.servedPrompt, new RegExp(`out/${result.rowId}\\.txt for ${region}`));
				assert.doesNotMatch(result.servedPrompt, /\{matrix\./);
			}
			assert.notEqual(rowA.servedPrompt, rowB.servedPrompt, "rows must see distinct substituted content");

			// Served bytes are exactly the whole-document substitution of the
			// authored PROMPT with the row values (SP-670 engine).
			assert.equal(rowA.servedPrompt, applyMatrixRowToPrompt(authored, { run_id: "a", region: "us-east-1" }));
			assert.equal(rowB.servedPrompt, applyMatrixRowToPrompt(authored, { run_id: "b", region: "eu-west-1" }));

			// Scaffolding cleanup: the row worktree PROMPT is restored and the
			// row's .DONE dropped before the per-row commit, so the row branch
			// carries only real row output (stub STATUS.md delivery here).
			const rowPromptOnDisk = fs.readFileSync(path.join(rowA.worktreePath, folderRel, "PROMPT.md"), "utf-8");
			assert.equal(rowPromptOnDisk, authored, "row worktree PROMPT.md must be restored after the worker finishes");
			assert.equal(fs.existsSync(path.join(rowA.worktreePath, folderRel, ".DONE")), false, "row .DONE must not be committed scaffolding");

			for (const result of results) {
				const changed = execFileSync(
					"git",
					["diff", `main...${result.branch}`, "--name-only"],
					{ cwd: projectRoot, encoding: "utf-8" },
				).trim();
				assert.equal(
					changed,
					path.join(folderRel, "STATUS.md").split(path.sep).join("/"),
					`row branch must carry only worker output, not PROMPT/.DONE scaffolding; got: ${changed}`,
					);
				removeMatrixSubLaneWorktree(projectRoot, result.worktreePath, result.branch);
			}
		} finally {
			await destroyGitRepo(projectRoot);
		}
	}));

test("runMatrixSubLane fails an LLM row loud on unknown {matrix.*} refs (#232)", () =>
	withStubEnv(async () => {
		const projectRoot = await initGitRepo("spine-matrix-llm-badref-");
		try {
			const taskId = "TP-321";
			const folderRel = writeLlmMatrixTask(projectRoot, taskId, llmMatrixPrompt(taskId));
			commitAll(projectRoot);

			const result = await runMatrixSubLane({
				projectRoot,
				batchId: "batch-llm-badref",
				laneNumber: 1,
				taskId,
				laneBranch: "main",
				laneCorrelationId: "corr-llm-badref",
				// Missing the `region` column: fail-loud, never reaches the worker.
				row: { rowId: "a", values: { run_id: "a" } },
				matrixType: "llm",
				parentTaskFolderAbs: path.join(projectRoot, folderRel),
				taskFolderRel: folderRel,
				config: {},
				baseBranch: "main",
			});

			assert.equal(result.ok, false);
			assert.equal(result.exitCode, 1);
			assert.match(
				result.output,
				/matrix row prompt substitution failed: Unknown matrix variable reference: \{matrix\.region\}/,
			);
			removeMatrixSubLaneWorktree(projectRoot, result.worktreePath, result.branch);
		} finally {
			await destroyGitRepo(projectRoot);
		}
	}));

test("E2E: LLM matrix rows receive distinct substituted PROMPTs and the authored packet stays intact (#232)", () =>
	withStubEnv(async () => {
		const projectRoot = await initGitRepo("spine-matrix-llm-e2e-");
		try {
			const taskId = "TP-306";
			const authored = llmMatrixPrompt(taskId);
			const folderRel = writeLlmMatrixTask(projectRoot, taskId, authored);
			commitAll(projectRoot);

			configureForBatch(projectRoot, { maxParallel: 2 });

			const oldIsWorker = process.env.SPINE_IS_WORKER;
			delete process.env.SPINE_IS_WORKER;
			const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
			if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

			assert.ok(
				batchResult.ok,
				`batch should succeed; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
			);

			// Each row journaled the exact served PROMPT digest, and the two rows
			// saw different substituted content.
			const events = readJournalEvents(projectRoot, batchResult.batchId);
			const served = events.filter((e) => e.type === "matrix.sub_lane.prompt_served");
			assert.equal(served.length, 2, "both rows should journal prompt_served");
			const shaByRow = new Map(served.map((e) => [e.payload.rowId, e.payload.sha256]));
			assert.equal(shaByRow.get("a"), sha256(applyMatrixRowToPrompt(authored, { run_id: "a", region: "us-east-1" })));
			assert.equal(shaByRow.get("b"), sha256(applyMatrixRowToPrompt(authored, { run_id: "b", region: "eu-west-1" })));
			assert.notEqual(shaByRow.get("a"), shaByRow.get("b"), "rows must see distinct substituted content");

			// The authored packet survives: the merged PROMPT.md keeps its
			// {matrix.*} placeholders (substitution scaffolding is never committed).
			const mergedPrompt = execFileSync(
				"git",
				["show", `${batchResult.orchBranch}:${folderRel.split(path.sep).join("/")}/PROMPT.md`],
				{ cwd: projectRoot, encoding: "utf-8" },
			);
			assert.equal(mergedPrompt, authored);

			// Row output landed: both rows delivered the stub STATUS.md marker.
			const deliveredStatus = execFileSync(
				"git",
				["show", `${batchResult.orchBranch}:${folderRel.split(path.sep).join("/")}/STATUS.md`],
				{ cwd: projectRoot, encoding: "utf-8" },
			);
			assert.match(deliveredStatus, /\*\*Current Step:\*\* Complete/);
		} finally {
			await destroyGitRepo(projectRoot);
		}
	}));

/* ------------------------------------------------------------------ */
/* E2E + row-level: matrix index env vars + matrixMaxParallel throttle  */
/* (SP-751 / #229)                                                     */
/* ------------------------------------------------------------------ */

test("E2E: execute matrix rows receive the matrix index env vars (#229)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-env-e2e-");
	try {
		const taskId = "TP-323";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix-env`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), envMatrixPrompt(taskId), "utf-8");
		fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, "scripts", "dump-matrix-env.sh"),
			DUMP_MATRIX_ENV_SH,
			{ encoding: "utf-8", mode: 0o755 },
		);
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

		// Each row's dump script saw the full Slurm/K8s-shaped identity: parent
		// task id as JOB_ID, row id as TASK_ID, 0-based index + K8s alias, count 2.
		const rowA = execFileSync("git", ["show", `${batchResult.orchBranch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(rowA, /^job=TP-323$/m);
		assert.match(rowA, /^task=a$/m);
		assert.match(rowA, /^index=0$/m);
		assert.match(rowA, /^count=2$/m);
		assert.match(rowA, /^k8s=0$/m);

		const rowB = execFileSync("git", ["show", `${batchResult.orchBranch}:out/b.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(rowB, /^job=TP-323$/m);
		assert.match(rowB, /^task=b$/m);
		assert.match(rowB, /^index=1$/m);
		assert.match(rowB, /^count=2$/m);
		assert.match(rowB, /^k8s=1$/m);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("E2E: matrixMaxParallel=1 serializes rows under a larger global pool (#229)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-throttle-");
	try {
		const taskId = "TP-324";
		const folder = path.join(projectRoot, "spine-tasks", `${taskId}-matrix-throttle`);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			throttleMatrixPrompt(taskId, 1),
			"utf-8",
		);
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });

		// Global pool of 2, matrix throttle of 1: rows must take turns.
		configureForBatch(projectRoot, { maxParallel: 2 });

		const oldIsWorker = process.env.SPINE_IS_WORKER;
		delete process.env.SPINE_IS_WORKER;
		const batchResult = await startBatch({ projectRoot, scope: taskId, skipPreflight: true });
		if (oldIsWorker) process.env.SPINE_IS_WORKER = oldIsWorker;

		assert.ok(
			batchResult.ok,
			`batch should succeed; output: ${batchResult.output}\n${JSON.stringify(batchResult)}`,
			);

		const events = readJournalEvents(projectRoot, batchResult.batchId);
		const startedEvents = events.filter((e) => e.type === "matrix.sub_lane.started");
		const completions = events.filter((e) => e.type === "matrix.sub_lane.completed");
		assert.equal(startedEvents.length, 2, "both rows should start");
		assert.equal(completions.length, 2, "both rows should complete");

		// The throttle was parsed and carried into scheduling: rowConcurrency is
		// the throttled min(1, global=2), and the global pool stayed maxParallel=2.
		const taskStarted = events.find((e) => e.type === "matrix.task_started");
		assert.ok(taskStarted, "matrix.task_started should be journaled");
		assert.equal(taskStarted.payload.matrixMaxParallel, 1);
		assert.equal(taskStarted.payload.rowConcurrency, 1);
		assert.equal(taskStarted.payload.maxParallel, 2);

		// Serial proof (Slurm %N analog): the first row fully completed before
		// the second row started — impossible under the unthrottled global pool.
		const firstCompletion = Math.min(...completions.map((e) => Date.parse(e.timestamp)));
		const lastStart = Math.max(...startedEvents.map((e) => Date.parse(e.timestamp)));
		assert.ok(
			firstCompletion < lastStart,
			`matrixMaxParallel=1 must serialize rows; first completion ${firstCompletion}, last start ${lastStart}`,
			);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runMatrixSubLane passes matrix env to LLM row workers (#229)", () =>
	withStubEnv(async () => {
		const projectRoot = await initGitRepo("spine-matrix-llm-env-");
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spine-matrix-llm-env-dump-"));
		try {
			const taskId = "TP-325";
			const folderRel = writeLlmMatrixTask(projectRoot, taskId, llmMatrixPrompt(taskId));
			commitAll(projectRoot);

			// Launch script dumps the row worker's inherited env, then execs the
			// real runner — proving the vars reach the worker child process.
			fs.mkdirSync(path.join(projectRoot, "scripts"), { recursive: true });
			fs.writeFileSync(
				path.join(projectRoot, "scripts", "spine-worker-launch.sh"),
				ENV_DUMP_LAUNCH_SH,
				{ encoding: "utf-8", mode: 0o755 },
			);

			const rows = [
				{ rowId: "a", values: { run_id: "a", region: "us-east-1" }, index: 0 },
				{ rowId: "b", values: { run_id: "b", region: "eu-west-1" }, index: 1 },
			];
			for (const row of rows) {
				const dumpPath = path.join(tmp, `env-${row.rowId}.txt`);
				process.env.SPINE_MATRIX_ENV_DUMP = dumpPath;
				process.env.SPINE_TEST_NODE = process.execPath;
				const result = await runMatrixSubLane({
					projectRoot,
					batchId: "batch-llm-env",
					laneNumber: 1,
					taskId,
					laneBranch: "main",
					laneCorrelationId: "corr-llm-env",
					row: { rowId: row.rowId, values: row.values },
					matrixType: "llm",
					parentTaskFolderAbs: path.join(projectRoot, folderRel),
					taskFolderRel: folderRel,
					config: { development: { workerLaunchScript: "scripts/spine-worker-launch.sh" } },
					baseBranch: "main",
					rowIndex: row.index,
					rowCount: rows.length,
				});
				assert.equal(result.ok, true, `row ${row.rowId} should succeed: ${result.output}`);

				const dumped = fs.readFileSync(dumpPath, "utf-8");
				assert.match(dumped, /^job=TP-325$/m, "SPINE_MATRIX_JOB_ID is the parent task id");
				assert.match(dumped, new RegExp(`^task=${row.rowId}$`, "m"), "SPINE_MATRIX_TASK_ID is the row id");
				assert.match(dumped, new RegExp(`^index=${row.index}$`, "m"), "SPINE_MATRIX_TASK_INDEX is 0-based");
				assert.match(dumped, /^count=2$/m, "SPINE_MATRIX_TASK_COUNT is the row count");
				assert.match(dumped, new RegExp(`^k8s=${row.index}$`, "m"), "JOB_COMPLETION_INDEX aliases the index");
			}
		} finally {
			delete process.env.SPINE_MATRIX_ENV_DUMP;
			delete process.env.SPINE_TEST_NODE;
			fs.rmSync(tmp, { recursive: true, force: true });
			await destroyGitRepo(projectRoot);
		}
	}));

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

/**
 * Read a batch's journal events as parsed objects (ordered).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @returns {Array<{ type: string, timestamp: string, payload: object }>}
 */
function readJournalEvents(projectRoot, batchId) {
	const journalPath = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"journal",
		"events.jsonl",
	);
	return fs
		.readFileSync(journalPath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

/**
 * Maximum number of simultaneously-open [start, end] intervals (epoch ms).
 * Ends sort before starts at equal timestamps so back-to-back work does not
 * count as overlap.
 *
 * @param {Array<[number, number]>} intervals
 * @returns {number}
 */
function maxConcurrentOverlap(intervals) {
	const points = [];
	for (const [start, end] of intervals) {
		points.push([start, 1], [end, -1]);
	}
	points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	let current = 0;
	let peak = 0;
	for (const [, delta] of points) {
		current += delta;
		if (current > peak) peak = current;
	}
	return peak;
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
| runCommand | \`test -f hook-marker.txt && mkdir -p out && tr -d '\\n' < hook-marker.txt > out/{matrix.run_id}.txt && echo "{matrix.value}" >> out/{matrix.run_id}.txt\` |
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

/**
 * LLM matrix prompt: rows write a per-row report whose path and step text are
 * substituted per row. File scope is the task folder's STATUS.md so the stub
 * worker's delivery path (writeStubDeliveryStatusIfNeeded) satisfies the
 * contract without a real agent.
 *
 * @param {string} taskId
 */
function llmMatrixPrompt(taskId) {
	return `# Task: ${taskId} — Matrix LLM
**Size:** S
**Type:** llm

## Mission
Each row reports on its region; the served PROMPT must carry row values (#232).

## Dependencies
**None**

## File Scope
- \`spine-tasks/${taskId}-matrix-llm/STATUS.md\`

## Matrix
| run_id | region |
|--------|--------|
| a | us-east-1 |
| b | eu-west-1 |

## Steps
### Step 1: Report for {matrix.region}

- [ ] Write out/{matrix.run_id}.txt for {matrix.region}

## Contract
| Field | Value |
|-------|-------|
| fileScopeMustChange | \`spine-tasks/${taskId}-matrix-llm/STATUS.md\` |
| testCommand | \`test -f spine-tasks/${taskId}-matrix-llm/STATUS.md\` |

## Testing
Stub delivery writes STATUS.md per row.

## Completion Criteria
- [ ] Both rows deliver

## Do NOT
- Touch other rows' outputs
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

/**
 * Matrix prompt whose rows sleep `seconds` before writing output, so journal
 * started/completed intervals prove (or disprove) concurrent row execution.
 *
 * @param {string} taskId
 * @param {number} seconds
 */
function sleepMatrixPrompt(taskId, seconds) {
	return `# Task: ${taskId} — Matrix sleep
**Size:** S
**Type:** execute

## Mission
Rows sleep so scheduling overlap is observable in the journal.

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
| runCommand | \`sleep ${seconds} && mkdir -p out && echo {matrix.value} > out/{matrix.run_id}.txt\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row sleeps, then writes its output file.

## Completion Criteria
- [ ] Both rows produce output

## Do NOT
- Fail
`;
}

/**
 * Sibling (non-matrix) execute prompt that sleeps `seconds`, sharing the
 * global lane pool with a matrix wave-mate (SP-697 / #228).
 *
 * @param {string} taskId
 * @param {number} seconds
 */
function sleepSiblingPrompt(taskId, seconds) {
	return `# Task: ${taskId} — Sibling
**Size:** S
**Type:** execute

## Mission
A non-matrix sibling task that runs on its own lane in the same wave as a
matrix task. Non-overlapping file scope (out2/) so the planner assigns it to a
distinct lane, exercising first-class row lane-pool competition (SP-697 / #228).

## Dependencies
**None**

## File Scope
- \`out2/\`

## Steps
### Step 1: Run

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`sleep ${seconds} && mkdir -p out2 && echo sibling-ran > out2/sibling.txt\` |
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

/** Shell script committed into env-E2E fixtures: dumps the matrix index env
 * vars (#229) into the row's out file. Lives in scripts/ because contract
 * commands refuse `$` (#268) — the script, not the runCommand, reads the env. */
const DUMP_MATRIX_ENV_SH = `#!/bin/sh
mkdir -p out
{
	printf 'job=%s\\n' "$SPINE_MATRIX_JOB_ID"
	printf 'task=%s\\n' "$SPINE_MATRIX_TASK_ID"
	printf 'index=%s\\n' "$SPINE_MATRIX_TASK_INDEX"
	printf 'count=%s\\n' "$SPINE_MATRIX_TASK_COUNT"
	printf 'k8s=%s\\n' "$JOB_COMPLETION_INDEX"
} > "out/$SPINE_MATRIX_TASK_ID.txt"
`;

/** Worker launch script that dumps the inherited row-worker env (#229) to
 * $SPINE_MATRIX_ENV_DUMP, then execs the real runner args. */
const ENV_DUMP_LAUNCH_SH = `#!/bin/sh
{
	printf 'job=%s\\n' "$SPINE_MATRIX_JOB_ID"
	printf 'task=%s\\n' "$SPINE_MATRIX_TASK_ID"
	printf 'index=%s\\n' "$SPINE_MATRIX_TASK_INDEX"
	printf 'count=%s\\n' "$SPINE_MATRIX_TASK_COUNT"
	printf 'k8s=%s\\n' "$JOB_COMPLETION_INDEX"
} > "$SPINE_MATRIX_ENV_DUMP"
exec "$SPINE_TEST_NODE" "$@"
`;

/**
 * Execute matrix prompt whose runCommand delegates to the committed env-dump
 * script, so each row's out file records the env vars the row process saw.
 *
 * @param {string} taskId
 */
function envMatrixPrompt(taskId) {
	return `# Task: ${taskId} — Matrix env
**Size:** S
**Type:** execute

## Mission
Each row dumps its matrix index env vars into its output file (#229).

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
### Step 1: Dump env per row

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`sh scripts/dump-matrix-env.sh\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row writes its env dump.

## Completion Criteria
- [ ] Both rows carry env evidence

## Do NOT
- Fail
`;
}

/**
 * Matrix prompt with a Contract `matrixMaxParallel` throttle; rows sleep so
 * serialization under the throttle is observable in the journal (#229).
 *
 * @param {string} taskId
 * @param {number} seconds
 */
function throttleMatrixPrompt(taskId, seconds) {
	return `# Task: ${taskId} — Matrix throttled
**Size:** S
**Type:** execute

## Mission
Rows sleep so the matrixMaxParallel throttle is observable in the journal.

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
| matrixMaxParallel | 1 |
| runCommand | \`sleep ${seconds} && mkdir -p out && echo {matrix.value} > out/{matrix.run_id}.txt\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Each row sleeps, then writes its output file.

## Completion Criteria
- [ ] Both rows produce output

## Do NOT
- Fail
`;
}
