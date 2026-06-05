import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { runSpinePlan } from "../../bin/spine-plan.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

const PLAN_CONFIG = { lanes: { maxParallel: 1, queueExcess: true } };

/**
 * @param {string} tasksRoot
 * @param {string} folderName
 * @param {string} taskId
 * @param {string} promptMarkdown
 */
function writeTask(tasksRoot, folderName, taskId, promptMarkdown) {
	const folder = path.join(tasksRoot, folderName);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), promptMarkdown, "utf-8");
}

async function createTasksRoot() {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-prompt-validation-"));
	const tasksRoot = path.join(root, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	fs.writeFileSync(
		path.join(tasksRoot, "dependencies.json"),
		JSON.stringify({ version: 1, tasks: {} }, null, 2),
		"utf-8",
	);
	return { root, tasksRoot };
}

test("buildPlan rejects invalid heading separator", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		writeTask(
			tasksRoot,
			"FX-001-heading",
			"FX-001",
			`# Task: FX-001 - Bad heading

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
### Step 0: Work
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
		);

		assert.throws(
			() => buildPlan({ scope: "FX-001", config: PLAN_CONFIG, tasksRoot }),
			(err) => {
				assert.match(err.message, /Invalid PROMPT for FX-001/);
				assert.match(err.message, /em dash/i);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildPlan rejects missing testing coverage", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		writeTask(
			tasksRoot,
			"FX-002-testing",
			"FX-002",
			`# Task: FX-002 — Missing testing

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
### Step 0: Work
- [ ] a

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
		);

		assert.throws(
			() => buildPlan({ scope: "FX-002", config: PLAN_CONFIG, tasksRoot }),
			(err) => {
				assert.match(err.message, /Invalid PROMPT for FX-002/);
				assert.match(err.message, /testing coverage/i);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildPlan rejects missing File Scope section", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		writeTask(
			tasksRoot,
			"FX-003-scope",
			"FX-003",
			`# Task: FX-003 — Missing file scope

## Mission
x

## Dependencies
- **None**

## Steps
### Step 0: Work
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
		);

		assert.throws(
			() => buildPlan({ scope: "FX-003", config: PLAN_CONFIG, tasksRoot }),
			(err) => {
				assert.match(err.message, /Invalid PROMPT for FX-003/);
				assert.match(err.message, /File Scope/);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("runSpinePlan exits with validation errors for invalid PROMPT", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	const configPath = path.join(root, ".spine");
	fs.mkdirSync(configPath, { recursive: true });
	fs.writeFileSync(
		path.join(configPath, "spine-config.json"),
		JSON.stringify(
			{
				configVersion: 1,
				project: { name: "prompt-validation" },
				paths: { tasksRoot: "spine-tasks" },
				baseBranch: "main",
				testing: { commands: ["npm test"] },
				agents: { worker: { model: "inherit", thinking: "medium" } },
				lanes: { maxParallel: 1, queueExcess: true },
				gates: { requireBeforeIntegrate: true },
			},
			null,
			2,
		),
		"utf-8",
	);

	writeTask(
		tasksRoot,
		"FX-004-plan-cli",
		"FX-004",
		`# Task: FX-004 - Bad heading

## Mission
x

## Dependencies
- **None**

## File Scope
- \`src/example.mjs\`

## Steps
### Step 0: Work
- [ ] a

### Step 1: Testing & Verification
- [ ] t

## Completion Criteria
- [ ] done

## Do NOT
- n
`,
	);

	try {
		await assert.rejects(
			() => runSpinePlan({ projectRoot: root, scope: "FX-004", json: true }),
			(err) => {
				assert.match(err.message, /Invalid PROMPT for FX-004/);
				return true;
			},
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildPlan accepts valid PROMPT packets", async () => {
	const { root, tasksRoot } = await createTasksRoot();
	try {
		writeTask(
			tasksRoot,
			"FX-005-valid",
			"FX-005",
			minimalValidPromptMarkdown("FX-005", {
				title: "Valid fixture",
				fileScope: "src/example.mjs",
			}),
		);

		const plan = buildPlan({ scope: "FX-005", config: PLAN_CONFIG, tasksRoot });
		assert.deepEqual(plan.scope.taskIds, ["FX-005"]);
		assert.equal(plan.tasks["FX-005"].title, "Valid fixture");
		assert.deepEqual(plan.tasks["FX-005"].fileScope, ["src/example.mjs"]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
