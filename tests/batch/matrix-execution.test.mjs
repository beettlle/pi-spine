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
import {
	aggregateMatrixOutcomes,
	isMatrixSubLaneWorktreeDir,
	loadMatrixTaskRows,
	matrixSubLaneBranch,
	matrixWorktreeDir,
	matrixWorktreePath,
	runConcurrent,
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
/* Fixtures + helpers                                                  */
/* ------------------------------------------------------------------ */

function configureForBatch(projectRoot, { maxParallel }) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	fs.writeFileSync(
		configPath,
		JSON.stringify({
			...existing,
			workerBackend: "agentSession",
			lanes: { ...existing.lanes, maxParallel },
			integrate: { requireGate: false, enforceCoverageLimit: false },
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
