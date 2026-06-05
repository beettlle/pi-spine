/**
 * Batch reconciliation (FR-BATCH-12, §17.5).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { resolveTasksRootPath } from "../config/env-overrides.mjs";
import { buildDiagnosisOutput, inferLaunchFailureKind } from "./diagnosis.mjs";
import { detectOrphanRunning, journalEventsSinceResume } from "./orphan-detect.mjs";
import { computePendingTasks } from "./resume-multi.mjs";
import { extractJournalDiagnosisHints, journalPath, readJournalEvents } from "./journal.mjs";
import { findLatestSalvageInspection } from "./salvage.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { parseSpineBatchState } from "./readers/spine-state.mjs";
import { parseTaskplaneBatchState } from "./readers/taskplane-state.mjs";

const LIMBO_PHASES = new Set(["stopped", "failed", "executing"]);
const RUNNING_PHASES = new Set(["planning", "running", "executing", "merging"]);

/**
 * @typedef {object} NormalizedTask
 * @property {string} taskId
 * @property {string} status
 * @property {string|null} taskFolder
 * @property {boolean} doneFileFound
 * @property {string} classification
 * @property {boolean} [doneOnDisk]
 */

/**
 * @typedef {object} NormalizedBatchState
 * @property {"spine"|"taskplane"} source
 * @property {string} batchId
 * @property {string} phase
 * @property {string} baseBranch
 * @property {string|null} orchBranch
 * @property {unknown} startedAt
 * @property {unknown} endedAt
 * @property {number} failedTasks
 * @property {number} succeededTasks
 * @property {number} totalTasks
 * @property {unknown[]} mergeResults
 * @property {NormalizedTask[]} tasks
 * @property {Array<{ segmentId: string, taskId: string, status: string, classification: string }>} segments
 * @property {unknown[]} lanes
 * @property {Record<string, unknown>} raw
 */

/**
 * @typedef {object} ReconciliationResult
 * @property {string|null} diagnosis
 * @property {string} headline
 * @property {string} suggestedCommand
 * @property {string[]} [alternatives]
 * @property {string|null} [batchId]
 * @property {string|null} [batchStatePath]
 * @property {string|null} [phase]
 * @property {object} [signals]
 */

/**
 * @param {string} projectRoot
 */
export function resolveBatchStatePath(projectRoot) {
	const spinePath = path.join(projectRoot, ".spine", "batch-state.json");
	if (fs.existsSync(spinePath)) return spinePath;

	const piPath = path.join(projectRoot, ".pi", "batch-state.json");
	if (fs.existsSync(piPath)) return piPath;

	return null;
}

/**
 * @param {string} projectRoot
 * @param {string|null} [batchStatePath]
 */
export function loadBatchStateFile(projectRoot, batchStatePath = null) {
	const resolved = batchStatePath ?? resolveBatchStatePath(projectRoot);
	if (!resolved) return { path: null, raw: null, parseError: null };

	try {
		const raw = JSON.parse(fs.readFileSync(resolved, "utf-8"));
		return { path: resolved, raw, parseError: null };
	} catch (err) {
		return { path: resolved, raw: null, parseError: err.message };
	}
}

/**
 * @param {unknown} raw
 * @param {string} batchStatePath
 */
export function parseBatchState(raw, batchStatePath) {
	if (!raw) return null;
	if (batchStatePath.includes(`${path.sep}.pi${path.sep}`)) {
		return parseTaskplaneBatchState(raw);
	}
	return parseSpineBatchState(raw) ?? parseTaskplaneBatchState(raw);
}

/**
 * @param {string} projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [configResult]
 */
export function resolveTasksRoot(projectRoot, configResult) {
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	if (!loaded.config) {
		return null;
	}
	return resolveTasksRootPath(projectRoot, loaded.config);
}

/**
 * @param {string} tasksRoot
 * @param {string} taskId
 * @param {string|null} taskFolder
 */
function resolveTaskFolder(tasksRoot, taskId, taskFolder) {
	if (taskFolder) {
		const direct = path.join(tasksRoot, taskFolder);
		if (fs.existsSync(direct)) return direct;
	}

	if (!tasksRoot || !fs.existsSync(tasksRoot)) return null;

	const match = fs
		.readdirSync(tasksRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${taskId}-`))
		.map((entry) => path.join(tasksRoot, entry.name))[0];

	return match ?? null;
}

/**
 * @param {NormalizedBatchState} batch
 * @param {string|null} tasksRoot
 */
export function classifyTasks(batch, tasksRoot) {
	return batch.tasks.map((task) => {
		const folderPath =
			tasksRoot && task.taskId
				? resolveTaskFolder(tasksRoot, task.taskId, task.taskFolder)
				: null;
		const doneOnDisk = folderPath ? fs.existsSync(path.join(folderPath, ".DONE")) : false;

		let classification = task.classification;
		if (doneOnDisk || task.doneFileFound) {
			classification = "terminal-success";
		}

		return {
			...task,
			doneOnDisk,
			classification,
		};
	});
}

/**
 * @param {string} projectRoot
 */
function isInsideGitRepo(projectRoot) {
	try {
		execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function gitRefExists(projectRoot, ref) {
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} ancestor
 * @param {string} descendant
 */
function gitIsAncestor(projectRoot, ancestor, descendant) {
	try {
		execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function listOrchBranches(projectRoot, batchId) {
	try {
		const output = execFileSync("git", ["branch", "-a", "--list", "*orch*"], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		});

		return output
			.split(/\r?\n/)
			.map((line) => line.trim().replace(/^\*?\s+/, "").replace(/^remotes\/[^/]+\//, ""))
			.filter(Boolean)
			.filter((branch) => branch.includes(batchId));
	} catch {
		return [];
	}
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {string} ctx.batchId
 * @param {string} ctx.baseBranch
 * @param {string|null} ctx.orchBranch
 */
export function inspectGitState(ctx) {
	const { projectRoot, batchId, baseBranch, orchBranch } = ctx;
	const result = {
		inGitRepo: isInsideGitRepo(projectRoot),
		baseBranch,
		orchBranch,
		orchBranches: [],
		orchBranchExists: false,
		orchMergedToBase: false,
		mergedOrchBranch: null,
		orchCommitsAhead: null,
	};

	if (!result.inGitRepo) return result;

	const candidates = new Set(listOrchBranches(projectRoot, batchId));
	if (orchBranch) candidates.add(orchBranch);
	candidates.add(`orch/cdelgado-${batchId}`);
	candidates.add(`orch/spine-*-${batchId}`.replace("*", "operator"));

	result.orchBranches = [...candidates].filter((branch) => !branch.includes("*"));

	for (const branch of result.orchBranches) {
		if (!gitRefExists(projectRoot, branch)) continue;
		result.orchBranchExists = true;
		if (gitIsAncestor(projectRoot, branch, baseBranch)) {
			result.orchMergedToBase = true;
			result.mergedOrchBranch = branch;
			break;
		}
	}

	const resolvedOrch = orchBranch && gitRefExists(projectRoot, orchBranch) ? orchBranch : result.mergedOrchBranch;
	if (resolvedOrch && gitRefExists(projectRoot, resolvedOrch) && !result.orchMergedToBase) {
		try {
			result.orchCommitsAhead = countCommitsAhead(projectRoot, baseBranch, resolvedOrch);
		} catch {
			result.orchCommitsAhead = null;
		}
	}

	if (!result.orchMergedToBase) {
		try {
			const merged = execFileSync("git", ["branch", "--merged", baseBranch], {
				cwd: projectRoot,
				encoding: "utf-8",
				timeout: 5000,
			});
			const mergedOrch = merged
				.split(/\r?\n/)
				.map((line) => line.trim().replace(/^\*?\s+/, ""))
				.filter((branch) => branch.includes("orch") && branch.includes(batchId));
			if (mergedOrch.length > 0) {
				result.orchMergedToBase = true;
				result.mergedOrchBranch = mergedOrch[0];
				result.orchBranchExists = true;
			}
		} catch {
			// ignore git errors
		}
	}

	return result;
}

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
 * @param {string|null} exitReason
 * @param {object} signals
 * @returns {{ exitReason: string|null, launchFailureKind: string|null }}
 */
function deriveFailureContext(failedTaskId, exitReason, signals) {
	const resolvedExitReason =
		exitReason ?? resolveFailedExitReason(signals.raw?.tasks, failedTaskId);
	const launchFailureKind = inferLaunchFailureKind({
		exitReason: resolvedExitReason,
		journalEvents: signals.journalEvents,
		failedTaskId,
	});
	return { exitReason: resolvedExitReason, launchFailureKind };
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
			return withFailureContext("needs_retry", orphanRunning.taskId, signals);
		}
		return withFailureContext("engine_orphaned", orphanRunning.taskId ?? null, signals);
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
		return withFailureContext("needs_retry", failedTaskId, signals);
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
 */
export function reconcileBatch(ctx) {
	const { projectRoot } = ctx;
	const loaded = ctx.batchState
		? {
				path: ctx.batchStatePath ?? null,
				raw: ctx.batchState,
				parseError: null,
			}
		: loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path && !loaded.raw) {
		return {
			diagnosis: null,
			headline: "No active batch — ready to plan or start",
			suggestedCommand: "spine preflight",
			alternatives: ["spine plan all"],
			batchId: null,
			batchStatePath: null,
			phase: null,
			signals: { idle: true },
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
			signals: { parseError: loaded.parseError },
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
			signals: { unreadable: true },
		};
	}

	const tasksRoot = resolveTasksRoot(projectRoot);
	const classifiedTasks = classifyTasks(batch, tasksRoot);
	const git = inspectGitState({
		projectRoot,
		batchId: batch.batchId,
		baseBranch: batch.baseBranch,
		orchBranch: batch.orchBranch,
	});

	const hasRunningTasks = classifiedTasks.some((task) => task.classification === "running");
	const hasPendingTasks = classifiedTasks.some((task) => task.classification === "pending");
	const hasFailedTasks = classifiedTasks.some((task) => task.classification === "terminal-failure");
	const allTasksTerminalSuccess =
		classifiedTasks.length > 0 &&
		classifiedTasks.every((task) => task.classification === "terminal-success");
	const failedTask = classifiedTasks.find((task) => task.classification === "terminal-failure");
	const pendingWithFailedSegment = batch.segments.some(
		(segment) => segment.classification === "terminal-failure",
	);
	const driftTask = batch.tasks.find((task) => {
		if (task.classification !== "pending") return false;
		return batch.segments.some(
			(segment) => segment.taskId === task.taskId && segment.classification === "terminal-failure",
		);
	});

	const signals = {
		phase: batch.phase,
		endedAt: batch.endedAt,
		failedTasks: hasFailedTasks ? Math.max(batch.failedTasks, 1) : batch.failedTasks,
		allTasksTerminalSuccess,
		hasRunningTasks,
		hasPendingTasks,
		hasFailedTasks,
		hasSegmentDrift: pendingWithFailedSegment || Boolean(driftTask),
		failedTaskId: failedTask?.taskId ?? driftTask?.taskId ?? null,
		mergeResultsEmpty: batch.mergeResults.length === 0,
		git,
		tasks: classifiedTasks,
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

	signals.orphanRunning = detectOrphanRunning({
		phase: batch.phase,
		hasRunningTasks,
		tasks: classifiedTasks,
		lanes: batch.lanes,
		raw: batch.raw,
		journalEvents: engineSessionJournalEvents,
	});

	const pendingTaskCount = computePendingTasks(batch.raw ?? {}).length;
	signals.pendingTaskCount = pendingTaskCount;

	const { diagnosis, failedTaskId, exitReason, launchFailureKind } = deriveDiagnosis(signals);
	const salvagePayload = findLatestSalvageInspection(journalEvents, failedTaskId);
	const salvageChangedFileCount = Number(salvagePayload?.changedFileCount ?? 0) || 0;
	const salvageRetryCommand =
		typeof salvagePayload?.retryCommand === "string"
			? salvagePayload.retryCommand
			: signals.orphanRunning?.taskId
				? `spine batch retry ${signals.orphanRunning.taskId}`
				: null;

	const output = buildDiagnosisOutput(diagnosis, {
		batchId: batch.batchId,
		phase: batch.phase,
		failedTasks: signals.failedTasks,
		failedTaskId,
		exitReason,
		launchFailureKind,
		gitMerged: git.orchMergedToBase,
		pendingTaskCount,
		salvageChangedFileCount,
		salvageRetryCommand,
	});

	return {
		...output,
		batchId: batch.batchId,
		batchStatePath: loaded.path ?? ctx.batchStatePath ?? null,
		phase: batch.phase,
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
