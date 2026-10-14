/**
 * Detect context-rewriting pi extension hooks (SP-822).
 *
 * Batch workers can pass `pi -ne` to skip user extension discovery, but
 * reviewers (plan/code/final) load user extensions by default. A pi package
 * that registers a context-rewriting hook (`context`, `context_with_system`,
 * `before_provider_request`) can silently rewrite what reviewers see. This
 * scanner reports which installed packages register such hooks so doctor can
 * surface an advisory warning. It never hard-fails: extensions are a legitimate
 * feature, so the check is informational with an opt-out config key.
 *
 * Scan scope stays bounded: only packages declared in pi `settings.json`
 * `packages` arrays are inspected (that is the set pi actually loads), and
 * within each package only the entry files named in `package.json` →
 * `pi.extensions`.
 */

import fs from "node:fs";
import path from "node:path";

import {
	readPiPackageSources,
	resolvePiAgentDir,
	resolvePiPackageSourcePath,
} from "./pi-extension-conflict.mjs";

/** Hooks that can rewrite the context a reviewer model sees. */
export const PI_CONTEXT_HOOK_NAMES = Object.freeze([
	"context",
	"context_with_system",
	"before_provider_request",
]);

/** Max extension entry files scanned per package (bounded scan). */
export const MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE = 16;

/** Max bytes read from a single extension entry file (bounded scan). */
export const MAX_PI_EXTENSION_SOURCE_BYTES = 512 * 1024;

/** Config value that acknowledges reviewer exposure to user extensions. */
export const REVIEWER_EXTENSION_ISOLATION_TRUSTED = "trusted";

/**
 * Patterns that indicate a context hook registration in an extension source
 * file. `context_with_system` and `before_provider_request` are unique
 * identifiers; plain `context` requires an exported-handler shape to avoid
 * false positives on unrelated `context` identifiers.
 *
 * @type {ReadonlyArray<{ hook: string, pattern: RegExp }>}
 */
const HOOK_PATTERNS = Object.freeze([
	{ hook: "context", pattern: /\bexport\s+(?:async\s+)?function\s+context\s*\(/ },
	{ hook: "context", pattern: /\bexport\s+const\s+context\s*[:=]/ },
	{ hook: "context_with_system", pattern: /\bcontext_with_system\b/ },
	{ hook: "before_provider_request", pattern: /\bbefore_provider_request\b/ },
]);

/**
 * Detect which context-rewriting hooks an extension source registers.
 *
 * @param {string} sourceText Extension entry file contents.
 * @returns {string[]} Hook names in canonical PI_CONTEXT_HOOK_NAMES order.
 */
export function scanPiExtensionSourceForContextHooks(sourceText) {
	const text = String(sourceText ?? "");
	const found = new Set();
	for (const { hook, pattern } of HOOK_PATTERNS) {
		if (pattern.test(text)) found.add(hook);
	}
	return PI_CONTEXT_HOOK_NAMES.filter((hook) => found.has(hook));
}

/**
 * Read `package.json` → `pi.extensions` entry list for an installed package.
 *
 * @param {string} packageDir Absolute path to the package root.
 * @returns {{ name: string, entries: string[] } | null} Null when the package
 *   declares no extension entries or cannot be read.
 */
function readPackageExtensionEntries(packageDir) {
	const manifestPath = path.join(packageDir, "package.json");
	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
	} catch {
		return null;
	}
	const rawEntries = manifest?.pi?.extensions;
	if (!Array.isArray(rawEntries)) return null;
	const entries = rawEntries
		.map((entry) => String(entry ?? "").trim())
		.filter(Boolean)
		.slice(0, MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE);
	if (entries.length === 0) return null;
	const name = typeof manifest?.name === "string" && manifest.name.trim()
		? manifest.name.trim()
		: path.basename(packageDir);
	return { name, entries };
}

/**
 * Scan settings-declared pi packages for context-rewriting extension hooks.
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 * @returns {{ findings: Array<{ source: string, packageName: string, extension: string, hooks: string[] }>, packagesScanned: number }}
 */
export function collectPiContextHookFindings({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
} = {}) {
	/** @type {Array<{ source: string, settingsDir: string }>} */
	const declared = [];

	const userSettings = path.join(agentDir, "settings.json");
	for (const source of readPiPackageSources(userSettings)) {
		declared.push({ source, settingsDir: agentDir });
	}

	const projectSettings = path.join(projectRoot, ".pi", "settings.json");
	for (const source of readPiPackageSources(projectSettings)) {
		declared.push({ source, settingsDir: path.dirname(projectSettings) });
	}

	/** @type {Set<string>} */
	const seenPackages = new Set();
	/** @type {Array<{ source: string, packageName: string, extension: string, hooks: string[] }>} */
	const findings = [];
	let packagesScanned = 0;

	for (const { source, settingsDir } of declared) {
		const packageDir = resolvePiPackageSourcePath(source, settingsDir, agentDir);
		if (!packageDir) continue;
		const resolvedDir = path.resolve(packageDir);
		if (seenPackages.has(resolvedDir)) continue;
		seenPackages.add(resolvedDir);

		const parsed = readPackageExtensionEntries(resolvedDir);
		if (!parsed) continue;
		packagesScanned++;

		for (const entry of parsed.entries) {
			const entryPath = path.resolve(resolvedDir, entry);
			let text;
			try {
				text = fs.readFileSync(entryPath, "utf-8");
			} catch {
				continue;
			}
			if (text.length > MAX_PI_EXTENSION_SOURCE_BYTES) {
				text = text.slice(0, MAX_PI_EXTENSION_SOURCE_BYTES);
			}
			const hooks = scanPiExtensionSourceForContextHooks(text);
			if (hooks.length > 0) {
				findings.push({
					source: String(source),
					packageName: parsed.name,
					extension: entry,
					hooks,
				});
			}
		}
	}

	return { findings, packagesScanned };
}

/**
 * Whether config acknowledges reviewer exposure to user extensions.
 *
 * @param {Record<string, any> | null | undefined} config
 * @returns {boolean}
 */
export function isTrustedReviewerExtensionIsolation(config) {
	return config?.reviewers?.piExtensionIsolation === REVIEWER_EXTENSION_ISOLATION_TRUSTED;
}

/**
 * @param {Array<{ packageName: string, hooks: string[] }>} findings
 * @returns {string}
 */
function summarizeFindings(findings) {
	const packages = [...new Set(findings.map((finding) => finding.packageName))];
	const hooks = [...new Set(findings.flatMap((finding) => finding.hooks))];
	return `${packages.join(", ")} register context-rewriting hook(s) (${hooks.join(", ")})`;
}

/**
 * Advisory doctor check: warn when installed pi packages register
 * context-rewriting hooks while reviewers load user extensions (SP-822).
 *
 * Never hard-fails (`ok` stays true); a `warning: true` check surfaces in
 * doctor output without blocking batch start.
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 * @param {Record<string, any>} [options.config] Loaded spine config.
 * @returns {{ label: string, ok: true, warning?: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildPiContextHookDoctorCheck({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
	config,
} = {}) {
	const label = "pi context-rewriting extension hooks";
	const { findings, packagesScanned } = collectPiContextHookFindings({ projectRoot, agentDir });

	if (findings.length === 0) {
		return {
			label,
			ok: true,
			detail: `no context-rewriting hooks found in ${packagesScanned} installed pi package(s)`,
		};
	}

	const summary = summarizeFindings(findings);
	if (isTrustedReviewerExtensionIsolation(config)) {
		return {
			label,
			ok: true,
			detail: `${summary} — reviewers.piExtensionIsolation=trusted acknowledges reviewer exposure`,
		};
	}

	return {
		label,
		ok: true,
		warning: true,
		detail: `${summary} — reviewers load user extensions by default; run reviewers with pi -ne or set reviewers.piExtensionIsolation trusted to acknowledge`,
		suggestedCommand: "spine settings set reviewers.piExtensionIsolation trusted",
	};
}
