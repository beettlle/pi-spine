/**
 * Reviewer context: auto-selected Cursor rules for review spawn (SP-250).
 * Mirrors worker context path with 16 KiB cap and no referenceDocs injection.
 */

import { discoverCursorRules, loadRulesManifest } from "./cursor-rules/discover.mjs";
import { loadRulesProfile } from "./cursor-rules/profile.mjs";
import { selectRulesForReviewer } from "./cursor-rules/select.mjs";
import {
	cursorRulesRootExists,
	loadContextDocEntries,
	normalizeContextPathList,
} from "./worker-context.mjs";
import { appendJournalEvent } from "../batch/journal.mjs";

export const DEFAULT_REVIEWER_CONTEXT_BYTE_CAP = 16_384;

/**
 * @typedef {object} ReviewerRulesJournalContext
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
 * @param {ReviewerRulesJournalContext | undefined} journal
 * @param {Record<string, unknown>} payload
 */
export function emitReviewerRulesSelected(journal, payload) {
	if (!journal?.projectRoot || !journal?.batchId) {
		return;
	}
	appendJournalEvent(journal.projectRoot, journal.batchId, "reviewer.rules_selected", {
		taskId: journal.taskId,
		laneNumber: journal.laneNumber,
		correlationId: journal.correlationId,
		...payload,
	});
}

/**
 * @param {object} params
 * @param {string} [params.projectRoot]
 * @param {object} [params.config]
 * @param {"plan"|"code"|"final"} [params.reviewType]
 * @param {string[]} [params.scopePaths]
 * @param {ReviewerRulesJournalContext} [params.journal]
 * @param {number} [params.byteCap]
 */
export function buildReviewerContext({
	projectRoot = process.cwd(),
	config = {},
	reviewType = "plan",
	scopePaths = [],
	journal,
	byteCap = DEFAULT_REVIEWER_CONTEXT_BYTE_CAP,
} = {}) {
	const neverLoad = new Set(normalizeContextPathList(config.neverLoad) ?? []);
	const standards = normalizeContextPathList(config.standards) ?? [];

	if (!cursorRulesRootExists(projectRoot)) {
		emitReviewerRulesSelected(journal, {
			mode: "skipped",
			reviewType,
			scopePaths,
			paths: [],
			capped: false,
			bytesUsed: 0,
			manifestSource: "none",
		});
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			selection: { mode: "skipped" },
		};
	}

	const profileResult = loadRulesProfile(projectRoot);
	if (!profileResult.ok) {
		emitReviewerRulesSelected(journal, {
			mode: "degraded",
			reviewType,
			scopePaths,
			paths: [],
			capped: false,
			bytesUsed: 0,
			profileError: profileResult.error,
		});
		return {
			text: "",
			entries: [],
			truncated: false,
			skipped: [],
			bytesUsed: 0,
			byteCap,
			selection: {
				mode: "degraded",
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

	const selection = selectRulesForReviewer({
		manifest,
		profile: profileResult.profile,
		scopePaths,
		standards,
		neverLoad: [...neverLoad],
	});

	const orderedPaths = selection.paths;

	if (orderedPaths.length === 0) {
		emitReviewerRulesSelected(journal, {
			mode: "auto",
			reviewType,
			scopePaths,
			paths: [],
			capped: selection.capped,
			bytesUsed: 0,
			manifestSource,
			profileSource: profileResult.source,
			entries: journalEntriesFromSelection(selection),
		});
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
		emitReviewerRulesSelected(journal, {
			mode: "degraded",
			reviewType,
			scopePaths,
			paths: orderedPaths,
			capped: selection.capped,
			bytesUsed: 0,
			loadError: loaded.error,
			blockedPath: loaded.relPath,
		});
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
		parts.length > 0 ? `\n\n## Project standards for review\n\n${parts.join("\n")}` : "";

	const capped = selection.capped || loaded.truncated;

	emitReviewerRulesSelected(journal, {
		mode: "auto",
		reviewType,
		scopePaths,
		paths: orderedPaths,
		capped,
		bytesUsed: loaded.bytesUsed,
		manifestSource,
		profileSource: profileResult.source,
		entries: journalEntriesFromSelection(selection),
		truncated: loaded.truncated,
	});

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
