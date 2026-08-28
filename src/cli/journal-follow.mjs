/**
 * Live tail of batch journal events (issue #45, SP-361).
 */

import fs from "node:fs";
import { validateBatchId } from "../batch/batch-id.mjs";
import {
	journalPath,
	normalizeJournalEvent,
	summarizeJournalEvent,
} from "../batch/journal.mjs";
import { loadBatchStateFile, reconcileBatch } from "../batch/reconcile.mjs";

export const JOURNAL_FOLLOW_HEADER =
	"  time                | type                  | lane   | task     | summary\n" +
	"  --------------------+-----------------------+--------+----------+------------------";

/**
 * @param {string} timestamp
 */
export function formatReplayTime(timestamp) {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return String(timestamp);
	return date.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * @param {object} event
 */
export function formatJournalFollowLine(event) {
	const time = formatReplayTime(event.timestamp).padEnd(19);
	const type = String(event.type ?? "").padEnd(21);
	const lane = String(event.laneId ?? "—").padEnd(6);
	const task = String(event.taskId ?? "—").padEnd(8);
	const summary = summarizeJournalEvent(event);
	return `  ${time} | ${type} | ${lane} | ${task} | ${summary}`;
}

/**
 * @param {string} projectRoot
 * @param {string|null|undefined} batchId
 */
export function resolveFollowBatchId(projectRoot, batchId) {
	if (batchId) return validateBatchId(batchId);

	const reconciliation = reconcileBatch({ projectRoot });
	if (reconciliation.batchId) return reconciliation.batchId;

	const loaded = loadBatchStateFile(projectRoot, null);
	if (!loaded.raw) return null;
	const resolved = loaded.raw.batchId ?? loaded.raw.id;
	return resolved != null && String(resolved) ? String(resolved) : null;
}

/**
 * @param {string[]} args
 */
export function parseJournalFollowArgs(args) {
	const batchIdx = args.indexOf("--batch");
	const batchId = batchIdx >= 0 ? args[batchIdx + 1] ?? null : null;
	const laneIdx = args.indexOf("--lane");
	const laneId = laneIdx >= 0 ? args[laneIdx + 1] ?? null : null;
	const json = args.includes("--json");
	return { batchId, laneId, json };
}

/**
 * @param {object} event
 * @param {string|null|undefined} laneId
 */
export function matchesLaneFilter(event, laneId) {
	if (!laneId) return true;
	return event.laneId === laneId;
}

/**
 * @param {string} rawLine
 * @param {{ laneId?: string|null, json?: boolean }} options
 * @returns {string|null}
 */
export function formatJournalFollowOutputLine(rawLine, options = {}) {
	const { laneId = null, json = false } = options;
	const trimmed = rawLine.trim();
	if (!trimmed) return null;

	if (json) {
		if (!laneId) return `${trimmed}\n`;
		try {
			const event = normalizeJournalEvent(JSON.parse(trimmed));
			if (!matchesLaneFilter(event, laneId)) return null;
		} catch {
			return null;
		}
		return `${trimmed}\n`;
	}

	try {
		const event = normalizeJournalEvent(JSON.parse(trimmed));
		if (!matchesLaneFilter(event, laneId)) return null;
		return `${formatJournalFollowLine(event)}\n`;
	} catch {
		return null;
	}
}

/**
 * @param {string} chunk
 * @param {string} partial
 * @param {{ laneId?: string|null, json?: boolean, onLine: (line: string) => void }} options
 * @returns {string}
 */
export function drainJournalFollowChunk(chunk, partial, options) {
	const buffer = partial + chunk;
	const parts = buffer.split("\n");
	const remainder = parts.pop() ?? "";

	for (const line of parts) {
		const formatted = formatJournalFollowOutputLine(line, options);
		if (formatted) options.onLine(formatted);
	}

	return remainder;
}

/**
 * @param {string} filePath
 * @param {{ laneId?: string|null, json?: boolean, onLine: (line: string) => void, headerPrinted?: { value: boolean } }} options
 * @param {typeof fs} fileSystem
 * @returns {{ offset: number, partial: string }}
 */
export function readJournalFollowSnapshot(filePath, options, fileSystem = fs) {
	let offset = 0;
	let partial = "";
	const content = fileSystem.readFileSync(filePath, "utf-8");
	const stat = fileSystem.statSync(filePath);
	offset = stat.size;

	if (!options.json && content.trim() && options.headerPrinted && !options.headerPrinted.value) {
		options.onLine(`${JOURNAL_FOLLOW_HEADER}\n`);
		options.headerPrinted.value = true;
	}

	partial = drainJournalFollowChunk(content, partial, options);
	return { offset, partial };
}

const defaultDeps = {
	fs,
	stdout: process.stdout,
	onSignal: (signal, handler) => process.on(signal, handler),
	offSignal: (signal, handler) => process.off(signal, handler),
};

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 * @param {boolean} [options.follow]
 * @param {typeof defaultDeps} [options.deps]
 * @returns {{ exitCode: number, output: string } | Promise<{ exitCode: number, output: string }>}
 *   Plain result for the non-follow path; a Promise that resolves on SIGINT/SIGTERM when following.
 */
export function runJournalFollow(options) {
	const { projectRoot, args = [], follow = true, deps = defaultDeps } = options;
	const { batchId: argBatchId, laneId, json } = parseJournalFollowArgs(args);
	let batchId = null;
	try {
		batchId = resolveFollowBatchId(projectRoot, argBatchId);
	} catch (error) {
		return {
			exitCode: 1,
			output: `${error instanceof Error ? error.message : String(error)}\n`,
		};
	}

	if (!batchId) {
		return {
			exitCode: 1,
			output:
				"No active batch for journal follow (pass --batch {id} or start a batch)\n",
		};
	}

	const filePath = journalPath(projectRoot, batchId);
	if (!deps.fs.existsSync(filePath)) {
		return {
			exitCode: 1,
			output: `Journal not found for batch ${batchId}: ${filePath}\n`,
		};
	}

	/** @type {string[]} */
	const lines = [];
	const headerPrinted = { value: false };
	const formatOptions = {
		laneId,
		json,
		headerPrinted,
		onLine: (line) => {
			lines.push(line);
			deps.stdout.write(line);
		},
	};

	let { offset, partial } = readJournalFollowSnapshot(filePath, formatOptions, deps.fs);

	if (!follow) {
		return { exitCode: 0, output: lines.join("") };
	}

	return new Promise((resolve) => {
		/** @type {import("node:fs").FSWatcher|null} */
		let watcher = null;

		const cleanup = (exitCode = 0) => {
			if (watcher) watcher.close();
			resolve({ exitCode, output: lines.join("") });
		};

		const onChange = () => {
			try {
				const stat = deps.fs.statSync(filePath);
				if (stat.size < offset) {
					offset = 0;
					partial = "";
				}
				if (stat.size <= offset) return;

				const toRead = stat.size - offset;
				const fd = deps.fs.openSync(filePath, "r");
				try {
					const buffer = Buffer.alloc(toRead);
					deps.fs.readSync(fd, buffer, 0, toRead, offset);
					offset = stat.size;
					partial = drainJournalFollowChunk(buffer.toString("utf-8"), partial, formatOptions);
				} finally {
					deps.fs.closeSync(fd);
				}
			} catch {
				// Transient read races while the engine appends are expected during follow.
			}
		};

		watcher = deps.fs.watch(filePath, onChange);
		const onSigInt = () => cleanup(0);
		const onSigTerm = () => cleanup(0);
		deps.onSignal("SIGINT", onSigInt);
		deps.onSignal("SIGTERM", onSigTerm);
	});
}
