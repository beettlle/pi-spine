/**
 * Merge v2.0 config section defaults for repos missing new keys (SP-141).
 */

import { CONFIG_V2_SECTION_DEFAULTS } from "./defaults.mjs";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-merge `defaults` into `target` for missing keys only.
 *
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} defaults
 */
function mergeMissingDefaults(target, defaults) {
	for (const [key, defaultValue] of Object.entries(defaults)) {
		if (!(key in target) || target[key] === undefined) {
			target[key] = Array.isArray(defaultValue)
				? [...defaultValue]
				: isPlainObject(defaultValue)
					? structuredClone(defaultValue)
					: defaultValue;
			continue;
		}
		if (isPlainObject(defaultValue) && isPlainObject(target[key])) {
			mergeMissingDefaults(/** @type {Record<string, unknown>} */ (target[key]), defaultValue);
		}
	}
}

/**
 * @param {object} config Parsed spine-config.json object (mutated in place).
 * @returns {object} Same config reference with v2 sections merged.
 */
export function applyConfigDefaults(config) {
	if (!isPlainObject(config)) {
		return config;
	}
	mergeMissingDefaults(/** @type {Record<string, unknown>} */ (config), CONFIG_V2_SECTION_DEFAULTS);
	return config;
}
