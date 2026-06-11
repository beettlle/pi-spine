/**
 * Handoff data assembly and rendering (FR-UXB-05, §7.4).
 */

import fs from "node:fs";
import path from "node:path";

import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { HANDOFF_DEFAULTS } from "../config/defaults.mjs";
import {
	classifyTasks,
	loadBatchStateFile,
	parseBatchState,
	reconcileBatch,
} from "../batch/reconcile.mjs";
import {
	readJournalEvents,
	readJournalTail,
	redactSecrets,
} from "../batch/journal.mjs";
import { computePendingTasks } from "../batch/resume-multi-validate.mjs";
import { formatJournalTailEntry } from "../dashboard/snapshot.mjs";

const SECRET_VALUE_PATTERN =
	/\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*\s*=\s*\S+|\b(sk-[A-Za-z0-9_-]{8,})\b/gi;

const JOURNAL_TAIL_LIMIT = 10;

/**
 * @param {string} text
 */
export function redactHandoffText(text) {
	if (typeof text !== "string") return text;
	return text.replace(SECRET_VALUE_PATTERN, "[REDACTED]");
}

/**
 * @param {unknown} value
 */
export function redactHandoffSecrets(value) {
	if (value == null || typeof value !== "object") {
		return typeof value === "string" ? redactHandoffText(value) : value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => redactHandoffSecrets(entry));
	}

	const redacted = redactSecrets(value);
	if (!redacted || typeof redacted !== "object") {
		return typeof redacted === "string" ? redactHandoffText(redacted) : redacted;
	}

	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (redacted))) {
		out[key] = redactHandoffSecrets(entry);
	}
	return out;
}

/**
 * @param {string} projectRoot
 */
function resolveHandoffPath(projectRoot) {
	const loaded = loadSpineConfig(projectRoot);
	const configured = loaded.config?.handoff?.path;
	return configured && typeof configured === "string" ? configured : HANDOFF_DEFAULTS.path;
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 */
function loadArchivedBatchState(projectRoot, batchId) {
	const archivePath = path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"archive",
		"batch-state.json",
	);
	if (!fs.existsSync(archivePath)) return null;
	try {
		const raw = JSON.parse(fs.readFileSync(archivePath, "utf-8"));
		return { path: archivePath, raw, batchId };
	} catch {
		return null;
	}
}

/**
 * @param {object[]} lanes
 * @param {import("../batch/reconcile.mjs").NormalizedTask[]} classifiedTasks
 */
function buildLaneSummary(lanes, classifiedTasks) {
	return (lanes ?? []).map((lane) => {
		const taskIds = lane.taskIds ?? [];
		return redactSecrets({
			laneNumber: lane.laneNumber,
			laneId: lane.laneId ?? `lane-${lane.laneNumber}`,
			taskIds,
			tasks: taskIds.map((taskId) => {
				const task = classifiedTasks.find((entry) => entry.taskId === taskId);
				return {
					taskId,
					status: task?.status ?? "unknown",
					classification: task?.classification ?? "unknown",
				};
			}),
		});
	});
}

/**
 * @param {{ suggestedCommand?: string|null, alternatives?: string[] }} reconciliation
 */
function buildRestoreCommands(reconciliation) {
	const commands = [];
	if (reconciliation.suggestedCommand) {
		commands.push(reconciliation.suggestedCommand);
	}
	for (const alt of reconciliation.alternatives ?? []) {
		if (alt && !commands.includes(alt)) commands.push(alt);
	}
	return commands;
}

/**
 * @param {object[]} pendingTasks
 */
function formatPendingTasks(pendingTasks) {
	return pendingTasks.map((task) =>
		redactSecrets({
			taskId: task.taskId,
			status: task.status ?? "pending",
			taskFolder: task.taskFolder ?? null,
		}),
	);
}

/**
 * Assemble structured handoff data from reconciliation, batch-state, and journal.
 *
 * @param {string} projectRoot
 * @param {string} [batchId]
 */
export function assembleHandoffData(projectRoot, batchId) {
	const generatedAt = new Date().toISOString();
	const reconciliation = reconcileBatch({ projectRoot, verbose: true });

	if (!reconciliation.batchId && reconciliation.signals?.idle) {
		return redactHandoffSecrets({
			generatedAt,
			batchId: null,
			diagnosis: "idle",
			headline: reconciliation.headline,
			suggestedCommand: reconciliation.suggestedCommand,
			alternatives: reconciliation.alternatives ?? [],
			pendingTasks: [],
			laneSummary: [],
			journalTail: [],
			restoreCommands: buildRestoreCommands(reconciliation),
			idle: true,
			handoffPath: resolveHandoffPath(projectRoot),
		});
	}

	const effectiveBatchId = batchId ?? reconciliation.batchId;
	let batch = null;
	let batchStatePath = reconciliation.batchStatePath;

	if (effectiveBatchId && effectiveBatchId !== reconciliation.batchId) {
		const archived = loadArchivedBatchState(projectRoot, effectiveBatchId);
		if (archived) {
			batch = parseBatchState(archived.raw, archived.path);
			batchStatePath = archived.path;
		}
	} else if (reconciliation.batchStatePath) {
		const loaded = loadBatchStateFile(projectRoot, reconciliation.batchStatePath);
		if (loaded.raw) {
			batch = parseBatchState(loaded.raw, loaded.path ?? reconciliation.batchStatePath);
		}
	}

	const classifiedTasks =
		reconciliation.signals?.tasks ??
		(batch ? classifyTasks(batch, null) : []);

	const pendingTasks = batch
		? formatPendingTasks(computePendingTasks(batch.raw ?? /** @type {object} */ (batch)))
		: [];
	const laneSummary = buildLaneSummary(batch?.lanes ?? reconciliation.signals?.lanes ?? [], classifiedTasks);

	let journalEvents = [];
	if (effectiveBatchId) {
		journalEvents = readJournalEvents(projectRoot, effectiveBatchId);
	}
	const journalTail = readJournalTail(journalEvents, JOURNAL_TAIL_LIMIT).map(formatJournalTailEntry);

	const diagnosis = reconciliation.diagnosis ?? "idle";

	return redactHandoffSecrets({
		generatedAt,
		batchId: effectiveBatchId ?? reconciliation.batchId ?? null,
		diagnosis,
		headline: reconciliation.headline,
		suggestedCommand: reconciliation.suggestedCommand,
		alternatives: reconciliation.alternatives ?? [],
		pendingTasks,
		laneSummary,
		journalTail,
		restoreCommands: buildRestoreCommands(reconciliation),
		batchStatePath,
		phase: reconciliation.phase ?? batch?.phase ?? null,
		idle: diagnosis === "idle",
		handoffPath: resolveHandoffPath(projectRoot),
	});
}

/**
 * @param {object[]} laneSummary
 * @param {string} taskId
 */
function findLaneNumber(laneSummary, taskId) {
	for (const lane of laneSummary ?? []) {
		if ((lane.taskIds ?? []).includes(taskId)) {
			return lane.laneNumber ?? null;
		}
	}
	return null;
}

/**
 * @param {ReturnType<typeof assembleHandoffData>} data
 */
export function renderHandoffMarkdown(data) {
	const lines = [
		"# pi-spine operator handoff",
		"",
		`**Generated at:** ${data.generatedAt}`,
		`**Batch ID:** ${data.batchId ?? "—"}`,
		"",
		"## Diagnosis",
		`**${data.diagnosis}** — ${data.headline}`,
		"",
		"## Suggested command",
		data.suggestedCommand,
		"",
		"## Alternatives",
	];

	if (data.alternatives?.length) {
		for (const alt of data.alternatives) {
			lines.push(`- ${alt}`);
		}
	} else {
		lines.push("- (none)");
	}

	lines.push("", "## Pending tasks");
	if (data.pendingTasks?.length) {
		for (const task of data.pendingTasks) {
			const laneNumber = findLaneNumber(data.laneSummary, task.taskId);
			const laneLabel = laneNumber != null ? `lane ${laneNumber}` : "lane —";
			lines.push(`- ${task.taskId} (${laneLabel}, ${task.status})`);
		}
	} else {
		lines.push("- (none)");
	}

	lines.push("", "## Lane summary", "| Lane | Status | Tasks |", "|------|--------|-------|");
	if (data.laneSummary?.length) {
		for (const lane of data.laneSummary) {
			const activeTasks = (lane.tasks ?? [])
				.filter(
					(task) =>
						task.classification === "running" ||
						task.classification === "pending" ||
						task.status === "running" ||
						task.status === "pending",
				)
				.map((task) => task.taskId);
			const status =
				activeTasks.length > 0
					? (lane.tasks ?? []).some(
							(task) => task.status === "running" || task.classification === "running",
						)
						? "running"
						: "pending"
					: "idle";
			const tasksCell =
				activeTasks.length > 0 ? activeTasks.join(", ") : (lane.taskIds ?? []).join(", ") || "—";
			lines.push(`| ${lane.laneNumber ?? lane.laneId ?? "—"} | ${status} | ${tasksCell} |`);
		}
	} else if (data.pendingTasks?.length) {
		for (const task of data.pendingTasks) {
			lines.push(`| — | ${task.status} | ${task.taskId} |`);
		}
	} else {
		lines.push("| — | — | — |");
	}

	lines.push("", "## Journal tail");
	if (data.journalTail?.length) {
		for (const entry of data.journalTail) {
			const suffix = entry.taskId ? ` ${entry.taskId}` : entry.laneId ? ` ${entry.laneId}` : "";
			lines.push(`- ${entry.timestamp} ${entry.type}${suffix}`);
		}
	} else {
		lines.push("- (none)");
	}

	lines.push("", "## Restore");
	if (data.restoreCommands?.length) {
		data.restoreCommands.forEach((command, index) => {
			lines.push(`${index + 1}. ${command}`);
		});
	} else {
		lines.push("1. spine preflight");
	}

	lines.push("");
	return redactHandoffText(lines.join("\n"));
}

/**
 * @param {string[]} argv
 */
export function parseHandoffArgs(argv) {
	const args = { batchId: null, json: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--batch") args.batchId = argv[++i] ?? null;
		else if (arg === "--json") args.json = true;
	}
	return args;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 */
export function runSpineHandoff(options) {
	const { projectRoot, args: argv = [] } = options;
	const args = parseHandoffArgs(argv);
	const data = assembleHandoffData(projectRoot, args.batchId ?? undefined);
	const handoffPath = path.resolve(projectRoot, data.handoffPath ?? resolveHandoffPath(projectRoot));
	const markdown = renderHandoffMarkdown(data);

	fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
	fs.writeFileSync(handoffPath, markdown, "utf-8");

	if (args.json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ ...data, handoffPath: data.handoffPath ?? resolveHandoffPath(projectRoot) }, null, 2)}\n`,
		};
	}

	return { exitCode: 0, output: `${markdown}\n` };
}
