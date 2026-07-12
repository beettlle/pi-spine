// @ts-check
/**
 * Persist consecutive approval streak counters for autoApproveAfterN (SP-631 / FR-REL250-09 / #123).
 * Counts are keyed by gate category and/or gate kind under `.spine/runtime/`.
 * No approve-path wiring — SP-632 consumes this API.
 */

import fs from "node:fs";
import path from "node:path";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";
import { GATE_CATEGORIES } from "./gate-posture-defaults.mjs";

/** @typedef {import("./gate-posture-defaults.mjs").GateCategory} GateCategory */

/**
 * @typedef {{
 *   version: number;
 *   categories: Record<string, number>;
 *   kinds: Record<string, number>;
 *   updatedAt: string;
 * }} GatePostureStreakState
 */

export const GATE_POSTURE_STREAK_VERSION = 1;

/** Relative path under project root for the streak store. */
export const GATE_POSTURE_STREAK_REL = path.join(
	".spine",
	"runtime",
	"gate-posture",
	"streaks.json",
);

const CATEGORY_SET = new Set(/** @type {string[]} */ ([...GATE_CATEGORIES]));

/**
 * Absolute path to the streak JSON file.
 * @param {string} projectRoot
 * @returns {string}
 */
export function gatePostureStreakPath(projectRoot) {
	return path.join(projectRoot, GATE_POSTURE_STREAK_REL);
}

/**
 * Empty store with zero counts for every known category.
 * @returns {GatePostureStreakState}
 */
function emptyStreakState() {
	/** @type {Record<string, number>} */
	const categories = {};
	for (const category of GATE_CATEGORIES) {
		categories[category] = 0;
	}
	return {
		version: GATE_POSTURE_STREAK_VERSION,
		categories,
		kinds: {},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce a count map to non-negative integers; drop invalid keys/values.
 * @param {unknown} raw
 * @param {{ allowOnlyCategories?: boolean }} [opts]
 * @returns {Record<string, number>}
 */
function normalizeCountMap(raw, opts = {}) {
	/** @type {Record<string, number>} */
	const out = {};
	if (!isPlainObject(raw)) {
		return out;
	}
	for (const [key, value] of Object.entries(raw)) {
		if (typeof key !== "string" || key.trim() === "") {
			continue;
		}
		if (opts.allowOnlyCategories === true && !CATEGORY_SET.has(key)) {
			continue;
		}
		if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
			continue;
		}
		out[key] = value;
	}
	return out;
}

/**
 * Normalize persisted JSON into a full streak state (fail-closed zeros on corruption).
 * @param {unknown} raw
 * @returns {GatePostureStreakState}
 */
function normalizeStreakState(raw) {
	const base = emptyStreakState();
	if (!isPlainObject(raw)) {
		return base;
	}

	const categories = normalizeCountMap(raw.categories, { allowOnlyCategories: true });
	for (const category of GATE_CATEGORIES) {
		if (category in categories) {
			base.categories[category] = categories[category];
		}
	}

	base.kinds = normalizeCountMap(raw.kinds);
	if (typeof raw.updatedAt === "string" && raw.updatedAt.trim() !== "") {
		base.updatedAt = raw.updatedAt;
	}
	return base;
}

/**
 * Load streak state from runtime path. Missing or corrupt file → empty zeros.
 * @param {string} projectRoot
 * @returns {GatePostureStreakState}
 */
export function loadGatePostureStreaks(projectRoot) {
	const filePath = gatePostureStreakPath(projectRoot);
	if (!fs.existsSync(filePath)) {
		return emptyStreakState();
	}
	try {
		const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		return normalizeStreakState(raw);
	} catch {
		// Corrupt JSON must not unlock auto-approve — treat as zero streak.
		return emptyStreakState();
	}
}

/**
 * Persist streak state atomically under `.spine/runtime/`.
 * @param {string} projectRoot
 * @param {GatePostureStreakState} state
 * @returns {GatePostureStreakState}
 */
export function saveGatePostureStreaks(projectRoot, state) {
	const next = {
		version: GATE_POSTURE_STREAK_VERSION,
		categories: { ...state.categories },
		kinds: { ...state.kinds },
		updatedAt: new Date().toISOString(),
	};
	writeJsonAtomic(gatePostureStreakPath(projectRoot), next);
	return next;
}

/**
 * Read consecutive approval count for a gate category.
 * @param {string} projectRoot
 * @param {GateCategory | string} category
 * @returns {number}
 */
export function getCategoryStreak(projectRoot, category) {
	const state = loadGatePostureStreaks(projectRoot);
	const count = state.categories[category];
	return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
}

/**
 * Read consecutive approval count for a gate kind (e.g. integrate).
 * @param {string} projectRoot
 * @param {string} kind
 * @returns {number}
 */
export function getKindStreak(projectRoot, kind) {
	const state = loadGatePostureStreaks(projectRoot);
	const count = state.kinds[kind];
	return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : 0;
}

/**
 * Increment category streak after an approval. Returns the new count.
 * @param {string} projectRoot
 * @param {GateCategory | string} category
 * @returns {number}
 */
export function incrementCategoryStreak(projectRoot, category) {
	const state = loadGatePostureStreaks(projectRoot);
	const prevRaw = state.categories[category];
	const prev =
		typeof prevRaw === "number" && Number.isInteger(prevRaw) && prevRaw >= 0 ? prevRaw : 0;
	const next = prev + 1;
	state.categories[category] = next;
	saveGatePostureStreaks(projectRoot, state);
	return next;
}

/**
 * Increment kind streak after an approval. Returns the new count.
 * @param {string} projectRoot
 * @param {string} kind
 * @returns {number}
 */
export function incrementKindStreak(projectRoot, kind) {
	if (typeof kind !== "string" || kind.trim() === "") {
		throw new Error("gate posture kind streak key must be a non-empty string");
	}
	const state = loadGatePostureStreaks(projectRoot);
	const prevRaw = state.kinds[kind];
	const prev =
		typeof prevRaw === "number" && Number.isInteger(prevRaw) && prevRaw >= 0 ? prevRaw : 0;
	const next = prev + 1;
	state.kinds[kind] = next;
	saveGatePostureStreaks(projectRoot, state);
	return next;
}

/**
 * Reset category streak on reject or manual break.
 * @param {string} projectRoot
 * @param {GateCategory | string} category
 * @returns {number} Always 0 after reset
 */
export function resetCategoryStreak(projectRoot, category) {
	const state = loadGatePostureStreaks(projectRoot);
	state.categories[category] = 0;
	saveGatePostureStreaks(projectRoot, state);
	return 0;
}

/**
 * Reset kind streak on reject or manual break.
 * @param {string} projectRoot
 * @param {string} kind
 * @returns {number} Always 0 after reset
 */
export function resetKindStreak(projectRoot, kind) {
	const state = loadGatePostureStreaks(projectRoot);
	state.kinds[kind] = 0;
	saveGatePostureStreaks(projectRoot, state);
	return 0;
}

/**
 * Clear all category and kind streaks (manual break across the board).
 * @param {string} projectRoot
 * @returns {GatePostureStreakState}
 */
export function resetAllStreaks(projectRoot) {
	return saveGatePostureStreaks(projectRoot, emptyStreakState());
}

/**
 * Whether a consecutive-approval count meets an autoApproveAfterN threshold.
 * Null / non-positive thresholds never meet (fail-closed except explicit 0 = immediate).
 * Callers treat threshold 0 as immediate auto via the evaluator; this helper returns true for 0.
 *
 * @param {number} consecutiveApprovals
 * @param {number | null | undefined} autoApproveAfterN
 * @returns {boolean}
 */
export function streakMeetsThreshold(consecutiveApprovals, autoApproveAfterN) {
	if (typeof consecutiveApprovals !== "number" || !Number.isInteger(consecutiveApprovals) || consecutiveApprovals < 0) {
		return false;
	}
	if (typeof autoApproveAfterN !== "number" || !Number.isInteger(autoApproveAfterN) || autoApproveAfterN < 0) {
		return false;
	}
	if (autoApproveAfterN === 0) {
		return true;
	}
	return consecutiveApprovals >= autoApproveAfterN;
}

/**
 * Load category streak and compare against threshold (threshold read convenience).
 * @param {string} projectRoot
 * @param {GateCategory | string} category
 * @param {number | null | undefined} autoApproveAfterN
 * @returns {{ count: number, meetsThreshold: boolean }}
 */
export function readCategoryStreakThreshold(projectRoot, category, autoApproveAfterN) {
	const count = getCategoryStreak(projectRoot, category);
	return {
		count,
		meetsThreshold: streakMeetsThreshold(count, autoApproveAfterN),
	};
}
