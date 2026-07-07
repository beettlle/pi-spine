/**
 * SP-456 — reconcileBatch light mode (GitHub #98 P1).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	clearLightReconcileCache,
	reconcileBatch,
} from "../../src/batch/reconcile.mjs";
import { waitForSequenceBatchTerminal } from "../../src/batch/sequence.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

test.beforeEach(() => {
	clearLightReconcileCache();
});

test("light reconcile matches full reconcile when batch phase is stable", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-light-parity-");
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const full = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(full.signals?.reconcileMode, "full");

		const light = reconcileBatch({ projectRoot, light: true, verbose: true });
		assert.equal(light.signals?.reconcileMode, "light");
		assert.equal(light.diagnosis, full.diagnosis);
		assert.equal(light.phase, full.phase);
		assert.equal(light.macroPhase, full.macroPhase);
		assert.equal(light.headline, full.headline);
		assert.equal(light.suggestedCommand, full.suggestedCommand);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("light reconcile skips git inspection when phase unchanged", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-light-skip-");
	const previous = process.env.SPINE_TEST_GIT_INSPECTION_THROW;
	delete process.env.SPINE_TEST_GIT_INSPECTION_THROW;
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const full = reconcileBatch({ projectRoot });
		assert.notEqual(full.diagnosis, "git_unavailable");

		process.env.SPINE_TEST_GIT_INSPECTION_THROW = "branch_merged_scan";
		const light = reconcileBatch({ projectRoot, light: true, verbose: true });
		assert.equal(light.signals?.reconcileMode, "light");
		assert.equal(light.diagnosis, full.diagnosis);
		assert.notEqual(light.diagnosis, "git_unavailable");
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_TEST_GIT_INSPECTION_THROW;
		} else {
			process.env.SPINE_TEST_GIT_INSPECTION_THROW = previous;
		}
		await destroyGitRepo(projectRoot);
	}
});

test("phase change forces full reconcile even with light flag", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-light-phase-");
	const previous = process.env.SPINE_TEST_GIT_INSPECTION_THROW;
	process.env.SPINE_TEST_GIT_INSPECTION_THROW = "branch_merged_scan";
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		reconcileBatch({ projectRoot });

		fixture.phase = "merging";
		writePiBatchState(projectRoot, fixture);

		const light = reconcileBatch({ projectRoot, light: true, verbose: true });
		assert.equal(light.signals?.reconcileMode, "full");
		assert.equal(light.diagnosis, "git_unavailable");
	} finally {
		if (previous === undefined) {
			delete process.env.SPINE_TEST_GIT_INSPECTION_THROW;
		} else {
			process.env.SPINE_TEST_GIT_INSPECTION_THROW = previous;
		}
		await destroyGitRepo(projectRoot);
	}
});

test("diagnosis transition falls back to full reconcile", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-light-transition-");
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const full = reconcileBatch({ projectRoot, verbose: true });
		assert.equal(full.diagnosis, "running");

		fixture.tasks = fixture.tasks.map((task) =>
			task.taskId === "TP-002"
				? { ...task, status: "failed", exitReason: "contract_failed" }
				: task,
		);
		fixture.segments = fixture.segments.map((segment) =>
			segment.taskId === "TP-002" ? { ...segment, status: "failed" } : segment,
		);
		fixture.failedTasks = 1;
		fixture.phase = "running";
		writePiBatchState(projectRoot, fixture);

		const light = reconcileBatch({ projectRoot, light: true, verbose: true });
		assert.equal(light.signals?.reconcileMode, "full");
		assert.equal(light.diagnosis, "needs_retry");
		assert.notEqual(light.diagnosis, full.diagnosis);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("waitForSequenceBatchTerminal uses light reconcile after first poll", async () => {
	const projectRoot = await initGitRepo("spine-reconcile-light-sequence-");
	/** @type {boolean[]} */
	const lightFlags = [];
	try {
		const fixture = loadFixture("running-batch.json");
		writePiBatchState(projectRoot, fixture);

		const wait = await waitForSequenceBatchTerminal({
			projectRoot,
			pollIntervalMs: 1,
			timeoutMs: 50,
			reconcileFn: (ctx) => {
				lightFlags.push(ctx.light === true);
				if (lightFlags.length >= 2) {
					return { diagnosis: "completed", batchId: fixture.batchId };
				}
				return { diagnosis: "running", batchId: fixture.batchId };
			},
		});

		assert.equal(wait.ok, true);
		assert.equal(wait.diagnosis, "completed");
		assert.deepEqual(lightFlags, [false, true]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
