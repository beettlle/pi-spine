import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
	appendBatchSizeGuidanceToPlanOutput,
	buildBatchSizeGuidanceWarning,
	countMediumLargeTasks,
} from "../../src/doctor/batch-size-guidance.mjs";
import { formatPlanHuman } from "../../src/planner/format-plan.mjs";

function writeSizedTask(tasksRoot, taskId, size) {
	const folder = path.join(tasksRoot, `${taskId}-task`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Example

**Size:** ${size}

## Mission
Do work.

## Dependencies
- **None**

## File Scope
- \`src/${taskId}.txt\`

## Steps
### Step 1: Work
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- scope creep
`,
		"utf-8",
	);
}

test("countMediumLargeTasks counts only M and L sizes", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ml-count-"));
	try {
		writeSizedTask(tasksRoot, "SP-901", "S");
		writeSizedTask(tasksRoot, "SP-902", "M");
		writeSizedTask(tasksRoot, "SP-903", "L");
		writeSizedTask(tasksRoot, "SP-904", "M");

		const result = countMediumLargeTasks({
			tasksRoot,
			taskIds: ["SP-901", "SP-902", "SP-903", "SP-904"],
		});
		assert.equal(result.count, 3);
		assert.deepEqual(result.taskIds, ["SP-902", "SP-903", "SP-904"]);
	} finally {
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});

test("buildBatchSizeGuidanceWarning returns null below threshold", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ml-warn-"));
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		writeSizedTask(tasksRoot, "SP-911", "M");
		writeSizedTask(tasksRoot, "SP-912", "L");
		writeSizedTask(tasksRoot, "SP-913", "M");
		assert.equal(
			buildBatchSizeGuidanceWarning({
				tasksRoot,
				taskIds: ["SP-911", "SP-912", "SP-913"],
			}),
			null,
		);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});

test("buildBatchSizeGuidanceWarning warns at 4+ M/L tasks for real pi", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-ml-warn2-"));
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		for (const id of ["SP-921", "SP-922", "SP-923", "SP-924"]) {
			writeSizedTask(tasksRoot, id, "M");
		}
		const warning = buildBatchSizeGuidanceWarning({
			tasksRoot,
			taskIds: ["SP-921", "SP-922", "SP-923", "SP-924"],
		});
		assert.ok(warning);
		assert.match(warning, /4 M\/L task/);
		assert.match(warning, /stallTimeoutMinutes/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});

test("formatPlanHuman appends batch size guidance warning", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-plan-warn-"));
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		for (const id of ["SP-931", "SP-932", "SP-933", "SP-934"]) {
			writeSizedTask(tasksRoot, id, "L");
		}
		const plan = {
			scope: { mode: "ids", taskIds: ["SP-931", "SP-932", "SP-933", "SP-934"] },
			metadata: { tasksSelected: 4, tasksRoot },
			laneConfig: { maxParallel: 1 },
			waves: [{ index: 0, taskIds: ["SP-931", "SP-932", "SP-933", "SP-934"], ticks: [] }],
			tasks: {},
		};
		const output = formatPlanHuman(plan);
		assert.match(output, /⚠ Batch includes 4 M\/L task/);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});

test("appendBatchSizeGuidanceToPlanOutput skips warning in stub mode", () => {
	const tasksRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-plan-stub-"));
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		for (const id of ["SP-941", "SP-942", "SP-943", "SP-944"]) {
			writeSizedTask(tasksRoot, id, "M");
		}
		const plan = {
			scope: { taskIds: ["SP-941", "SP-942", "SP-943", "SP-944"] },
			metadata: { tasksRoot },
		};
		const output = appendBatchSizeGuidanceToPlanOutput("plan body\n", plan);
		assert.equal(output, "plan body\n");
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
		fs.rmSync(tasksRoot, { recursive: true, force: true });
	}
});
