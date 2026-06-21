import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import { saveGateRecord } from "../../src/batch/gate.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordTaskTransition,
	resetTaskForRetry,
	saveSpineBatchState,
	spineBatchStatePath,
} from "../../src/batch/state.mjs";
import { gateRecordPath } from "../../src/batch/gate.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

test("recordTaskTransition writes batch-state then journal in order", async () => {
	const projectRoot = await initGitRepo("spine-state-transition-");
	try {
		const state = createInitialBatchState({
			batchId: "20260611T120000",
			baseBranch: "main",
			orchBranch: "orch/spine-test",
			wavePlan: [["SP-1"]],
			tasks: [{ taskId: "SP-1", laneNumber: 1, status: "failed", taskFolder: "spine-tasks/SP-1" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-1"] }],
		});
		state.phase = "failed";
		resetTaskForRetry(state, "SP-1");
		recordTaskTransition({
			projectRoot,
			state,
			journalType: "task.retry_requested",
			journalPayload: { taskId: "SP-1", previousClassification: "failed", pendingSegments: 1 },
		});
		const loaded = loadSpineBatchState(projectRoot);
		assert.equal(loaded.raw?.tasks?.[0]?.status, "pending");
		const events = readJournalEvents(projectRoot, "20260611T120000");
		assert.ok(events.some((event) => event.type === "task.retry_requested"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("saveSpineBatchState leaves prior JSON intact when atomic write fails", async () => {
	const projectRoot = await initGitRepo("spine-state-atomic-fail-");
	try {
		const state = createInitialBatchState({
			batchId: "20260620T010000",
			baseBranch: "main",
			orchBranch: "orch/spine-test",
			wavePlan: [["SP-1"]],
			tasks: [{ taskId: "SP-1", laneNumber: 1, status: "running", taskFolder: "spine-tasks/SP-1" }],
			lanes: [{ laneNumber: 1, laneId: "lane-1", worktreePath: ".worktrees/x/lane-1", branch: "b", taskIds: ["SP-1"] }],
		});
		saveSpineBatchState(projectRoot, state);
		const filePath = spineBatchStatePath(projectRoot);
		const before = fs.readFileSync(filePath, "utf-8");
		assert.doesNotThrow(() => JSON.parse(before));

		const originalWrite = fs.writeFileSync;
		fs.writeFileSync = (filePathArg, ...args) => {
			if (String(filePathArg).includes(".tmp")) {
				throw new Error("simulated interrupted batch-state write");
			}
			return originalWrite(filePathArg, ...args);
		};

		try {
			assert.throws(
				() => saveSpineBatchState(projectRoot, { ...state, phase: "paused" }),
				/simulated interrupted batch-state write/,
			);
		} finally {
			fs.writeFileSync = originalWrite;
		}

		const after = fs.readFileSync(filePath, "utf-8");
		assert.equal(after, before);
		assert.doesNotThrow(() => JSON.parse(after));
		const leftovers = fs
			.readdirSync(path.dirname(filePath), { recursive: true })
			.map(String)
			.filter((name) => name.includes(".tmp"));
		assert.equal(leftovers.length, 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("saveGateRecord leaves prior JSON intact when atomic write fails", async () => {
	const projectRoot = await initGitRepo("spine-gate-atomic-fail-");
	const batchId = "20260620T020000";
	try {
		const gate = {
			gateId: "gate-1",
			batchId,
			kind: "integrate",
			status: "pending",
			openedAt: new Date().toISOString(),
			evidenceRefs: [],
		};
		saveGateRecord(projectRoot, gate);
		const filePath = gateRecordPath(projectRoot, batchId);
		const before = fs.readFileSync(filePath, "utf-8");
		assert.doesNotThrow(() => JSON.parse(before));

		const originalWrite = fs.writeFileSync;
		fs.writeFileSync = (filePathArg, ...args) => {
			if (String(filePathArg).includes(".tmp")) {
				throw new Error("simulated interrupted gate write");
			}
			return originalWrite(filePathArg, ...args);
		};

		try {
			assert.throws(
				() => saveGateRecord(projectRoot, { ...gate, status: "approved" }),
				/simulated interrupted gate write/,
			);
		} finally {
			fs.writeFileSync = originalWrite;
		}

		const after = fs.readFileSync(filePath, "utf-8");
		assert.equal(after, before);
		assert.doesNotThrow(() => JSON.parse(after));
		const leftovers = fs
			.readdirSync(path.dirname(filePath), { recursive: true })
			.map(String)
			.filter((name) => name.includes(".tmp"));
		assert.equal(leftovers.length, 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
