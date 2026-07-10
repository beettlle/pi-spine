// @ts-nocheck
/** Diagnosis derivation and reconcile orchestration (SP-596). */

import fs from "node:fs";
import path from "node:path";
import { buildStalePathDoctorCheck } from "../doctor/stale-path.mjs";
import { PACKAGE_ROOT } from "../config/spine-init-constants.mjs";
import { loadGateRecord } from "./gate-evidence-read.mjs";
import { deriveMacroPhase, macroPhaseLabel } from "./macro-phase.mjs";
import {
	buildDiagnosisOutput,
	inferLaunchFailureFromWorkerOutputTail,
	inferLaunchFailureKind,
	inferMergeGitignoredFailure,
} from "./diagnosis.mjs";
import {
	classifyTasks,
	inspectGitState,
	inspectHumanBaseSync,
	resolveTasksRoot,
	syncPersistedClassifications,
} from "./reconcile-classify.mjs";
import { findLatestReviewHonorSignal } from "./review.mjs";
import { summarizeMergeFailures } from "./diagnosis-merge-failure.mjs";
import { inferWorkerDoneMissingFailure } from "./diagnosis-worker-done-missing.mjs";
import { inferEngineOrphanCause } from "./diagnosis-parent-exit.mjs";
import {
	findStubMarkedSucceededTask,
	inferStubExitReasonForTask,
} from "./diagnosis-stub.mjs";
import { workerOutputLogPath, workerOutputLogRef } from "./worker-output.mjs";
import { detectOrphanRunning, journalEventsSinceResume } from "./orphan-detect.mjs";
import { isPostMergeLimbo } from "./limbo-detect.mjs";
import { computePendingTasks } from "./resume-multi.mjs";
import { computeStatusProgress } from "./status-json.mjs";
import {
	detectBatchStateDrift,
	rebuildBatchStateFromJournal,
	reconcileBatchStateDrift,
} from "./journal-rebuild.mjs";
import {
	appendJournalEvent,
	extractJournalDiagnosisHints,
	findPlanReviewNestedSpawnBlockedFailure,
	journalPath,
	readJournalEvents,
} from "./journal.mjs";
import { findLatestSalvageInspection } from "./salvage.mjs";
import { isProcessAlive } from "../process/liveness.mjs";
import {
	loadBatchStateFile,
	parseBatchState,
	readBaseBranchHeadAtStart,
} from "./batch-state-io.mjs";
import {
	clearBatchEnginePid,
	readBatchEnginePid,
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "./state.mjs";

const LIMBO_PHASES = new Set(["stopped", "failed", "executing"]);
const RUNNING_PHASES = new Set(["planning", "running", "executing", "merging"]);

/** @type {{ projectRoot: string|null, batchId: string|null, phase: string|null, git: object|null, diagnosis: string|null }} */
let _lightReconcileCache = {
	projectRoot: null,
	batchId: null,
	phase: null,
	git: null,
	diagnosis: null,
};

/**
 * Clears light-reconcile git cache (test isolation).
 */
export function clearLightReconcileCache() {
	_lightReconcileCache = {
		projectRoot: null,
		batchId: null,
		phase: null,
		git: null,
		diagnosis: null,
	};
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} phase
 */
function lightReconcileCacheMatches(projectRoot, batchId, phase) {
	return (
		_lightReconcileCache.projectRoot === projectRoot &&
		_lightReconcileCache.batchId === batchId &&
		_lightReconcileCache.phase === phase &&
		_lightReconcileCache.git != null
	);
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} phase
 * @param {object} git
 * @param {string|null} diagnosis
 */
function updateLightReconcileCache(projectRoot, batchId, phase, git, diagnosis) {
	_lightReconcileCache = { projectRoot, batchId, phase, git, diagnosis };
}

const HUMAN_SYNC_OVERRIDE_DIAGNOSES = new Set([
	"completed",
	"completed_manual",
	"needs_integrate",
	"limbo_stale",
	"running",
	"paused",
]);

/**
 * @param {unknown} rawTasks
 * @param {string|null} failedTaskId
 * @returns {string|null}
 */
function resolveFailedExitReason(rawTasks, failedTaskId) {
	if (!failedTaskId || !Array.isArray(rawTasks)) return null;
	const match = rawTasks.find((entry) => {
		if (!entry || typeof entry !== "object") return false;
		return String(entry.taskId ?? entry.id ?? "") === failedTaskId;
	});
	if (!match || typeof match !== "object") return null;
	const exitReason = /** @type {{ exitReason?: unknown }} */ (match).exitReason;
	return typeof exitReason === "string" && exitReason ? exitReason : null;
}

/**
 * @param {string|null} failedTaskId
 * @param {object} signals
 * @returns {string|null}
 */
function resolvePrimaryFailureExitReason(failedTaskId, signals) {
	const fromTask = resolveFailedExitReason(signals.raw?.tasks, failedTaskId);
	if (fromTask) return fromTask;
	if (!failedTaskId) return null;
	if (Array.isArray(signals.segments)) {
		const segment = signals.segments.find((entry) => entry?.taskId === failedTaskId);
		const classification = segment?.classification;
		if (
			typeof classification === "string" &&
			classification &&
			classification !== "terminal-failure"
		) {
			return classification;
		}
	}
	if (Array.isArray(signals.journalEvents)) {
		for (let index = signals.journalEvents.length - 1; index >= 0; index -= 1) {
			const event = signals.journalEvents[index];
			if (event.type !== "task.failed") continue;
			const eventTaskId = event.taskId ?? event.payload?.taskId;
			if (eventTaskId !== failedTaskId) continue;
			const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
			const reason = payload.exitReason ?? payload.classification;
			if (typeof reason === "string" && reason) return reason;
		}
	}
	return null;
}

/**
 * @param {string|null} failedTaskId
 * @param {string|null} exitReason
 * @param {object} signals
 * @returns {{ exitReason: string|null, launchFailureKind: string|null }}
 */
function deriveFailureContext(failedTaskId, exitReason, signals) {
	let resolvedExitReason =
		exitReason ?? resolvePrimaryFailureExitReason(failedTaskId, signals);
	if (failedTaskId && signals.tasksRoot) {
		const taskFolder =
			signals.tasks?.find((entry) => entry.taskId === failedTaskId)?.taskFolder ?? null;
		const stubReason = inferStubExitReasonForTask(signals.tasksRoot, failedTaskId, taskFolder);
		if (stubReason) {
			resolvedExitReason = stubReason;
		}
	}
	const launchFailureKind = inferLaunchFailureKind({
		exitReason: resolvedExitReason,
		journalEvents: signals.journalEvents,
		failedTaskId,
	});
	return { exitReason: resolvedExitReason, launchFailureKind };
}

const WORKER_OUTPUT_TAIL_LINES = 20;

/**
 * @param {string} filePath
 * @param {number} [lineCount]
 * @returns {string|null}
 */
function readWorkerOutputLogTail(filePath, lineCount = WORKER_OUTPUT_TAIL_LINES) {
	if (!fs.existsSync(filePath)) return null;
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	if (lines.length === 0) return null;
	return lines.slice(-lineCount).join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null} failedTaskId
 * @param {Array<{ taskId: string, laneNumber?: number|null }>} tasks
 * @param {string|null} launchFailureKind
 * @returns {string|null}
 */
function enrichLaunchFailureFromWorkerOutput(projectRoot, batchId, failedTaskId, tasks, launchFailureKind) {
	if (launchFailureKind || !failedTaskId || !batchId) return launchFailureKind;
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	if (!task || task.laneNumber == null) return launchFailureKind;
	const logPath = workerOutputLogPath(projectRoot, batchId, task.laneNumber, failedTaskId);
	const tail = readWorkerOutputLogTail(logPath);
	return inferLaunchFailureFromWorkerOutputTail(tail) ?? launchFailureKind;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string|null} failedTaskId
 * @param {Array<{ taskId: string, laneNumber?: number|null }>} tasks
 * @param {object|null} doneMissingHint
 * @returns {{ workerOutputLogRef: string|null, workerOutputLogPath: string|null, workerOutputTail: string|null, workerOutputSnippet: string|null, changedFileCount: number|null }}
 */
function enrichWorkerDoneMissingContext(
	projectRoot,
	batchId,
	failedTaskId,
	tasks,
	doneMissingHint,
) {
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	const laneNumber = task?.laneNumber;
	const logRef =
		doneMissingHint?.workerOutputLogRef ??
		(failedTaskId && laneNumber != null
			? workerOutputLogRef(batchId, laneNumber, failedTaskId)
			: null);
	const logPath =
		doneMissingHint?.workerOutputLogPath ??
		(failedTaskId && laneNumber != null
			? workerOutputLogPath(projectRoot, batchId, laneNumber, failedTaskId)
			: null);
	const tailFromDisk = logPath ? readWorkerOutputLogTail(logPath) : null;
	const outputText = [doneMissingHint?.output, tailFromDisk].filter(Boolean).join("\n");
	const snippet = outputText
		? outputText
				.split("\n")
				.filter(Boolean)
				.slice(-3)
				.join(" | ")
		: null;

	return {
		workerOutputLogRef: logRef,
		workerOutputLogPath: logPath,
		workerOutputTail: tailFromDisk,
		workerOutputSnippet: snippet,
		changedFileCount:
			doneMissingHint?.changedFileCount != null ? doneMissingHint.changedFileCount : null,
	};
}

/**
 * @param {Array<{ taskId: string, classification: string, laneNumber?: number|null }>} tasks
 * @param {string|null} failedTaskId
 * @returns {boolean}
 */
function hasGhostRunningCluster(tasks, failedTaskId) {
	if (!failedTaskId) return false;
	const task = tasks.find((entry) => entry.taskId === failedTaskId);
	if (!task || task.laneNumber == null) return false;
	const laneNumber = Number(task.laneNumber);
	return (
		tasks.filter(
			(entry) =>
				entry.classification === "running" && Number(entry.laneNumber) === laneNumber,
		).length > 1
	);
}

/**
 * @param {object[]} journalEvents
 * @param {string|null} failedTaskId
 * @returns {string[]}
 */
function extractGitignoredPathsFromJournal(journalEvents, failedTaskId) {
	if (!Array.isArray(journalEvents)) return [];
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event.type !== "task.failed") continue;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		if (failedTaskId && eventTaskId && eventTaskId !== failedTaskId) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (Array.isArray(payload.gitignoredPaths)) {
			return payload.gitignoredPaths.filter((entry) => typeof entry === "string");
		}
	}
	return [];
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string} batchId
 * @param {string} taskId
 * @returns {string|null}
 */
function laneTaskBranchForDiagnosis(raw, batchId, taskId) {
	const tasks = raw?.tasks;
	if (!Array.isArray(tasks)) return null;
	const task = tasks.find((entry) => entry?.taskId === taskId);
	if (!task || task.laneNumber == null) return null;
	return `task/spine-lane-${task.laneNumber}-${batchId}`;
}

/**
 * @param {string} diagnosis
 * @param {string|null} failedTaskId
 * @param {object} signals
 * @param {string|null} [exitReason]
 */
function withFailureContext(diagnosis, failedTaskId, signals, exitReason = null) {
	const context = deriveFailureContext(failedTaskId, exitReason, signals);
	return {
		diagnosis,
		failedTaskId,
		exitReason: context.exitReason,
		launchFailureKind: context.launchFailureKind,
	};
}

/**
 * @param {object[]} journalEvents
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {string|null} taskId
 */
function journalIndicatesResumeRulesStall(journalEvents, raw, taskId) {
	const scoped = journalEventsSinceResume(journalEvents, raw);
	const hasRulesSelected = scoped.some((event) => {
		if (event.type !== "worker.rules_selected") return false;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		return !taskId || !eventTaskId || eventTaskId === taskId;
	});
	const hasBatchResumed = scoped.some((event) => event.type === "batch.resumed");
	return hasRulesSelected && hasBatchResumed;
}

/**
 * @param {object} signals
 */
function findNeedsReplanTask(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return (
		tasks.find(
			(task) =>
				task?.exitReason === "needs_replan" &&
				(task.status === "failed" || task.classification === "terminal-failure"),
		) ?? null
	);
}

/**
 * @param {object} signals
 */
function hasNeedsReplanBlocker(signals) {
	const tasks = signals.raw?.tasks ?? signals.tasks ?? [];
	return tasks.some((task) => task?.exitReason === "needs_replan");
}

/**
 * @param {object} signals
 */
export function deriveDiagnosis(signals) {
	const {
		phase,
		endedAt,
		failedTasks,
		allTasksTerminalSuccess,
		hasRunningTasks,
		hasPendingTasks,
		hasFailedTasks,
		hasSegmentDrift,
		failedTaskId,
		mergeResultsEmpty,
		git,
		orphanRunning,
	} = signals;

	if (orphanRunning) {
		if (orphanRunning.kind === "lane" && orphanRunning.taskId) {
			const enginePid = readBatchEnginePid(signals.raw);
			const engineDead = enginePid == null || !isProcessAlive(enginePid);
			const resumeRulesStall = journalIndicatesResumeRulesStall(
				signals.journalEvents ?? [],
				signals.raw,
				orphanRunning.taskId,
			);
			if (engineDead && resumeRulesStall) {
				return withFailureContext("engine_orphaned", orphanRunning.taskId, signals);
			}
			return withFailureContext("worker_orphaned", orphanRunning.taskId, signals);
		}
		return withFailureContext("engine_orphaned", orphanRunning.taskId ?? null, signals);
	}

	if (signals.stateDrift?.drifted) {
		const driftTask = signals.stateDrift.entries.find((entry) => entry.taskId !== "*");
		return withFailureContext("state_drift", driftTask?.taskId ?? null, signals);
	}

	if (
		!hasRunningTasks &&
		hasPendingTasks &&
		Array.isArray(signals.tasks) &&
		signals.tasks.some(
			(task) =>
				task?.doneInLane === true &&
				(task.status === "pending" || task.status === "running" || task.classification === "pending" || task.classification === "running"),
		)
	) {
		const driftTask = signals.tasks.find((task) => task?.doneInLane);
		return withFailureContext("needs_retry", driftTask?.taskId ?? null, signals);
	}

	if (git?.gitInspectionError) {
		return withFailureContext("git_unavailable", null, signals);
	}

	if (phase === "aborted") {
		return withFailureContext("aborted", null, signals);
	}
	if (phase === "completed" && endedAt != null) {
		if (git.orchBranchExists && !git.orchMergedToBase) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("completed", null, signals);
	}

	const limboSignals =
		allTasksTerminalSuccess &&
		failedTasks === 0 &&
		LIMBO_PHASES.has(phase) &&
		endedAt == null &&
		mergeResultsEmpty;

	if (limboSignals && git.orchMergedToBase) {
		return withFailureContext("completed_manual", null, signals);
	}

	if (limboSignals) {
		return withFailureContext("limbo_stale", null, signals);
	}

	if (hasFailedTasks || hasSegmentDrift) {
		const replanTask = findNeedsReplanTask(signals);
		if (replanTask) {
			return withFailureContext(
				"needs_replan",
				replanTask.taskId ?? failedTaskId,
				signals,
				"needs_replan",
			);
		}
		const doneMissing = inferWorkerDoneMissingFailure({
			journalEvents: signals.journalEvents,
			failedTaskId,
		});
		if (doneMissing) {
			return withFailureContext("worker_done_missing", failedTaskId, signals);
		}
		return withFailureContext("needs_retry", failedTaskId, signals);
	}

	if (hasNeedsReplanBlocker(signals)) {
		const replanTask = findNeedsReplanTask(signals);
		return withFailureContext(
			"needs_replan",
			replanTask?.taskId ?? failedTaskId,
			signals,
			"needs_replan",
		);
	}

	const postMergeLimbo = isPostMergeLimbo(signals.raw ?? {}, git);
	signals.postMergeLimbo = postMergeLimbo;

	if (postMergeLimbo) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (phase === "merge_blocked") {
		return withFailureContext("failed", null, signals);
	}

	if (
		phase === "merging" &&
		endedAt != null &&
		Array.isArray(signals.raw?.mergeResults) &&
		signals.raw.mergeResults.some((entry) => String(entry?.status ?? "").toLowerCase() === "failed")
	) {
		return withFailureContext("failed", null, signals);
	}

	if (phase === "merging" || (allTasksTerminalSuccess && mergeResultsEmpty && git.orchBranchExists && !git.orchMergedToBase)) {
		if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && !mergeResultsEmpty) {
			return withFailureContext("needs_integrate", null, signals);
		}
		return withFailureContext("needs_merge", null, signals);
	}

	if (allTasksTerminalSuccess && git.orchBranchExists && !git.orchMergedToBase && mergeResultsEmpty) {
		return withFailureContext("needs_integrate", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		hasPendingTasks
	) {
		return withFailureContext("needs_retry", null, signals);
	}

	if (
		phase === "failed" &&
		!hasFailedTasks &&
		!hasSegmentDrift &&
		allTasksTerminalSuccess &&
		mergeResultsEmpty
	) {
		return withFailureContext("needs_merge", null, signals);
	}

	if (phase === "failed" || (failedTasks > 0 && !hasPendingTasks && !hasRunningTasks)) {
		return withFailureContext("failed", failedTaskId, signals);
	}

	if (phase === "paused") {
		return withFailureContext("paused", null, signals);
	}

	if (RUNNING_PHASES.has(phase) || hasRunningTasks || hasPendingTasks) {
		return withFailureContext("running", null, signals);
	}

	return withFailureContext("paused", null, signals);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {object|null} [ctx.batchState]
 * @param {string|null} [ctx.batchStatePath]
 * @param {boolean} [ctx.verbose]
 * @param {boolean} [ctx.light] Skip git branch scans when batch phase unchanged since last full reconcile.
 * @param {boolean} [ctx._lightRetry] Internal — full reconcile after light diagnosis transition.
 */
export function reconcileBatch(ctx, _lightRetry = false) {
	const { projectRoot } = ctx;
	const loaded = ctx.batchState
		? {
				path: ctx.batchStatePath ?? null,
				raw: ctx.batchState,
				parseError: null,
			}
		: loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path && !loaded.raw) {
		clearLightReconcileCache();
		return {
			diagnosis: null,
			headline: "No active batch — ready to plan or start",
			suggestedCommand: "spine preflight",
			alternatives: ["spine plan all"],
			batchId: null,
			batchStatePath: null,
			phase: null,
			macroPhase: "idle",
			macroPhaseLabel: macroPhaseLabel("idle"),
			signals: { idle: true, macroPhase: "idle" },
		};
	}

	if (loaded.parseError) {
		return {
			diagnosis: "failed",
			headline: `Cannot parse batch state: ${loaded.parseError}`,
			suggestedCommand: "spine status --diagnose",
			alternatives: ["spine doctor"],
			batchId: null,
			batchStatePath: loaded.path,
			phase: null,
			macroPhase: "failed",
			macroPhaseLabel: macroPhaseLabel("failed"),
			signals: { parseError: loaded.parseError, macroPhase: "failed" },
		};
	}

	const batch = parseBatchState(loaded.raw ?? ctx.batchState, loaded.path ?? ctx.batchStatePath ?? "");
	if (!batch) {
		return {
			diagnosis: "failed",
			headline: "Batch state is unreadable",
			suggestedCommand: "spine status --diagnose",
			batchId: null,
			batchStatePath: loaded.path,
			phase: null,
			macroPhase: "failed",
			macroPhaseLabel: macroPhaseLabel("failed"),
			signals: { unreadable: true, macroPhase: "failed" },
		};
	}

	const tasksRoot = resolveTasksRoot(projectRoot);
	let classifiedTasks = classifyTasks(batch, tasksRoot, projectRoot);
	const useLightGit =
		ctx.light === true &&
		!_lightRetry &&
		lightReconcileCacheMatches(projectRoot, batch.batchId, batch.phase);
	const git = useLightGit
		? /** @type {ReturnType<typeof inspectGitState>} */ (_lightReconcileCache.git)
		: inspectGitState({
				projectRoot,
				batchId: batch.batchId,
				baseBranch: batch.baseBranch,
				orchBranch: batch.orchBranch,
			});

	const hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
	const hasPendingTasks = classifiedTasks.some((task) => task.classification === "pending");
	const pendingWithFailedSegment = batch.segments.some(
		(segment) => segment.classification === "terminal-failure",
	);
	const driftTask = batch.tasks.find((task) => {
		if (task.classification !== "pending") return false;
		return batch.segments.some(
			(segment) => segment.taskId === task.taskId && segment.classification === "terminal-failure",
		);
	});
	const hasSegmentDrift = pendingWithFailedSegment || Boolean(driftTask);
	const hasFailedTasks =
		classifiedTasks.some((task) => task.classification === "terminal-failure") ||
		hasSegmentDrift ||
		batch.failedTasks > 0;
	const allTasksTerminalSuccess =
		classifiedTasks.length > 0 &&
		classifiedTasks.every((task) => task.classification === "terminal-success");
	const failedTask = classifiedTasks.find((task) => task.classification === "terminal-failure");

	const signals = {
		phase: batch.phase,
		endedAt: batch.endedAt,
		failedTasks: hasFailedTasks ? Math.max(batch.failedTasks, 1) : batch.failedTasks,
		allTasksTerminalSuccess,
		hasRunningTasks,
		hasPendingTasks,
		hasFailedTasks,
		hasSegmentDrift,
		failedTaskId: failedTask?.taskId ?? driftTask?.taskId ?? null,
		mergeResultsEmpty: batch.mergeResults.length === 0,
		git,
		tasks: classifiedTasks,
		tasksRoot,
		segments: batch.segments,
		lanes: batch.lanes,
		raw: batch.raw,
	};

	const journalFile = journalPath(projectRoot, batch.batchId);
	/** @type {object[]} */
	let journalEvents = [];
	if (fs.existsSync(journalFile)) {
		journalEvents = readJournalEvents(projectRoot, batch.batchId);
		signals.journalHints = extractJournalDiagnosisHints(journalEvents);
		signals.journalEvents = journalEvents;
	}

	const engineSessionJournalEvents = journalEventsSinceResume(journalEvents, batch.raw);

	if (journalEvents.length > 0 && batch.raw) {
		let rebuilt = rebuildBatchStateFromJournal(batch.raw, journalEvents);
		let drift = detectBatchStateDrift(batch.raw, rebuilt, journalEvents, classifiedTasks);
		const healed = reconcileBatchStateDrift({
			projectRoot,
			state: batch.raw,
			classifiedTasks,
			journalEvents,
			drift,
		});
		if (healed.reconciled) {
			journalEvents = readJournalEvents(projectRoot, batch.batchId);
			const refreshed = parseBatchState(batch.raw, loaded.path ?? ctx.batchStatePath ?? "");
			if (refreshed) {
				batch.tasks = refreshed.tasks;
				batch.segments = refreshed.segments;
				batch.succeededTasks = refreshed.succeededTasks;
				batch.failedTasks = refreshed.failedTasks;
				batch.lanes = refreshed.lanes;
			}
			classifiedTasks = classifyTasks(batch, tasksRoot, projectRoot);
			rebuilt = rebuildBatchStateFromJournal(batch.raw, journalEvents);
			drift = detectBatchStateDrift(batch.raw, rebuilt, journalEvents, classifiedTasks);
		}
		signals.stateDrift = drift;
		signals.rebuiltFromJournal = rebuilt;
		if (healed.reconciled) {
			signals.journalEvents = journalEvents;
			signals.tasks = classifiedTasks;
			signals.hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
			signals.hasPendingTasks = classifiedTasks.some((task) => task.classification === "pending");
			signals.allTasksTerminalSuccess =
				classifiedTasks.length > 0 &&
				classifiedTasks.every((task) => task.classification === "terminal-success");
			const healedFailedTask = classifiedTasks.find(
				(task) => task.classification === "terminal-failure",
			);
			signals.failedTaskId = healedFailedTask?.taskId ?? signals.failedTaskId;
		}
	}

	if (batch.raw) {
		syncPersistedClassifications({ projectRoot, state: batch.raw });
	}

	signals.orphanRunning = detectOrphanRunning({
		phase: batch.phase,
		hasRunningTasks: signals.hasRunningTasks,
		tasks: classifiedTasks,
		lanes: batch.lanes,
		raw: batch.raw,
		journalEvents: engineSessionJournalEvents,
	});

	const pendingTaskCount = computePendingTasks(batch.raw ?? {}).length;
	signals.pendingTaskCount = pendingTaskCount;

	const derived = deriveDiagnosis(signals);
	let { diagnosis, failedTaskId, exitReason } = derived;
	const launchFailureKind = derived.launchFailureKind;
	const stubSucceededTaskId = findStubMarkedSucceededTask(tasksRoot, classifiedTasks);
	if (
		stubSucceededTaskId &&
		(diagnosis === "completed" ||
			diagnosis === "needs_integrate" ||
			diagnosis === "limbo_stale" ||
			diagnosis === "completed_manual")
	) {
		diagnosis = "needs_retry";
		failedTaskId = stubSucceededTaskId;
		exitReason = "stub";
	}

	const humanBaseSync = inspectHumanBaseSync({
		projectRoot,
		baseBranch: batch.baseBranch,
		baseBranchHeadAtStart: readBaseBranchHeadAtStart(batch.raw),
		orchBranch: batch.orchBranch,
		git,
		journalEvents,
	});
	if (humanBaseSync && HUMAN_SYNC_OVERRIDE_DIAGNOSES.has(diagnosis)) {
		diagnosis = humanBaseSync.diagnosis;
	}

	const doneMissingHint =
		diagnosis === "worker_done_missing"
			? inferWorkerDoneMissingFailure({
					journalEvents,
					failedTaskId,
				})
			: null;
	const doneMissingContext =
		diagnosis === "worker_done_missing"
			? enrichWorkerDoneMissingContext(
					projectRoot,
					batch.batchId,
					failedTaskId,
					classifiedTasks,
					doneMissingHint,
				)
			: null;
	const resolvedLaunchFailureKind =
		diagnosis === "worker_orphaned"
			? enrichLaunchFailureFromWorkerOutput(
					projectRoot,
					batch.batchId,
					failedTaskId,
					classifiedTasks,
					launchFailureKind,
				)
			: launchFailureKind;
	const ghostRunningCluster =
		diagnosis === "worker_orphaned" && hasGhostRunningCluster(classifiedTasks, failedTaskId);
	const salvagePayload = findLatestSalvageInspection(journalEvents, failedTaskId);
	const salvageChangedFileCount = Number(salvagePayload?.changedFileCount ?? 0) || 0;
	const salvageRetryCommand =
		typeof salvagePayload?.retryCommand === "string"
			? salvagePayload.retryCommand
			: signals.orphanRunning?.taskId
				? `spine batch retry ${signals.orphanRunning.taskId}`
				: null;

	const gateRecord = batch.batchId ? loadGateRecord(projectRoot, batch.batchId) : null;
	const integrateGateOpen = signals.postMergeLimbo === true && Boolean(gateRecord);

	const macroPhase = deriveMacroPhase({
		diagnosis,
		batchPhase: batch.phase,
		gateRecord,
		postMergeLimbo: signals.postMergeLimbo === true,
		journalEvents,
		mergeResults: batch.mergeResults,
		hasActiveWorkerTasks: hasRunningTasks || hasPendingTasks,
		allTasksTerminalSuccess: signals.allTasksTerminalSuccess,
		mergeResultsEmpty: signals.mergeResultsEmpty,
	});
	const resolvedMacroPhaseLabel = macroPhaseLabel(macroPhase);
	if (ctx.verbose) {
		signals.macroPhase = macroPhase;
		signals.reconcileMode = useLightGit ? "light" : "full";
	}

	const stalePathCheck = buildStalePathDoctorCheck({
		packageRoot: PACKAGE_ROOT,
		runningSpinePath: path.join(PACKAGE_ROOT, "bin", "spine.mjs"),
	});
	const stalePathSpine = stalePathCheck.warning === true;
	const planReviewNestedSpawnBlocked =
		diagnosis === "worker_orphaned" &&
		findPlanReviewNestedSpawnBlockedFailure(journalEvents, failedTaskId);

	const mergeGitignoredFailure = inferMergeGitignoredFailure({
		exitReason,
		failureClass: batch.raw?.mergeResults?.find((entry) => entry?.failureClass)?.failureClass ?? null,
		lastError: batch.raw?.lastError ?? null,
		journalEvents,
	});
	const mergeFailureSummary = summarizeMergeFailures(
		batch.mergeResults,
		batch.raw?.lastError ?? null,
	);
	signals.mergeFailed = mergeFailureSummary.mergeFailed;
	signals.failedMerges = mergeFailureSummary.failedMerges;
	signals.failedWaveIndex = mergeFailureSummary.failedWaveIndex;
	signals.failedLane = mergeFailureSummary.failedLane;
	signals.lastError = mergeFailureSummary.lastError;
	const gitignoredPaths = extractGitignoredPathsFromJournal(journalEvents, failedTaskId);
	const taskBranch =
		failedTaskId != null
			? laneTaskBranchForDiagnosis(batch.raw, batch.batchId, failedTaskId)
			: null;
	const driftTaskStatus =
		failedTaskId != null
			? String(
					(batch.raw?.tasks ?? []).find((entry) => entry?.taskId === failedTaskId)?.status ?? "",
				)
			: null;

	const activeReviewTaskId =
		failedTaskId ??
		classifiedTasks.find((task) => task.classification === "running")?.taskId ??
		null;
	const reviewHonorSignal = findLatestReviewHonorSignal(journalEvents, activeReviewTaskId);
	if (ctx.verbose) {
		signals.reviewHonor = reviewHonorSignal;
	}

	const enginePid = readBatchEnginePid(batch.raw);
	const staleEnginePid =
		enginePid != null && !isProcessAlive(enginePid);
	const engineOrphanCause =
		diagnosis === "engine_orphaned"
			? inferEngineOrphanCause({ journalEvents, staleEnginePid })
			: null;

	const output = buildDiagnosisOutput(diagnosis, {
		batchId: batch.batchId,
		phase: batch.phase,
		failedTasks: signals.failedTasks,
		failedTaskId,
		driftTaskStatus,
		exitReason,
		launchFailureKind: resolvedLaunchFailureKind,
		gitMerged: git.orchMergedToBase,
		pendingTaskCount,
		salvageChangedFileCount,
		salvageRetryCommand,
		ghostRunningCluster,
		postMergeLimbo: signals.postMergeLimbo === true,
		integrateGateOpen,
		stalePathSpine,
		planReviewNestedSpawnBlocked,
		mergeGitignoredFailure,
		mergeFailed: mergeFailureSummary.mergeFailed,
		failedWaveIndex: mergeFailureSummary.failedWaveIndex,
		failedLane: mergeFailureSummary.failedLane,
		lastError: mergeFailureSummary.lastError,
		succeededTasks: batch.succeededTasks,
		totalTasks: batch.totalTasks,
		taskBranch,
		gitignoredPaths,
		hasRunningTasks,
		hasPendingTasks,
		allTasksTerminalSuccess: signals.allTasksTerminalSuccess,
		tasksRoot,
		macroPhase,
		reviewHonorSignal,
		...(doneMissingContext ?? {}),
		engineOrphanCause,
		staleEnginePid,
		humanBaseSync,
		overlapPaths: humanBaseSync?.overlapPaths ?? [],
	});

	if (humanBaseSync && (diagnosis === "human_base_diverged" || diagnosis === "integrate_isolated_ok")) {
		output.headline = humanBaseSync.headline;
	}

	if (diagnosis === "git_unavailable") {
		output.headline = `Batch ${batch.batchId} — git inspection failed: ${git.gitInspectionError}`;
		output.suggestedCommand = "spine doctor";
		output.alternatives = ["spine status --diagnose"];
	}

	const progress = computeStatusProgress({
		batchRaw: batch.raw,
		succeededTasks: batch.succeededTasks,
		totalTasks: batch.totalTasks,
		pendingTasks: pendingTaskCount,
	});

	if (
		ctx.light === true &&
		useLightGit &&
		!_lightRetry &&
		_lightReconcileCache.diagnosis != null &&
		_lightReconcileCache.diagnosis !== diagnosis
	) {
		return reconcileBatch({ ...ctx, light: false }, true);
	}

	if (!useLightGit) {
		updateLightReconcileCache(projectRoot, batch.batchId, batch.phase, git, diagnosis);
	} else {
		_lightReconcileCache.diagnosis = diagnosis;
	}

	return {
		...output,
		batchId: batch.batchId,
		batchStatePath: loaded.path ?? ctx.batchStatePath ?? null,
		phase: batch.phase,
		macroPhase,
		macroPhaseLabel: resolvedMacroPhaseLabel,
		failedTasks: signals.failedTasks,
		succeededTasks: batch.succeededTasks,
		totalTasks: batch.totalTasks,
		pendingTasks: progress?.pendingTasks,
		currentWaveIndex: progress?.currentWaveIndex,
		waveCount: progress?.waveCount,
		mergeFailed: mergeFailureSummary.mergeFailed,
		failedMerges: mergeFailureSummary.failedMerges,
		failedWaveIndex: mergeFailureSummary.failedWaveIndex,
		failedLane: mergeFailureSummary.failedLane,
		lastError: mergeFailureSummary.lastError,
		signals: ctx.verbose ? signals : undefined,
	};
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {object|null} [ctx.batchState]
 * @param {string|null} [ctx.batchStatePath]
 */
export function runReconciliationCheck(ctx) {
	return reconcileBatch(ctx);
}

/**
 * @param {unknown[]} lanes
 * @param {number|null|undefined} laneNumber
 */
function findLaneForOrphanReconcile(lanes, laneNumber) {
	if (!Array.isArray(lanes)) return null;
	if (laneNumber != null) {
		const match = lanes.find((lane) => Number(lane?.laneNumber) === Number(laneNumber));
		if (match) return match;
	}
	return lanes[0] ?? null;
}

/**
 * Classify tasks for orphan reconcile (status-only, mirrors resume validation).
 *
 * @param {object[]} tasks
 */
function classifyTasksForOrphanReconcile(tasks) {
	return (tasks ?? []).map((task) => {
		const status = String(task?.status ?? "").toLowerCase();
		return {
			taskId: task.taskId,
			laneNumber: task.laneNumber,
			classification: status === "running" ? "running" : status,
		};
	});
}

/**
 * @param {object[]} journalEvents
 * @param {string} taskId
 * @param {string} eventType
 */
function journalHasTaskEvent(journalEvents, taskId, eventType) {
	return journalEvents.some((event) => {
		if (String(event?.type ?? "") !== eventType) return false;
		const eventTaskId = event.taskId ?? event.payload?.taskId;
		return eventTaskId === taskId;
	});
}

/**
 * Transition orphan running tasks to failed so retry/resume paths succeed (SP-315 / #20).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @returns {{ reconciled: boolean, taskId?: string|null, kind?: string, exitReason?: string }}
 */
export function reconcileOrphanRunningState({ projectRoot, state }) {
	if (!state || typeof state !== "object") {
		return { reconciled: false };
	}

	const batchId = String(state.batchId ?? "");
	if (!batchId) {
		return { reconciled: false };
	}

	const classifiedTasks = classifyTasksForOrphanReconcile(state.tasks);
	const hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
	const journalEvents = readJournalEvents(projectRoot, batchId);
	const scopedJournalEvents = journalEventsSinceResume(journalEvents, state);
	const orphanRunning = detectOrphanRunning({
		phase: String(state.phase ?? ""),
		hasRunningTasks,
		tasks: classifiedTasks,
		lanes: state.lanes ?? [],
		raw: state,
		journalEvents: scopedJournalEvents,
	});

	if (!orphanRunning) {
		return { reconciled: false };
	}

	const exitReason = orphanRunning.kind === "engine" ? "engine_orphaned" : "worker_orphaned";
	/** @type {string[]} */
	const taskIdsToFail =
		orphanRunning.kind === "lane" && orphanRunning.taskId
			? [orphanRunning.taskId]
			: classifiedTasks
					.filter((task) => task.classification === "running")
					.map((task) => task.taskId)
					.filter(Boolean);

	if (taskIdsToFail.length === 0) {
		return { reconciled: false };
	}

	const now = Date.now();
	let changed = false;

	for (const taskId of taskIdsToFail) {
		const task = (state.tasks ?? []).find((entry) => entry?.taskId === taskId);
		if (!task || task.status !== "running") continue;

		task.status = "failed";
		task.endedAt = now;
		task.exitReason = exitReason;
		updateSegmentForTask(state, taskId, "failed");
		changed = true;

		if (!journalHasTaskEvent(scopedJournalEvents, taskId, "task.failed")) {
			const lane = findLaneForOrphanReconcile(state.lanes, task.laneNumber);
			appendJournalEvent(projectRoot, batchId, "task.failed", {
				taskId,
				laneNumber: task.laneNumber ?? null,
				laneId: lane?.laneId ?? null,
				reason: exitReason,
				reconciled: true,
			});
		}

		if (
			orphanRunning.kind === "lane" &&
			!journalHasTaskEvent(scopedJournalEvents, taskId, "lane.died")
		) {
			const lane = findLaneForOrphanReconcile(state.lanes, task.laneNumber);
			appendJournalEvent(projectRoot, batchId, "lane.died", {
				taskId,
				laneNumber: task.laneNumber ?? null,
				laneId: lane?.laneId ?? null,
				reason: exitReason,
				reconciled: true,
			});
		}
	}

	for (const lane of state.lanes ?? []) {
		if (!lane || typeof lane !== "object") continue;
		const workerPid = Number(/** @type {{ workerPid?: number }} */ (lane).workerPid);
		if (Number.isFinite(workerPid) && workerPid > 0 && !isProcessAlive(workerPid)) {
			delete lane.workerPid;
			changed = true;
		}
	}

	const enginePid = readBatchEnginePid(state);
	if (enginePid != null && !isProcessAlive(enginePid)) {
		clearBatchEnginePid(state);
		changed = true;
	}

	if (!changed) {
		return { reconciled: false };
	}

	recomputeTaskCounters(state);
	if (String(state.phase ?? "") === "running") {
		state.phase = "failed";
		state.endedAt = state.endedAt ?? now;
		state.lastError =
			state.lastError ?? `Orphan reconcile: ${exitReason} (task ${taskIdsToFail.join(", ")})`;
	}

	saveSpineBatchState(projectRoot, state);

	return {
		reconciled: true,
		taskId: orphanRunning.taskId ?? taskIdsToFail[0] ?? null,
		kind: orphanRunning.kind,
		exitReason,
	};
}
