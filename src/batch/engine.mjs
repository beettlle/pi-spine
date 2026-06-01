/**
 * pi-spine batch engine (Phase 2 single-lane, Phase 3 multi-lane + §17.4 merge policy).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { discoverTasks } from "../compat/taskplane/discover.mjs";
import { buildPlan } from "../planner/index.mjs";
import { runBatchPreflight, resolveTasksRoot } from "../../bin/spine-preflight.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import crypto from "node:crypto";
import { appendJournalEvent } from "./journal.mjs";
import { commitLaneWorktree, countCommitsAhead, gitPorcelain } from "./lane-commit.mjs";
import {
	assertNoActiveBatch,
	createInitialBatchState,
	generateBatchId,
	loadSpineBatchState,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";
import {
	ensureOrchBranch,
	laneTaskBranch,
	laneWorktreePath,
	provisionLaneWorktree,
	removeLaneWorktrees,
} from "./worktree.mjs";
import { runWorker } from "./worker-host.mjs";

/**
 * @param {import("../planner/index.mjs").buildPlan} plan
 */
export function countPlanTasks(plan) {
	const ids = new Set();
	for (const wave of plan.waves ?? []) {
		for (const taskId of wave.taskIds ?? []) {
			ids.add(taskId);
		}
	}
	return [...ids];
}

/**
 * @param {string} scope
 */
export function isExplicitBatchScope(scope) {
	const normalized = String(scope ?? "")
		.trim()
		.toLowerCase();
	return Boolean(normalized) && normalized !== "all";
}

/**
 * @param {object} plan
 * @param {string} scope
 */
export function canStartMultiTaskBatch(plan, scope) {
	const taskIds = countPlanTasks(plan);
	if (taskIds.length <= 1) {
		return { ok: true, taskIds };
	}

	const singleWave = (plan.waves?.length ?? 0) === 1;
	const firstWave = plan.waves?.[0];
	const virtualLaneCount = firstWave?.virtualLaneCount ?? 1;
	const multiLane = virtualLaneCount > 1;
	const explicit = isExplicitBatchScope(scope);

	if (explicit || (singleWave && multiLane)) {
		return { ok: true, taskIds };
	}

	return {
		ok: false,
		taskIds,
		error: "multi_task_not_allowed",
		output:
			`Multi-task batches require a single wave with disjoint lanes (virtualLaneCount > 1) or an explicit scope.\n` +
			`Plan selected ${taskIds.length} task(s) across ${plan.waves?.length ?? 0} wave(s); virtualLaneCount=${virtualLaneCount}.\n` +
			`Use: spine batch start TP-001 TP-002  or  spine plan <scope>  to verify lane assignment.\n`,
	};
}

/**
 * @param {object} plan
 */
export function maxLaneNumberForPlan(plan) {
	let max = 1;
	for (const wave of plan.waves ?? []) {
		for (const tick of wave.ticks ?? []) {
			max = Math.max(max, tick.lanes?.length ?? 0);
		}
	}
	return max;
}

/**
 * @param {object} plan
 * @returns {Map<string, { laneNumber: number, waveIndex: number, tickIndex: number }>}
 */
export function buildTaskLaneAssignments(plan) {
	/** @type {Map<string, { laneNumber: number, waveIndex: number, tickIndex: number }>} */
	const map = new Map();
	for (const wave of plan.waves ?? []) {
		for (const tick of wave.ticks ?? []) {
			for (let laneInTick = 0; laneInTick < (tick.lanes?.length ?? 0); laneInTick++) {
				const laneNumber = laneInTick + 1;
				for (const taskId of tick.lanes[laneInTick] ?? []) {
					map.set(taskId, {
						laneNumber,
						waveIndex: wave.index,
						tickIndex: tick.index,
					});
				}
			}
		}
	}
	return map;
}

/**
 * @param {object[]} failedTasks
 * @param {object[]} pendingTasks
 */
export function formatMixedOutcomeMessage(failedTasks, pendingTasks) {
	const failedIds = failedTasks.map((task) => task.taskId);
	const pendingIds = pendingTasks.map((task) => task.taskId);
	const lines = ["Wave merge blocked (§17.4 mixed-outcome policy)."];

	if (failedIds.length > 0) {
		lines.push(`Failed task(s): ${failedIds.join(", ")}.`);
		lines.push(
			`Suggested: ${failedIds.map((id) => `/spine-retry-task ${id}`).join("; ")} then /spine-resume --force`,
		);
		lines.push(`Or skip: ${failedIds.map((id) => `/spine-skip-task ${id}`).join("; ")}`);
	}
	if (pendingIds.length > 0) {
		lines.push(`Pending/running task(s): ${pendingIds.join(", ")}.`);
	}
	lines.push("Do not report batch success while failures remain.");
	return lines.join("\n");
}

/**
 * @param {object} state
 * @param {number} waveIndex
 */
export function assessWaveMergeEligibility(state, waveIndex) {
	const forceMerged = (state.resilience?.forceMergedWaves ?? []).includes(waveIndex);
	if (forceMerged) {
		return { ok: true, forceMerged: true };
	}

	const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
	const tasks = waveTaskIds
		.map((taskId) => (state.tasks ?? []).find((task) => task?.taskId === taskId))
		.filter(Boolean);

	const failed = tasks.filter((task) => task.status === "failed");
	const pending = tasks.filter(
		(task) => task.status === "pending" || task.status === "running",
	);

	if (failed.length === 0 && pending.length === 0) {
		return { ok: true };
	}

	return {
		ok: false,
		failedTaskIds: failed.map((task) => task.taskId),
		pendingTaskIds: pending.map((task) => task.taskId),
		message: formatMixedOutcomeMessage(failed, pending),
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {number} params.waveIndex
 */
export function forceMergeWave({ projectRoot, waveIndex }) {
	const loaded = loadSpineBatchState(projectRoot);
	if (!loaded.raw) {
		return { ok: false, exitCode: 1, error: "no_active_batch", output: "No active pi-spine batch.\n" };
	}

	const state = loaded.raw;
	const phase = String(state.phase ?? "");
	if (phase !== "failed" && phase !== "paused") {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_force_merge",
			output: `Force-merge is allowed when batch phase is failed or paused (current: ${phase}).\n`,
			batchId: state.batchId,
		};
	}

	state.resilience = state.resilience ?? {};
	state.resilience.forceMergedWaves = [...(state.resilience.forceMergedWaves ?? []), waveIndex];
	saveSpineBatchState(projectRoot, state);

	appendJournalEvent(projectRoot, state.batchId, "batch.force_merge_requested", {
		waveIndex,
	});

	return {
		ok: true,
		exitCode: 0,
		batchId: state.batchId,
		waveIndex,
		output: `Wave ${waveIndex} marked for force-merge. Resume with: spine batch resume --force\n`,
	};
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return execFileSync("git", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {object} params
 * @param {boolean} [params.requireLaneCommits] When true, task branch must be ahead of orch before merge (post lane auto-commit).
 */
export function mergeLaneToOrch({
	projectRoot,
	baseBranch,
	orchBranch,
	taskBranch,
	batchId,
	requireLaneCommits = false,
}) {
	const previous = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	try {
		const orchHeadBefore = git(projectRoot, ["rev-parse", orchBranch]);
		const commitsAhead = countCommitsAhead(projectRoot, orchBranch, taskBranch);

		if (requireLaneCommits && commitsAhead === 0) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Task branch ${taskBranch} has no commits ahead of ${orchBranch} after lane auto-commit. ` +
					`Worker may have created .DONE without persisting file changes to git.`,
			};
		}

		git(projectRoot, ["checkout", orchBranch]);
		git(projectRoot, ["merge", "--no-ff", taskBranch, "-m", `merge ${taskBranch} into ${orchBranch}`]);
		const mergeCommit = git(projectRoot, ["rev-parse", "HEAD"]);

		if (requireLaneCommits && mergeCommit === orchHeadBefore) {
			return {
				ok: false,
				failureClass: "EmptyMerge",
				error:
					`Merge into ${orchBranch} did not advance HEAD (still ${orchHeadBefore.slice(0, 7)}). ` +
					`Lane work was not integrated.`,
			};
		}

		return { ok: true, mergeCommit, commitsAhead };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	} finally {
		try {
			git(projectRoot, ["checkout", previous || baseBranch]);
		} catch {
			git(projectRoot, ["checkout", baseBranch]);
		}
	}
}

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
function transitionPhase(state, newPhase, ctx) {
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

/**
 * @param {object} state
 */
function recomputeTaskCounters(state) {
	const tasks = state.tasks ?? [];
	state.succeededTasks = tasks.filter((task) => task?.status === "succeeded").length;
	state.failedTasks = tasks.filter((task) => task?.status === "failed").length;
	state.skippedTasks = tasks.filter((task) => task?.status === "skipped").length;
}

/**
 * @param {object} params
 */
function buildTasksAndLanesFromPlan({ plan, discovered, projectRoot, batchId, maxLaneNumber }) {
	const assignments = buildTaskLaneAssignments(plan);
	const taskIds = countPlanTasks(plan);

	/** @type {Record<number, string[]>} */
	const laneTaskIds = {};
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		laneTaskIds[laneNumber] = [];
	}

	const tasks = taskIds.map((taskId) => {
		const entry = discovered.find((task) => task.taskId === taskId);
		const assignment = assignments.get(taskId) ?? { laneNumber: 1 };
		laneTaskIds[assignment.laneNumber].push(taskId);
		return {
			taskId,
			laneNumber: assignment.laneNumber,
			status: "pending",
			taskFolder: entry?.folderPath ?? null,
			startedAt: null,
			endedAt: null,
			doneFileFound: false,
			exitReason: null,
		};
	});

	const lanes = [];
	for (let laneNumber = 1; laneNumber <= maxLaneNumber; laneNumber++) {
		lanes.push({
			laneNumber,
			laneId: `lane-${laneNumber}`,
			worktreePath: laneWorktreePath(projectRoot, batchId, laneNumber),
			branch: laneTaskBranch(batchId, laneNumber),
			taskIds: laneTaskIds[laneNumber] ?? [],
			lastHeartbeatAt: null,
		});
	}

	return { tasks, lanes, assignments };
}

/**
 * @param {object} params
 */
async function runTaskOnLane({
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

	task.status = "running";
	if (!task.startedAt) task.startedAt = Date.now();
	updateSegmentForTask(state, taskId, "running");
	saveSpineBatchState(projectRoot, state);
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
		config,
		onHeartbeat: (timestamp) => {
			lane.lastHeartbeatAt = timestamp;
			saveSpineBatchState(projectRoot, state);
		},
		onWorkerPid: (pid) => {
			if (pid > 0) {
				lane.workerPid = pid;
				saveSpineBatchState(projectRoot, state);
			}
		},
	});

	if (!workerResult.ok) {
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
		saveSpineBatchState(projectRoot, state);
		if (!aborted) {
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				...workerResult,
			});
		}
		return { ok: false, aborted, workerResult };
	}

	appendJournalEvent(projectRoot, batchId, "lane.completed", {
		laneNumber,
		laneId: lane.laneId,
		taskId,
		correlationId: laneCorrelationId,
	});
	task.status = "succeeded";
	task.endedAt = Date.now();
	task.doneFileFound = true;
	task.exitReason = "done";
	updateSegmentForTask(state, taskId, "succeeded");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.completed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
	});

	const laneCommit = commitLaneWorktree({
		worktreePath: wt,
		taskBranch,
		taskId,
		batchId,
		taskFolder: taskFolderInWorktree,
	});
	if (!laneCommit.ok) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = laneCommit.failureClass ?? "lane_commit_failed";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		return {
			ok: false,
			error: "lane_commit_failed",
			output: laneCommit.error,
		};
	}
	if (laneCommit.committed) {
		appendJournalEvent(projectRoot, batchId, "lane.committed", {
			taskId,
			laneNumber,
			commitSha: laneCommit.commitSha,
		});
	}

	const remainingDirty = gitPorcelain(wt);
	if (remainingDirty) {
		task.status = "failed";
		task.endedAt = Date.now();
		task.exitReason = "DirtyWorktree";
		updateSegmentForTask(state, taskId, "failed");
		recomputeTaskCounters(state);
		saveSpineBatchState(projectRoot, state);
		return {
			ok: false,
			error: "dirty_after_lane_commit",
			output:
				"Lane worktree still has uncommitted changes after auto-commit — commit manually or fix worker output",
		};
	}

	return { ok: true, laneCommit };
}

/**
 * @param {object} params
 */
async function mergeWaveLanesToOrch({
	projectRoot,
	state,
	batchId,
	baseBranch,
	orchBranch,
	waveIndex,
}) {
	const lanes = state.lanes ?? [];
	let lastMergeCommit = null;

	for (const lane of lanes) {
		const laneNumber = lane.laneNumber;
		const waveTaskIds = state.wavePlan?.[waveIndex] ?? [];
		const laneSucceeded = waveTaskIds.some((taskId) => {
			const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
			return task && task.laneNumber === laneNumber && task.status === "succeeded";
		});
		if (!laneSucceeded) continue;

		const taskBranch = lane.branch ?? laneTaskBranch(batchId, laneNumber);
		appendJournalEvent(projectRoot, batchId, "batch.merge_started", {
			taskBranch,
			orchBranch,
			laneNumber,
			waveIndex,
		});

		const merge = mergeLaneToOrch({
			projectRoot,
			baseBranch,
			orchBranch,
			taskBranch,
			batchId,
			requireLaneCommits: false,
		});
		if (!merge.ok) {
			return { ok: false, error: merge.error ?? "merge_failed", laneNumber };
		}
		lastMergeCommit = merge.mergeCommit;
		appendJournalEvent(projectRoot, batchId, "batch.merge_completed", {
			mergeCommit: merge.mergeCommit,
			laneNumber,
			waveIndex,
		});
	}

	state.mergeResults.push({
		waveIndex,
		status: "succeeded",
		failedLane: null,
		failureReason: null,
		mergeCommit: lastMergeCommit,
	});
	saveSpineBatchState(projectRoot, state);

	return { ok: true, mergeCommit: lastMergeCommit };
}

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

	const plan = buildPlan({ scope, config, tasksRoot });
	const batchPolicy = canStartMultiTaskBatch(plan, scope);
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
				/** @type {Promise<{ ok: boolean, aborted?: boolean }>[]} */
				const tickRuns = [];

				for (let laneInTick = 0; laneInTick < (tick.lanes?.length ?? 0); laneInTick++) {
					const tickTaskIds = tick.lanes[laneInTick] ?? [];
					if (tickTaskIds.length === 0) continue;

					const laneNumber = laneInTick + 1;
					const lane = state.lanes.find((entry) => entry.laneNumber === laneNumber);
					if (!lane) continue;

					for (const taskId of tickTaskIds) {
						const task = state.tasks.find((entry) => entry.taskId === taskId);
						const entry = discovered.find((item) => item.taskId === taskId);
						if (!task || !entry) continue;

						const taskFolderRel = path.relative(projectRoot, entry.folderPath);

						tickRuns.push(
							runTaskOnLane({
								projectRoot,
								state,
								batchId,
								baseBranch,
								config,
								task,
								lane,
								taskFolderRel,
								laneCorrelationId: lane.correlationId ?? crypto.randomUUID(),
							}).then((result) => {
								if (result.aborted) batchAborted = true;
								return result;
							}),
						);
					}
				}

				await Promise.all(tickRuns);
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
		}

		state.endedAt = Date.now();
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
				`  → spine integrate\n  → spine batch complete\n  → spine status\n`,
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
