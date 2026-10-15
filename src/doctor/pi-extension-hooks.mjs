/**
 * Detect context-rewriting pi extension hooks (SP-822).
 *
 * Batch workers can pass `pi -ne` to skip user extension discovery, and per
 * SP-819 reviewers do the same unless spine config opts in with
 * `agents.reviewer.loadUserExtensions: true`. When that opt-in is set, a pi
 * package that registers a context-rewriting hook (`context`,
 * `context_with_system`, `before_provider_request`) can silently rewrite what
 * reviewers see. This scanner reports which installed packages register such
 * hooks so doctor can surface an advisory warning. It never hard-fails:
 * extensions are a legitimate feature, so the check is informational with an
 * opt-out config key.
 *
 * Scan scope stays bounded: only packages declared in pi `settings.json`
 * `packages` arrays are inspected (that is the set pi actually loads), and
 * within each package only the entry files named in `package.json` →
 * `pi.extensions` — or, when the manifest declares none, the conventional
 * `extensions/` directory plus root `index.{ts,js,mjs}` files that pi
 * discovers for manifest-less packages.
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

/** Max installed packages scanned per run (bounded scan). */
export const MAX_PI_PACKAGES_SCANNED = 50;

/** Max extension entry files scanned per package (bounded scan). */
export const MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE = 20;

/** Max bytes read from a single extension entry file (bounded scan). */
export const MAX_PI_EXTENSION_SOURCE_BYTES = 512 * 1024;

/** File extensions pi treats as extension entry files. */
const EXTENSION_ENTRY_FILE_PATTERN = /\.(?:ts|js|mjs)$/;

/** Conventional root entry files pi discovers when no manifest list exists. */
const FALLBACK_ROOT_ENTRIES = Object.freeze(["index.ts", "index.js", "index.mjs"]);

/**
 * Patterns that indicate a context hook registration in an extension source
 * file. All three hooks register through `pi.on("<event>", ...)`, so the
 * patterns match the `.on("<event>"` / `.on('<event>'` call shape (see
 * pi-coding-agent docs/extensions.md, "Events and concurrency"). Matching the
 * call shape avoids false positives on unrelated identifiers that merely
 * mention the event names.
 *
 * @type {ReadonlyArray<{ hook: string, pattern: RegExp }>}
 */
const HOOK_PATTERNS = Object.freeze([
	{ hook: "context", pattern: /\.on\(\s*["']context["']/ },
	{ hook: "context_with_system", pattern: /\.on\(\s*["']context_with_system["']/ },
	{ hook: "before_provider_request", pattern: /\.on\(\s*["']before_provider_request["']/ },
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
 * List the conventional entry files pi discovers when the manifest declares
 * no `pi.extensions`: files in `extensions/` plus root `index.{ts,js,mjs}`.
 *
 * @param {string} packageDir Absolute path to the package root.
 * @returns {string[]} Entry paths relative to the package root, sorted and
 *   capped at MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE.
 */
function discoverFallbackExtensionEntries(packageDir) {
	/** @type {string[]} */
	const entries = [];
	const extensionsDir = path.join(packageDir, "extensions");
	try {
		for (const fileName of fs.readdirSync(extensionsDir).sort()) {
			if (!EXTENSION_ENTRY_FILE_PATTERN.test(fileName)) continue;
			if (!fs.statSync(path.join(extensionsDir, fileName)).isFile()) continue;
			entries.push(path.join("extensions", fileName));
		}
	} catch {
		// No readable extensions/ directory — fall through to root entries.
	}
	for (const rootEntry of FALLBACK_ROOT_ENTRIES) {
		try {
			if (fs.statSync(path.join(packageDir, rootEntry)).isFile()) {
				entries.push(rootEntry);
			}
		} catch {
			// Missing root entry — skip.
		}
	}
	return entries.slice(0, MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE);
}

/**
 * Resolve the extension entry files for an installed package: the
 * `package.json` → `pi.extensions` list when present, else the conventional
 * `extensions/` directory and root `index.{ts,js,mjs}` files pi discovers.
 *
 * @param {string} packageDir Absolute path to the package root.
 * @returns {{ name: string, entries: string[] } | null} Null when the package
 *   has no extension entries to scan.
 */
function readPackageExtensionEntries(packageDir) {
	const manifestPath = path.join(packageDir, "package.json");
	let manifest;
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
	} catch {
		manifest = null;
	}
	const name = typeof manifest?.name === "string" && manifest.name.trim()
		? manifest.name.trim()
		: path.basename(packageDir);
	const rawEntries = manifest?.pi?.extensions;
	if (Array.isArray(rawEntries) && rawEntries.length > 0) {
		const entries = rawEntries
			.map((entry) => String(entry ?? "").trim())
			.filter(Boolean)
			.slice(0, MAX_PI_EXTENSION_ENTRIES_PER_PACKAGE);
		return entries.length > 0 ? { name, entries } : null;
	}
	const entries = discoverFallbackExtensionEntries(packageDir);
	return entries.length > 0 ? { name, entries } : null;
}

/**
 * Read at most MAX_PI_EXTENSION_SOURCE_BYTES bytes from a file without ever
 * allocating more than the cap, regardless of the file size on disk.
 *
 * @param {string} filePath
 * @returns {string | null} Null when the file cannot be opened or read.
 */
function readBoundedText(filePath) {
	let fd;
	try {
		fd = fs.openSync(filePath, "r");
		const stat = fs.fstatSync(fd);
		const length = Math.min(stat.size, MAX_PI_EXTENSION_SOURCE_BYTES);
		const buffer = Buffer.alloc(length);
		const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
		return buffer.toString("utf-8", 0, bytesRead);
	} catch {
		return null;
	} finally {
		if (fd !== undefined) {
			try {
				fs.closeSync(fd);
			} catch {
				// Close errors must not mask read results.
			}
		}
	}
}

/**
 * Scan settings-declared pi packages for context-rewriting extension hooks.
 * Missing or unreadable paths are skipped and noted in `skipped`; nothing is
 * ever thrown.
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 * @returns {{ packages: Array<{ source: string, hooks: string[] }>, packagesScanned: number, skipped: Array<{ source: string, reason: string }> }}
 */
export function findContextRewritingExtensions({
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
	/** @type {Array<{ source: string, hooks: string[] }>} */
	const packages = [];
	/** @type {Array<{ source: string, reason: string }>} */
	const skipped = [];
	let packagesScanned = 0;

	for (const { source, settingsDir } of declared) {
		const packageDir = resolvePiPackageSourcePath(source, settingsDir, agentDir);
		if (!packageDir) {
			skipped.push({ source: String(source), reason: "unresolvable package source" });
			continue;
		}
		const resolvedDir = path.resolve(packageDir);
		if (seenPackages.has(resolvedDir)) continue;
		seenPackages.add(resolvedDir);
		if (packagesScanned >= MAX_PI_PACKAGES_SCANNED) {
			skipped.push({ source: String(source), reason: "package scan cap reached" });
			continue;
		}
		if (!fs.existsSync(resolvedDir)) {
			skipped.push({ source: String(source), reason: "package path not found" });
			continue;
		}
		packagesScanned++;

		const parsed = readPackageExtensionEntries(resolvedDir);
		if (!parsed) continue;

		/** @type {Set<string>} */
		const packageHooks = new Set();
		for (const entry of parsed.entries) {
			const entryPath = path.resolve(resolvedDir, entry);
			if (entryPath !== resolvedDir && !entryPath.startsWith(resolvedDir + path.sep)) {
				// Manifest entry escapes the package directory — never read outside it.
				skipped.push({
					source: String(source),
					reason: `entry escapes package directory: ${entry}`,
				});
				continue;
			}
			const text = readBoundedText(entryPath);
			if (text === null) {
				skipped.push({ source: String(source), reason: `unreadable entry: ${entry}` });
				continue;
			}
			for (const hook of scanPiExtensionSourceForContextHooks(text)) {
				packageHooks.add(hook);
			}
		}
		if (packageHooks.size > 0) {
			packages.push({
				source: String(source),
				hooks: PI_CONTEXT_HOOK_NAMES.filter((hook) => packageHooks.has(hook)),
			});
		}
	}

	return { packages, packagesScanned, skipped };
}

/**
 * @param {Array<{ source: string, hooks: string[] }>} packages
 * @returns {string}
 */
function summarizeFindings(packages) {
	return packages
		.map((pkg) => `${pkg.source} (${pkg.hooks.join(", ")})`)
		.join("; ");
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
 * @param {Record<string, any> | null} [options.config] Loaded spine config.
 * @returns {{ label: string, ok: true, warning?: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildContextHookExtensionDoctorCheck({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
	config,
} = {}) {
	const label = "pi extensions rewriting reviewer context";
	const { packages, packagesScanned } = findContextRewritingExtensions({ projectRoot, agentDir });

	if (packages.length === 0) {
		return {
			label,
			ok: true,
			detail: `no context-rewriting hooks found in ${packagesScanned} installed pi package(s)`,
		};
	}

	const summary = summarizeFindings(packages);
	if (config?.agents?.reviewer?.loadUserExtensions === true) {
		return {
			label,
			ok: true,
			warning: true,
			detail: `${summary} register context-rewriting hook(s) and reviewers load user extensions (agents.reviewer.loadUserExtensions=true); these hooks can rewrite reviewer context`,
			suggestedCommand: "spine settings set agents.reviewer.loadUserExtensions false",
		};
	}

	return {
		label,
		ok: true,
		detail: `${packages.length} package(s) register context hooks (${summary}); reviewers isolated (pi -ne)`,
	};
}
