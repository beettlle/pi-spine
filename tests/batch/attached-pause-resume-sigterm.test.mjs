/**
 * SP-513 — pause → SIGTERM → resume must not surface engine_orphaned (#184).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	enforceAttachedEngineSingleOwner,
	reconcilePausedResumeDoneInLane,
} from "../../src/batch/attached-runner.mjs";
import { appendJournalEvent, readJournalEvents } from "../../src/batch/journal.mjs";
import {
	detectOrphanRunning,
	journalEventsSinceResume,
	journalHasContractVerified,
	journalIndicatesPausedForceResume,
	shouldSuppressPausedResumeEngineOrphan,
} from "../../src/batch/orphan-detect.mjs";
import { reconcileBatch } from "../../src/batch/reconcile.mjs";
import {
	createInitialBatchState,
	loadSpineBatchState,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "../../src/batch/state.mjs";
import { classifyTaskDoneSemantics } from "../../src/batch/diagnosis-task-done.mjs";
import { resolveTasksRoot } from "../../src/config/spine-preflight-lib.mjs";
import { loadSpineConfig } from "../../src/config/spine-config-load.mjs";
import { laneTaskBranch, laneWorktreePath, provisionLaneWorktree } from "../../src/batch/worktree.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const DEAD_PID = 999_999_999;
const BATCH_ID = "20260706T052912";
const TASK_ID = "SP-513";

/**
 * @param {string} projectRoot
 * @param {string} laneWorktree
 */
function writeDoneInLane(projectRoot, laneWorktree) {
	const taskFolderRel = `spine-tasks/${TASK_ID}-pause-resume-sigterm`;
	const hostFolder = path.join(projectRoot, taskFolderRel);
	fs.mkdirSync(hostFolder, { recursive: true });
	fs.writeFileSync(path.join(hostFolder, "PROMPT.md"), `# ${TASK_ID}\n`, "utf-8");

	const laneFolder = path.join(laneWorktree, taskFolderRel);
	fs.mkdirSync(laneFolder, { recursive: true });
	fs.writeFileSync(path.join(laneFolder, ".DONE"), "", "utf-8");
	execFileSync("git", ["add", `${taskFolderRel}/.DONE`], { cwd: laneWorktree, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "worker: .DONE"], { cwd: laneWorktree, stdio: "ignore" });
	return taskFolderRel;
}

/**
 * @param {string} projectRoot
 * @param {object} [options]
 */
function seedPausedResumeSigtermScenario(projectRoot, { enginePid = DEAD_PID, phase = "running" } = {}) {
	const taskFolderRel = writeDoneInLane(
		projectRoot,
		laneWorktreePath(projectRoot, BATCH_ID, 1),
	);
	const state = createInitialBatchState({
		batchId: BATCH_ID,
		baseBranch: "main",
		orchBranch: `orch/spine-${BATCH_ID}`,
		wavePlan: [[TASK_ID]],
		tasks: [
			{
				taskId: TASK_ID,
				laneNumber: 1,
				status: "running",
				taskFolder: taskFolderRel,
				startedAt: Date.now() - 120_000,
				endedAt: null,
				doneFileFound: false,
				exitReason: null,
			},
		],
		lanes: [
			{
				laneNumber: 1,
				laneId: "lane-1",
				worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
				branch: laneTaskBranch(BATCH_ID, 1),
				taskIds: [TASK_ID],
			},
		],
	});
	state.phase = phase;
	recordBatchEnginePid(state, enginePid);
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, BATCH_ID, "lane.completed", {
		taskId: TASK_ID,
		laneNumber: 1,
		laneId: "lane-1",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.paused", {
		fromPhase: "running",
		toPhase: "paused",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "engine.orphan_terminated", {
		stalePid: enginePid,
		fromPhase: "paused",
		signal: "SIGTERM",
	});
	appendJournalEvent(projectRoot, BATCH_ID, "batch.resumed", {
		fromPhase: "paused",
		toPhase: "running",
		resumeForced: true,
	});
	appendJournalEvent(projectRoot, BATCH_ID, "contract.verified", {
		taskId: TASK_ID,
		ok: true,
		resumed: true,
	});
}

test("journalIndicatesPausedForceResume matches paused force resume journal", () => {
	const events = [
		{ type: "batch.paused", payload: { fromPhase: "running", toPhase: "paused" } },
		{ type: "engine.orphan_terminated", payload: { fromPhase: "paused", signal: "SIGTERM" } },
		{ type: "batch.resumed", payload: { fromPhase: "paused", toPhase: "running", resumeForced: true } },
	];
	assert.equal(journalIndicatesPausedForceResume(events), true);
	assert.equal(journalHasContractVerified(events, TASK_ID), false);

	const withContract = [
		...events,
		{ type: "contract.verified", taskId: TASK_ID, payload: { ok: true } },
	];
	assert.equal(journalHasContractVerified(withContract, TASK_ID), true);
});

test("detectOrphanRunning suppresses engine_orphaned after paused force resume with doneInLane + contract", async () => {
	const projectRoot = await initGitRepo("spine-pause-resume-sigterm-detect-");
	try {
		execFileSync("git", ["branch", `orch/spine-${BATCH_ID}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch: `orch/spine-${BATCH_ID}` });
		seedPausedResumeSigtermScenario(projectRoot);

		const loaded = loadSpineBatchState(projectRoot);
		const configResult = loadSpineConfig(projectRoot);
		const tasksRoot = resolveTasksRoot(projectRoot, configResult);
		const classified = (loaded.raw?.tasks ?? []).map((task) =>
			classifyTaskDoneSemantics(task, {
				tasksRoot,
				projectRoot,
				batchId: BATCH_ID,
				lanes: loaded.raw?.lanes ?? [],
			}),
		);
		const journalEvents = journalEventsSinceResume(readJournalEvents(projectRoot, BATCH_ID), loaded.raw);

		assert.equal(
			shouldSuppressPausedResumeEngineOrphan(
				{ raw: loaded.raw, tasks: classified },
				journalEvents,
			),
			true,
		);

		const orphan = detectOrphanRunning({
			phase: "running",
			hasRunningTasks: true,
			tasks: classified,
			lanes: loaded.raw?.lanes ?? [],
			raw: loaded.raw,
			journalEvents,
		});
		assert.equal(orphan, null);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reconcilePausedResumeDoneInLane promotes running cache task with lane .DONE", async () => {
	const projectRoot = await initGitRepo("spine-pause-resume-sigterm-reconcile-");
	try {
		execFileSync("git", ["branch", `orch/spine-${BATCH_ID}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch: `orch/spine-${BATCH_ID}` });
		seedPausedResumeSigtermScenario(projectRoot);

		const before = loadSpineBatchState(projectRoot).raw;
		const result = reconcilePausedResumeDoneInLane({
			projectRoot,
			state: before,
			batchId: BATCH_ID,
		});
		assert.equal(result.reconciled, true);
		assert.deepEqual(result.taskIds, [TASK_ID]);

		const after = loadSpineBatchState(projectRoot).raw;
		const task = after?.tasks?.find((entry) => entry.taskId === TASK_ID);
		assert.equal(task?.status, "succeeded");
		assert.equal(task?.doneFileFound, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("pause → SIGTERM → resume cycle does not produce engine_orphaned in reconcile", async () => {
	const projectRoot = await initGitRepo("spine-pause-resume-sigterm-e2e-");
	try {
		execFileSync("git", ["branch", `orch/spine-${BATCH_ID}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch: `orch/spine-${BATCH_ID}` });
		seedPausedResumeSigtermScenario(projectRoot);

		const loaded = loadSpineBatchState(projectRoot);
		reconcilePausedResumeDoneInLane({
			projectRoot,
			state: loaded.raw,
			batchId: BATCH_ID,
		});

		const result = reconcileBatch({ projectRoot, verbose: true });
		assert.notEqual(result.diagnosis, "engine_orphaned", result.headline ?? result.diagnosis);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("enforceAttachedEngineSingleOwner force handoff from paused records orphan without engine_orphaned drift", async () => {
	const projectRoot = await initGitRepo("spine-pause-resume-sigterm-handoff-");
	const staleEngine = await import("node:child_process").then(({ spawn }) =>
		spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]),
	);
	try {
		execFileSync("git", ["branch", `orch/spine-${BATCH_ID}`, "main"], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		provisionLaneWorktree({ projectRoot, batchId: BATCH_ID, laneNumber: 1, orchBranch: `orch/spine-${BATCH_ID}` });

		const taskFolderRel = writeDoneInLane(
			projectRoot,
			laneWorktreePath(projectRoot, BATCH_ID, 1),
		);
		const state = createInitialBatchState({
			batchId: BATCH_ID,
			baseBranch: "main",
			orchBranch: `orch/spine-${BATCH_ID}`,
			wavePlan: [[TASK_ID]],
			tasks: [
				{
					taskId: TASK_ID,
					laneNumber: 1,
					status: "running",
					taskFolder: taskFolderRel,
					startedAt: Date.now(),
				},
			],
			lanes: [
				{
					laneNumber: 1,
					laneId: "lane-1",
					worktreePath: laneWorktreePath(projectRoot, BATCH_ID, 1),
					branch: laneTaskBranch(BATCH_ID, 1),
					taskIds: [TASK_ID],
				},
			],
		});
		state.phase = "paused";
		recordBatchEnginePid(state, staleEngine.pid);
		saveSpineBatchState(projectRoot, state);

		appendJournalEvent(projectRoot, BATCH_ID, "batch.paused", {
			fromPhase: "running",
			toPhase: "paused",
		});
		appendJournalEvent(projectRoot, BATCH_ID, "contract.verified", {
			taskId: TASK_ID,
			ok: true,
		});

		const lock = enforceAttachedEngineSingleOwner({ projectRoot, force: true, operation: "resume" });
		assert.equal(lock.ok, true);
		assert.equal(lock.terminated, true);

		const events = readJournalEvents(projectRoot, BATCH_ID);
		assert.ok(events.some((event) => event.type === "engine.orphan_terminated"));

		appendJournalEvent(projectRoot, BATCH_ID, "batch.resumed", {
			fromPhase: "paused",
			toPhase: "running",
			resumeForced: true,
		});

		const loaded = loadSpineBatchState(projectRoot);
		const reconcile = reconcilePausedResumeDoneInLane({
			projectRoot,
			state: loaded.raw,
			batchId: BATCH_ID,
		});
		assert.equal(reconcile.reconciled, true);

		const diagnosis = reconcileBatch({ projectRoot });
		assert.notEqual(diagnosis.diagnosis, "engine_orphaned");
	} finally {
		try {
			staleEngine.kill("SIGKILL");
		} catch {
			/* ignore */
		}
		await destroyGitRepo(projectRoot);
	}
});
