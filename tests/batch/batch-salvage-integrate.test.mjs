/**
 * SP-571 — operator salvage integrate after batch abort (#158).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { runSpineBatch } from "../../bin/spine-batch.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { approveIntegrateGate, loadGateRecord, openIntegrateGate } from "../../src/batch/gate.mjs";
import { archiveBatchStatePath } from "../../src/batch/lifecycle.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	formatSalvageIntegrateOutput,
	integrateSalvageableLane,
} from "../../src/batch/salvage-batch.mjs";
import { createInitialBatchState } from "../../src/batch/state.mjs";
import { laneTaskBranch } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const BATCH_ID = "20260703T231119";

/**
 * @param {string} projectRoot
 * @param {object} [overrides]
 */
function writeArchivedBatch(projectRoot, overrides = {}) {
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [["SP-470"], ["SP-471"]],
		tasks: [
			{
				taskId: "SP-470",
				laneNumber: 1,
				status: "succeeded",
				taskFolder: "spine-tasks/SP-470-fixture",
				doneFileFound: true,
				exitReason: "done",
			},
			{
				taskId: "SP-471",
				laneNumber: 2,
				status: "failed",
				taskFolder: "spine-tasks/SP-471-fixture",
				doneFileFound: false,
				exitReason: "contract_failed",
			},
		],
		lanes: [
			{ laneNumber: 1, laneId: "lane-1", taskIds: ["SP-470"] },
			{ laneNumber: 2, laneId: "lane-2", taskIds: ["SP-471"] },
		],
	});
	state.phase = "aborted";
	state.endedAt = Date.now();
	Object.assign(state, overrides);

	const archivePath = archiveBatchStatePath(projectRoot, BATCH_ID);
	fs.mkdirSync(path.dirname(archivePath), { recursive: true });
	fs.writeFileSync(archivePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
	return state;
}

/**
 * @param {string} projectRoot
 */
function seedSalvageJournal(projectRoot) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-470", laneNumber: 1 });
	appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
		taskId: "SP-470",
		laneNumber: 1,
		commitSha: "lane1sha",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.completed", {
		taskId: "SP-470",
		doneFileFound: true,
		exitReason: "done",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-471", laneNumber: 2 });
	appendJournalEvent(projectRoot, BATCH_ID, "lane.committed", {
		taskId: "SP-471",
		laneNumber: 2,
		commitSha: "lane2sha",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
		taskId: "SP-471",
		exitReason: "contract_failed",
		classification: "contract_failed",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.aborted", { reason: "operator abort" });
}

/**
 * @param {string} projectRoot
 * @param {number} laneNumber
 * @param {string} fileName
 */
function commitLaneBranchWork(projectRoot, laneNumber, fileName) {
	const branch = laneTaskBranch(BATCH_ID, laneNumber);
	execFileSync("git", ["branch", branch, "main"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", branch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, fileName), `lane ${laneNumber} work\n`, "utf-8");
	execFileSync("git", ["add", fileName], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", `lane ${laneNumber} salvage work`], {
		cwd: projectRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {object} batchState
 */
function approveGateForSalvage(projectRoot, batchState) {
	const config = loadSpineConfig(projectRoot).config;
	openIntegrateGate({ projectRoot, batchId: BATCH_ID, batchState, config });
	approveIntegrateGate({ projectRoot, batchId: BATCH_ID });
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 * @param {string} filePath
 */
function gitRefHasPath(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["show", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

test("integrateSalvageableLane lands salvageable lane commits on main", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-ok-");
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-integrate-ok.txt");
		approveGateForSalvage(projectRoot, batchState);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.equal(result.laneNumber, 1);
		assert.ok(result.mergeCommit);
		assert.ok(gitRefHasPath(projectRoot, "main", "salvage-integrate-ok.txt"));

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "batch.salvage_integrate_started"));
		assert.ok(events.some((event) => event.type === "batch.salvage_integrated"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateSalvageableLane rejects non-salvageable lane", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-lane-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-lane-1.txt");
		commitLaneBranchWork(projectRoot, 2, "salvage-lane-2.txt");

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 2, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "lane_not_salvageable");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateSalvageableLane blocks when integrate gate pending", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-gate-");
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-gate.txt");
		const config = loadSpineConfig(projectRoot).config;
		openIntegrateGate({ projectRoot, batchId: BATCH_ID, batchState, config });

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 2);
		assert.equal(result.failureClass, "GateBlocked");

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "batch.salvage_integrate_failed"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateSalvageableLane requires --yes when stdin is not a TTY", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-confirm-");
	const prevStdinIsTTY = process.stdin.isTTY;
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-confirm.txt");
		approveGateForSalvage(projectRoot, batchState);

		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: false,
		});

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			confirmFn: async () => true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "confirmation_required");
		assert.match(result.suggestedCommand ?? "", /--yes/);
	} finally {
		Object.defineProperty(process.stdin, "isTTY", {
			configurable: true,
			value: prevStdinIsTTY,
		});
		await destroyGitRepo(projectRoot);
	}
});

test("formatSalvageIntegrateOutput renders JSON", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-json-");
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-json.txt");
		approveGateForSalvage(projectRoot, batchState);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		const output = formatSalvageIntegrateOutput(result, { json: true });
		const parsed = JSON.parse(output);
		assert.equal(parsed.ok, true);
		assert.equal(parsed.laneNumber, 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch salvage --integrate --yes lands lane work", async () => {
	const projectRoot = await initGitRepo("salvage-cli-integrate-");
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-cli-integrate.txt");
		approveGateForSalvage(projectRoot, batchState);

		const cli = await runSpineBatch({
			projectRoot,
			args: ["salvage", "--batch", BATCH_ID, "--lane", "1", "--integrate", "--yes"],
		});

		assert.equal(cli.exitCode, 0);
		assert.match(cli.output ?? "", /Salvaged lane 1/i);
		assert.ok(gitRefHasPath(projectRoot, "main", "salvage-cli-integrate.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineBatch salvage integrate without --lane returns usage", async () => {
	const projectRoot = await initGitRepo("salvage-cli-usage-");
	try {
		const cli = await runSpineBatch({
			projectRoot,
			args: ["salvage", "--batch", BATCH_ID, "--integrate"],
		});
		assert.equal(cli.exitCode, 1);
		assert.match(cli.output ?? "", /--lane/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * #196 — journal without lane.committed still integrates when branch is ahead.
 *
 * @param {string} projectRoot
 */
function seedSalvageJournalWithoutLaneCommitted(projectRoot) {
	appendJournalEvent(projectRoot, BATCH_ID, "batch.started", {
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-470", laneNumber: 1 });
	appendJournalEvent(projectRoot, BATCH_ID, "task.completed", {
		taskId: "SP-470",
		doneFileFound: true,
		exitReason: "done",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "task.started", { taskId: "SP-471", laneNumber: 2 });
	appendJournalEvent(projectRoot, BATCH_ID, "task.failed", {
		taskId: "SP-471",
		exitReason: "contract_failed",
		classification: "contract_failed",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.aborted", { reason: "operator abort" });
}

test("integrateSalvageableLane lands commits without journal lane.committed (#196)", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-no-lane-committed-");
	try {
		const batchState = writeArchivedBatch(projectRoot);
		seedSalvageJournalWithoutLaneCommitted(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-196-integrate.txt");
		approveGateForSalvage(projectRoot, batchState);

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, true);
		assert.equal(result.exitCode, 0);
		assert.equal(result.laneNumber, 1);
		assert.notEqual(result.error, "lane_not_salvageable");
		assert.ok(result.mergeCommit);
		assert.ok(gitRefHasPath(projectRoot, "main", "salvage-196-integrate.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("integrateSalvageableLane still rejects contract_failed lane without lane.committed", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-exclude-no-commit-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournalWithoutLaneCommitted(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-ok.txt");
		commitLaneBranchWork(projectRoot, 2, "salvage-excluded.txt");

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 2, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "lane_not_salvageable");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * #274 — batch failed before merge, so no gate record exists. Salvage integrate
 * must open a fresh gate from salvage inspection evidence instead of dead-ending
 * on "no gate record".
 */
test("integrateSalvageableLane opens fresh gate when none exists (#274)", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-open-gate-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-open-gate.txt");
		const mainTipBefore = execFileSync("git", ["rev-parse", "main"], {
			cwd: projectRoot,
			encoding: "utf-8",
		}).trim();

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});

		// Default posture is locked — fail closed pending human approval, but the
		// recovery no longer dead-ends on the missing-gate-record precondition.
		assert.equal(result.ok, false);
		assert.equal(result.failureClass, "GateBlocked");
		assert.notEqual(result.error, "Integrate gate not opened — approve evidence before merging");
		assert.equal(result.gateOpenedBySalvage, true);
		assert.match(result.headline ?? "", /approve/i);

		const gate = loadGateRecord(projectRoot, BATCH_ID);
		assert.ok(gate, "gate record should exist after salvage open");
		assert.equal(gate.status, "pending");
		assert.match(gate.targetRevision ?? "", /^[0-9a-f]{40}$/);
		assert.equal(gate.targetRevision, mainTipBefore, "gate pins the orch/base tip at salvage open");
		assert.ok(gate.evidenceRefs.includes("evidence/salvage-inspect.json"));
		assert.ok(
			fs.existsSync(
				path.join(projectRoot, ".spine", "runtime", BATCH_ID, "evidence", "salvage-inspect.json"),
			),
		);
		const inspect = JSON.parse(
			fs.readFileSync(
				path.join(projectRoot, ".spine", "runtime", BATCH_ID, "evidence", "salvage-inspect.json"),
				"utf-8",
			),
		);
		assert.equal(inspect.laneNumber, 1);
		assert.equal(inspect.commitsAhead, 1);
		assert.deepEqual(inspect.salvageableTasks, ["SP-470"]);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "batch.salvage_gate_opened"));

		// Operator approves → re-run proceeds (full #274 recovery path).
		approveIntegrateGate({ projectRoot, batchId: BATCH_ID });
		const retry = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});
		assert.equal(retry.ok, true);
		assert.ok(retry.mergeCommit);
		assert.ok(gitRefHasPath(projectRoot, "main", "salvage-open-gate.txt"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * #274 — with an explicit auto-approve posture opt-in, salvage integrate proceeds
 * end-to-end in one run (fresh gate opens and is auto-approved by posture).
 */
test("integrateSalvageableLane proceeds when posture auto-approves salvage gate", async () => {
	const projectRoot = await initGitRepo("salvage-integrate-auto-gate-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-auto-gate.txt");
		const configPath = path.join(projectRoot, ".spine", "spine-config.json");
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		config.gates = {
			...(config.gates ?? {}),
			postures: { execute: { posture: "cautious", autoApproveAfterN: 0 } },
		};
		fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 1, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, true);
		assert.equal(result.gateOpenedBySalvage, true);
		assert.ok(gitRefHasPath(projectRoot, "main", "salvage-auto-gate.txt"));

		const gate = loadGateRecord(projectRoot, BATCH_ID);
		assert.equal(gate.status, "approved");
		assert.equal(gate.decidedBy, "auto");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

/**
 * #274 fail-closed guard — non-salvageable lanes must never get a gate opened.
 */
test("integrateSalvageableLane does not open gate for non-salvageable lane", async () => {
	const projectRoot = await initGitRepo("salvage-nogate-nonsalvageable-");
	try {
		writeArchivedBatch(projectRoot);
		seedSalvageJournal(projectRoot);
		commitLaneBranchWork(projectRoot, 1, "salvage-ok-nogate.txt");
		commitLaneBranchWork(projectRoot, 2, "salvage-failed-nogate.txt");

		const result = await integrateSalvageableLane(projectRoot, BATCH_ID, 2, {
			yes: true,
			confirmFn: async () => true,
		});

		assert.equal(result.ok, false);
		assert.equal(result.error, "lane_not_salvageable");
		assert.equal(loadGateRecord(projectRoot, BATCH_ID), null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
