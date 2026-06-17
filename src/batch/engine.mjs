/**
 * pi-spine batch engine (Phase 2 single-lane, Phase 3 multi-lane + §17.4 merge policy).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { buildPlan } from "../planner/index.mjs";
import { runBatchPreflight, resolveTasksRoot } from "../config/spine-preflight-lib.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { openIntegrateGateAfterBatchComplete } from "./gate.mjs";
import { integrateOrchToBase } from "./integrate.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	generateBatchId,
	recordBatchEnginePid,
	saveSpineBatchState,
} from "./state.mjs";
import {
	ensureOrchBranch,
	provisionLaneWorktree,
	removeLaneWorktrees,
	runWorktreeSetupHook,
} from "./worktree.mjs";
import { resolveWorktreeSetupHook } from "../config/worktree-setup-hook.mjs";
import {
	assessWaveMergeEligibility,
	canStartMultiTaskBatch,
	countPlanTasks,
	maxLaneNumberForPlan,
	resolveBatchStartScope,
	shouldAutoIntegrateAfterWave,
} from "./engine-scope.mjs";
import {
	buildTasksAndLanesFromPlan,
	mergeWaveLanesToOrch,
	runTaskOnLane,
	skipTaskDoneOnDisk,
	transitionPhase,
} from "./engine-lanes.mjs";

export {
	assessWaveMergeEligibility,
	buildTaskLaneAssignments,
	canStartMultiTaskBatch,
	countPlanTasks,
	forceMergeWave,
	formatMixedOutcomeMessage,
	isExplicitBatchScope,
	maxLaneNumberForPlan,
	resolveBatchStartScope,
} from "./engine-scope.mjs";
export { loadTaskFileScopePaths, mergeLaneToOrch } from "./engine-lanes.mjs";

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.scope]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipPreflight]
 */
export async function startBatch({
	projectRoot,
	scope = "all",
	dryRun = false,
	skipPreflight = false,
}) {
	if (!skipPreflight) {
		const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
		if (!preflight.ok) {
			return {
				ok: false,
				exitCode: preflight.exitCode ?? 1,
				error: "preflight_failed",
				output: preflight.output,
			};
		}
	}

	assertNoActiveBatch(projectRoot);

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRoot) {
		return { ok: false, exitCode: 1, error: "tasks_root_missing" };
	}

	const scopeResolution = resolveBatchStartScope(scope, tasksRoot);
	if (!scopeResolution.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: scopeResolution.error,
			output: scopeResolution.output,
		};
	}

	const effectiveScope = scopeResolution.scope;
	const policyScope = scopeResolution.policyScope ?? effectiveScope;

	const plan = buildPlan({ scope: effectiveScope, config, tasksRoot });
	const batchPolicy = canStartMultiTaskBatch(plan, policyScope);
	if (!batchPolicy.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: batchPolicy.error,
			output: batchPolicy.output,
		};
	}

	const taskIds = batchPolicy.taskIds;
	const maxLaneNumber = maxLaneNumberForPlan(plan);

	if (dryRun) {
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			taskIds,
			plan,
			output:
				`Dry run: would start batch for ${taskIds.length} task(s) across ${plan.waves.length} wave(s), ` +
				`up to ${maxLaneNumber} lane(s), maxParallel=${config.lanes?.maxParallel ?? 1}.\n`,
		};
	}

	const batchId = generateBatchId();
	const baseBranch = config.baseBranch ?? "main";
	const orchBranch = `orch/spine-${batchId}`;

	const discovered = discoverTasks(tasksRoot);
	for (const taskId of taskIds) {
		if (!discovered.find((entry) => entry.taskId === taskId)) {
			return { ok: false, exitCode: 1, error: "task_not_found", taskId };
		}
	}

	const { tasks, lanes } = buildTasksAndLanesFromPlan({
		plan,
		discovered,
		projectRoot,
		batchId,
		maxLaneNumber,
	});

	let state = createInitialBatchState({
		batchId,
		baseBranch,
		orchBranch,
		wavePlan: plan.waves.map((wave) => wave.taskIds),
		tasks,
		lanes,
	});

	saveSpineBatchState(projectRoot, state);

	try {
		ensureOrchBranch(projectRoot, baseBranch, orchBranch);
		transitionPhase(state, "running", { projectRoot, batchId });
		recordBatchEnginePid(state, process.pid);
		saveSpineBatchState(projectRoot, state);

		for (const lane of state.lanes) {
			lane.correlationId = crypto.randomUUID();
			const { worktreePath: wt } = provisionLaneWorktree({
				projectRoot,
				batchId,
				laneNumber: lane.laneNumber,
				orchBranch,
			});
			lane.worktreePath = wt;

			const setupHookPath = resolveWorktreeSetupHook(projectRoot, config);
			if (setupHookPath) {
				appendJournalEvent(projectRoot, batchId, "lane.setup_hook.started", {
					laneNumber: lane.laneNumber,
					laneId: lane.laneId,
					worktreePath: wt,
					hookPath: setupHookPath,
					correlationId: lane.correlationId,
				});
				try {
					const hookResult = runWorktreeSetupHook({
						projectRoot,
						worktreePath: wt,
						batchId,
						laneNumber: lane.laneNumber,
						config,
					});
					appendJournalEvent(projectRoot, batchId, "lane.setup_hook.completed", {
						laneNumber: lane.laneNumber,
						laneId: lane.laneId,
						worktreePath: wt,
						durationMs: hookResult.durationMs,
						correlationId: lane.correlationId,
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					appendJournalEvent(projectRoot, batchId, "lane.setup_hook.failed", {
						laneNumber: lane.laneNumber,
						laneId: lane.laneId,
						worktreePath: wt,
						error: message,
						correlationId: lane.correlationId,
					});
					throw err;
				}
			}

			appendJournalEvent(projectRoot, batchId, "lane.provisioned", {
				laneNumber: lane.laneNumber,
				laneId: lane.laneId,
				worktreePath: wt,
				taskBranch: lane.branch,
				correlationId: lane.correlationId,
			});
		}
		saveSpineBatchState(projectRoot, state);

		let batchAborted = false;

		for (const wave of plan.waves) {
			state.currentWaveIndex = wave.index;
			saveSpineBatchState(projectRoot, state);

			for (const tick of wave.ticks ?? []) {
				/** @type {Map<number, { lane: object, runs: Array<{ taskId: string, run: () => Promise<{ ok: boolean, aborted?: boolean }> }> }>} */
				const runsByLane = new Map();

				for (let laneInTick = 0; laneInTick < (tick.lanes?.length ?? 0); laneInTick++) {
					const tickTaskIds = tick.lanes[laneInTick] ?? [];
					if (tickTaskIds.length === 0) continue;

					const laneNumber = laneInTick + 1;
					const lane = state.lanes.find((entry) => entry.laneNumber === laneNumber);
					if (!lane) continue;

					if (!runsByLane.has(laneNumber)) {
						runsByLane.set(laneNumber, { lane, runs: [] });
					}
					const laneQueue = runsByLane.get(laneNumber);

					for (const taskId of tickTaskIds) {
						const task = state.tasks.find((entry) => entry.taskId === taskId);
						const entry = discovered.find((item) => item.taskId === taskId);
						if (!task || !entry) continue;

						const taskFolderRel = path.relative(projectRoot, entry.folderPath);
						const doneOnDisk = fs.existsSync(path.join(entry.folderPath, ".DONE"));
						const laneCorrelationId = lane.correlationId ?? crypto.randomUUID();

						const run = doneOnDisk
							? () =>
									skipTaskDoneOnDisk({
										projectRoot,
										state,
										batchId,
										task,
										lane,
										taskFolderPath: entry.folderPath,
										laneCorrelationId,
									})
							: () =>
									runTaskOnLane({
										projectRoot,
										state,
										batchId,
										baseBranch,
										config,
										task,
										lane,
										taskFolderRel,
										laneCorrelationId,
									}).then((result) => {
										if (result.aborted) batchAborted = true;
										return result;
									});

						laneQueue.runs.push({ taskId, run });
					}
				}

				const laneExecutions = [...runsByLane.entries()].map(async ([laneNumber, { lane, runs }]) => {
					if (runs.length > 1) {
						appendJournalEvent(projectRoot, batchId, "lane.tasks_serialized", {
							laneNumber,
							laneId: lane.laneId,
							waveIndex: wave.index,
							tickIndex: tick.index,
							taskIds: runs.map((entry) => entry.taskId),
							correlationId: lane.correlationId ?? null,
						});
					}

					for (const { run } of runs) {
						const result = await run();
						if (result.aborted) {
							return result;
						}
					}
					return { ok: true };
				});

				await Promise.all(laneExecutions);
				if (batchAborted) break;
			}

			if (batchAborted) {
				const abortedTask = state.tasks.find((task) => task.status === "aborted");
				state.endedAt = Date.now();
				state.lastError = "batch aborted";
				transitionPhase(state, "aborted", {
					projectRoot,
					batchId,
					extra: { taskId: abortedTask?.taskId },
				});
				saveSpineBatchState(projectRoot, state);
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "aborted",
					output: "Batch aborted.\n",
				};
			}

			const mergeEligibility = assessWaveMergeEligibility(state, wave.index);
			if (!mergeEligibility.ok) {
				state.endedAt = Date.now();
				state.lastError = mergeEligibility.message?.slice(0, 500) ?? "mixed_outcome";
				transitionPhase(state, "failed", {
					projectRoot,
					batchId,
					extra: {
						waveIndex: wave.index,
						failedTaskIds: mergeEligibility.failedTaskIds,
						pendingTaskIds: mergeEligibility.pendingTaskIds,
						reason: "mixed_outcome",
					},
				});
				saveSpineBatchState(projectRoot, state);
				appendJournalEvent(projectRoot, batchId, "batch.merge_blocked", {
					waveIndex: wave.index,
					failedTaskIds: mergeEligibility.failedTaskIds,
					pendingTaskIds: mergeEligibility.pendingTaskIds,
				});
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "mixed_outcome_merge_blocked",
					failedTaskIds: mergeEligibility.failedTaskIds,
					output: `${mergeEligibility.message}\n`,
				};
			}

			const mergeResult = await mergeWaveLanesToOrch({
				projectRoot,
				state,
				batchId,
				baseBranch,
				orchBranch,
				waveIndex: wave.index,
			});
			if (!mergeResult.ok) {
				state.endedAt = Date.now();
				state.lastError = mergeResult.error ?? "merge failed";
				transitionPhase(state, "failed", {
					projectRoot,
					batchId,
					extra: { reason: "merge", waveIndex: wave.index },
				});
				saveSpineBatchState(projectRoot, state);
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "merge_failed",
					output: mergeResult.error,
				};
			}

			if (
				shouldAutoIntegrateAfterWave({
					config,
					waveIndex: wave.index,
					totalWaves: state.totalWaves,
				})
			) {
				const integrateResult = integrateOrchToBase({ projectRoot, batchId });
				appendJournalEvent(projectRoot, batchId, "integrate.started", {
					waveIndex: wave.index,
					mode: "auto_between_waves",
					ok: integrateResult.ok,
				});
			}
		}

		state.endedAt = Date.now();
		openIntegrateGateAfterBatchComplete({
			projectRoot,
			batchId,
			batchState: { ...state, phase: "completed" },
		});
		transitionPhase(state, "completed", {
			projectRoot,
			batchId,
			extra: { taskIds, mergeCommit: state.mergeResults.at(-1)?.mergeCommit },
		});
		saveSpineBatchState(projectRoot, state);

		const summaryTask =
			taskIds.length === 1 ? taskIds[0] : `${taskIds.length} tasks (${taskIds.join(", ")})`;
		return {
			ok: true,
			exitCode: 0,
			batchId,
			taskId: taskIds.length === 1 ? taskIds[0] : undefined,
			taskIds,
			orchBranch,
			mergeCommit: state.mergeResults.at(-1)?.mergeCommit,
			output:
				`Batch ${batchId} completed: ${summaryTask} succeeded; merged to ${orchBranch}.\n` +
				`  → spine gate status\n  → spine gate approve\n  → spine integrate\n  → spine batch complete\n`,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		state.endedAt = Date.now();
		state.lastError = message;
		transitionPhase(state, "failed", {
			projectRoot,
			batchId,
			extra: { error: message },
		});
		saveSpineBatchState(projectRoot, state);
		removeLaneWorktrees(projectRoot, batchId, maxLaneNumber);
		return { ok: false, exitCode: 1, batchId, error: message };
	}
}

