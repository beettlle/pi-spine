// @ts-nocheck
/**
 * SP-876 / #311 — matrix lane slot release on state-save failure and
 * fail-closed matrix packet loading.
 *
 * Bug 1 (slot leak): the row runner acquired a lane slot, then persisted the
 * row's `running` status BEFORE entering the try/finally that releases the
 * slot. A `saveEngineBatchState` failure in that window leaked the slot and
 * stalled the global pool for the rest of the batch. The tests arm a failing
 * save exactly in that window — via a matrixRows entry whose `exitCode`
 * getter throws once the `running` status flip fires (the write that
 * preceded the formerly-unguarded save) — and assert the slot returns to the
 * pool. No module mocks: `mock.module` is unavailable under the contract
 * test flags, so the real save path is exercised end-to-end.
 *
 * Bug 2 (packet demotion): `loadMatrixTaskRows` collapses every packet load
 * error into `null`, which callers read as "not a matrix task". A task whose
 * raw PROMPT.md declares a `## Matrix` section must fail closed with a clear
 * error instead of silently resuming as a plain worker.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	runMatrixTaskForResume,
	runMatrixTaskOnLane,
} from "../../src/batch/engine-lanes/matrix-run.mjs";
import {
	acquireLaneSlot,
	releaseLaneSlot,
} from "../../src/batch/engine-lanes/matrix.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/**
 * Matrix packet for the slot-leak run: an execute row whose command is never
 * reached (the armed save throws before runMatrixSubLane is called).
 *
 * @param {string} taskId
 */
function matrixPacket(taskId) {
	return `# Task: ${taskId} — Matrix run
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
|--------|-------|
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

/**
 * Plain (non-matrix) packet — no `## Matrix` section.
 *
 * @param {string} taskId
 */
function plainPacket(taskId) {
	return `# Task: ${taskId} — Plain resume
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
 * Build a matrixRows entry whose `exitCode` getter throws exactly once, the
 * first time it is read AFTER the row runner flips the entry's `status` to
 * `running`. JSON.stringify inside saveSpineBatchState reads every enumerable
 * property, so the armed getter makes that specific in-row state save reject
 * — the exact save that used to run outside the try/finally (#311).
 *
 * @param {string} rowId
 */
function armedRowEntry(rowId) {
	const entry = {
		rowId,
		status: "pending",
		exitCode: null,
		commitSha: null,
	};
	let armed = false;
	let thrownOnce = false;
	Object.defineProperty(entry, "status", {
		configurable: true,
		enumerable: true,
		get() {
			return entry._status ?? "pending";
		},
		/** @param {string} value */
		set(value) {
			entry._status = value;
			// Arm the save bomb on the exact property write that precedes the
			// formerly-unguarded per-row state save.
			if (value === "running") armed = true;
		},
	});
	Object.defineProperty(entry, "exitCode", {
		configurable: true,
		enumerable: true,
		get() {
			if (armed && !thrownOnce) {
				thrownOnce = true;
				throw new Error("simulated saveEngineBatchState failure (#311)");
			}
			return entry._exitCode ?? null;
		},
		/** @param {number|null} value */
		set(value) {
			entry._exitCode = value;
		},
	});
	return entry;
}

/**
 * Minimal batch state the matrix runner can persist through the real
 * saveEngineBatchState path on a fresh temp repo.
 *
 * @param {object} task Parent matrix task (mutated in place by the runner).
 */
function batchState(task) {
	return {
		batchId: "batch-sp876",
		baseBranch: "main",
		phase: "running",
		tasks: [task],
		segments: [{ taskId: task.taskId, status: "running" }],
	};
}

/**
 * Params bag for runMatrixTaskOnLane / runMatrixTaskForResume on a temp repo.
 *
 * @param {string} projectRoot
 * @param {object} task
 * @param {string} folderRel
 * @param {{ rows: any[], columns: string[], type: string }} [matrix]
 */
function matrixParams(projectRoot, task, folderRel, matrix) {
	return {
		projectRoot,
		state: batchState(task),
		batchId: "batch-sp876",
		baseBranch: "main",
		config: {},
		task,
		lane: {
			laneNumber: 1,
			branch: "main",
			worktreePath: path.join(projectRoot, ".worktrees", "lane-1"),
			laneId: "lane-1",
		},
		taskFolderRel: folderRel,
		laneCorrelationId: "corr-sp876",
		fileScopePaths: [],
		...(matrix ? { matrix, maxParallel: 1 } : {}),
	};
}

/**
 * The acquired slot must be back in the pool: re-acquiring with maxParallel
 * 1 resolves immediately. A leaked slot would leave this acquisition hanging
 * forever — the race turns the hang into a deterministic failure.
 *
 * @param {object} state
 */
async function assertSlotReleased(state) {
	const reacquired = await Promise.race([
		acquireLaneSlot(state, 1),
		new Promise((resolve, reject) => {
			setTimeout(
				() => reject(new Error("lane slot leaked: re-acquire did not resolve (#311)")),
				500,
			);
		}),
	]);
	releaseLaneSlot(state, reacquired);
}

/* ------------------------------------------------------------------ */
/* Slot leak (#311)                                                    */
/* ------------------------------------------------------------------ */

test(
	"runMatrixTaskOnLane releases the lane slot when the per-row state save throws (#311)",
	{ timeout: 30000 },
	async () => {
		const projectRoot = await initGitRepo("spine-matrix-run-slot-");
		try {
			const taskId = "TP-876";
			const task = {
				taskId,
				status: "running",
				isMatrix: true,
				matrixRows: [armedRowEntry("a"), armedRowEntry("b")],
			};
			const folderRel = path.join("spine-tasks", `${taskId}-matrix`);
			const params = matrixParams(projectRoot, task, folderRel, {
				rows: [
					{ rowId: "a", values: { run_id: "a" } },
					{ rowId: "b", values: { run_id: "b" } },
				],
				columns: ["run_id"],
				type: "execute",
			});

			// Both rows' in-row saves throw (each entry arms once); with the fix the
			// throws land inside the try, every slot is released in the finally, and
			// the rows are recorded as crashed sub-lanes instead of stalling the pool.
			const result = await runMatrixTaskOnLane({ ...params, maxParallel: 1 });

			assert.equal(result.ok, false);
			assert.equal(task.status, "failed");
			assert.deepEqual(
				task.matrixRows.map((/** @type {any} */ e) => e.status),
				["failed", "failed"],
			);
			assert.deepEqual(
				task.matrixRows.map((/** @type {any} */ e) => e.exitCode),
				[1, 1],
			);

			// maxParallel=1 with two rows: row b could only start after row a
			// released the slot — serialization across the single slot is itself
			// evidence the release ran mid-sweep.
			await assertSlotReleased(params.state);
		} finally {
			await destroyGitRepo(projectRoot);
		}
	},
);

/* ------------------------------------------------------------------ */
/* Packet load fail-closed (#311)                                      */
/* ------------------------------------------------------------------ */

test("runMatrixTaskForResume fails closed when a declared matrix packet fails to load (#311)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-packet-broken-");
	try {
		const taskId = "TP-877";
		const folderRel = path.join("spine-tasks", `${taskId}-matrix`);
		const folder = path.join(projectRoot, folderRel);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), matrixPacket(taskId), "utf-8");
		// STATUS.md as a directory: loadTaskPacket throws reading it, and
		// loadMatrixTaskRows collapses that error into null — the exact bug
		// shape (#311). The raw PROMPT.md still declares `## Matrix`.
		fs.mkdirSync(path.join(folder, "STATUS.md"));

		const task = { taskId, status: "running", isMatrix: true, matrixRows: [] };
		await assert.rejects(
			runMatrixTaskForResume(matrixParams(projectRoot, task, folderRel)),
			/matrix packet failed to load/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runMatrixTaskForResume keeps plain packets on the non-matrix path (#311)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-packet-plain-");
	try {
		const taskId = "TP-878";
		const folderRel = path.join("spine-tasks", `${taskId}-plain`);
		const folder = path.join(projectRoot, folderRel);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), plainPacket(taskId), "utf-8");
		fs.writeFileSync(
			path.join(folder, "STATUS.md"),
			"# STATUS\n\n**Current Step:** Not Started\n",
			"utf-8",
		);

		const task = { taskId, status: "running", isMatrix: false, matrixRows: [] };
		const resume = await runMatrixTaskForResume(matrixParams(projectRoot, task, folderRel));
		assert.deepEqual(resume, { isMatrix: false });
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runMatrixTaskForResume leaves broken non-matrix packets unchanged (#311)", async () => {
	const projectRoot = await initGitRepo("spine-matrix-packet-brokenplain-");
	try {
		const taskId = "TP-879";
		const folderRel = path.join("spine-tasks", `${taskId}-plain`);
		const folder = path.join(projectRoot, folderRel);
		fs.mkdirSync(folder, { recursive: true });
		// Plain packet (no Matrix section) with an unloadable STATUS.md: the
		// fail-closed rule is matrix-specific — the plain path keeps its
		// existing behavior (no scheduling change for non-matrix tasks).
		fs.writeFileSync(path.join(folder, "PROMPT.md"), plainPacket(taskId), "utf-8");
		fs.mkdirSync(path.join(folder, "STATUS.md"));

		const task = { taskId, status: "running", isMatrix: false, matrixRows: [] };
		const resume = await runMatrixTaskForResume(matrixParams(projectRoot, task, folderRel));
		assert.deepEqual(resume, { isMatrix: false });
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
