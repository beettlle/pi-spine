/**
 * Select Cursor rules for spine workers from manifest + PROMPT File Scope (SP-091).
 */

import { CURSOR_RULES_ROOT_REL } from "./discover.mjs";
import { expandFileScopeProbes, ruleGlobsMatchFileScope } from "./match-globs.mjs";
import { priorityRank } from "./priority.mjs";

/** Default maximum rules returned before injection (SP-092 may truncate further by bytes). */
export const DEFAULT_SELECT_MAX_RULES = 48;

/** @typedef {import("./priority.mjs").RuleSelectionSource} RuleSelectionSource */

/**
 * @typedef {object} RuleSelectionEntry
 * @property {string} relPath Path relative to `.cursor/rules/`
 * @property {string} contextPath Project-relative path for worker context loading
 * @property {RuleSelectionSource} source
 * @property {import("./discover.mjs").CursorRuleSpineClass} [spineClass]
 */

/**
 * @typedef {object} RulesSelectionResult
 * @property {true} ok
 * @property {string[]} paths Ordered project-relative context paths (`.cursor/rules/...`)
 * @property {RuleSelectionEntry[]} entries Ordered selection entries for journal / debugging
 * @property {boolean} capped True when `maxRules` dropped lower-priority paths
 * @property {string[]} [dropped] Context paths omitted by the cap (stable order)
 * @property {boolean} globMatchEnabled Whether profile had glob matching enabled
 * @property {number} fileScopeProbeCount Probe count after `expandFileScopeProbes`
 */

/**
 * @param {string} relPath
 * @returns {string}
 */
function toPosixRelPath(relPath) {
	return relPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/**
 * @param {string} relPath Path relative to `.cursor/rules/`
 * @returns {string}
 */
export function ruleRelPathToContextPath(relPath) {
	const normalized = toPosixRelPath(relPath);
	return `${CURSOR_RULES_ROOT_REL}/${normalized}`;
}

/**
 * @param {string} contextPath Project-relative path (often `.cursor/rules/foo.mdc`)
 * @returns {string|null}
 */
export function contextPathToRuleRelPath(contextPath) {
	const normalized = toPosixRelPath(contextPath);
	const rulesPrefix = `${CURSOR_RULES_ROOT_REL}/`;
	if (normalized.startsWith(rulesPrefix)) {
		return normalized.slice(rulesPrefix.length);
	}
	if (!normalized.includes("/")) {
		return normalized;
	}
	return null;
}

/**
 * @param {string[]} paths
 * @returns {Set<string>}
 */
function normalizeBlocklist(paths) {
	/** @type {Set<string>} */
	const blocked = new Set();
	for (const entry of paths) {
		const normalized = toPosixRelPath(entry);
		if (!normalized) {
			continue;
		}
		blocked.add(normalized);
		const rel = contextPathToRuleRelPath(normalized);
		if (rel) {
			blocked.add(rel);
			blocked.add(ruleRelPathToContextPath(rel));
		}
	}
	return blocked;
}

/**
 * @param {import("./discover.mjs").CursorRulesManifest} manifest
 * @param {import("./profile.mjs").RulesProfile} profile
 * @param {string[]} fileScope PROMPT File Scope paths
 * @param {string[]} [standards] `config.standards` paths (appended after auto-selection)
 * @param {string[]} [neverLoad] `config.neverLoad` paths
 * @param {number} [maxRules]
 * @returns {RulesSelectionResult}
 */
export function selectRulesForWorker({
	manifest,
	profile,
	fileScope = [],
	standards = [],
	neverLoad = [],
	maxRules = DEFAULT_SELECT_MAX_RULES,
}) {
	const globMatchEnabled = profile.worker.globMatch !== false;
	const fileScopeProbeCount = expandFileScopeProbes(fileScope).length;

	/** @type {Map<string, RuleSelectionEntry>} */
	const byRelPath = new Map();
	const manifestByRel = new Map(manifest.rules.map((rule) => [rule.relPath, rule]));

	const addEntry = (relPath, source) => {
		const normalized = toPosixRelPath(relPath);
		if (!normalized || byRelPath.has(normalized)) {
			return;
		}
		const manifestRule = manifestByRel.get(normalized);
		byRelPath.set(normalized, {
			relPath: normalized,
			contextPath: ruleRelPathToContextPath(normalized),
			source,
			spineClass: manifestRule?.spineClass,
		});
	};

	for (const relPath of profile.worker.alwaysInclude) {
		addEntry(relPath, "alwaysInclude");
	}

	for (const rule of manifest.rules) {
		if (rule.spineClass === "always") {
			addEntry(rule.relPath, "always");
		}
	}

	if (globMatchEnabled) {
		for (const rule of manifest.rules) {
			if (rule.spineClass !== "glob" || rule.globs.length === 0) {
				continue;
			}
			if (ruleGlobsMatchFileScope(rule.globs, fileScope)) {
				addEntry(rule.relPath, "glob");
			}
		}
	}

	for (const standardPath of standards) {
		const rel = contextPathToRuleRelPath(standardPath);
		if (rel) {
			addEntry(rel, "standards");
		}
	}

	const blocked = normalizeBlocklist([
		...profile.worker.neverInclude.map((rel) => ruleRelPathToContextPath(rel)),
		...neverLoad,
	]);

	const sorted = [...byRelPath.values()]
		.filter((entry) => !blocked.has(entry.relPath) && !blocked.has(entry.contextPath))
		.sort((left, right) => {
			const rankDiff = priorityRank(left.source) - priorityRank(right.source);
			if (rankDiff !== 0) {
				return rankDiff;
			}
			return left.relPath.localeCompare(right.relPath);
		});

	const limit = Math.max(1, maxRules);
	const selected = sorted.slice(0, limit);
	const dropped = sorted.slice(limit).map((entry) => entry.contextPath);

	return {
		ok: true,
		paths: selected.map((entry) => entry.contextPath),
		entries: selected,
		capped: dropped.length > 0,
		dropped: dropped.length > 0 ? dropped : undefined,
		globMatchEnabled,
		fileScopeProbeCount,
	};
}
