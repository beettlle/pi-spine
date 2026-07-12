// @ts-check
/**
 * Resolve gate postures from spine-config with fail-closed defaults (SP-629 / FR-REL250-07 / #123).
 * Invalid or missing overlay never unlocks locked categories and never rejects whole config load.
 */

import {
	DEFAULT_POSTURES,
	GATE_CATEGORIES,
	LOCKED_CATEGORIES,
	POSTURES,
} from "../batch/gate-posture-defaults.mjs";

/** @typedef {import("../batch/gate-posture-defaults.mjs").GateCategory} GateCategory */
/** @typedef {import("../batch/gate-posture-defaults.mjs").GatePosture} GatePosture */
/** @typedef {import("../batch/gate-posture-defaults.mjs").CategoryPostureDefault} CategoryPostureDefault */

/**
 * @typedef {{
 *   categories: Readonly<Record<GateCategory, Readonly<CategoryPostureDefault>>>,
 *   alwaysBreakOn: ReadonlyArray<string>,
 * }} GatePostureConfig
 */

const KNOWN_POSTURES = new Set(Object.values(POSTURES));
const LOCKED_SET = new Set(/** @type {GateCategory[]} */ ([...LOCKED_CATEGORIES]));

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fail-closed locked entry used for unknown postures and locked categories.
 * @returns {Readonly<CategoryPostureDefault>}
 */
function lockedEntry() {
	return Object.freeze({ posture: POSTURES.LOCKED, autoApproveAfterN: null });
}

/**
 * Clone DEFAULT_POSTURES into a mutable record for overlay.
 * @returns {Record<GateCategory, CategoryPostureDefault>}
 */
function cloneDefaults() {
	/** @type {Record<GateCategory, CategoryPostureDefault>} */
	const out = /** @type {Record<GateCategory, CategoryPostureDefault>} */ ({});
	for (const category of GATE_CATEGORIES) {
		const entry = DEFAULT_POSTURES[category];
		out[category] = { posture: entry.posture, autoApproveAfterN: entry.autoApproveAfterN };
	}
	return out;
}

/**
 * @param {unknown} raw
 * @returns {Readonly<CategoryPostureDefault>}
 */
function normalizeCategoryEntry(raw) {
	if (!isPlainObject(raw)) {
		return lockedEntry();
	}

	const postureRaw = raw.posture;
	if (typeof postureRaw !== "string" || !KNOWN_POSTURES.has(/** @type {GatePosture} */ (postureRaw))) {
		return lockedEntry();
	}

	const posture = /** @type {GatePosture} */ (postureRaw);
	if (posture === POSTURES.LOCKED) {
		return lockedEntry();
	}

	const thresholdRaw = raw.autoApproveAfterN;
	if (thresholdRaw === undefined) {
		return Object.freeze({ posture, autoApproveAfterN: 0 });
	}
	if (
		typeof thresholdRaw !== "number" ||
		!Number.isInteger(thresholdRaw) ||
		thresholdRaw < 0
	) {
		return lockedEntry();
	}

	return Object.freeze({ posture, autoApproveAfterN: thresholdRaw });
}

/**
 * Accept string tags only; invalid shapes fail closed to [].
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeAlwaysBreakOn(raw) {
	if (raw == null) {
		return [];
	}
	if (!Array.isArray(raw)) {
		return [];
	}
	/** @type {string[]} */
	const tags = [];
	for (const entry of raw) {
		if (typeof entry === "string" && entry.trim() !== "") {
			tags.push(entry.trim());
		}
	}
	return tags;
}

/**
 * Locate optional postures overlay and alwaysBreakOn from spine-config.
 * Supports `gates.postures` map and `alwaysBreakOn` on `gates` or under `gates.postures`.
 *
 * @param {unknown} config
 * @returns {{ overlay: Record<string, unknown> | null, alwaysBreakOnRaw: unknown }}
 */
function extractPostureSection(config) {
	if (!isPlainObject(config)) {
		return { overlay: null, alwaysBreakOnRaw: undefined };
	}
	const gates = config.gates;
	if (!isPlainObject(gates)) {
		return { overlay: null, alwaysBreakOnRaw: undefined };
	}

	const posturesRaw = gates.postures;
	/** @type {unknown} */
	let alwaysBreakOnRaw = gates.alwaysBreakOn;

	if (posturesRaw == null) {
		return { overlay: null, alwaysBreakOnRaw };
	}

	if (!isPlainObject(posturesRaw)) {
		// Invalid postures container — fail closed: ignore overlay, keep alwaysBreakOn if present.
		return { overlay: null, alwaysBreakOnRaw };
	}

	if (alwaysBreakOnRaw === undefined && "alwaysBreakOn" in posturesRaw) {
		alwaysBreakOnRaw = posturesRaw.alwaysBreakOn;
	}

	return { overlay: posturesRaw, alwaysBreakOnRaw };
}

/**
 * Merge optional `gates.postures` / `gates.alwaysBreakOn` over DEFAULT_POSTURES.
 * Missing config → defaults. Unknown posture / invalid threshold → locked.
 * destroy/auth stay locked even if config tries to relax them.
 *
 * @param {unknown} config Parsed spine-config (or partial with `gates`)
 * @returns {GatePostureConfig}
 */
export function resolveGatePostureConfig(config) {
	const { overlay, alwaysBreakOnRaw } = extractPostureSection(config);
	const categories = cloneDefaults();

	if (overlay) {
		for (const category of GATE_CATEGORIES) {
			if (!(category in overlay)) {
				continue;
			}
			if (LOCKED_SET.has(category)) {
				categories[category] = lockedEntry();
				continue;
			}
			categories[category] = normalizeCategoryEntry(overlay[category]);
		}
	}

	// Hard fail-closed: locked categories never leave locked.
	for (const category of LOCKED_CATEGORIES) {
		categories[category] = lockedEntry();
	}

	/** @type {Record<GateCategory, Readonly<CategoryPostureDefault>>} */
	const frozenCategories = /** @type {Record<GateCategory, Readonly<CategoryPostureDefault>>} */ ({});
	for (const category of GATE_CATEGORIES) {
		frozenCategories[category] = Object.freeze(categories[category]);
	}

	return Object.freeze({
		categories: Object.freeze(frozenCategories),
		alwaysBreakOn: Object.freeze(normalizeAlwaysBreakOn(alwaysBreakOnRaw)),
	});
}
