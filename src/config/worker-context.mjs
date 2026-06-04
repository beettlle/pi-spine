/**
 * FR-WORK-05: tiered worker context from spine-config referenceDocs/standards.
 * SP-092: auto-select `.cursor/rules/` via manifest + PROMPT File Scope.
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent } from "../batch/journal.mjs";
import {
	CURSOR_RULES_ROOT_REL,
	discoverCursorRules,
	loadRulesManifest,
} from "./cursor-rules/discover.mjs";
import { loadRulesProfile } from "./cursor-rules/profile.mjs";
import { selectRulesForWorker } from "./cursor-rules/select.mjs";

/** Default injected standards for pi-spine / JS-CLI projects (matches bootstrap checklist). */
export const DEFAULT_SPINE_INIT_STANDARDS = [
	".cursor/rules/javascript-3-development-standards.mdc",
	".cursor/rules/general-llm-anti-patterns.mdc",
	".cursor/rules/critical-rules-quick-reference.mdc",
	".cursor/rules/taskplane-task-authoring.mdc",
	".cursor/rules/taskplane-worker-cursor.mdc",
];

export const DEFAULT_WORKER_CONTEXT_BYTE_CAP = 32_768;

/**
 * @param {unknown} value
 * @returns {string[]|null}
 */
export function normalizeContextPathList(value) {
	if (value == null) return [];
	if (!Array.isArray(value)) return null;
	const paths = [];
	for (const entry of value) {
		if (typeof entry !== "string" || !entry.trim()) {
			return null;
		}
		paths.push(entry.trim().replace(/\\/g, "/"));
	}
	return paths;
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 */
export function resolveContextDocPath(projectRoot, relPath) {
	const normalized = relPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
	if (path.isAbsolute(normalized)) {
		return { ok: false, error: "absolute paths are not allowed in worker context lists" };
	}
	if (normalized.includes("..")) {
		return { ok: false, error: "path traversal is not allowed in worker context lists" };
	}

	const absPath = path.resolve(projectRoot, normalized);
	const rel = path.relative(projectRoot, absPath);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return { ok: false, error: `path escapes project root: ${relPath}` };
	}

	return { ok: true, absPath, relPath: rel.replace(/\\/g, "/") };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string[]} params.paths
 * @param {Set<string>} [params.neverLoad]
 * @param {number} [params.byteCap]
 */
export function loadContextDocEntries({ projectRoot, paths, neverLoad = new Set(), byteCap = DEFAULT_WORKER_CONTEXT_BYTE_CAP }) {
	/** @type {{ relPath: string, content: string }[]} */
	const loaded = [];
	let totalBytes = 0;
	/** @type {string[]} */
	const skipped = [];

	for (const relPath of paths) {
		if (neverLoad.has(relPath)) {
			skipped.push(relPath);
			continue;
		}

		const resolved = resolveContextDocPath(projectRoot, relPath);
		if (!resolved.ok) {
			return { ok: false, error: resolved.error, relPath };
		}

		if (!fs.existsSync(resolved.absPath) || !fs.statSync(resolved.absPath).isFile()) {
			skipped.push(relPath);
			continue;
		}

		const content = fs.readFileSync(resolved.absPath, "utf-8");
		const size = Buffer.byteLength(content, "utf-8");
		if (totalBytes + size > byteCap) {
			return {
				ok: true,
				entries: loaded,
				truncated: true,
				skipped: [...skipped, relPath, "...remaining paths omitted (byte cap)"],
				bytesUsed: totalBytes,
				byteCap,
			};
		}

		loaded.push({ relPath: resolved.relPath, content });
		totalBytes += size;
	}

	return {
		ok: true,
		entries: loaded,
		truncated: false,
		skipped,
		bytesUsed: totalBytes,
		byteCap,
	};
}

/**
 * @param {object} [config]
 * @param {string} [projectRoot]
 * @param {number} [byteCap]
 */
export function buildWorkerContext(config = {}, projectRoot = process.cwd(), byteCap = DEFAULT_WORKER_CONTEXT_BYTE_CAP) {
	const neverLoad = new Set(normalizeContextPathList(config.neverLoad) ?? []);
	const referenceDocs = normalizeContextPathList(config.referenceDocs) ?? [];
	const standards = normalizeContextPathList(config.standards) ?? [];
	const orderedPaths = [...referenceDocs, ...standards];

	if (orderedPaths.length === 0) {
		return { text: "", entries: [], truncated: false, skipped: [], bytesUsed: 0, byteCap };
	}

	const result = loadContextDocEntries({ projectRoot, paths: orderedPaths, neverLoad, byteCap });
	if (!result.ok) {
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			error: result.error,
			blockedPath: result.relPath,
		};
	}

	const parts = result.entries.map(
		(entry) => `--- ${entry.relPath} ---\n${entry.content.trim()}\n`,
	);
	const text = parts.length > 0 ? `\n\n## Project standards & reference\n\n${parts.join("\n")}` : "";

	return {
		text,
		entries: result.entries,
		truncated: result.truncated,
		skipped: result.skipped,
		bytesUsed: result.bytesUsed,
		byteCap: result.byteCap,
	};
}

/**
 * @param {object} config
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
/**
 * @param {string} projectRoot
 */
export function cursorRulesRootExists(projectRoot) {
	const rulesRoot = path.join(projectRoot, CURSOR_RULES_ROOT_REL);
	return fs.existsSync(rulesRoot) && fs.statSync(rulesRoot).isDirectory();
}

/**
 * @typedef {object} WorkerRulesJournalContext
 * @property {string} projectRoot
 * @property {string} batchId
 * @property {string} [taskId]
 * @property {number} [laneNumber]
 * @property {string} [correlationId]
 */

/**
 * @param {import("./cursor-rules/select.mjs").RulesSelectionResult} selection
 * @returns {object[]}
 */
function journalEntriesFromSelection(selection) {
	return selection.entries.map((entry) => ({
		relPath: entry.relPath,
		contextPath: entry.contextPath,
		source: entry.source,
		...(entry.spineClass ? { spineClass: entry.spineClass } : {}),
	}));
}

/**
 * @param {WorkerRulesJournalContext | undefined} journal
 * @param {Record<string, unknown>} payload
 */
export function emitWorkerRulesSelected(journal, payload) {
	if (!journal?.projectRoot || !journal?.batchId) {
		return;
	}
	appendJournalEvent(journal.projectRoot, journal.batchId, "worker.rules_selected", {
		taskId: journal.taskId,
		laneNumber: journal.laneNumber,
		correlationId: journal.correlationId,
		...payload,
	});
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string} [params.projectRoot]
 * @param {string[]} [params.taskFileScope]
 * @param {number} [params.byteCap]
 * @param {WorkerRulesJournalContext} [params.journal]
 */
export async function buildWorkerContextAsync({
	config = {},
	projectRoot = process.cwd(),
	taskFileScope = [],
	byteCap = DEFAULT_WORKER_CONTEXT_BYTE_CAP,
	journal,
} = {}) {
	const neverLoad = new Set(normalizeContextPathList(config.neverLoad) ?? []);
	const referenceDocs = normalizeContextPathList(config.referenceDocs) ?? [];
	const standards = normalizeContextPathList(config.standards) ?? [];

	if (!cursorRulesRootExists(projectRoot)) {
		const staticPaths = [...referenceDocs, ...standards];
		const staticResult = buildWorkerContext(config, projectRoot, byteCap);
		emitWorkerRulesSelected(journal, {
			mode: "static",
			manifestSource: "none",
			pathCount: staticPaths.filter((entry) => !neverLoad.has(entry)).length,
			paths: staticPaths.filter((entry) => !neverLoad.has(entry)),
			fileScopeCount: taskFileScope.length,
		});
		return {
			...staticResult,
			selection: {
				mode: "static",
				manifestSource: "none",
				paths: staticPaths,
			},
		};
	}

	const profileResult = loadRulesProfile(projectRoot);
	if (!profileResult.ok) {
		const staticResult = buildWorkerContext(config, projectRoot, byteCap);
		emitWorkerRulesSelected(journal, {
			mode: "static",
			manifestSource: "none",
			profileError: profileResult.error,
			pathCount: 0,
			paths: [],
			fileScopeCount: taskFileScope.length,
		});
		return {
			...staticResult,
			selection: {
				mode: "static",
				manifestSource: "none",
				profileError: profileResult.error,
			},
		};
	}

	let manifest = loadRulesManifest(projectRoot);
	let manifestSource = "committed";
	if (!manifest) {
		const discovered = discoverCursorRules({
			projectRoot,
			profile: profileResult.profile,
			writeManifest: false,
		});
		manifest = discovered.manifest;
		manifestSource = "discovered";
	}

	const selection = selectRulesForWorker({
		manifest,
		profile: profileResult.profile,
		fileScope: taskFileScope,
		standards,
		neverLoad: [...neverLoad],
	});

	const selectedSet = new Set(selection.paths);
	const orderedPaths = [
		...selection.paths,
		...referenceDocs.filter((entry) => !neverLoad.has(entry) && !selectedSet.has(entry)),
	];

	emitWorkerRulesSelected(journal, {
		mode: "auto",
		manifestSource,
		profileSource: profileResult.source,
		pathCount: selection.paths.length,
		paths: selection.paths,
		entries: journalEntriesFromSelection(selection),
		capped: selection.capped,
		dropped: selection.dropped,
		globMatchEnabled: selection.globMatchEnabled,
		fileScopeProbeCount: selection.fileScopeProbeCount,
		fileScopeCount: taskFileScope.length,
		referenceDocCount: referenceDocs.filter(
			(entry) => !neverLoad.has(entry) && !selectedSet.has(entry),
		).length,
	});

	if (orderedPaths.length === 0) {
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			selection: {
				mode: "auto",
				manifestSource,
				profileSource: profileResult.source,
				...selection,
			},
		};
	}

	const loaded = loadContextDocEntries({
		projectRoot,
		paths: orderedPaths,
		neverLoad,
		byteCap,
	});
	if (!loaded.ok) {
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			error: loaded.error,
			blockedPath: loaded.relPath,
			selection: {
				mode: "auto",
				manifestSource,
				profileSource: profileResult.source,
				...selection,
			},
		};
	}

	const parts = loaded.entries.map(
		(entry) => `--- ${entry.relPath} ---\n${entry.content.trim()}\n`,
	);
	const text =
		parts.length > 0 ? `\n\n## Project standards & reference\n\n${parts.join("\n")}` : "";

	return {
		text,
		entries: loaded.entries,
		truncated: loaded.truncated,
		skipped: loaded.skipped,
		bytesUsed: loaded.bytesUsed,
		byteCap: loaded.byteCap,
		selection: {
			mode: "auto",
			manifestSource,
			profileSource: profileResult.source,
			...selection,
		},
	};
}

export function validateWorkerContextConfig(config) {
	for (const [field, label] of [
		["referenceDocs", "referenceDocs"],
		["standards", "standards"],
		["neverLoad", "neverLoad"],
	]) {
		if (config[field] == null) continue;
		const normalized = normalizeContextPathList(config[field]);
		if (normalized === null) {
			return {
				code: "CONFIG_WORKER_CONTEXT_INVALID",
				message: `${label} must be an array of non-empty strings`,
				suggestedCommand: "spine settings set",
			};
		}
	}
	return null;
}
