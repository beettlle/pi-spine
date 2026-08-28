import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { runWorker } from "../../src/batch/worker-host.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import {
	resolveStallConfigForTask,
	resolveTaskStallMinutes,
	resolveWorkerPiTimeoutMs,
	STALL_MINUTES_BY_SIZE,
} from "../../src/batch/task-stall-budget.mjs";

const GLOBAL_STALL_MIN = 120;
const CONTRACT_STALL_MIN = 240;

/** V8 coverage + full-suite concurrency starves this timing case (~15m wall, false stall). */
const UNDER_COVERAGE = process.execArgv.some((arg) =>
	String(arg).includes("experimental-test-coverage"),
);

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

test(
	"runWorker with contract stall override survives beyond global stall budget (scaled)",
	{ skip: UNDER_COVERAGE ? "timing-sensitive under V8 coverage CPU load" : false },
	async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-contract-stall-"));
	const batchId = "20260620T194352";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "SP-314-test");
	fs.mkdirSync(taskFolder, { recursive: true });

	// Scaled timings: global ~1.8s stall; contract ~12s (well above 5s poll cap).
	// Margins are intentionally wide so the case stays stable when multiple batch
	// lanes run the full npm test suite concurrently on a loaded host.
	const scaledGlobal = 0.03;
	const scaledContract = 0.2;
	const hangMs = 2_500;

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
},
);

test("runWorker without contract override stalls at scaled global budget", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-contract-stall-base-"));
	const batchId = "20260620T194353";
	const projectRoot = path.join(root, "project");
	const worktreePath = path.join(root, "worktree");
	const taskFolder = path.join(worktreePath, "spine-tasks", "SP-314-base");
	fs.mkdirSync(taskFolder, { recursive: true });

	const scaledGlobal = 0.04;
	const hangMs = 3_000;

	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`# Task: SP-314B — Baseline stall

## Review Level: 0

## Mission
Baseline stall without contract override.

## Dependencies
- **None**

## File Scope
- \`README.md\`

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
			taskId: "SP-314B",
			config: {
				lanes: {
					stallTimeoutMinutes: scaledGlobal,
					stallGraceAfterProgressMinutes: 0.01,
					heartbeatIntervalMinutes: 60,
				},
			},
		});

		assert.equal(result.classification, "stall_timeout");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevHang === undefined) delete process.env.SPINE_WORKER_STUB_HANG_MS;
		else process.env.SPINE_WORKER_STUB_HANG_MS = prevHang;
		await rm(root, { recursive: true, force: true });
	}
});
