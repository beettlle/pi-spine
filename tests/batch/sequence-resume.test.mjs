/**
 * SP-389 — sequence state persistence and resume (GitHub #54 Tier 2 SP-D).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import {
	loadSequenceState,
	resolveResumeFromWave,
} from "../../src/batch/sequence-state.mjs";
import { runSequence } from "../../src/batch/sequence.mjs";
import { startBatch } from "../../src/batch/engine.mjs";
import { buildPlan } from "../../src/planner/index.mjs";
import { loadSpineBatchState } from "../../src/batch/state.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TASK_W0 = "SP-701";
const TASK_W1 = "SP-702";

/**
 * @param {string} projectRoot
 * @param {string} taskId
 * @param {string} slug
 * @param {string[]} deps
 */
function writeSequenceTask(projectRoot, taskId, slug, deps = []) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-${slug}`);
	fs.mkdirSync(folder, { recursive: true });
	const depLines = deps.length ? deps.map((dep) => `- **${dep}**`).join("\n") : "- **None**";
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		minimalValidPromptMarkdown(taskId, {
			title: slug,
			fileScope: `src/${slug}.txt`,
			mission: `Sequence resume fixture ${slug}.`,
		}).replace("## Dependencies\n- **None**", `## Dependencies\n${depLines}`),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
function writeSequenceDependencies(projectRoot) {
	fs.writeFileSync(
		path.join(projectRoot, "spine-tasks", "dependencies.json"),
		JSON.stringify(
			{
				version: 1,
				tasks: {
					[TASK_W0]: [],
					[TASK_W1]: [TASK_W0],
				},
			},
			null,
			2,
		),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 */
async function buildPendingPlan(projectRoot) {
	const config = loadSpineConfig(projectRoot);
	const tasksRoot = resolveTasksRoot(projectRoot, config);
	return buildPlan({ scope: "pending", config, tasksRoot });
}

test("resolveResumeFromWave continues after last completed wave", () => {
	assert.equal(resolveResumeFromWave({ fromWave: 0, completedWaves: [] }), 0);
	assert.equal(
		resolveResumeFromWave({
			fromWave: 0,
			completedWaves: [{ waveIndex: 0, batchId: "20260101T000000", diagnosis: "completed" }],
		}),
		1,
	);
	assert.equal(
		resolveResumeFromWave({
			fromWave: 0,
			completedWaves: [
				{ waveIndex: 0, batchId: "a", diagnosis: null },
				{ waveIndex: 1, batchId: "b", diagnosis: null },
			],
		}),
		2,
	);
});

test("sequence persists fromWave, completedWaves, and lastBatchId after wave 0", async () => {
	const projectRoot = await initGitRepo("spine-sequence-state-persist-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSequenceTask(projectRoot, TASK_W0, "resume-w0");
		writeSequenceTask(projectRoot, TASK_W1, "resume-w1", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence resume tasks"], { cwd: projectRoot, stdio: "ignore" });

		const plan = await buildPendingPlan(projectRoot);
		const partial = await runSequence({
			projectRoot,
			plan,
			scope: "pending",
			throughWave: 0,
			attached: true,
			autoApproveGate: true,
			skipPreflight: true,
		});

		assert.equal(partial.ok, true, partial.output ?? partial.error);
		assert.equal(partial.completedWaves?.length, 1);
		assert.equal(partial.completedWaves?.[0]?.waveIndex, 0);
		assert.ok(partial.completedWaves?.[0]?.batchId);

		const saved = loadSequenceState(projectRoot);
		assert.equal(saved.ok, true);
		assert.equal(saved.state.fromWave, 0);
		assert.equal(saved.state.completedWaves.length, 1);
		assert.equal(saved.state.lastBatchId, partial.completedWaves?.[0]?.batchId);
		assert.equal(saved.state.scope, "pending");
		assert.equal(saved.state.status, "active");
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("resume after interrupted wave 0 integrate completes remaining waves", async () => {
	const projectRoot = await initGitRepo("spine-sequence-resume-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSequenceTask(projectRoot, TASK_W0, "resume-w0");
		writeSequenceTask(projectRoot, TASK_W1, "resume-w1", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence resume tasks"], { cwd: projectRoot, stdio: "ignore" });

		const plan = await buildPendingPlan(projectRoot);

		const partial = await runSequence({
			projectRoot,
			plan,
			scope: "pending",
			throughWave: 0,
			attached: true,
			autoApproveGate: true,
			skipPreflight: true,
		});
		assert.equal(partial.ok, true, partial.output ?? partial.error);

		const interrupted = loadSequenceState(projectRoot);
		assert.equal(interrupted.ok, true);
		assert.equal(interrupted.state.completedWaves.length, 1);
		assert.equal(interrupted.state.completedWaves[0]?.waveIndex, 0);
		assert.equal(interrupted.state.lastBatchId, partial.completedWaves?.[0]?.batchId);

		const resumed = await runSequence({
			projectRoot,
			plan,
			scope: "pending",
			resume: true,
			attached: true,
			autoApproveGate: true,
			skipPreflight: true,
		});

		assert.equal(resumed.ok, true, resumed.output ?? resumed.error);
		assert.equal(resumed.resumed, true);
		assert.equal(resumed.completedWaves?.length, 2);
		assert.equal(resumed.completedWaves?.[0]?.waveIndex, 0);
		assert.equal(resumed.completedWaves?.[1]?.waveIndex, 1);
		assert.equal(loadSequenceState(projectRoot).ok, false);
		assert.equal(loadSpineBatchState(projectRoot).raw, null);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});

test("sequence halts on wave failure with --stop-on-failure and preserves completed waves", async () => {
	const projectRoot = await initGitRepo("spine-sequence-halt-");
	const prevStub = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";

	try {
		writeSequenceTask(projectRoot, TASK_W0, "halt-w0");
		writeSequenceTask(projectRoot, TASK_W1, "halt-w1", [TASK_W0]);
		writeSequenceDependencies(projectRoot);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "sequence halt tasks"], { cwd: projectRoot, stdio: "ignore" });

		const plan = await buildPendingPlan(projectRoot);
		let waveStarts = 0;

		const failingStartBatch = async (params) => {
			waveStarts += 1;
			if (waveStarts === 2) {
				return {
					ok: false,
					error: "batch_start_failed",
					output: "Simulated wave 1 batch start failure.\n",
				};
			}
			return startBatch({ ...params, skipPreflight: true });
		};

		const result = await runSequence({
			projectRoot,
			plan,
			scope: "pending",
			attached: true,
			autoApproveGate: true,
			stopOnFailure: true,
			skipPreflight: true,
			startBatchFn: failingStartBatch,
		});

		assert.equal(result.ok, false);
		assert.equal(result.halted, true);
		assert.equal(result.waveIndex, 1);
		assert.equal(result.completedWaves?.length, 1);
		assert.equal(result.completedWaves?.[0]?.waveIndex, 0);

		const saved = loadSequenceState(projectRoot);
		assert.equal(saved.ok, true);
		assert.equal(saved.state.status, "halted");
		assert.equal(saved.state.completedWaves.length, 1);
		assert.equal(saved.state.lastBatchId, result.completedWaves?.[0]?.batchId);
	} finally {
		if (prevStub === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prevStub;
		await destroyGitRepo(projectRoot);
	}
});
