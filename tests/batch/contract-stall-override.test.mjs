import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runWorker } from "../../src/batch/worker-host.mjs";
import { createWorkerPollState, pollWorkerUntilSettled } from "../../src/batch/worker-heartbeat.mjs";
import { resolveStallConfig } from "../../src/batch/heartbeat.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import {
	resolveStallConfigForTask,
	resolveTaskStallMinutes,
	resolveWorkerPiTimeoutMs,
	STALL_MINUTES_BY_SIZE,
} from "../../src/batch/task-stall-budget.mjs";

const GLOBAL_STALL_MIN = 120;
const CONTRACT_STALL_MIN = 240;

/**
 * Fake WorkerChildHandle for direct pollWorkerUntilSettled calls (SP-779 /
 * #308): an EventEmitter exposing `exitCode` like a ChildProcess, with pid 0
 * so terminateHungWorkerChild falls back to kill() instead of real signals.
 *
 * When `exitAtMs` is set, the bundled virtual clock exits the child (exitCode
 * set and childDone resolved — mimicking close-after-exit ordering) the first
 * time the clock reaches it. When `killExitCode` is set, kill() settles the
 * child the way a SIGKILL'd process would, modeling a hung worker that only
 * termination ends.
 */
function fakeWorkerChild({ exitAtMs = null, exitCode = 0, killExitCode = null } = {}) {
	const child = new EventEmitter();
	child.pid = 0;
	/** @type {number | null} */
	child.exitCode = null;
	let virtualNow = 0;
	let releaseChildDone = () => {};
	const childDone = new Promise((resolve) => {
		releaseChildDone = resolve;
	});
	const settle = (code) => {
		child.exitCode = code;
		releaseChildDone({ exitCode: code, output: "" });
	};
	if (killExitCode !== null) {
		child.kill = () => {
			if (child.exitCode === null) {
				settle(killExitCode);
			}
		};
	}
	const deps = {
		now: () => virtualNow,
		sleep: async (ms) => {
			virtualNow += ms;
			if (exitAtMs !== null && virtualNow >= exitAtMs && child.exitCode === null) {
				settle(exitCode);
			}
		},
	};
	return { child, childDone, deps, elapsedMs: () => virtualNow };
}

test("parseContract extracts stallTimeoutMinutes and extendGraceOnFileScope", () => {
	const markdown = `# Task: SP-999 — Stall override

## Contract

| Field | Value |
|-------|-------|
| stallTimeoutMinutes | 240 |
| extendGraceOnFileScope | true |
`;
	const parsed = parseContract(markdown);
	assert.equal(parsed.stallTimeoutMinutes, 240);
	assert.equal(parsed.extendGraceOnFileScope, true);
	assert.equal(parsed.errors.length, 0);
});

test("resolveTaskStallMinutes uses max of global, size floor, and contract override", () => {
	const config = { lanes: { stallTimeoutMinutes: GLOBAL_STALL_MIN } };
	assert.equal(
		resolveTaskStallMinutes("S", config, { stallTimeoutMinutes: CONTRACT_STALL_MIN }),
		CONTRACT_STALL_MIN,
	);
	assert.equal(
		resolveTaskStallMinutes("S", config, { stallTimeoutMinutes: 60 }),
		GLOBAL_STALL_MIN,
	);
	assert.equal(
		resolveTaskStallMinutes("M", config, { stallTimeoutMinutes: 200 }),
		200,
	);
	assert.equal(
		resolveTaskStallMinutes("M", config, { stallTimeoutMinutes: 150 }),
		STALL_MINUTES_BY_SIZE.M,
	);
	assert.equal(resolveTaskStallMinutes(null, config, { stallTimeoutMinutes: 180 }), 180);
});

test("resolveStallConfigForTask applies contract stallTimeoutMinutes to stallTimeoutMs", () => {
	const cfg = resolveStallConfigForTask({
		config: { lanes: { stallTimeoutMinutes: GLOBAL_STALL_MIN } },
		taskSize: "S",
		contract: { stallTimeoutMinutes: CONTRACT_STALL_MIN },
	});
	assert.equal(cfg.stallTimeoutMs, CONTRACT_STALL_MIN * 60 * 1000);
});

test("resolveStallConfigForTask honors contract extendGraceOnFileScope", () => {
	const cfg = resolveStallConfigForTask({
		config: { lanes: { extendGraceOnFileScope: false } },
		taskSize: "S",
		contract: { extendGraceOnFileScope: true },
	});
	assert.equal(cfg.extendGraceOnFileScope, true);
});

test("resolveWorkerPiTimeoutMs aligns with contract stall budget", () => {
	const previous = process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	delete process.env.SPINE_WORKER_PI_TIMEOUT_MS;
	try {
		const ms = resolveWorkerPiTimeoutMs({
			config: { lanes: { stallTimeoutMinutes: GLOBAL_STALL_MIN } },
			taskSize: "S",
			contract: { stallTimeoutMinutes: CONTRACT_STALL_MIN },
		});
		assert.equal(ms, CONTRACT_STALL_MIN * 60 * 1000);
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_WORKER_PI_TIMEOUT_MS;
		} else {
			process.env.SPINE_WORKER_PI_TIMEOUT_MS = previous;
		}
	}
});

test("runWorker with contract stall override survives beyond global stall budget", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-contract-stall-"));
	const batchId = "20260620T194352";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "SP-314-test");
	fs.mkdirSync(taskFolder, { recursive: true });

	// Generous real-subprocess margins: the global budget (3s) sits well below
	// the 6s stub hang, and the contract override lifts the budget to 30s — 5x
	// the hang. Only the classification is asserted: the #308 ordering fix makes
	// the poll loop observe the child exit before any budget judgment, so slow
	// polls can no longer flip this case to stall_timeout on a loaded host.
	const scaledGlobal = 0.05;
	const scaledContract = 0.5;
	const hangMs = 6_000;

	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: SP-314 — Contract stall test

## Review Level: 0

## Mission
Scaled stall override fixture (no Size line — avoids SP-088 floor in sub-minute tests).

## Dependencies
- **None**

## File Scope
- \`README.md\`

## Contract

| Field | Value |
|-------|-------|
| stallTimeoutMinutes | ${scaledContract} |

## Steps
### Step 0
- [ ] one
`,
		"utf-8",
	);
	fs.writeFileSync(path.join(taskFolder, "STATUS.md"), "# Status\n", "utf-8");

	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevHang = process.env.SPINE_WORKER_STUB_HANG_MS;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_HANG_MS = String(hangMs);

	try {
		const result = await runWorker({
			worktreePath,
			taskFolder,
			projectRoot,
			batchId,
			laneNumber: 1,
			taskId: "SP-314",
			config: {
				lanes: {
					stallTimeoutMinutes: scaledGlobal,
					stallGraceAfterProgressMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
				},
			},
		});

		assert.notEqual(
			result.classification,
			"stall_timeout",
			"contract override should extend stall beyond scaled global budget",
		);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_HANG_MS;
		else process.env.SPINE_WORKER_STUB_HANG_MS = prevHang;
		await rm(root, { recursive: true, force: true });
	}
});

test("contract override: worker exiting at virtual 10s under a 12s contract budget settles", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-contract-virtual-"));
	// 12s contract budget (stallTimeoutMs as resolveStallConfigForTask yields
	// after the override — its wiring is covered above) and polls every 5s: the
	// child exits at virtual 10s, 4x past the 2.4s global budget that would
	// apply without the override but well under the contract budget.
	const { child, childDone, deps } = fakeWorkerChild({ exitAtMs: 10_000, exitCode: 0 });
	const stallConfig = {
		...resolveStallConfig({
			lanes: {
				stallTimeoutMinutes: 0.2,
				stallGraceAfterProgressMinutes: 0.01,
				heartbeatIntervalMinutes: 60,
			},
		}),
		pollIntervalMs: 5_000,
	};
	let failure = null;
	try {
		const result = await pollWorkerUntilSettled({
			donePath: path.join(dir, ".DONE"),
			workerChild: child,
			childDone,
			stallConfig,
			startedAt: 0,
			pollState: createWorkerPollState(0, "pi"),
			worktreePath: dir,
			taskFolder: dir,
			useStub: true,
			workerBackend: "stub",
			childPastPreflight: true,
			buildFailureResult: (input) => {
				failure = input;
				return { classification: input.classification };
			},
			workerMode: "stub",
			deps,
		});

		assert.equal(result.kind, "settled", "exit at virtual 10s is settled work");
		assert.equal(
			failure,
			null,
			"a worker that exits inside its contract budget is never classified stall_timeout",
		);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("no contract override: hung worker stalls at the virtual 2.4s global budget", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spine-global-virtual-"));
	// 2.4s global budget with a 5s poll step: the first poll after t=0 lands at
	// virtual 5s, past the budget, with the child still hung (never exits on its
	// own; only kill() settles it). This is a true stall — it must still be
	// classified stall_timeout (the #308 ordering fix must not overcorrect).
	const { child, childDone, deps } = fakeWorkerChild({ killExitCode: 137 });
	const stallConfig = {
		...resolveStallConfig({
			lanes: {
				stallTimeoutMinutes: 0.04,
				stallGraceAfterProgressMinutes: 0.01,
				heartbeatIntervalMinutes: 60,
			},
		}),
		pollIntervalMs: 5_000,
	};
	let failureInput = null;
	try {
		const result = await pollWorkerUntilSettled({
			donePath: path.join(dir, ".DONE"),
			workerChild: child,
			childDone,
			stallConfig,
			startedAt: 0,
			pollState: createWorkerPollState(0, "pi"),
			worktreePath: dir,
			taskFolder: dir,
			useStub: true,
			workerBackend: "stub",
			childPastPreflight: true,
			buildFailureResult: (input) => {
				failureInput = input;
				return { classification: input.classification };
			},
			workerMode: "stub",
			deps,
		});

		assert.equal(result.kind, "failure");
		assert.equal(result.result.classification, "stall_timeout");
		assert.equal(failureInput?.classification, "stall_timeout");
		assert.equal(failureInput?.exitCode, 124);
		assert.ok(failureInput?.stallDeadline, "failure carries the stall deadline");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
