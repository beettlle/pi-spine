/**
 * Discover `.cursor/rules/` and build `.spine/rules-manifest.json`.
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import micromatch from "micromatch";

import { parseCursorRuleFrontmatter } from "./parse-frontmatter.mjs";
import { DEFAULT_RULES_PROFILE, loadRulesProfile } from "./profile.mjs";

/** Relative path from project root to Cursor rules directory. */
export const CURSOR_RULES_ROOT_REL = ".cursor/rules";

/** Relative path from project root to committed rules manifest. */
export const RULES_MANIFEST_REL_PATH = ".spine/rules-manifest.json";

/** Maximum discovered rule files per scan. */
export const DISCOVER_MAX_FILES = 200;

/** Maximum bytes read per rule file. */
export const DISCOVER_MAX_FILE_BYTES = 512 * 1024;

const RULE_FILE_RE = /\.(mdc|md)$/i;

/**
 * @typedef {"always" | "glob" | "manual" | "excluded"} CursorRuleSpineClass
 */

/**
 * @typedef {object} CursorRuleManifestEntry
 * @property {string} relPath Path relative to `.cursor/rules/` (posix)
 * @property {Exclude<CursorRuleSpineClass, "excluded">} spineClass
 * @property {boolean} alwaysApply
 * @property {string|null} description
 * @property {string[]} globs
 * @property {"ok" | "skip" | "warn"} parseStatus
 * @property {string[]} [warnings]
 */

/**
 * @typedef {object} CursorRuleExcludedEntry
 * @property {string} relPath Path relative to `.cursor/rules/` (posix)
 * @property {"excludePattern" | "excludeRelPath"} reason
 * @property {CursorRuleSpineClass} spineClass Always `"excluded"`
 */

/**
 * @typedef {object} CursorRulesManifest
 * @property {string} generatedAt ISO-8601 timestamp
 * @property {string} rulesRoot Relative path to rules directory (posix)
 * @property {CursorRuleManifestEntry[]} rules
 * @property {CursorRuleExcludedEntry[]} excluded
 * @property {string[]} [warnings] Non-fatal discovery issues (truncation, oversize files)
 */

/**
 * @typedef {object} DiscoverCursorRulesResult
 * @property {true} ok
 * @property {CursorRulesManifest} manifest
 * @property {string} [manifestPath] Written manifest path when `writeManifest` is true
 */

/**
 * @param {string} relPath
 * @returns {string}
 */
function toPosixRelPath(relPath) {
	return relPath.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/**
 * @param {import("./profile.mjs").RulesProfileDiscovery} discovery
 * @param {string} relPath
 * @returns {"excludePattern" | "excludeRelPath" | null}
 */
export function getCursorRuleExclusionReason(discovery, relPath) {
	const normalized = toPosixRelPath(relPath);
	const relPathSet = new Set(discovery.excludeRelPaths.map(toPosixRelPath));
	if (relPathSet.has(normalized)) {
		return "excludeRelPath";
	}

	const matchTargets = [normalized];
	const baseName = path.posix.basename(normalized);
	const stem = baseName.replace(/\.(mdc|md)$/i, "");
	if (stem !== normalized) {
		matchTargets.push(stem);
	}
	if (baseName !== normalized) {
		matchTargets.push(baseName);
	}

	for (const target of matchTargets) {
		if (micromatch.isMatch(target, discovery.excludePatterns)) {
			return "excludePattern";
		}
	}
	return null;
}

/**
 * @param {ReturnType<typeof parseCursorRuleFrontmatter>} parsed
 * @returns {Exclude<CursorRuleSpineClass, "excluded">}
 */
export function classifyCursorRuleSpineClass(parsed) {
	if (parsed.alwaysApply) {
		return "always";
	}
	if (parsed.globs.length > 0) {
		return "glob";
	}
	return "manual";
}

/**
 * @param {ReturnType<typeof parseCursorRuleFrontmatter>} parsed
 * @returns {CursorRuleManifestEntry}
 */
export function buildCursorRuleManifestEntry(parsed) {
	/** @type {CursorRuleManifestEntry} */
	const entry = {
		relPath: parsed.relPath,
		spineClass: classifyCursorRuleSpineClass(parsed),
		alwaysApply: parsed.alwaysApply,
		description: parsed.description,
		globs: parsed.globs,
		parseStatus: parsed.parseStatus,
	};
	if (parsed.warnings.length > 0) {
		entry.warnings = parsed.warnings;
	}
	return entry;
}

/**
 * Recursively collect `.mdc`/`.md` paths under `rulesRoot`, sorted by posix relPath.
 *
 * @param {string} rulesRootAbs
 * @param {string} [currentAbs]
 * @returns {string[]} Absolute file paths
 */
function collectRuleFiles(rulesRootAbs, currentAbs = rulesRootAbs) {
	/** @type {string[]} */
	const files = [];

	if (!fs.existsSync(currentAbs)) {
		return files;
	}

	for (const entry of fs.readdirSync(currentAbs, { withFileTypes: true })) {
		const absPath = path.join(currentAbs, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectRuleFiles(rulesRootAbs, absPath));
			continue;
		}
		if (entry.isFile() && RULE_FILE_RE.test(entry.name)) {
			files.push(absPath);
		}
	}

	return files.sort((left, right) =>
		toPosixRelPath(path.relative(rulesRootAbs, left)).localeCompare(
			toPosixRelPath(path.relative(rulesRootAbs, right)),
		),
	);
}

/**
 * @param {string} projectRoot
 * @param {CursorRulesManifest} manifest
 */
export function writeRulesManifestAtomic(projectRoot, manifest) {
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	const dir = path.dirname(manifestPath);
	fs.mkdirSync(dir, { recursive: true });

	const tmpPath = `${manifestPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
	const content = `${JSON.stringify(manifest, null, 2)}\n`;

	try {
		fs.writeFileSync(tmpPath, content, "utf-8");
		fs.renameSync(tmpPath, manifestPath);
	} catch (err) {
		try {
			if (fs.existsSync(tmpPath)) {
				fs.unlinkSync(tmpPath);
			}
		} catch {
			// ignore cleanup failure
		}
		throw err;
	}

	return manifestPath;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {import("./profile.mjs").RulesProfile} [params.profile]
 * @param {boolean} [params.writeManifest]
 * @returns {DiscoverCursorRulesResult}
 */
export function discoverCursorRules({ projectRoot, profile, writeManifest = true }) {
	const profileResult = profile ? { ok: true, profile } : loadRulesProfile(projectRoot);
	const resolvedProfile =
		profileResult.ok && profileResult.profile ? profileResult.profile : DEFAULT_RULES_PROFILE;
	const rulesRootAbs = path.join(projectRoot, CURSOR_RULES_ROOT_REL);
	const allFiles = collectRuleFiles(rulesRootAbs);

	/** @type {string[]} */
	const warnings = [];
	const scannedFiles = allFiles.slice(0, DISCOVER_MAX_FILES);
	if (allFiles.length > DISCOVER_MAX_FILES) {
		warnings.push(
			`truncated discovery at ${DISCOVER_MAX_FILES} files (${allFiles.length} found)`,
		);
	}

	/** @type {CursorRuleManifestEntry[]} */
	const rules = [];
	/** @type {CursorRuleExcludedEntry[]} */
	const excluded = [];

	for (const absPath of scannedFiles) {
		const relPath = toPosixRelPath(path.relative(rulesRootAbs, absPath));
		const exclusionReason = getCursorRuleExclusionReason(resolvedProfile.discovery, relPath);
		if (exclusionReason) {
			excluded.push({
				relPath,
				reason: exclusionReason,
				spineClass: "excluded",
			});
			continue;
		}

		const stat = fs.statSync(absPath);
		if (stat.size > DISCOVER_MAX_FILE_BYTES) {
			warnings.push(`skipped oversize rule file (${stat.size} bytes): ${relPath}`);
			const parsed = parseCursorRuleFrontmatter("", relPath);
			const entry = buildCursorRuleManifestEntry({
				...parsed,
				parseStatus: "warn",
				warnings: [
					...parsed.warnings,
					`file exceeds ${DISCOVER_MAX_FILE_BYTES} byte limit`,
				],
			});
			rules.push(entry);
			continue;
		}

		const content = fs.readFileSync(absPath, "utf-8");
		const parsed = parseCursorRuleFrontmatter(content, relPath);
		rules.push(buildCursorRuleManifestEntry(parsed));
	}

	/** @type {CursorRulesManifest} */
	const manifest = {
		generatedAt: new Date().toISOString(),
		rulesRoot: CURSOR_RULES_ROOT_REL,
		rules,
		excluded,
	};
	if (warnings.length > 0) {
		manifest.warnings = warnings;
	}

	/** @type {DiscoverCursorRulesResult} */
	const result = { ok: true, manifest };
	if (writeManifest) {
		result.manifestPath = writeRulesManifestAtomic(projectRoot, manifest);
	}
	return result;
}

/**
 * @param {string} projectRoot
 * @returns {CursorRulesManifest | null}
 */
export function loadRulesManifest(projectRoot) {
	const manifestPath = path.join(projectRoot, RULES_MANIFEST_REL_PATH);
	if (!fs.existsSync(manifestPath)) {
		return null;
	}
	return /** @type {CursorRulesManifest} */ (JSON.parse(fs.readFileSync(manifestPath, "utf-8")));
}
