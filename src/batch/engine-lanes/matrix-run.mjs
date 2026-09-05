// @ts-nocheck
/**
 * Matrix task / sub-lane runners (SP-671 / #217).
 *
 * Kept out of `engine-lanes.mjs` so the facade stays under the Phase 23 500 LOC cap.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
	acquireLaneSlot,
	aggregateMatrixOutcomes,
	buildMatrixRowEnv,
	loadMatrixTaskRows,
	provisionMatrixSubLaneWorktree,
	recordMatrixEvent,
	releaseLaneSlot,
	removeMatrixSubLaneWorktree,
	runConcurrent,
	runMatrixSubLaneSetupHook,
	runShellInDir,
	substituteRowCommand,
} from "./matrix.mjs";
import { applyMatrixRowToPrompt } from "../../planner/matrix.mjs";
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
 * Serve a matrix LLM row its row-substituted PROMPT.md (#232). Reads the parent
 * PROMPT.md (same source convention as `readParentContract`), substitutes
 * `{matrix.<column>}` placeholders across the whole document — steps, contract
 * fields, and File Scope paths — and writes the result to the row worktree's
 * PROMPT.md so `runWorker` and the spawned worker both read row-specific
 * content instead of raw `{matrix.*}` refs.
 *
 * @param {object} params
 * @param {string} params.parentTaskFolderAbs Parent task folder in the main checkout.
 * @param {string} params.worktreePath Row worktree root.
 * @param {string} params.taskFolderRel Task folder path relative to the worktree root.
 * @param {Record<string, string>} params.row Matrix row values keyed by column.
 * @returns {{ servedPrompt: string, sha256: string }} Exact bytes served plus their digest.
 * @throws When the parent PROMPT.md is missing, or on unknown `{matrix.X}`
 *   references (fail-loud via `substituteMatrixVariables`).
 */
function serveMatrixRowPrompt({ parentTaskFolderAbs, worktreePath, taskFolderRel, row }) {
	const promptPath = path.join(parentTaskFolderAbs, "PROMPT.md");
	if (!fs.existsSync(promptPath)) {
		throw new Error(`parent PROMPT.md not found: ${promptPath}`);
	}
	const substituted = applyMatrixRowToPrompt(fs.readFileSync(promptPath, "utf-8"), row);
	const rowPromptPath = path.join(worktreePath, taskFolderRel, "PROMPT.md");
	fs.mkdirSync(path.dirname(rowPromptPath), { recursive: true });
	fs.writeFileSync(rowPromptPath, substituted, "utf-8");
	const sha256 = createHash("sha256").update(substituted, "utf-8").digest("hex");
	return { servedPrompt: substituted, sha256 };
}

/**
 * Restore the authored PROMPT.md and drop the row's `.DONE` after a successful
 * LLM row so the per-row commit carries only real row output. Row branches are
 * merged into the lane (SP-697), and per-row PROMPT/.DONE content always
 * differs (row values, completion timestamps) — committing either would
 * add/add-conflict every multi-row LLM matrix merge. The parent writes the
 * lane-level `.DONE` after all rows merge, mirroring the execute path.
 *
 * @param {object} params
 * @param {string} params.worktreePath Row worktree root.
 * @param {string} params.taskFolderRel Task folder path relative to the worktree root.
 * @param {string} [params.projectRoot] Main repo root for git identity.
 */
function restoreMatrixRowPrompt({ worktreePath, taskFolderRel, projectRoot }) {
	const promptRel = `${taskFolderRel.replace(/\\/g, "/")}/PROMPT.md`;
	gitExec(worktreePath, ["checkout", "--", promptRel], { projectRoot });
	fs.rmSync(path.join(worktreePath, taskFolderRel, ".DONE"), { force: true });
}

/**
 * Effective per-matrix row concurrency (#229): the Contract's optional
 * `matrixMaxParallel` throttle (Slurm `%N` analog) capped by the global
 * `lanes.maxParallel` — a matrix can narrow its share of the pool but never
 * widen it. Missing/invalid throttles fall back to the global cap.
 *
 * @param {object} params
 * @param {number | null} [params.matrixMaxParallel] Contract `matrixMaxParallel` (positive int).
 * @param {number} [params.maxParallel] Global `lanes.maxParallel`.
 * @returns {number}
 */
export function resolveMatrixRowConcurrency({ matrixMaxParallel, maxParallel = 1 }) {
	const globalCap = Math.max(1, Math.floor(Number(maxParallel) || 1));
	if (matrixMaxParallel == null) return globalCap;
	const throttle = Number(matrixMaxParallel);
	if (!Number.isFinite(throttle) || throttle < 1) return globalCap;
	return Math.max(1, Math.min(Math.floor(throttle), globalCap));
}

/**
 * Execute a single matrix row in its own worktree. Substitutes `{matrix.X}`
 * placeholders for execution-only rows; LLM rows delegate to `runWorker` with a
 * row-substituted PROMPT.md served into the row worktree (#232). Commits
 * successful row output to the row branch.
 *
 * Rows also receive matrix index environment variables (#229) when `rowIndex`
 * and `rowCount` are supplied: execute rows via the shell env, LLM rows via the
 * worker child env (`buildMatrixRowEnv`).
 *
 * @param {object} params
 * @param {number} [params.rowIndex] 0-based index of this row in the matrix.
 * @param {number} [params.rowCount] Total matrix row count.
 * @returns {Promise<{ rowId: string, ok: boolean, exitCode: number, output: string, worktreePath?: string, branch?: string, commitSha?: string, servedPrompt?: string }>}
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
	rowIndex,
	rowCount,
}) {
	const rowId = row.rowId;
	const values = row.values;
	const matrixEnv = buildMatrixRowEnv({ taskId, rowId, rowIndex, rowCount });
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

	// Mirror the parent-lane provision→hook sequence: the row worktree is freshly
	// provisioned off the lane branch, so gitignored toolchains/assets (e.g.
	// `.venv`) that the row's runCommand depends on are absent until the hook
	// links them in. Fail closed on hook failure so the row reports the missing
	// setup rather than masking it as a runCommand failure (#224).
	try {
		runMatrixSubLaneSetupHook({
			projectRoot,
			worktreePath,
			batchId,
			laneNumber,
			taskId,
			rowId,
			correlationId: laneCorrelationId,
			config,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
			taskId,
			laneNumber,
			rowId,
			correlationId: laneCorrelationId,
			error: `setup hook failed: ${message}`,
		});
		return {
			rowId,
			ok: false,
			exitCode: 1,
			output: `worktree setup hook failed: ${message}`,
			worktreePath,
			branch,
		};
	}

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
			const run = await runShellInDir(worktreePath, command, matrixEnv);
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
		// LLM rows delegate to the worker in the row worktree. Serve the row its
		// row-substituted PROMPT.md first (#232): steps, contract fields, and File
		// Scope all carry this row's values, so the worker never sees raw
		// `{matrix.*}` refs. Substitution is fail-loud (SP-670 engine): an unknown
		// reference fails the row instead of reaching the worker.
		try {
			const { servedPrompt, sha256 } = serveMatrixRowPrompt({
				parentTaskFolderAbs,
				worktreePath,
				taskFolderRel,
				row: values,
			});
			recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.prompt_served", {
				taskId,
				laneNumber,
				rowId,
				correlationId: laneCorrelationId,
				sha256,
				chars: servedPrompt.length,
			});
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
				...(matrixEnv ? { extraEnv: matrixEnv } : {}),
			});
			result = {
				rowId,
				ok: Boolean(workerResult.ok),
				exitCode: workerResult.exitCode ?? 0,
				output: workerResult.output ?? "",
				worktreePath,
				branch,
			};
			if (result.ok) {
				// Drop the substitution scaffolding before the per-row commit so
				// row→lane merges stay conflict-free (see restoreMatrixRowPrompt).
				try {
					restoreMatrixRowPrompt({ worktreePath, taskFolderRel, projectRoot });
				} catch (restoreErr) {
					const restoreMessage = restoreErr instanceof Error ? restoreErr.message : String(restoreErr);
					result = {
						...result,
						ok: false,
						exitCode: 1,
						output: `${result.output}\nmatrix row prompt restore failed: ${restoreMessage}`,
					};
				}
			}
			result.servedPrompt = servedPrompt;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			result = {
				rowId,
				ok: false,
				exitCode: 1,
				output: `matrix row prompt substitution failed: ${message}`,
				worktreePath,
				branch,
			};
		}
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
 * Resume-path entry for matrix tasks (SP-752 / #230).
 *
 * The single-task (`resume.mjs`) and multi-task (`resume-multi-lanes.mjs`)
 * resume loops run workers directly and have no matrix fan-out — without this
 * dispatch a retried matrix task falls through to a plain worker run on the
 * unsubstituted parent PROMPT. Detect a matrix packet and delegate to
 * `runMatrixTaskOnLane`, which owns per-row execution, carry-over, lane commit,
 * and success/failure recording for the resumed task.
 *
 * On failure the matrix runner has already failed the task, persisted state,
 * and journaled `task.failed`; this finishes the failed-batch bookkeeping
 * (batch phase/counters — the plain worker failure branch does the same) and
 * returns a ready-to-return `cliResult` envelope for the resume caller.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state Live batch state.
 * @param {string} params.batchId
 * @param {string} params.baseBranch
 * @param {object} params.config
 * @param {object} params.task
 * @param {object} params.lane
 * @param {string} params.taskFolderRel
 * @param {string} params.laneCorrelationId
 * @param {string[]} params.fileScopePaths
 * @returns {Promise<{ isMatrix: false } | { isMatrix: true, ok: boolean, cliResult?: object }>}
 */
export async function runMatrixTaskForResume({
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
}) {
	const matrix = loadMatrixTaskRows(path.join(projectRoot, taskFolderRel));
	if (!matrix) return { isMatrix: false };
	const result = await runMatrixTaskOnLane({
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
		maxParallel: config?.lanes?.maxParallel ?? 1,
	});
	if (!result.ok) {
		const output = result.workerResult?.output ?? result.output ?? "matrix task failed";
		state.failedTasks = 1;
		state.succeededTasks = 0;
		state.phase = "failed";
		state.endedAt = Date.now();
		state.lastError = String(output).slice(0, 500);
		saveEngineBatchState(projectRoot, state);
		return {
			isMatrix: true,
			ok: false,
			cliResult: {
				ok: false,
				exitCode: result.workerResult?.exitCode ?? 1,
				batchId,
				taskId: task.taskId,
				error: result.workerResult?.classification ?? "worker_failed",
				output,
			},
		};
	}
	// Success: the matrix runner already lane-committed, recorded task success,
	// and journaled — the caller skips its plain worker postlude.
	return { isMatrix: true, ok: true };
}

/**
 * Run every matrix row of a task as a first-class lane-pool competitor
 * (SP-697 / #228, supersedes the SP-690 nested throttle).
 *
 * The parent task does NOT hold a lane slot while its rows run: each active
 * row acquires a slot from the global pool sized `lanes.maxParallel` (shared
 * with sibling lane tasks via `acquireLaneSlot`), so rows compete with sibling
 * lanes for the same pool and global in-flight workers never exceed
 * `lanes.maxParallel`. The acquired slot number is the row's lane identity —
 * its worktree/branch use it, so concurrent rows land on distinct
 * `lane-{n}-…` worktrees.
 *
 * Each row runs in its own worktree off the lane task branch. The parent task
 * succeeds only when every non-canceled row succeeds; any failed row fails the
 * task and surfaces the failing row id(s). `canceled` rows (row-scoped skip,
 * #230) are operator exclusions and leave the required set. On a failed sweep
 * only the failed rows' worktrees are removed — succeeded rows keep theirs so a
 * row-scoped retry carries them over without re-execution. Successful row
 * branches (fresh and carried-over) are merged back into the lane worktree so
 * the normal lane-commit + wave-merge carry all rows' output.
 *
 * @param {object} params
 * @param {number} params.maxParallel  Global `lanes.maxParallel` (pool size).
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

	// Per-matrix throttle (#229): an optional Contract `matrixMaxParallel`
	// narrows this matrix's share of the global pool. The pool itself stays
	// sized `maxParallel` — global `lanes.maxParallel` semantics never change.
	const parentContract = readParentContract(parentTaskFolderAbs);
	const matrixMaxParallel = parentContract?.matrixMaxParallel ?? null;
	const rowConcurrency = resolveMatrixRowConcurrency({ matrixMaxParallel, maxParallel });

	task.status = "running";
	task.isMatrix = true;
	task.matrixType = matrix.type;
	if (!task.startedAt) task.startedAt = Date.now();
	// Seed per-row entries preserving prior-attempt state (#230): `succeeded`
	// rows keep their status + persisted worktree/branch for retry carry-over,
	// `canceled` rows stay excluded, and only failed/pending rows re-enter the
	// sweep. Fresh rows start `pending`.
	task.matrixRows = matrix.rows.map((row) => {
		const existing = Array.isArray(task.matrixRows)
			? task.matrixRows.find((entry) => entry && entry.rowId === row.rowId)
			: null;
		return existing ?? {
			rowId: row.rowId,
			status: "pending",
			exitCode: null,
			commitSha: null,
		};
	});

	// Partition rows for this sweep (#230): carry-over succeeded rows (kept
	// worktree/branch from a prior attempt — never re-executed), rows to run now
	// (status pending), and rows skipped this sweep (canceled, or still failed
	// because only a subset was retried).
	const carryOverRows = [];
	const runnableRows = [];
	const skippedRowIds = [];
	for (const row of matrix.rows) {
		const entry = task.matrixRows.find((m) => m.rowId === row.rowId);
		if (entry.status === "succeeded") {
			const carryWorktree = typeof entry.worktreePath === "string" ? entry.worktreePath : null;
			const carryBranch = typeof entry.branch === "string" ? entry.branch : null;
			if (carryWorktree && carryBranch && fs.existsSync(carryWorktree)) {
				carryOverRows.push({ row, worktreePath: carryWorktree, branch: carryBranch, commitSha: entry.commitSha });
				continue;
			}
			// Carry-over material lost (crash recovery / manual cleanup): fall back
			// to re-execution — never worse than the pre-SP-752 whole-sweep rerun.
			// A stale branch would break `worktree add -b`, so drop it first.
			if (carryBranch) {
				gitExec(projectRoot, ["branch", "-D", carryBranch], { throwOnError: false });
			}
			recordMatrixEvent(projectRoot, batchId, "matrix.row_reexecuted", {
				taskId,
				laneNumber,
				rowId: row.rowId,
				correlationId: laneCorrelationId,
				reason: "carry_over_worktree_missing",
			});
			entry.status = "pending";
			runnableRows.push(row);
			continue;
		}
		if (entry.status === "pending") {
			runnableRows.push(row);
			continue;
		}
		skippedRowIds.push(row.rowId);
	}
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
		matrixMaxParallel,
		rowConcurrency,
		runnableRowIds: runnableRows.map((row) => row.rowId),
		carriedOverRowIds: carryOverRows.map((carry) => carry.row.rowId),
		skippedRowIds,
	});

	const { results } = await runConcurrent(runnableRows, rowConcurrency, async (row, rowIndex) => {
		// Compete for the global lane pool: block until a slot frees (a sibling
		// lane task or another row releasing), then run on that slot as the
		// row's distinct lane identity. Always release so a crashed row cannot
		// leak a slot and stall the batch.
		const rowLaneNumber = await acquireLaneSlot(state, maxParallel);
		// Per-row live status (#230): flip to `running` only once the row actually
		// holds a slot, and persist so `spine status` sees it from another process.
		const runningEntry = task.matrixRows.find((m) => m.rowId === row.rowId);
		if (runningEntry) {
			runningEntry.status = "running";
			saveEngineBatchState(projectRoot, state);
		}
		try {
			return await runMatrixSubLane({
				projectRoot,
				batchId,
				laneNumber: rowLaneNumber,
				taskId,
				laneBranch,
				laneCorrelationId,
				row,
				matrixType: matrix.type,
				parentTaskFolderAbs,
				taskFolderRel,
				config,
				baseBranch,
				rowIndex,
				rowCount: matrix.rows.length,
			});
		} catch (err) {
			// Defensive: a crashed sub-lane must never lose its row identity, or the
			// parent could aggregate a phantom pending row.
			const message = err instanceof Error ? err.message : String(err);
			recordMatrixEvent(projectRoot, batchId, "matrix.sub_lane.failed", {
				taskId,
				laneNumber: rowLaneNumber,
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
		} finally {
			releaseLaneSlot(state, rowLaneNumber);
		}
	});

	for (const rowResult of results) {
		const entry = task.matrixRows.find((m) => m.rowId === rowResult.rowId);
		if (entry) {
			entry.status = rowResult.ok ? "succeeded" : "failed";
			entry.exitCode = rowResult.exitCode ?? null;
			entry.commitSha = rowResult.commitSha ?? null;
			if (rowResult.ok && rowResult.worktreePath && rowResult.branch) {
				// Persist carry-over material (#230): a later row-scoped retry reuses
				// this worktree/branch instead of re-executing the succeeded row.
				entry.worktreePath = rowResult.worktreePath;
				entry.branch = rowResult.branch;
			}
		}
	}

	// Aggregate from the full per-row state (#230): `canceled` rows are operator
	// exclusions and leave the required set; everything else must be `succeeded`.
	// The default all-rows-must-succeed policy itself is unchanged (#231 out of
	// scope).
	const { ok, failedRowIds } = aggregateMatrixOutcomes(
		task.matrixRows
			.filter((entry) => entry.status !== "canceled")
			.map((entry) => ({ rowId: entry.rowId, ok: entry.status === "succeeded" })),
	);

	if (!ok) {
		for (const rowResult of results) {
			if (!rowResult.worktreePath) continue;
			if (rowResult.ok) continue;
			// Failed rows' worktrees are cleaned up; succeeded rows keep theirs as
			// carry-over material for a row-scoped retry (#230).
			removeMatrixSubLaneWorktree(projectRoot, rowResult.worktreePath, rowResult.branch);
			const failedEntry = task.matrixRows.find((m) => m.rowId === rowResult.rowId);
			if (failedEntry) {
				delete failedEntry.worktreePath;
				delete failedEntry.branch;
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
	// Carry-over rows (#230) merge their kept prior-attempt branches alongside
	// the freshly executed rows — their outputs land exactly once.
	const allRowResults = [
		...carryOverRows.map((carry) => ({
			rowId: carry.row.rowId,
			ok: true,
			exitCode: 0,
			output: "",
			worktreePath: carry.worktreePath,
			branch: carry.branch,
			commitSha: carry.commitSha ?? null,
			carriedOver: true,
		})),
		...results,
	];
	for (const rowResult of allRowResults) {
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
			for (const other of allRowResults) {
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
		rowIds: allRowResults.map((rowResult) => rowResult.rowId),
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
