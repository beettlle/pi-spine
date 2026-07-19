/**
 * Dashboard snapshot builder (PRD §16, NFR-OBS-04).
 * Thin assembly: `buildDashboardSnapshot` composes snapshot-lanes and snapshot-waves.
 */

import fs from "node:fs";
import path from "node:path";
import { deriveMacroPhase, macroPhaseLabel } from "../batch/macro-phase.mjs";
import {
	classifyTasks,
	loadBatchStateFile,
	parseBatchState,
	reconcileBatch,
} from "../batch/reconcile.mjs";
import { loadGateRecord, formatGateSummary } from "../batch/gate.mjs";
import {
	readJournalEventsCached,
	readJournalTail,
} from "../batch/journal.mjs";
import { resolveStallConfig } from "../batch/heartbeat.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { formatElapsedMs } from "./lane-throughput.mjs";
import {
	deriveLanesThroughput,
	summarizeLaneThroughput,
} from "./lane-throughput.mjs";
import {
	filterMetricsLines,
	metricsFilePath,
	readMetricsLines,
} from "../batch/metrics.mjs";
import { consumeDashboardInvalidateSignal } from "./cache-invalidate.mjs";
import { parsePrompt } from "../tasks/packet/parse-prompt.mjs";
import { buildLaneRows } from "./snapshot-lanes.mjs";
import {
	buildDefaultViewStatus,
	buildWaveProgress,
	formatJournalTailEntry,
	resolveTailActivityLabel,
	summarizeBatch,
} from "./snapshot-waves.mjs";

/** Last N journal events included in dashboard snapshot tail (not full journal per client). */
export const DASHBOARD_JOURNAL_TAIL_LIMIT = 20;

/**
 * @param {number} laneNumber
 * @param {object[]} journalEvents
 */
export function resolveSubprocessHeartbeatMeta(laneNumber, journalEvents) {
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event.type !== "lane.heartbeat") continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (payload.laneNumber != null && payload.laneNumber !== laneNumber) continue;
		if (event.laneId && event.laneId !== `lane-${laneNumber}`) continue;
		return {
			workerPhase: typeof payload.workerPhase === "string" ? payload.workerPhase : null,
			subprocessCommand:
				typeof payload.subprocessCommand === "string" ? payload.subprocessCommand : null,
			subprocessStartedAtMs:
				payload.subprocessStartedAtMs != null ? Number(payload.subprocessStartedAtMs) : null,
		};
	}
	return { workerPhase: null, subprocessCommand: null, subprocessStartedAtMs: null };
}

/**
 * @param {object} params
 * @param {string} params.subprocessCommand
 * @param {number | null} [params.subprocessStartedAtMs]
 * @param {number} [params.now]
 */
export function formatSubprocessHeartbeatDisplay({
	subprocessCommand,
	subprocessStartedAtMs,
	now = Date.now(),
}) {
	const elapsedMs =
		subprocessStartedAtMs != null && Number.isFinite(subprocessStartedAtMs)
			? Math.max(0, now - subprocessStartedAtMs)
			: null;
	const elapsed = elapsedMs != null ? formatElapsedMs(elapsedMs) : null;
	if (elapsed && elapsed !== "—") {
		return `running ${subprocessCommand} (${elapsed})`;
	}
	return `running ${subprocessCommand}`;
}

/**
 * @param {object[]} lanes
 * @param {object[]} journalEvents
 * @param {number} [now]
 */
export function enrichLaneRowsWithSubprocessHeartbeat(lanes, journalEvents, now = Date.now()) {
	return (lanes ?? []).map((lane) => {
		const subprocessMeta = resolveSubprocessHeartbeatMeta(lane.laneNumber, journalEvents);
		if (subprocessMeta.workerPhase !== "subprocess" || !subprocessMeta.subprocessCommand) {
			return lane;
		}
		return {
			...lane,
			workerPhase: subprocessMeta.workerPhase,
			subprocessCommand: subprocessMeta.subprocessCommand,
			subprocessStartedAtMs: subprocessMeta.subprocessStartedAtMs,
			heartbeatDisplay: formatSubprocessHeartbeatDisplay({
				subprocessCommand: subprocessMeta.subprocessCommand,
				subprocessStartedAtMs: subprocessMeta.subprocessStartedAtMs,
				now,
			}),
		};
	});
}

/**
 * In-memory cache of parsed task titles keyed by absolute PROMPT.md path.
 * Titles are immutable per file; mtime invalidates the entry so edits show up.
 * Keyed by path (not taskId) so distinct project roots never cross-contaminate.
 * @type {Map<string, { mtimeMs: number, title: string | null }>}
 */
const taskTitleCache = new Map();

/**
 * Read and parse a single PROMPT.md title with mtime-aware caching.
 * Any read/parse failure degrades gracefully to null (PRD: graceful fallback).
 *
 * @param {string} promptPath Absolute path to a task PROMPT.md
 * @returns {string | null}
 */
function readTaskTitleFromPrompt(promptPath) {
	try {
		const stat = fs.statSync(promptPath);
		const cached = taskTitleCache.get(promptPath);
		if (cached && cached.mtimeMs === stat.mtimeMs) return cached.title;
		const title = parsePrompt(fs.readFileSync(promptPath, "utf-8")).title ?? null;
		taskTitleCache.set(promptPath, { mtimeMs: stat.mtimeMs, title });
		return title;
	} catch {
		return null;
	}
}

/**
 * Resolve the absolute PROMPT.md path for a task. Uses the batch's `taskFolder`
 * when present, falling back to scanning the tasks root for `${taskId}-*`.
 *
 * @param {string} tasksRootPath Absolute tasks root directory
 * @param {string} taskId
 * @param {string | null | undefined} taskFolder
 * @returns {string | null}
 */
function resolveTaskPromptPath(tasksRootPath, taskId, taskFolder) {
	if (taskFolder) {
		return path.join(tasksRootPath, taskFolder, "PROMPT.md");
	}
	try {
		for (const name of fs.readdirSync(tasksRootPath)) {
			if (name.startsWith(`${taskId}-`)) {
				return path.join(tasksRootPath, name, "PROMPT.md");
			}
		}
	} catch {
		// Tasks root missing or unreadable — degrade to no title.
	}
	return null;
}

/**
 * Build a taskId → title map by parsing each task's PROMPT.md.
 *
 * @param {string} projectRoot
 * @param {string | null | undefined} tasksRoot Configured tasks root (relative to projectRoot)
 * @param {Array<{ taskId?: unknown, taskFolder?: string | null }> | null | undefined} tasks
 * @returns {Map<string, string | null>}
 */
export function resolveRunningTaskTitles(projectRoot, tasksRoot, tasks) {
	const titles = new Map();
	if (!projectRoot || !tasksRoot || !Array.isArray(tasks)) return titles;
	const tasksRootPath = path.join(projectRoot, tasksRoot);
	for (const task of tasks) {
		const taskId = task?.taskId != null ? String(task.taskId) : "";
		if (!taskId || titles.has(taskId)) continue;
		const promptPath = resolveTaskPromptPath(tasksRootPath, taskId, task?.taskFolder ?? null);
		titles.set(taskId, promptPath ? readTaskTitleFromPrompt(promptPath) : null);
	}
	return titles;
}

/**
 * Attach `runningTaskTitle` to each lane row from the resolved title map.
 * Lanes without a running task (or an unresolvable title) get null.
 *
 * @param {object[]} lanes
 * @param {Map<string, string | null>} taskTitles
 */
export function enrichLaneRowsWithRunningTaskTitle(lanes, taskTitles) {
	return (lanes ?? []).map((lane) => {
		const title =
			lane?.runningTaskId != null
				? (taskTitles.get(String(lane.runningTaskId)) ?? null)
				: null;
		return { ...lane, runningTaskTitle: title };
	});
}

/**
 * @param {string} projectRoot
 */
export function buildDashboardSnapshot(projectRoot) {
	consumeDashboardInvalidateSignal(projectRoot);
	const configResult = loadSpineConfig(projectRoot);
	const stallConfig = resolveStallConfig(configResult.config ?? {});
	const reconciliation = reconcileBatch({ projectRoot, verbose: true });

	let batch = null;
	if (reconciliation.batchStatePath) {
		const loaded = loadBatchStateFile(projectRoot, reconciliation.batchStatePath);
		if (loaded.raw) {
			batch = parseBatchState(loaded.raw, loaded.path ?? reconciliation.batchStatePath);
		}
	}

	const classifiedTasks =
		reconciliation.signals?.tasks ??
		(batch ? classifyTasks(batch, null) : []);

	let gate = null;
	if (reconciliation.batchId) {
		const record = loadGateRecord(projectRoot, reconciliation.batchId);
		if (record) {
			gate = {
				gateId: record.gateId,
				batchId: record.batchId,
				kind: record.kind,
				status: record.status,
				openedAt: record.openedAt,
				summary: formatGateSummary(record),
				evidenceRefs: record.evidenceRefs ?? [],
			};
		}
	}

	let journalTail = [];
	let journalEvents = [];
	if (reconciliation.batchId) {
		journalEvents = readJournalEventsCached(projectRoot, reconciliation.batchId);
		journalTail = readJournalTail(journalEvents, DASHBOARD_JOURNAL_TAIL_LIMIT).map(
			formatJournalTailEntry,
		);
	}

	const now = Date.now();
	const rawBatch =
		batch?.raw && typeof batch.raw === "object"
			? /** @type {Record<string, unknown>} */ (batch.raw)
			: {};
	const currentWaveIndex = Number(rawBatch.currentWaveIndex ?? 0);
	const wavePlan = Array.isArray(rawBatch.wavePlan) ? rawBatch.wavePlan : [];
	const currentWaveTaskIds = Array.isArray(wavePlan[currentWaveIndex])
		? wavePlan[currentWaveIndex].map(String)
		: [];

	const config = configResult.config ?? {};
	let metricsLines = [];
	if (reconciliation.batchId) {
		const metricsPath = metricsFilePath(projectRoot, config);
		metricsLines = filterMetricsLines(readMetricsLines(metricsPath), {
			batchId: reconciliation.batchId,
		});
	}

	const lanes = enrichLaneRowsWithSubprocessHeartbeat(
		enrichLaneRowsWithRunningTaskTitle(
			buildLaneRows({
				lanes: batch?.lanes ?? [],
				classifiedTasks,
				stallConfig,
				currentWaveTaskIds,
				journalTail,
				journalEvents,
				metricsLines,
				projectRoot,
				batchId: reconciliation.batchId,
				now,
				diagnosis: reconciliation.diagnosis,
			}),
			resolveRunningTaskTitles(projectRoot, config?.paths?.tasksRoot ?? null, batch?.tasks),
		),
		journalEvents,
		now,
	);
	const laneThroughputSummary = summarizeLaneThroughput(
		deriveLanesThroughput({
			lanes: batch?.lanes ?? [],
			journalEvents,
			metricsLines,
			tasks: batch?.tasks,
			now,
		}),
	);
	const waves = buildWaveProgress(batch, classifiedTasks, {
		diagnosis: reconciliation.diagnosis,
		endedAt: batch?.endedAt ?? null,
	});
	const defaultView = buildDefaultViewStatus(reconciliation, gate);

	const macroPhase = deriveMacroPhase({
		diagnosis: reconciliation.diagnosis,
		batchPhase: batch?.phase ?? reconciliation.phase,
		currentWaveIndex,
		mergeResults: Array.isArray(rawBatch.mergeResults) ? rawBatch.mergeResults : [],
		gateRecord: gate,
		postMergeLimbo: reconciliation.signals?.postMergeLimbo === true,
		journalEvents,
	});
	const resolvedMacroPhaseLabel = macroPhaseLabel(macroPhase);
	const batchSummary = summarizeBatch(batch, reconciliation);
	if (batchSummary) {
		batchSummary.macroPhase = macroPhase;
		batchSummary.macroPhaseLabel = resolvedMacroPhaseLabel;
	}

	const tailActivityLabel = resolveTailActivityLabel({
		reconciliation,
		batch: batchSummary,
		lanes,
		macroPhase,
		macroPhaseLabel: resolvedMacroPhaseLabel,
		journalEvents,
	});

	return {
		generatedAt: new Date(now).toISOString(),
		defaultView,
		diagnosis: reconciliation.diagnosis,
		headline: reconciliation.headline,
		suggestedCommand: reconciliation.suggestedCommand,
		alternatives: reconciliation.alternatives ?? [],
		reviewHonor: reconciliation.signals?.reviewHonor ?? null,
		batchId: reconciliation.batchId,
		phase: reconciliation.phase,
		batchStatePath: reconciliation.batchStatePath,
		reconciliation,
		batch: batchSummary,
		macroPhase,
		macroPhaseLabel: resolvedMacroPhaseLabel,
		tailActivityLabel,
		lanes,
		laneThroughputSummary,
		gate,
		journalTail,
		waves,
	};
}

export {
	buildLaneLogTail,
	buildLaneRecentEvents,
	buildLaneRows,
	classifyLaneStatus,
	computeActiveTaskIdsForLane,
	computeQueuedTaskIdsForLane,
	computeRunningTaskIdForLane,
	formatLaneHeartbeatDisplay,
	heartbeatAgeSeconds,
	laneEventMatches,
	readLogFileTailLines,
	resolveLaneActivityPhase,
	resolveLaneAlert,
	resolveLaneHeartbeatMeta,
	resolveLaneWorkerLog,
	truncateWorktreePath,
} from "./snapshot-lanes.mjs";

export {
	buildDefaultViewStatus,
	buildWaveProgress,
	formatJournalTailEntry,
	lanesHaveActiveTasks,
	resolveTailActivityFromJournal,
	resolveTailActivityLabel,
} from "./snapshot-waves.mjs";
