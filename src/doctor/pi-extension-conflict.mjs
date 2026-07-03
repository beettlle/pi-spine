/**
 * Detect pi-web-access duplicate extension sources (GitHub #104, SP-450).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Tools registered by pi-web-access that collide when loaded twice. */
export const PI_WEB_ACCESS_TOOL_NAMES = ["web_search", "fetch_content", "get_search_content"];

const PI_WEB_ACCESS_PACKAGE_RE = /pi-web-access/i;

/**
 * @param {string} [agentDir]
 */
export function resolvePiAgentDir(agentDir = process.env.PI_AGENT_DIR) {
	if (agentDir && String(agentDir).trim()) {
		return path.resolve(String(agentDir));
	}
	return path.join(os.homedir(), ".pi", "agent");
}

/**
 * @param {string} settingsPath
 * @returns {string[]}
 */
export function readPiPackageSources(settingsPath) {
	if (!fs.existsSync(settingsPath)) return [];
	try {
		const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
		const packages = raw?.packages;
		if (!Array.isArray(packages)) return [];
		return packages.map((entry) => String(entry ?? "").trim()).filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function isPiWebAccessPackageSource(source) {
	return PI_WEB_ACCESS_PACKAGE_RE.test(String(source ?? ""));
}

/**
 * Resolve a package source entry to an absolute path when possible.
 *
 * @param {string} source
 * @param {string} settingsDir
 * @param {string} [agentDir]
 */
export function resolvePiPackageSourcePath(source, settingsDir, agentDir = resolvePiAgentDir()) {
	const normalized = String(source ?? "").trim();
	if (!normalized) return null;
	if (normalized.startsWith("npm:")) {
		const pkgName = normalized.slice(4);
		const segments = pkgName.split("/").filter(Boolean);
		return path.join(agentDir, "npm", "node_modules", ...segments);
	}
	if (path.isAbsolute(normalized)) {
		return normalized;
	}
	return path.resolve(settingsDir, normalized);
}

/**
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 * @returns {{ conflict: boolean, sources: string[], detail: string }}
 */
export function detectPiWebAccessExtensionConflict({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
} = {}) {
	/** @type {Set<string>} */
	const resolvedSources = new Set();
	/** @type {string[]} */
	const rawSources = [];

	const userSettings = path.join(agentDir, "settings.json");
	for (const source of readPiPackageSources(userSettings)) {
		if (!isPiWebAccessPackageSource(source)) continue;
		rawSources.push(source);
		const resolved = resolvePiPackageSourcePath(source, agentDir);
		if (resolved) resolvedSources.add(path.resolve(resolved));
	}

	const projectSettings = path.join(projectRoot, ".pi", "settings.json");
	for (const source of readPiPackageSources(projectSettings)) {
		if (!isPiWebAccessPackageSource(source)) continue;
		rawSources.push(source);
		const resolved = resolvePiPackageSourcePath(source, path.dirname(projectSettings));
		if (resolved) resolvedSources.add(path.resolve(resolved));
	}

	const npmDefault = path.join(agentDir, "npm", "node_modules", "pi-web-access");
	if (fs.existsSync(npmDefault)) {
		resolvedSources.add(path.resolve(npmDefault));
		if (!rawSources.some((entry) => entry.startsWith("npm:pi-web-access"))) {
			rawSources.push("npm:pi-web-access");
		}
	}

	const conflict = resolvedSources.size > 1 || rawSources.length > 1;
	const detail =
		rawSources.length === 0
			? "no pi-web-access sources detected"
			: conflict
				? `duplicate pi-web-access sources: ${rawSources.join(", ")}`
				: `single pi-web-access source: ${rawSources[0]}`;

	return { conflict, sources: [...rawSources], detail };
}

/**
 * Whether batch workers should pass `pi -ne` (skip user extension discovery).
 *
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 * @returns {boolean}
 */
export function shouldWorkerUsePiNoExtensions({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
} = {}) {
	return detectPiWebAccessExtensionConflict({ projectRoot, agentDir }).conflict;
}

/**
 * @param {string} output
 */
export function isPiExtensionConflictOutput(output) {
	const text = String(output ?? "");
	if (!/conflicts with/i.test(text)) return false;
	return PI_WEB_ACCESS_TOOL_NAMES.some((tool) => text.includes(`Tool "${tool}"`));
}

/**
 * @param {object} [options]
 * @param {string} [options.projectRoot]
 * @param {string} [options.agentDir]
 */
export function buildPiExtensionConflictDoctorCheck({
	projectRoot = process.cwd(),
	agentDir = resolvePiAgentDir(),
} = {}) {
	const assessment = detectPiWebAccessExtensionConflict({ projectRoot, agentDir });
	if (!assessment.conflict) {
		return {
			label: "pi-web-access extension conflict",
			ok: true,
			detail: assessment.detail,
		};
	}

	return {
		label: "pi-web-access extension conflict",
		ok: true,
		warning: true,
		detail: `${assessment.detail} — batch workers pass pi -ne when this conflict is detected; remove duplicate source or run pi remove for npm:pi-web-access`,
		suggestedCommand:
			"pi remove npm:pi-web-access -l || pi remove ../../Documents/github/pi-web-access -l",
	};
}
