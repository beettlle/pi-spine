// @ts-nocheck
/**
 * Matrix task / sub-lane runners (SP-671 / #217).
 *
 * Kept out of `engine-lanes.mjs` so the facade stays under the Phase 23 500 LOC cap.
 */

import fs from "node:fs";
import path from "node:path";
import {
	aggregateMatrixOutcomes,
	provisionMatrixSubLaneWorktree,
	recordMatrixEvent,
	removeMatrixSubLaneWorktree,
	runConcurrent,
	runShellInDir,
	substituteRowCommand,
} from "./matrix.mjs";
import { commitLaneAndValidateWorktree } from "./commit.mjs";
import { recordLaneTaskMetric } from "./queue.mjs";
import { appendJournalEvent } from "../journal.mjs";
import { saveEngineBatchState } from "../pause.mjs";
import {
	recordTaskSucceeded,
	recordTaskTransition,
	recomputeTaskCounters,
	updateSegmentForTask,
} from "../state.mjs";
import { runWorker } from "../worker-host.mjs";
import { resolveWorktreeSetupIgnorePaths } from "../../config/spine-config-load.mjs";
import { parseContract } from "../../tasks/packet/parse-prompt.mjs";
import { verifyContract } from "../contract-verify.mjs";
import { gitExec } from "../git-exec.mjs";

/**
 * Read the `## Contract` table from a parent task folder (un-substituted).
 *
 * @param {string} parentTaskFolderAbs
 * @returns {object|null}
 */
export function readParentContract(parentTaskFolderAbs) {
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
export async function runMatrixSubLane({
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
export async function runMatrixTaskOnLane({
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
