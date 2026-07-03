/**
 * Model id validation and normalization (SP-422 / #76).
 * Canonical pi model id format: `provider/model` (e.g. `google/gemini-3.1-pro-preview`).
 * Pi TUI display labels use `model [provider]` (e.g. `gemini-3.1-pro-preview [google]`).
 */

const DISPLAY_LABEL_RE = /^([a-z0-9][a-z0-9._-]*)\s+\[([a-z0-9][a-z0-9._-]*)\]$/i;
const CANONICAL_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;
const SPECIAL_VALUES = new Set(["inherit", ""]);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isDisplayLabel(value) {
	if (typeof value !== "string") return false;
	return DISPLAY_LABEL_RE.test(value.trim());
}

/**
 * Convert a pi TUI display label (`model [provider]`) to canonical `provider/model`.
 * Returns null when the input does not match the display label pattern.
 *
 * @param {string} value
 * @returns {string|null}
 */
export function displayLabelToCanonical(value) {
	if (typeof value !== "string") return null;
	const match = value.trim().match(DISPLAY_LABEL_RE);
	if (!match) return null;
	return `${match[2]}/${match[1]}`;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isCanonicalModelId(value) {
	if (typeof value !== "string") return false;
	return CANONICAL_RE.test(value.trim());
}

/**
 * Normalize a model id for `spine settings set`.
 * Display labels are converted to canonical form; canonical ids pass through;
 * special values (`inherit`, empty) pass through.
 *
 * @param {string} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function normalizeModelId(value) {
	if (typeof value !== "string") {
		return { ok: false, error: "Model id must be a string" };
	}

	const trimmed = value.trim();
	if (SPECIAL_VALUES.has(trimmed)) {
		return { ok: true, value: trimmed };
	}

	if (isCanonicalModelId(trimmed)) {
		return { ok: true, value: trimmed };
	}

	const canonical = displayLabelToCanonical(trimmed);
	if (canonical) {
		return { ok: true, value: canonical };
	}

	return {
		ok: false,
		error: `Invalid model id "${trimmed}". Use canonical provider/model format (e.g. google/gemini-3.1-pro-preview). Run \`pi --list-models\` for available ids.`,
	};
}

/**
 * Validate that a model id already stored in config is canonical.
 * Used by doctor checks — flags display labels and unrecognized formats.
 *
 * @param {string} value
 * @returns {{ ok: true } | { ok: false, error: string, canonical?: string, suggestedCommand?: string }}
 */
export function validateModelIdFormat(value) {
	if (typeof value !== "string") return { ok: true };
	const trimmed = value.trim();
	if (SPECIAL_VALUES.has(trimmed)) return { ok: true };

	if (isCanonicalModelId(trimmed)) return { ok: true };

	const canonical = displayLabelToCanonical(trimmed);
	if (canonical) {
		return {
			ok: false,
			error: `display label "${trimmed}" — use canonical id ${canonical}`,
			canonical,
		};
	}

	return {
		ok: false,
		error: `invalid model id "${trimmed}" — expected provider/model format`,
	};
}
