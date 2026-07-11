import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	assertLocCapstoneReadinessForPlan,
	checkLocCapstoneReadiness,
	evaluateBatchLocPolicyAfterEmptyGrandfather,
	isLocCapstoneEmptyGrandfatherMission,
	listPendingLocCapstoneTasks,
} from "../../src/config/preflight/loc-capstone.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const EMPTY_GRANDFATHER_PROMPT = `# Task: SP-593 — Empty PHASE23_GRANDFATHERED_OVER_500

## Mission
Remove all entries from \`PHASE23_GRANDFATHERED_OVER_500\`. Ensure \`bin/spine-cli/verify.mjs\` \`batch-loc-policy\` passes.

## Dependencies
- **None**

## File Scope
- \`bin/spine-cli/verify.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |
| fileScopeMustChange | \`bin/spine-cli/verify.mjs\` |

## Steps
### Step 1: Empty grandfather list
- [ ] Set \`PHASE23_GRANDFATHERED_OVER_500\` to \`[]\`

### Step 2: Testing & Verification
- [ ] verify

## Completion Criteria
- [ ] Grandfather list empty; verify green

## Do NOT
- Remove LOC policy entirely
`;

const READINESS_GATE_PROMPT = `# Task: SP-611 — LOC capstone readiness gate

## Mission
Capstone tasks that empty \`PHASE23_GRANDFATHERED_OVER_500\` must not become runnable until batch-loc-policy would pass. Do not re-open SP-593.

## Dependencies
- **None**

## File Scope
- \`src/config/preflight/\`
- \`bin/spine-cli/verify.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |

## Steps
### Step 1: Readiness gate
- [ ] block premature empty-grandfather

### Step 2: Testing & Verification
- [ ] verify

## Completion Criteria
- [ ] gate works

## Do NOT
- Re-populate grandfather list
`;

const ORDINARY_PROMPT = `# Task: SP-900 — Ordinary feature

## Mission
Implement an ordinary feature with no grandfather involvement.

## Dependencies
- **None**

## File Scope
- \`src/feature.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`true\` |

## Steps
### Step 1: Work
- [ ] implement

### Step 2: Testing & Verification
- [ ] verify

## Completion Criteria
- [ ] done

## Do NOT
- skip
`;

/**
 * @param {string} projectRoot
 * @param {string} folderName
 * @param {string} taskId
 * @param {string} promptMarkdown
 */
function writePendingTask(projectRoot, folderName, taskId, promptMarkdown) {
	const folder = path.join(projectRoot, "spine-tasks", folderName);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(path.join(folder, "PROMPT.md"), promptMarkdown, "utf-8");
	fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
	const depsPath = path.join(projectRoot, "spine-tasks", "dependencies.json");
	let tasks = {};
	if (fs.existsSync(depsPath)) {
		tasks = JSON.parse(fs.readFileSync(depsPath, "utf-8")).tasks ?? {};
	}
	tasks[taskId] = [];
	fs.writeFileSync(depsPath, JSON.stringify({ version: 1, tasks }, null, 2), "utf-8");
}

/**
 * @param {string} projectRoot
 * @param {string} name
 * @param {number} lineCount
 */
function writeBatchModule(projectRoot, name, lineCount) {
	fs.mkdirSync(path.join(projectRoot, "src", "batch"), { recursive: true });
	const body = Array.from({ length: Math.max(lineCount, 1) }, (_, index) => `// line ${index + 1}`).join(
		"\n",
	);
	fs.writeFileSync(path.join(projectRoot, "src", "batch", name), `${body}\n`, "utf-8");
}

test("isLocCapstoneEmptyGrandfatherMission detects SP-593-style emptying", () => {
	assert.equal(
		isLocCapstoneEmptyGrandfatherMission({
			title: "Empty PHASE23_GRANDFATHERED_OVER_500",
			missionText: "Remove all entries from PHASE23_GRANDFATHERED_OVER_500",
			fileScope: ["bin/spine-cli/verify.mjs"],
			folderName: "SP-593-rel230-grandfather-list-empty",
		}),
		true,
	);
});

test("isLocCapstoneEmptyGrandfatherMission excludes readiness-gate packets", () => {
	assert.equal(
		isLocCapstoneEmptyGrandfatherMission({
			title: "LOC capstone readiness gate",
			missionText:
				"Capstone tasks that empty PHASE23_GRANDFATHERED_OVER_500 must not become runnable",
			fileScope: ["bin/spine-cli/verify.mjs", "src/config/preflight/"],
			folderName: "SP-611-loc-capstone-readiness-gate",
		}),
		false,
	);
});

test("evaluateBatchLocPolicyAfterEmptyGrandfather reports over-limit modules", async () => {
	const projectRoot = await initGitRepo("loc-capstone-eval-");
	try {
		writeBatchModule(projectRoot, "small.mjs", 10);
		writeBatchModule(projectRoot, "huge.mjs", 520);
		const policy = evaluateBatchLocPolicyAfterEmptyGrandfather(projectRoot);
		assert.equal(policy.ok, false);
		assert.equal(policy.ungrandfathered.length, 1);
		assert.equal(policy.ungrandfathered[0].relPath, "src/batch/huge.mjs");
		assert.ok(policy.ungrandfathered[0].lines > 500);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkLocCapstoneReadiness blocks premature empty-grandfather task", async () => {
	const projectRoot = await initGitRepo("loc-capstone-block-");
	try {
		writeBatchModule(projectRoot, "huge.mjs", 520);
		writePendingTask(
			projectRoot,
			"SP-593-rel230-grandfather-list-empty",
			"SP-593",
			EMPTY_GRANDFATHER_PROMPT,
		);

		const check = checkLocCapstoneReadiness({ projectRoot });
		assert.equal(check.ok, false);
		assert.equal(check.id, "loc-capstone-readiness");
		assert.match(check.message, /LOC-capstone not ready/);
		assert.match(check.message, /src\/batch\/huge\.mjs/);
		assert.match(check.message, /SP-593/);
		assert.deepEqual(check.details?.taskIds, ["SP-593"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkLocCapstoneReadiness allows empty-grandfather when policy would pass", async () => {
	const projectRoot = await initGitRepo("loc-capstone-allow-");
	try {
		writeBatchModule(projectRoot, "ok.mjs", 40);
		writePendingTask(
			projectRoot,
			"SP-593-rel230-grandfather-list-empty",
			"SP-593",
			EMPTY_GRANDFATHER_PROMPT,
		);

		const check = checkLocCapstoneReadiness({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /LOC-capstone ready/);
		assert.match(check.message, /SP-593/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkLocCapstoneReadiness ignores ordinary pending tasks even when modules are over limit", async () => {
	const projectRoot = await initGitRepo("loc-capstone-ordinary-");
	try {
		writeBatchModule(projectRoot, "huge.mjs", 520);
		writePendingTask(projectRoot, "SP-900-ordinary-feature", "SP-900", ORDINARY_PROMPT);

		const check = checkLocCapstoneReadiness({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /no pending empty-grandfather/);
		assert.deepEqual(listPendingLocCapstoneTasks({ projectRoot }), []);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkLocCapstoneReadiness does not treat readiness-gate as capstone", async () => {
	const projectRoot = await initGitRepo("loc-capstone-self-");
	try {
		writeBatchModule(projectRoot, "huge.mjs", 520);
		writePendingTask(
			projectRoot,
			"SP-611-loc-capstone-readiness-gate",
			"SP-611",
			READINESS_GATE_PROMPT,
		);

		const check = checkLocCapstoneReadiness({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /no pending empty-grandfather/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildPlan throws for blocked LOC-capstone scope", async () => {
	const projectRoot = await initGitRepo("loc-capstone-plan-");
	try {
		writeBatchModule(projectRoot, "huge.mjs", 520);
		writePendingTask(
			projectRoot,
			"SP-593-rel230-grandfather-list-empty",
			"SP-593",
			EMPTY_GRANDFATHER_PROMPT,
		);
		const tasksRoot = path.join(projectRoot, "spine-tasks");
		assert.throws(
			() =>
				buildPlan({
					scope: "SP-593",
					config: { lanes: { maxParallel: 1, queueExcess: true } },
					tasksRoot,
					projectRoot,
				}),
			/LOC-capstone not ready.*src\/batch\/huge\.mjs/,
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("assertLocCapstoneReadinessForPlan is a no-op when ready", async () => {
	const projectRoot = await initGitRepo("loc-capstone-assert-ok-");
	try {
		writeBatchModule(projectRoot, "ok.mjs", 20);
		assert.doesNotThrow(() =>
			assertLocCapstoneReadinessForPlan({
				projectRoot,
				tasks: [
					{
						taskId: "SP-593",
						title: "Empty PHASE23_GRANDFATHERED_OVER_500",
						missionText: "Remove all entries from PHASE23_GRANDFATHERED_OVER_500",
						fileScope: ["bin/spine-cli/verify.mjs"],
						folderName: "SP-593-rel230-grandfather-list-empty",
					},
				],
			}),
		);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
