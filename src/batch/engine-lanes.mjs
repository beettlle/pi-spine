// @ts-nocheck
/**
 * Lane task execution facade — re-exports split modules and phase transitions.
 */

import fs from "node:fs";
import path from "node:path";
import {
	loadTaskFileScopePaths,
	recordLaneTaskMetric,
	recordPromptParseFailure,
} from "./engine-lanes/queue.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { commitLaneAndValidateWorktree } from "./engine-lanes/commit.mjs";
import { recordTaskFailureSalvage } from "./salvage.mjs";
import { saveEngineBatchState } from "./pause.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	updateSegmentForTask,
} from "./state.mjs";
import { runWorker } from "./worker-host.mjs";
import { runCodeReviewPhase, runFinalReviewPhase } from "./engine-lanes/review.mjs";
import { ensureLaneSyncedForSharedScopeDeps } from "./engine-lanes/orch-sync.mjs";
import { resolveWorktreeSetupIgnorePaths } from "../config/spine-config-load.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { verifyContract } from "./contract-verify.mjs";
import { gitExec } from "./git-exec.mjs";
import {
	aggregateMatrixOutcomes,
	loadMatrixTaskRows,
	provisionMatrixSubLaneWorktree,
	recordMatrixEvent,
	removeMatrixSubLaneWorktree,
	runConcurrent,
	runShellInDir,
	substituteRowCommand,
} from "./engine-lanes/matrix.mjs";

export {
	buildTasksAndLanesFromPlan,
	loadTaskFileScopePaths,
	skipTaskDoneOnDisk,
} from "./engine-lanes/queue.mjs";

export {
	buildFinalReviewArtifactPath,
	parseFinalReviewVerdict,
	shouldRunCodeReview,
	shouldRunFinalReview,
	runEngineFinalReview,
	runEngineCodeReview,
} from "./engine-lanes/review.mjs";

export {
	mergeLaneToOrch,
	mergeWaveLanesToOrch,
	resolveRulesManifestIntegrateDrift,
	tryAutoResolveMergeConflicts,
	tryAutoResolveRulesManifestMergeConflict,
} from "./engine-lanes/merge.mjs";

export { syncLaneWorktreeFromOrch } from "./worktree.mjs";
export {
	collectSharedScopeSatisfiedDeps,
	ensureLaneSyncedForSharedScopeDeps,
} from "./engine-lanes/orch-sync.mjs";

export {
	aggregateMatrixOutcomes,
	isMatrixSubLaneWorktreeDir,
	loadMatrixTaskRows,
	matrixSubLaneBranch,
	matrixWorktreeDir,
	matrixWorktreePath,
	provisionMatrixSubLaneWorktree,
	removeAllMatrixSubLaneWorktrees,
	removeMatrixSubLaneWorktree,
	runConcurrent,
	runShellInDir,
} from "./engine-lanes/matrix.mjs";

/**
 * @param {string} fromPhase
 * @param {string} toPhase
 */
function phaseTransitionEventType(fromPhase, toPhase) {
	if (fromPhase === "planning" && toPhase === "running") return "batch.started";
	if (toPhase === "completed") return "batch.completed";
	if (toPhase === "failed") return "batch.failed";
	if (toPhase === "aborted") return "batch.aborted";
	return null;
}

/**
 * @param {object} params
 */
function recordPhaseTransition({ projectRoot, batchId, fromPhase, toPhase, extra = {} }) {
	const type = phaseTransitionEventType(fromPhase, toPhase);
	if (!type) return null;
	return appendJournalEvent(projectRoot, batchId, type, {
		fromPhase,
		toPhase,
		...extra,
	});
}

/**
 * @param {object} state
 * @param {string} newPhase
 * @param {object} ctx
 */
export function transitionPhase(state, newPhase, ctx) {
	const fromPhase = state.phase;
	if (fromPhase === newPhase) return;
	state.phase = newPhase;
	recordPhaseTransition({
		projectRoot: ctx.projectRoot,
		batchId: ctx.batchId,
		fromPhase,
		toPhase: newPhase,
		...ctx.extra,
	});
}

export async function runTaskOnLane({
	projectRoot,
	state,
	batchId,
	baseBranch,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const wt = lane.worktreePath;
	const taskBranch = lane.branch;
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const scopeResult = loadTaskFileScopePaths(path.join(projectRoot, taskFolderRel));
	if (!scopeResult.ok) {
		return recordPromptParseFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			scopeResult,
			config,
			taskFolderPath: path.join(projectRoot, taskFolderRel),
		});
	}
	const fileScopePaths = scopeResult.fileScopePaths;

	// Matrix tasks fan out into per-row sub-lane worktrees (SP-671 / #217).
	// Non-matrix tasks fall through to the single-worker path below.
	const matrixRows = loadMatrixTaskRows(path.join(projectRoot, taskFolderRel));
	if (matrixRows) {
		return runMatrixTaskOnLane({
			projectRoot,
			state,
			batchId,
			baseBranch,
			config,
			task,
			lane,
			taskFolderRel,
			laneCorrelationId,
			fileScopePaths,
			matrix: matrixRows,
			maxParallel: config?.lanes?.maxParallel ?? 1,
		});
	}

	const syncResult = ensureLaneSyncedForSharedScopeDeps({
		projectRoot,
		state,
		taskId,
		fileScopePaths,
		worktreePath: wt,
		config,
	});
	if (!syncResult.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "orch_sync_failed";
		if (!task.startedAt) task.startedAt = Date.now();
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveEngineBatchState(projectRoot, state);
		appendJournalEvent(projectRoot, batchId, "lane.orch_sync_failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			error: syncResult.error,
			sharedDeps: syncResult.sharedDeps,
		});
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "orch_sync_failed",
			exitCode: 1,
			output: syncResult.error,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			workerResult: {
				ok: false,
				classification: "orch_sync_failed",
				output: syncResult.error,
				exitCode: 1,
			},
		};
	}
	if (syncResult.synced) {
		appendJournalEvent(projectRoot, batchId, "lane.orch_synced", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			orchBranch: state.orchBranch,
			headSha: syncResult.headSha,
			sharedDeps: syncResult.sharedDeps,
		});
	}

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveEngineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
	});

	const workerResult = await runWorker({
		worktreePath: wt,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		batchId,
		laneNumber,
		taskId,
		laneBranch: taskBranch,
		laneCorrelationId,
		fileScopePaths,
		config,
		onHeartbeat: (timestamp) => {
			lane.lastHeartbeatAt = timestamp;
			saveEngineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveEngineBatchState(projectRoot, state);
			}
		},
	});

	if (!workerResult.ok) {
		const doneOnDisk = fs.existsSync(path.join(taskFolderInWorktree, ".DONE"));
		const orphanSalvage =
			doneOnDisk &&
			(workerResult.doneFound === true || workerResult.classification === "stall_timeout");
		if (orphanSalvage) {
			appendJournalEvent(projectRoot, batchId, "worker.orphan_salvaged", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				classification: workerResult.classification ?? "worker_failed",
				doneOnDisk: true,
			});
			if (lane.workerPid) {
				delete lane.workerPid;
				saveEngineBatchState(projectRoot, state);
			}
		} else {
		const aborted = workerResult.classification === "aborted";
		appendJournalEvent(projectRoot, batchId, "lane.died", {
			laneNumber,
			laneId: lane.laneId,
			taskId,
			correlationId: laneCorrelationId,
			reason: workerResult.classification ?? "worker_failed",
		});
		task.status = aborted ? "aborted" : "failed";
		task.endedAt = Date.now();
		task.exitReason = workerResult.classification ?? "worker_failed";
		updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
		recomputeTaskCounters(state);
		saveEngineBatchState(projectRoot, state);
		if (!aborted) {
			const salvageFields = recordTaskFailureSalvage({
				projectRoot,
				batchId,
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				worktreePath: wt,
				fileScopePaths,
				taskFolder: taskFolderInWorktree,
				workerResult,
				config,
				batchPhase: state.phase,
				taskBranch,
			});
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				...workerResult,
				...salvageFields,
			});
		}
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return { ok: false, aborted, workerResult };
		}
	}

	if (lane.workerPid) {
		delete lane.workerPid;
		saveEngineBatchState(projectRoot, state);
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});

	const codeReview = await runCodeReviewPhase({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
	});
	if (!codeReview.ok) {
		return codeReview;
	}

	const finalReview = await runFinalReviewPhase({
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
		baseBranch,
	});
	if (!finalReview.ok) {
		return finalReview;
	}

	if (process.env.SPINE_TEST_STRIP_DONE_BEFORE_LANE_COMMIT === "1") {
		const donePath = path.join(taskFolderInWorktree, ".DONE");
		if (fs.existsSync(donePath)) {
			fs.unlinkSync(donePath);
		}
	}

	const ignorePatterns = resolveWorktreeSetupIgnorePaths(config);
	const commitResult = commitLaneAndValidateWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		fileScopePaths,
		ignorePatterns,
		task,
		lane,
		laneNumber,
		laneCorrelationId,
		state,
		config,
	});
	if (!commitResult.ok) {
		return {
			ok: false,
			error: commitResult.error,
			output: commitResult.output,
		};
	}
	const { laneCommit } = commitResult;

	recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true });
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.completed",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderInWorktree,
	});

	return { ok: true, laneCommit };
}

/**
 * Read the `## Contract` table from a parent task folder (un-substituted).
 *
 * @param {string} parentTaskFolderAbs
 * @returns {object|null}
 */
function readParentContract(parentTaskFolderAbs) {
	const promptPath = path.join(parentTaskFolderAbs, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return null;
	return parseContract(fs.readFileSync(promptPath, "utf-8"));
}

/**
 * Execute a single matrix row in its own worktree. Substitutes `{matrix.X}`
 * placeholders for execution-only rows; LLM rows delegate to `runWorker`.
 * Commits successful row output to the row branch.
 *
 * @param {object} params
 * @returns {Promise<{ rowId: string, ok: boolean, exitCode: number, output: string, worktreePath?: string, branch?: string, commitSha?: string }>}
 */
async function runMatrixSubLane({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	laneBranch,
	laneCorrelationId,
	row,
	matrixType,
	parentTaskFolderAbs,
	taskFolderRel,
	config,
	baseBranch,
}) {
	const rowId = row.rowId;
	const values = row.values;
	let worktreePath;
	let branch;

	try {
		const provisioned = provisionMatrixSubLaneWorktree({
			projectRoot,
			batchId,
			laneNumber,
			parentTaskId: taskId,
			rowId,
			baseRef: laneBranch,
		});
		worktreePath = provisioned.worktreePath;
		branch = provisioned.branch;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
			taskId,
			laneNumber,
			rowId,
			correlationId: laneCorrelationId,
			error: message,
		});
		return { rowId, ok: false, exitCode: 1, output: `worktree provision failed: ${message}` };
	}

	recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.started", {
		taskId,
		laneNumber,
		rowId,
		correlationId: laneCorrelationId,
		branch,
		worktreePath,
	});

	/** @type {{ rowId: string, ok: boolean, exitCode: number, output: string, worktreePath?: string, branch?: string }} */
	let result;

	if (matrixType === "execute") {
		const contract = readParentContract(parentTaskFolderAbs);
		const rawCommand = contract?.runCommand || contract?.testCommand;
		if (!rawCommand) {
			result = {
				rowId,
				ok: false,
				exitCode: 1,
				output: "No runCommand or testCommand for execute matrix row",
				worktreePath,
				branch,
			};
		} else {
			const command = substituteRowCommand(rawCommand, values);
			const run = await runShellInDir(worktreePath, command);
			if (run.exitCode !== 0) {
				result = {
					rowId,
					ok: false,
					exitCode: run.exitCode,
					output: run.output,
					worktreePath,
					branch,
				};
			} else {
				// Commit row output first so per-row contract verification (which diffs
				// committed files against baseBranch) sees the row's output, then verify.
				let commitError = null;
				try {
					const dirty = gitExec(worktreePath, ["status", "--porcelain"], {
						throwOnError: false,
						projectRoot,
					});
					if (dirty) {
						gitExec(worktreePath, ["add", "-A"], { projectRoot });
						gitExec(
							worktreePath,
							["commit", "-m", `feat(${taskId}[${rowId}]): matrix row`],
							{ projectRoot },
						);
					}
				} catch (err) {
					commitError = err instanceof Error ? err.message : String(err);
				}
				if (commitError) {
					result = {
						rowId,
						ok: false,
						exitCode: 1,
						output: `${run.output}\nmatrix row commit failed: ${commitError}`,
						worktreePath,
						branch,
					};
				} else {
					// Verify the contract per row (testCommand + fileScopeMustChange
					// substituted with this row's values). This is the per-row gate.
					const verify = verifyContract(worktreePath, contract, {
						matrixRow: values,
						baseBranch,
					});
					if (verify.ok) {
						result = {
							rowId,
							ok: true,
							exitCode: 0,
							output: run.output,
							worktreePath,
							branch,
						};
					} else {
						const failing = (verify.checks || [])
							.filter((check) => !check.ok)
							.map((check) => check.message)
							.join("; ");
						result = {
							rowId,
							ok: false,
							exitCode: 1,
							output: `${run.output}\ncontract verify failed: ${failing}`,
							worktreePath,
							branch,
						};
					}
				}
			}
		}
	} else {
		// LLM rows delegate to the worker in the row worktree. Per-row agent-prompt
		// substitution is handled by SP-670 helpers at the worker boundary; full
		// worker-side substitution wiring is tracked for SP-673.
		const workerResult = await runWorker({
			worktreePath,
			taskFolder: path.join(worktreePath, taskFolderRel),
			projectRoot,
			batchId,
			laneNumber,
			taskId,
			laneBranch: branch,
			laneCorrelationId: `${laneCorrelationId}-matrix-${rowId}`,
			fileScopePaths: [],
			config,
		});
		result = {
			rowId,
			ok: Boolean(workerResult.ok),
			exitCode: workerResult.exitCode ?? 0,
			output: workerResult.output ?? "",
			worktreePath,
			branch,
		};
	}

	if (result.ok) {
		try {
			const dirty = gitExec(worktreePath, ["status", "--porcelain"], {
				throwOnError: false,
				projectRoot,
			});
			if (dirty) {
				gitExec(worktreePath, ["add", "-A"], { projectRoot });
				gitExec(
					worktreePath,
					["commit", "-m", `feat(${taskId}[${rowId}]): matrix row`],
					{ projectRoot },
				);
			}
			const sha = gitExec(worktreePath, ["rev-parse", "HEAD"], { projectRoot });
			result.commitSha = sha;
			recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.completed", {
				taskId,
				laneNumber,
				rowId,
				correlationId: laneCorrelationId,
				commitSha: sha,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			result.ok = false;
			result.exitCode = 1;
			result.output = `${result.output}\nmatrix row commit failed: ${message}`;
			recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
				taskId,
				laneNumber,
				rowId,
				correlationId: laneCorrelationId,
				error: message,
			});
		}
	} else {
		recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
			taskId,
			laneNumber,
			rowId,
			correlationId: laneCorrelationId,
			exitCode: result.exitCode,
			output: (result.output || "").slice(0, 2000),
		});
	}

	return result;
}

/**
 * Run every matrix row of a task as a parallel sub-lane (SP-671).
 *
 * Each row runs in its own worktree off the lane task branch. The parent task
 * succeeds only when every row succeeds; any failure fails the task and
 * surfaces the failing row id(s). Successful row branches are merged back into
 * the lane worktree so the normal lane-commit + wave-merge carry all rows'
 * output. Concurrency is bounded by `maxParallel`.
 *
 * @param {object} params
 */
async function runMatrixTaskOnLane({
	projectRoot,
	state,
	batchId,
	baseBranch,
	config,
	task,
	lane,
	taskFolderRel,
	laneCorrelationId,
	fileScopePaths,
	matrix,
	maxParallel,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const laneBranch = lane.branch;
	const wt = lane.worktreePath;
	const taskFolderInWorktree = path.join(wt, taskFolderRel);
	const parentTaskFolderAbs = path.join(projectRoot, taskFolderRel);

	task.status = "running";
	task.isMatrix = true;
	task.matrixType = matrix.type;
	if (!task.startedAt) task.startedAt = Date.now();
	task.matrixRows = matrix.rows.map((row) => ({
		rowId: row.rowId,
		status: "pending",
		exitCode: null,
		commitSha: null,
	}));
	updateSegmentForTask(state, taskId, "running");
	saveEngineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, batchId, "task.started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		matrix: true,
	});
	recordMatrixEvent(projectRoot, batchId, "matrix.task_started", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		rowIds: matrix.rows.map((row) => row.rowId),
		matrixType: matrix.type,
		maxParallel,
	});

	const { results } = await runConcurrent(matrix.rows, maxParallel, async (row) => {
		try {
			return await runMatrixSubLane({
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneBranch,
				laneCorrelationId,
				row,
				matrixType: matrix.type,
				parentTaskFolderAbs,
				taskFolderRel,
				config,
				baseBranch,
			});
		} catch (err) {
			// Defensive: a crashed sub-lane must never lose its row identity, or the
			// parent could aggregate a phantom pending row.
			const message = err instanceof Error ? err.message : String(err);
			recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
				taskId,
				laneNumber,
				rowId: row.rowId,
				correlationId: laneCorrelationId,
				error: `sub-lane crashed: ${message}`,
			});
			return {
				rowId: row.rowId,
				ok: false,
				exitCode: 1,
				output: `sub-lane crashed: ${message}`,
			};
		}
	});

	for (const rowResult of results) {
		const entry = task.matrixRows.find((m) => m.rowId === rowResult.rowId);
		if (entry) {
			entry.status = rowResult.ok ? "succeeded" : "failed";
			entry.exitCode = rowResult.exitCode ?? null;
			entry.commitSha = rowResult.commitSha ?? null;
		}
	}

	const { ok, failedRowIds } = aggregateMatrixOutcomes(
		results.map((rowResult) => ({ rowId: rowResult.rowId, ok: rowResult.ok })),
	);

	if (!ok) {
		for (const rowResult of results) {
			if (rowResult.worktreePath) {
				removeMatrixSubLaneWorktree(
					projectRoot,
					rowResult.worktreePath,
					rowResult.branch,
				);
			}
		}
		const failedSummary = failedRowIds.join(", ");
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = `matrix_sub_lane_failed:${failedSummary}`;
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveEngineBatchState(projectRoot, state);
		recordMatrixEvent(projectRoot, batchId, "matrix.task_failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			failedRowIds,
			matrixRows: task.matrixRows,
		});
		appendJournalEvent(projectRoot, batchId, "task.failed", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			classification: "matrix_sub_lane_failed",
			exitCode: 1,
			output: `Matrix sub-lane(s) failed: ${failedSummary}`,
			failedRowIds,
		});
		recordLaneTaskMetric({
			projectRoot,
			batchId,
			task,
			config,
			taskFolder: taskFolderInWorktree,
			lane,
		});
		return {
			ok: false,
			aborted: false,
			workerResult: {
				ok: false,
				classification: "matrix_sub_lane_failed",
				exitCode: 1,
				output: `Matrix sub-lane(s) failed: ${failedSummary}`,
			},
		};
	}

	// All rows succeeded: merge each row branch into the lane worktree so the
	// lane carries every row's output, then run the standard lane commit.
	for (const rowResult of results) {
		if (!rowResult.branch) continue;
		try {
			gitExec(
				wt,
				["merge", "--no-edit", "-m", `merge matrix row ${rowResult.rowId} into lane`, rowResult.branch],
				{ projectRoot },
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			gitExec(wt, ["merge", "--abort"], { throwOnError: false, projectRoot });
			for (const other of results) {
				if (other.worktreePath) {
					removeMatrixSubLaneWorktree(projectRoot, other.worktreePath, other.branch);
				}
			}
			task.status = "failed";
			task.endedAt = Date.now();
			task.exitReason = `matrix_row_merge_failed:${rowResult.rowId}`;
			updateSegmentForTask(state, taskId, "failed");
			recomputeTaskCounters(state);
			saveEngineBatchState(projectRoot, state);
			return {
				ok: false,
				workerResult: {
					ok: false,
					classification: "matrix_row_merge_failed",
					exitCode: 1,
					output: `Failed to merge matrix row ${rowResult.rowId}: ${message}`,
				},
			};
		}
		removeMatrixSubLaneWorktree(projectRoot, rowResult.worktreePath, rowResult.branch);
	}

	// Mirror the execution-only convention: a `.DONE` marker authorizes commit.
	const donePath = path.join(taskFolderInWorktree, ".DONE");
	fs.mkdirSync(path.dirname(donePath), { recursive: true });
	fs.writeFileSync(donePath, "");

	recordMatrixEvent(projectRoot, batchId, "matrix.task_completed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		rowIds: results.map((rowResult) => rowResult.rowId),
	});

	const ignorePatterns = resolveWorktreeSetupIgnorePaths(config);
	const commitResult = commitLaneAndValidateWorktree({
		worktreePath: wt,
		taskBranch: laneBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
		projectRoot,
		fileScopePaths,
		ignorePatterns,
		task,
		lane,
		laneNumber,
		laneCorrelationId,
		state,
		config,
	});
	if (!commitResult.ok) {
		return { ok: false, error: commitResult.error, output: commitResult.output };
	}

	recordTaskSucceeded(state, taskId, { exitReason: "done", doneFileFound: true });
	recordTaskTransition({
		projectRoot,
		state,
		journalType: "task.completed",
		journalPayload: {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			matrix: true,
			matrixRows: task.matrixRows,
		},
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder: taskFolderInWorktree,
		lane,
	});

	return { ok: true, laneCommit: commitResult.laneCommit };
}
