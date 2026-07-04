/**
 * SP-437 — sequence continues or skips later waves after merge_blocked (GitHub #82).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { runSequence } from "../../src/batch/sequence.mjs";
import {
	buildSequenceSatisfiedTaskIds,
	evaluateWaveTaskDependencies,
	formatSequenceWaveSkipMessage,
	isMergeBlockedBatchOutcome,
	planSequenceWaveTasks,
	resolveWaveAfterMergeBlocked,
} from "../../src/batch/sequence-waves.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_OK = "SP-811";
const TASK_FAIL = "SP-812";
const TASK_MID = "SP-813";
const TASK_W2 = "SP-814";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string} fileScopePath
 * @param {string[]} deps
 */
function writeSequenceTask(projectRoot, taskId, slug, fileScopePath, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((dep) => `- **${dep}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: slug,
			fileScope: fileScopePath,
			mission: `Sequence merge_blocked fixture (${slug}).`,
		}).replace("## Dependencies\n- **None**", `## Dependencies\n${depLines}`),
		"utf-8",
	);
}

function writeDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_OK]: [],
					[TASK_FAIL]: [],
					[TASK_MID]: [TASK_OK],
					[TASK_W2]: [TASK_FAIL, TASK_MID],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

function setMaxParallel(projectRoot, maxParallel) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.lanes = { ...config.lanes, maxParallel, queueExcess: true };
	fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function execCommit(projectRoot, message) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", message], { cwd: projectRoot, stdio: "ignore" });
}

test("isMergeBlockedBatchOutcome detects mixed-outcome and merge_blocked phases", () => {
	assert.equal(
		isMergeBlockedBatchOutcome({
			startResult: { error: "mixed_outcome_merge_blocked" },
		}),
		true,
	);
	assert.equal(
		isMergeBlockedBatchOutcome({
			reconciliation: { phase: "merge_blocked" },
		}),
		true,
	);
	assert.equal(
		isMergeBlockedBatchOutcome({
			reconciliation: {
				phase: "failed",
				signals: { raw: { lastError: "Wave merge blocked (§17.4 mixed-outcome policy)." } },
			},
		}),
		true,
	);
	assert.equal(isMergeBlockedBatchOutcome({ startResult: { error: "preflight_failed" } }), false);
});

test("evaluateWaveTaskDependencies filters runnable tasks by satisfied deps", () => {
	const plan = {
		tasks: {
			[TASK_MID]: { dependencies: [TASK_OK] },
			[TASK_W2]: { dependencies: [TASK_FAIL, TASK_MID] },
		},
	};
	const satisfied = buildSequenceSatisfiedTaskIds([], [{ succeeded: [TASK_OK], failed: [TASK_FAIL] }]);
	const wave1 = evaluateWaveTaskDependencies({
		plan,
		waveTaskIds: [TASK_MID],
		satisfiedTaskIds: satisfied,
	});
	assert.deepEqual(wave1.runnable, [TASK_MID]);
	assert.deepEqual(wave1.blocked, []);

	const wave2 = evaluateWaveTaskDependencies({
		plan,
		waveTaskIds: [TASK_W2],
		satisfiedTaskIds: satisfied,
	});
	assert.deepEqual(wave2.runnable, []);
	assert.deepEqual(wave2.blocked, [{ taskId: TASK_W2, unsatisfiedDeps: [TASK_FAIL, TASK_MID] }]);
});

test("formatSequenceWaveSkipMessage names blocked dependencies per §17.4", () => {
	const message = formatSequenceWaveSkipMessage({
		waveIndex: 2,
		mergeBlockedWaveIndex: 0,
		failedTaskIds: [TASK_FAIL],
		succeededTaskIds: [TASK_OK],
		blocked: [{ taskId: TASK_W2, unsatisfiedDeps: [TASK_FAIL, TASK_MID] }],
	});
	assert.match(message, /§17\.4/);
	assert.match(message, /wave 2 skipped/i);
	assert.match(message, /SP-814/);
	assert.match(message, /SP-812/);
});

test("resolveWaveAfterMergeBlocked continues wave 1 and skips wave 2 tasks", () => {
	const plan = {
		tasks: {
			[TASK_MID]: { dependencies: [TASK_OK] },
			[TASK_W2]: { dependencies: [TASK_FAIL, TASK_MID] },
		},
	};
	const satisfied = buildSequenceSatisfiedTaskIds([], [{ succeeded: [TASK_OK], failed: [TASK_FAIL] }]);

	const wave1 = resolveWaveAfterMergeBlocked({
		plan,
		waveIndex: 1,
		waveTaskIds: [TASK_MID],
		satisfiedTaskIds: satisfied,
		mergeBlockedWaveIndex: 0,
		failedTaskIds: [TASK_FAIL],
		succeededTaskIds: [TASK_OK],
	});
	assert.equal(wave1.action, "continue");
	assert.deepEqual(wave1.runnableTaskIds, [TASK_MID]);

	const wave2 = resolveWaveAfterMergeBlocked({
		plan,
		waveIndex: 2,
		waveTaskIds: [TASK_W2],
		satisfiedTaskIds: satisfied,
		mergeBlockedWaveIndex: 0,
		failedTaskIds: [TASK_FAIL],
		succeededTaskIds: [TASK_OK],
	});
	assert.equal(wave2.action, "skip");
	assert.match(wave2.message ?? "", /§17\.4/);
});

test("planSequenceWaveTasks skips wave when no deps are satisfied", () => {
	const plan = {
		tasks: {
			[TASK_W2]: { dependencies: [TASK_FAIL] },
		},
	};
	const resolution = planSequenceWaveTasks({
		plan,
		waveIndex: 2,
		waveTaskIds: [TASK_W2],
		satisfiedTaskIds: new Set([TASK_OK]),
	});
	assert.equal(resolution.action, "skip");
});

test("3-wave sequence continues wave 1 after wave 0 merge_blocked and skips wave 2", async () => {
	const projectRoot = await initGitRepo("spine-seq-merge-blocked-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	const prevFail = process.env.SPINE_WORKER_STUB_FAIL_TASKS;
	const prevWorker = process.env.SPINE_IS_WORKER;
	process.env.SPINE_WORKER_STUB = "1";
	process.env.SPINE_WORKER_STUB_FAIL_TASKS = TASK_FAIL;
	delete process.env.SPINE_IS_WORKER;

	try {
		setMaxParallel(projectRoot, 2);
		writeSequenceTask(projectRoot, TASK_OK, "wave0-ok", "src/seq-ok.txt");
		writeSequenceTask(projectRoot, TASK_FAIL, "wave0-fail", "src/seq-fail.txt");
		writeSequenceTask(projectRoot, TASK_MID, "wave1", "src/seq-w1.txt", [TASK_OK]);
		writeSequenceTask(projectRoot, TASK_W2, "wave2", "src/seq-w2.txt", [TASK_FAIL, TASK_MID]);
		writeDependencies(projectRoot);
		execCommit(projectRoot, "merge-blocked sequence tasks");

		const config = loadSpineConfig(projectRoot);
		const tasksRoot = resolveTasksRoot(projectRoot, config);
		const plan = buildPlan({
			scope: "pending",
			config,
			tasksRoot,
		});
		assert.deepEqual(
			plan.waves.map((wave) => [...(wave.taskIds ?? [])].sort()),
			[[TASK_OK, TASK_FAIL].sort(), [TASK_MID], [TASK_W2]],
		);

		const result = await runSequence({
			projectRoot,
			plan,
			attached: true,
			autoApproveGate: true,
			skipPreflight: true,
		});

		assert.equal(result.mergeBlocked, true, result.output ?? result.error);
		assert.equal(result.exitCode, 1);
		assert.match(result.output ?? "", /§17\.4/);
		assert.match(result.output ?? "", new RegExp(TASK_FAIL));
		assert.match(result.output ?? "", /wave 2 skipped/i);
		assert.ok(
			(result.skippedWaves ?? []).some((entry) => entry.waveIndex === 2),
			`expected wave 2 skip record in ${JSON.stringify(result.skippedWaves)}`,
		);
		assert.ok(
			(result.completedWaves ?? []).some((entry) => entry.waveIndex === 1),
			`expected wave 1 completion in ${JSON.stringify(result.completedWaves)}`,
		);
		assert.equal(loadSpineBatchState(projectRoot).raw, null);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		if (prevFail === undefined) delete process.env.SPINE_WORKER_STUB_FAIL_TASKS;
		else process.env.SPINE_WORKER_STUB_FAIL_TASKS = prevFail;
		if (prevWorker === undefined) delete process.env.SPINE_IS_WORKER;
		else process.env.SPINE_IS_WORKER = prevWorker;
		await destroyGitRepo(projectRoot);
	}
});
