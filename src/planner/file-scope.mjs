// @ts-nocheck
/**
 * File Scope overlap detection for wave planner (SP-352 / issue #31).
 *
 * Detects when two tasks' ## File Scope globs could touch the same paths so
 * parallel lane assignment would risk merge conflicts.
 */

import micromatch from 'micromatch';

/** Synthetic basename used when expanding globs into concrete probe paths. */
const PROBE_BASENAME = '__probe__';

/** Extensions probed when expanding directory or wildcard scope entries. */
const SYNTHETIC_PROBE_EXTENSIONS = Object.freeze([
	'.mjs',
	'.js',
	'.cjs',
	'.ts',
	'.tsx',
	'.swift',
	'.py',
	'.go',
	'.java',
	'.rs',
	'.md',
	'.json',
	'.yaml',
	'.yml',
]);

/**
 * Cap on brace-expanded variants per scope entry. Bounds the synthetic probe
 * count so wide `{a,b,c,...}` scopes cannot cause probe storms on large repos.
 */
const MAX_BRACE_EXPANSIONS = 32;

/**
 * Expand `{a,b}` brace groups into concrete entry variants (micromatch-style).
 * Nested groups are expanded recursively; expansion stops at
 * MAX_BRACE_EXPANSIONS so probe generation stays bounded.
 *
 * @param {string} entry
 * @returns {string[]}
 */
function expandBracePattern(entry) {
	/** @type {string[]} */
	const results = [];

	/** @param {string} text */
	const visit = (text) => {
		if (results.length >= MAX_BRACE_EXPANSIONS) return;

		const start = text.indexOf('{');
		if (start === -1) {
			results.push(text);
			return;
		}

		// Find the matching closing brace for the first group.
		let depth = 0;
		let end = -1;
		for (let i = start; i < text.length; i++) {
			if (text[i] === '{') depth++;
			else if (text[i] === '}') {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) {
			// Unbalanced brace — treat as a literal character.
			results.push(text);
			return;
		}

		// Split the group body on top-level commas.
		/** @type {string[]} */
		const parts = [];
		let last = start + 1;
		depth = 0;
		for (let i = start + 1; i < end; i++) {
			const ch = text[i];
			if (ch === '{') depth++;
			else if (ch === '}') depth--;
			else if (ch === ',' && depth === 0) {
				parts.push(text.slice(last, i));
				last = i + 1;
			}
		}
		parts.push(text.slice(last, end));

		if (parts.length <= 1) {
			// `{a}` is not a brace set — keep the text as-is.
			results.push(text);
			return;
		}

		for (const part of parts) {
			visit(text.slice(0, start) + part + text.slice(end + 1));
			if (results.length >= MAX_BRACE_EXPANSIONS) return;
		}
	};

	visit(entry);
	return results;
}

/**
 * @param {string} raw: raw File Scope path or glob from PROMPT.md
 * @returns {string|null}
 */
export function normalizeFileScopePath(raw) {
	let s = String(raw ?? '').trim();
	if (!s) return null;

	s = s.replace(/\\/g, '/');
	if (s.startsWith('./')) s = s.slice(2);
	s = s.replace(/\/+$/g, '');

	// Directory-style globs are treated as path prefixes for overlap checks.
	if (s.endsWith('/*')) s = s.slice(0, -2);
	if (s.endsWith('/**')) s = s.slice(0, -3);

	return s || null;
}

/**
 * True when normalized paths share a directory prefix or are equal.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function pathsOverlap(a, b) {
	if (a === b) return true;
	// Only treat directory-prefix matches; a file prefix without a slash should not match.
	return a.startsWith(b + '/') || b.startsWith(a + '/');
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeScopeEntry(raw) {
	return String(raw ?? '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
}

/**
 * Expand one brace-free scope entry into concrete probe paths.
 *
 * @param {string} entry: normalized scope entry (no leading `./`)
 * @returns {string[]}
 */
function expandSingleEntryProbes(entry) {
	/** @type {Set<string>} */
	const probes = new Set([entry]);

	if (entry.endsWith('/**')) {
		const base = entry.slice(0, -3);
		for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
			probes.add(`${base}/${PROBE_BASENAME}/${PROBE_BASENAME}${ext}`);
			probes.add(`${base}/nested/${PROBE_BASENAME}${ext}`);
		}
		return [...probes];
	}

	if (entry.endsWith('/*')) {
		const base = entry.slice(0, -2);
		for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
			probes.add(`${base}/${PROBE_BASENAME}${ext}`);
		}
		return [...probes];
	}

	if (/[*?[\\]/.test(entry)) {
		probes.add(entry.replace(/\*/g, PROBE_BASENAME).replace(/\?/g, 'x'));
		return [...probes];
	}

	const baseName = entry.split('/').pop() ?? '';
	if (!/\.\w[\w\d]*$/.test(baseName)) {
		for (const ext of SYNTHETIC_PROBE_EXTENSIONS) {
			probes.add(`${entry}/${PROBE_BASENAME}${ext}`);
		}
	}

	return [...probes];
}

/**
 * Expand a single File Scope entry into concrete paths for glob overlap probes.
 * Brace groups (`{a,b}`) are expanded first so probes cover every alternative.
 *
 * @param {string} raw
 * @returns {string[]}
 */
function expandScopeEntryProbes(raw) {
	const entry = normalizeScopeEntry(raw);
	if (!entry) return [];

	/** @type {Set<string>} */
	const probes = new Set();
	for (const variant of expandBracePattern(entry)) {
		for (const probe of expandSingleEntryProbes(variant)) {
			probes.add(probe);
		}
	}

	return [...probes];
}

/**
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
		for (const probe of expandScopeEntryProbes(raw)) {
			probes.add(probe);
		}
	}

	return [...probes];
}

/**
 * @param {string} pattern
 * @returns {boolean}
 */
function patternHasGlobMeta(pattern) {
	return /[*?[\\]{}]/.test(pattern);
}

/**
 * True when two File Scope patterns could match the same repository path.
 *
 * @param {string} leftPattern
 * @param {string} rightPattern
 * @returns {boolean}
 */
export function fileScopePatternsOverlap(leftPattern, rightPattern) {
	const leftEntry = normalizeScopeEntry(leftPattern);
	const rightEntry = normalizeScopeEntry(rightPattern);
	if (!leftEntry || !rightEntry) return false;

	const leftPrefix = normalizeFileScopePath(leftPattern);
	const rightPrefix = normalizeFileScopePath(rightPattern);
	if (leftPrefix && rightPrefix && pathsOverlap(leftPrefix, rightPrefix)) {
		return true;
	}

	const leftProbes = expandScopeEntryProbes(leftPattern);
	const rightProbes = expandScopeEntryProbes(rightPattern);
	const matchOpts = { dot: true };

	for (const probe of leftProbes) {
		if (micromatch.isMatch(probe, rightEntry, matchOpts)) return true;
	}

	for (const probe of rightProbes) {
		if (micromatch.isMatch(probe, leftEntry, matchOpts)) return true;
	}

	if (!patternHasGlobMeta(leftEntry) && micromatch.isMatch(leftEntry, rightEntry, matchOpts)) {
		return true;
	}

	if (!patternHasGlobMeta(rightEntry) && micromatch.isMatch(rightEntry, leftEntry, matchOpts)) {
		return true;
	}

	return false;
}

/**
 * @param {string[]} left
 * @param {string[]} right
 * @returns {boolean}
 */
export function fileScopesOverlap(left, right) {
	const leftPatterns = Array.isArray(left) ? left : [];
	const rightPatterns = Array.isArray(right) ? right : [];

	for (const a of leftPatterns) {
		for (const b of rightPatterns) {
			if (fileScopePatternsOverlap(a, b)) return true;
		}
	}

	return false;
}

/**
 * @typedef {{
 *   waveIndex: number,
 *   taskA: string,
 *   taskB: string,
 *   scopesA: string[],
 *   scopesB: string[],
 * }} FileScopeOverlapPair
 */

/**
 * Find overlapping File Scope pairs among tasks scheduled in the same wave.
 *
 * @param {string[][]} waves
 * @param {Record<string, { fileScope?: string[] }>} tasksById
 * @returns {FileScopeOverlapPair[]}
 */
export function findWaveFileScopeOverlaps(waves, tasksById) {
	/** @type {FileScopeOverlapPair[]} */
	const overlaps = [];

	for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
		const waveTaskIds = waves[waveIndex];
		if (waveTaskIds.length < 2) continue;

		for (let i = 0; i < waveTaskIds.length; i++) {
			for (let j = i + 1; j < waveTaskIds.length; j++) {
				const taskA = waveTaskIds[i];
				const taskB = waveTaskIds[j];
				const scopesA = tasksById[taskA]?.fileScope ?? [];
				const scopesB = tasksById[taskB]?.fileScope ?? [];

				if (!fileScopesOverlap(scopesA, scopesB)) continue;

				overlaps.push({
					waveIndex,
					taskA,
					taskB,
					scopesA: [...scopesA],
					scopesB: [...scopesB],
				});
			}
		}
	}

	return overlaps;
}
