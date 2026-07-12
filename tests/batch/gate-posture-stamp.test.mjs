import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	DEFAULT_INTEGRATE_GATE_CATEGORY,
	gateRecordPath,
	loadGateRecord,
	openIntegrateGate,
	resolveIntegrateGateCategory,
} from "../../src/batch/gate.mjs";
import { POSTURES } from "../../src/batch/gate-posture-defaults.mjs";
import { resolveGatePostureConfig } from "../../src/config/gate-posture-config.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function completedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "TP-012", status: "succeeded", taskFolder: "TP-012", doneFileFound: true }],
	};
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

test("resolveIntegrateGateCategory defaults to execute", () => {
	assert.equal(DEFAULT_INTEGRATE_GATE_CATEGORY, "execute");
	assert.equal(resolveIntegrateGateCategory(null), "execute");
	assert.equal(resolveIntegrateGateCategory({}), "execute");
	assert.equal(resolveIntegrateGateCategory({ gates: {} }), "execute");
	assert.equal(resolveIntegrateGateCategory({ gates: { integrateCategory: "not-a-category" } }), "execute");
});

test("resolveIntegrateGateCategory accepts valid gates.integrateCategory", () => {
	assert.equal(resolveIntegrateGateCategory({ gates: { integrateCategory: "write" } }), "write");
	assert.equal(resolveIntegrateGateCategory({ gates: { integrateCategory: "read" } }), "read");
});

test("openIntegrateGate stamps category and stays pending (no auto-approve)", async () => {
	const projectRoot = await initGitRepo("spine-gate-stamp-");
	const batchId = "20260712T120000";
	const orchBranch = "orch/spine-gate-stamp";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);

		const opened = openIntegrateGate({
			projectRoot,
			batchId,
			batchState: fixture,
			config: null,
		});

		assert.equal(opened.opened, true);
		assert.equal(opened.gate.category, DEFAULT_INTEGRATE_GATE_CATEGORY);
		assert.equal(opened.gate.status, "pending");
		assert.equal(opened.gate.decidedBy, undefined);
		assert.equal(opened.gate.decidedAt, undefined);

		const persisted = loadGateRecord(projectRoot, batchId);
		assert.ok(persisted);
		assert.equal(persisted.category, "execute");
		assert.equal(persisted.status, "pending");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));

		// Integrate remains manual until SP-632 config opt-in — stamp must not approve.
		assert.notEqual(opened.gate.status, "approved");
		assert.equal(opened.gate.kind, "integrate");
		const posture = resolveGatePostureConfig(null);
		assert.ok(posture.categories[opened.gate.category]);
		assert.equal(typeof posture.categories.execute.posture, "string");
		assert.ok(Object.values(POSTURES).includes(posture.categories.execute.posture));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("openIntegrateGate honors gates.integrateCategory override", async () => {
	const projectRoot = await initGitRepo("spine-gate-stamp-cat-");
	const batchId = "20260712T120001";
	const orchBranch = "orch/spine-gate-stamp-cat";
	try {
		createOrchWithWork(projectRoot, orchBranch);
		const fixture = completedFixture(batchId, orchBranch);
		const config = {
			gates: {
				integrateCategory: "write",
				requireBeforeIntegrate: true,
			},
		};

		const opened = openIntegrateGate({
			projectRoot,
			batchId,
			batchState: fixture,
			config,
		});

		assert.equal(opened.gate.category, "write");
		assert.equal(opened.gate.status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
