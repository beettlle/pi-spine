import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { waitForDetachedBatchResume } from "../../src/batch/detached-start.mjs";
import { gateRecordPath, saveGateRecord } from "../../src/batch/gate.mjs";
import { saveSpineBatchState } from "../../src/batch/state.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function completedBatchState(batchId, updatedAt) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch: `orch/spine-${batchId}`,
		updatedAt,
		startedAt: updatedAt - 60_000,
		endedAt: updatedAt,
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		tasks: [{ taskId: "SP-193", status: "succeeded", doneFileFound: true }],
		mergeResults: [{ waveIndex: 0, status: "succeeded", mergeCommit: "abc1234" }],
	};
}

test("waitForDetachedBatchResume waits for integrate gate after batch completes", async () => {
	const projectRoot = await initGitRepo("spine-detached-resume-gate-");
	try {
		const batchId = "20260611T225006";
		const updatedAtBefore = Date.now() - 5_000;
		const updatedAtAfter = Date.now();

		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			`${JSON.stringify(
				{
					version: 1,
					gates: { requireBeforeIntegrate: true },
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);

		saveSpineBatchState(projectRoot, completedBatchState(batchId, updatedAtAfter));

		const waitPromise = waitForDetachedBatchResume({
			projectRoot,
			batchId,
			updatedAtBefore,
			taskId: "SP-193",
			timeoutMs: 5_000,
			waitTerminal: true,
		});

		await new Promise((resolve) => setTimeout(resolve, 300));
		saveGateRecord(projectRoot, {
			gateId: "gate-test",
			batchId,
			kind: "integrate",
			status: "pending",
			openedAt: new Date().toISOString(),
			evidenceRefs: [],
		});

		const wait = await waitPromise;
		assert.equal(wait.ok, true, wait.error);
		assert.equal(wait.status, "resume_completed");
		assert.ok(fs.existsSync(gateRecordPath(projectRoot, batchId)));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("waitForDetachedBatchResume completes without gate when integrate gate not required", async () => {
	const projectRoot = await initGitRepo("spine-detached-resume-no-gate-");
	try {
		const batchId = "20260611T225007";
		const updatedAtBefore = Date.now() - 5_000;
		const updatedAtAfter = Date.now();

		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			`${JSON.stringify(
				{
					version: 1,
					gates: { requireBeforeIntegrate: false },
				},
				null,
				2,
			)}\n`,
			"utf-8",
		);

		saveSpineBatchState(projectRoot, completedBatchState(batchId, updatedAtAfter));

		const wait = await waitForDetachedBatchResume({
			projectRoot,
			batchId,
			updatedAtBefore,
			taskId: "SP-193",
			timeoutMs: 2_000,
			waitTerminal: true,
		});

		assert.equal(wait.ok, true, wait.error);
		assert.equal(wait.status, "resume_completed");
		assert.equal(fs.existsSync(gateRecordPath(projectRoot, batchId)), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
