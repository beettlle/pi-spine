/**
 * Micromatch helpers for PROMPT File Scope vs rule globs (SP-091).
 */

import micromatch from "micromatch";

/** Synthetic extensions used when expanding directory or wildcard scope entries. */
export const SYNTHETIC_PROBE_EXTENSIONS = Object.freeze([
	".mjs",
	".js",
	".ts",
	".tsx",
	".swift",
	".py",
	".go",
	".java",
	".rs",
	".md",
]);

const PROBE_BASENAME = "__probe__";

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeScopePath(raw) {
	return raw.trim().replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/**
 * Expand PROMPT File Scope paths into concrete probe paths for glob matching.
 * Handles literals, `dir/*`, `dir/**`, and in-path wildcards (e.g. `bin/*.mjs`).
 *
 * @param {string[]} fileScope
 * @returns {string[]}
 */
export function expandFileScopeProbes(fileScope) {
	if (!Array.isArray(fileScope) || fileScope.length === 0) {
		return [];
	}

	/** @type {Set<string>} */
	const probes = new Set();

	for (const raw of fileScope) {
		const entry = normalizeScopePath(raw);
		if (!entry) {
			continue;
		}

		probes.add(entry);

		if (entry.endsWith("/**")) {
			const base = entry.slice(0, -3);
			for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
				probes.add(`${base}/${PROBE_BASENAME}/${PROBE_BASENAME}${ext}`);
				probes.add(`${base}/nested/${PROBE_BASENAME}${ext}`);
			}
			continue;
		}

		if (entry.endsWith("/*")) {
			const base = entry.slice(0, -2);
			for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
				probes.add(`${base}/${PROBE_BASENAME}${ext}`);
			}
			continue;
		}

		if (entry.includes("*")) {
			probes.add(entry.replace(/\*/g, PROBE_BASENAME));
			continue;
		}

		const baseName = entry.split("/").pop() ?? "";
		if (!/\.\w[\w\d]*$/.test(baseName)) {
			for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
				probes.add(`${entry}/${PROBE_BASENAME}${ext}`);
			}
		}
	}

	return [...probes];
}

/**
 * @param {string} glob
 * @returns {boolean}
 */
function isUniversalGlob(glob) {
	return glob === "**/*" || glob === "**";
}

/**
 * True when any rule glob matches the task file scope (via probes and raw scope entries).
 * Empty fileScope never triggers glob-matched rules.
 *
 * @param {string[]} globs Rule frontmatter globs
 * @param {string[]} fileScope PROMPT File Scope paths
 * @returns {boolean}
 */
export function ruleGlobsMatchFileScope(globs, fileScope) {
	if (!Array.isArray(fileScope) || fileScope.length === 0) {
		return false;
	}
	if (!Array.isArray(globs) || globs.length === 0) {
		return false;
	}

	const probes = expandFileScopeProbes(fileScope);
	const scopeEntries = fileScope.map(normalizeScopePath).filter(Boolean);
	if (probes.length === 0) {
		return false;
	}

	for (const glob of globs) {
		if (isUniversalGlob(glob)) {
			return true;
		}

		if (scopeEntries.some((entry) => micromatch.isMatch(entry, glob))) {
			return true;
		}

		if (probes.some((probe) => micromatch.isMatch(probe, glob))) {
			return true;
		}
	}

	return false;
}
