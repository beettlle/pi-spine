// @ts-nocheck
/** Main reconcileBatch orchestration (SP-606 / #192). */

import fs from "node:fs";
import path from "node:path";
import { buildStalePathDoctorCheck } from "../doctor/stale-path.mjs";
import { PACKAGE_ROOT } from "../config/spine-init-constants.mjs";
import { loadGateRecord } from "./gate-evidence-read.mjs";
import { deriveMacroPhase, macroPhaseLabel } from "./macro-phase.mjs";
import {
	buildDiagnosisOutput,
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
import { findStubMarkedSucceededTask } from "./diagnosis-stub.mjs";
import { detectOrphanRunning, journalEventsSinceResume } from "./orphan-detect.mjs";
import { computePendingTasks } from "./resume-multi.mjs";
import { computeStatusProgress } from "./status-json.mjs";
import {
	detectBatchStateDrift,
	rebuildBatchStateFromJournal,
	reconcileBatchStateDrift,
} from "./journal-rebuild.mjs";
import {
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
import { readBatchEnginePid } from "./state.mjs";
import {
	deriveDiagnosis,
	enrichLaunchFailureFromWorkerOutput,
	enrichWorkerDoneMissingContext,
	extractGitignoredPathsFromJournal,
	hasGhostRunningCluster,
	laneTaskBranchForDiagnosis,
} from "./reconcile-diagnosis.mjs";
import {
	HUMAN_SYNC_OVERRIDE_DIAGNOSES,
	_lightReconcileCache,
	clearLightReconcileCache,
	lightReconcileCacheMatches,
	updateLightReconcileCache,
} from "./reconcile-light-cache.mjs";

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
