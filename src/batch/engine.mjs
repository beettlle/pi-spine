// @ts-check
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
import { integrateOrchToBase } from "./integrate.mjs";
import { installAttachedEngineShutdownHandlers } from "./attached-engine-handoff.mjs";
import { finalizeBatchForIntegrate, tryFinalizePostMergeLimbo } from "./post-merge-limbo.mjs";
import { detectPostMergeLimboForResume } from "./resume-multi-validate.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recordBatchBaseSnapshotOnStart } from "./lifecycle.mjs";
import { adoptPauseIfRequested, saveEngineBatchState } from "./pause.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	generateBatchId,
	recordBatchEnginePid,
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
	maxLaneNumberForPlan,
	resolveBatchStartScope,
	shouldAutoIntegrateAfterWave,
} from "./engine-scope.mjs";
import { filterPlanToWave } from "../planner/wave-scope.mjs";
import {
	buildTasksAndLanesFromPlan,
	mergeWaveLanesToOrch,
	runTaskOnLane,
	skipTaskDoneOnDisk,
	transitionPhase,
} from "./engine-lanes.mjs";

/**
 * @param {string} batchId
 */
function buildEnginePausedResult(batchId) {
	return {
		ok: true,
		exitCode: 0,
		batchId,
		paused: true,
		output: "Batch paused.\n",
	};
}

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

const WORKTREE_SPINE_PATTERN = /[/\\]\.worktrees[/\\]spine-/;

/**
 * Detect whether the current process is running inside a spine worker context.
 * Returns a human-readable reason string if nested, or null if safe to proceed.
 *
 * Two guards: (1) SPINE_IS_WORKER env set by worker-host, and
 * (2) projectRoot inside a .worktrees/spine-* directory (catches cases where
 * the env was not inherited but the target is clearly a lane worktree).
 *
 * @param {string} projectRoot — the directory where the batch would run
 * @returns {string | null}
 */
export function detectNestedWorkerContext(projectRoot) {
	if (process.env.SPINE_IS_WORKER === "1") {
		return "SPINE_IS_WORKER=1 is set (running inside a worker process)";
	}
	const parentBatchId = process.env.SPINE_PARENT_BATCH_ID ?? process.env.SPINE_BATCH_ID;
	if (parentBatchId && WORKTREE_SPINE_PATTERN.test(projectRoot)) {
		return (
			`parent batch ${parentBatchId} is active and projectRoot is inside a ` +
			`.worktrees/spine-* lane directory`
		);
	}
	if (WORKTREE_SPINE_PATTERN.test(projectRoot)) {
		return "projectRoot is inside a .worktrees/spine-* lane directory";
	}
	return null;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string} [options.scope]
 * @param {boolean} [options.dryRun]
 * @param {boolean} [options.skipPreflight]
 * @param {boolean} [options.forceSuperseded]
 * @param {number|null} [options.waveFilter]
 */
export async function startBatch({
	projectRoot,
	scope = "all",
	dryRun = false,
	skipPreflight = false,
	forceSuperseded = false,
	waveFilter = null,
}) {
	const nestedReason = detectNestedWorkerContext(projectRoot);
	if (nestedReason) {
		const parentBatchId = process.env.SPINE_PARENT_BATCH_ID ?? process.env.SPINE_BATCH_ID ?? "unknown";
		try {
			appendJournalEvent(projectRoot, parentBatchId, "engine.nested_spawn_blocked", {
				projectRoot,
				parentBatchId,
				reason: nestedReason,
			});
		} catch {
			// Journal may not be writable from a worker worktree; best-effort.
		}
		return {
			ok: false,
			exitCode: 1,
			error: "nested_batch_spawn_blocked",
			output:
				`Nested batch start blocked: ${nestedReason}. ` +
				`Workers must not spawn batch engines. ` +
				`Parent batch: ${parentBatchId}, projectRoot: ${projectRoot}\n`,
		};
	}

	if (!skipPreflight) {
		const preflight = runBatchPreflight({ projectRoot, skipDoctor: false });
		if (!preflight.ok) {
			return {
				ok: false,
				exitCode: preflight.exitCode ?? 1,
				error: "preflight_failed",
				output: /** @type {string | undefined} */ (/** @type {any} */ (preflight).output),
			};
		}
	}

	assertNoActiveBatch(projectRoot);

	const configResult = loadSpineConfig(projectRoot);
	/** @type {Record<string, any>} */
	const config = configResult.config ?? {};
	const tasksRoot = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRoot) {
		return { ok: false, exitCode: 1, error: "tasks_root_missing" };
	}

	const scopeResolution = resolveBatchStartScope(scope, tasksRoot, { forceSuperseded });
	if (!scopeResolution.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: scopeResolution.error,
			output: scopeResolution.output,
		};
	}

	const effectiveScope = /** @type {string} */ (scopeResolution.scope);
	const policyScope = scopeResolution.policyScope ?? effectiveScope;

	const plan = buildPlan({ scope: effectiveScope, config, tasksRoot: /** @type {string} */ (tasksRoot) });
	let effectivePlan = plan;
	let plannerWaveCount = plan.waves?.length ?? 0;
	if (waveFilter != null) {
		const filtered = filterPlanToWave(plan, waveFilter);
		if (filtered.ok !== true) {
			return {
				ok: false,
				exitCode: 1,
				error: filtered.error,
				output: `${filtered.output}\n`,
			};
		}
		effectivePlan = /** @type {typeof plan} */ (filtered.plan);
		plannerWaveCount = filtered.waveCount;
	}
	const batchPolicy = canStartMultiTaskBatch(effectivePlan, policyScope ?? effectiveScope);
	if (!batchPolicy.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: batchPolicy.error,
			output: batchPolicy.output,
		};
	}

	const taskIds = batchPolicy.taskIds;
	const maxLaneNumber = maxLaneNumberForPlan(effectivePlan);

	if (dryRun) {
		const waveHint =
			waveFilter != null ? ` (planner wave ${waveFilter} of ${plannerWaveCount})` : "";
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			taskIds,
			plan: effectivePlan,
			waveFilter,
			output:
				`Dry run: would start batch for ${taskIds.length} task(s) across ${effectivePlan.waves.length} wave(s)${waveHint}, ` +
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
		plan: effectivePlan,
		discovered,
		projectRoot,
		batchId,
		maxLaneNumber,
	});

	/** @type {ReturnType<typeof createInitialBatchState>} */
	let state = createInitialBatchState({
		batchId,
		baseBranch,
		orchBranch,
		wavePlan: effectivePlan.waves.map((/** @type {{ taskIds: string[] }} */ wave) => wave.taskIds),
		tasks,
		lanes,
	});

	recordBatchBaseSnapshotOnStart(projectRoot, state);
	saveEngineBatchState(projectRoot, state);

	try {
		ensureOrchBranch(projectRoot, baseBranch, orchBranch);
		transitionPhase(state, "running", { projectRoot, batchId });
		recordBatchEnginePid(state, process.pid);
		installAttachedEngineShutdownHandlers({ projectRoot });
		saveEngineBatchState(projectRoot, state);

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
		saveEngineBatchState(projectRoot, state);

		let batchAborted = false;

		for (const wave of effectivePlan.waves) {
			const pauseAtWave = adoptPauseIfRequested({ projectRoot, state, batchId });
			if (pauseAtWave.stop) {
				return buildEnginePausedResult(batchId);
			}

			state.currentWaveIndex = wave.index;
			saveEngineBatchState(projectRoot, state);

			for (const tick of wave.ticks ?? []) {
				const pauseAtTick = adoptPauseIfRequested({ projectRoot, state, batchId });
				if (pauseAtTick.stop) {
					return buildEnginePausedResult(batchId);
				}
				/** @type {Map<number, { lane: object, runs: Array<{ taskId: string, run: () => Promise<{ ok: boolean, aborted?: boolean }> }> }>} */
				const runsByLane = new Map();

				for (let laneInTick = 0; laneInTick < (tick.lanes?.length ?? 0); laneInTick++) {
					const tickTaskIds = tick.lanes[laneInTick] ?? [];
					if (tickTaskIds.length === 0) continue;

					const laneNumber = laneInTick + 1;
					const lane = state.lanes.find((/** @type {{ laneNumber: number }} */ entry) => entry.laneNumber === laneNumber);
					if (!lane) continue;

					if (!runsByLane.has(laneNumber)) {
						runsByLane.set(laneNumber, { lane, runs: [] });
					}
					const laneQueue = runsByLane.get(laneNumber);

					for (const taskId of tickTaskIds) {
						const task = state.tasks.find((/** @type {{ taskId: string }} */ entry) => entry.taskId === taskId);
						const entry = discovered.find((/** @type {{ taskId: string }} */ item) => item.taskId === taskId);
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
										if ("aborted" in result && result.aborted) batchAborted = true;
										return result;
									});

						if (laneQueue) {
							laneQueue.runs.push({ taskId, run });
						}
					}
				}

				const laneExecutions = [...runsByLane.entries()].map(async ([laneNumber, { lane, runs }]) => {
					const laneMeta = /** @type {{ laneId?: string; correlationId?: string }} */ (lane);
					if (runs.length > 1) {
						appendJournalEvent(projectRoot, batchId, "lane.tasks_serialized", {
							laneNumber,
							laneId: laneMeta.laneId,
							waveIndex: wave.index,
							tickIndex: tick.index,
							taskIds: runs.map((entry) => entry.taskId),
							correlationId: laneMeta.correlationId ?? null,
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

				const pauseAfterTick = adoptPauseIfRequested({ projectRoot, state, batchId });
				if (pauseAfterTick.stop) {
					return buildEnginePausedResult(batchId);
				}
			}

			if (batchAborted) {
				const abortedTask = state.tasks.find((/** @type {{ status: string }} */ task) => task.status === "aborted");
				/** @type {any} */ (state).endedAt = Date.now();
				/** @type {any} */ (state).lastError = "batch aborted";
				transitionPhase(state, "aborted", {
					projectRoot,
					batchId,
					extra: { taskId: abortedTask?.taskId },
				});
				saveEngineBatchState(projectRoot, state);
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
				/** @type {any} */ (state).endedAt = Date.now();
				/** @type {any} */ (state).lastError = mergeEligibility.message?.slice(0, 500) ?? "mixed_outcome";
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
				saveEngineBatchState(projectRoot, state);
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
				return {
					ok: false,
					exitCode: 1,
					batchId,
					error: "merge_failed",
					output: mergeResult.error,
				};
			}

			if (mergeResult.finalized && mergeResult.finalizeResult) {
				return mergeResult.finalizeResult;
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

		if (detectPostMergeLimboForResume({ projectRoot, state })) {
			const limboResult = tryFinalizePostMergeLimbo({
				projectRoot,
				state,
				batchId,
				orchBranch,
			});
			if (limboResult) {
				return limboResult;
			}
		}

		return finalizeBatchForIntegrate({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumed: false,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		/** @type {any} */ (state).endedAt = Date.now();
		/** @type {any} */ (state).lastError = message;
		transitionPhase(state, "failed", {
			projectRoot,
			batchId,
			extra: { error: message },
		});
		saveEngineBatchState(projectRoot, state);
		removeLaneWorktrees(projectRoot, batchId, maxLaneNumber);
		return { ok: false, exitCode: 1, batchId, error: message };
	}
}

