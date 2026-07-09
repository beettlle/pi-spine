// @ts-nocheck
/**
 * Resolve the authoritative Pi CLI entrypoint and compare with PATH `pi`.
 * Mirrors Taskplane path-resolver argv-first strategy (issue #128 / SP-559).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

/** Pi coding-agent npm scopes — canonical first, legacy second (Pi v0.74+ rename). */
export const PI_PACKAGE_SCOPES = ["@earendil-works", "@mariozechner"];

/** @type {string | null} */
let cachedNpmGlobalRoot = null;

/**
 * @param {typeof spawnSync} [spawn]
 * @returns {string}
 */
export function getNpmGlobalRoot(spawn = spawnSync) {
	if (cachedNpmGlobalRoot !== null) return cachedNpmGlobalRoot;
	try {
		const result = spawn("npm", ["root", "-g"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
			shell: process.platform === "win32",
		});
		cachedNpmGlobalRoot = result.stdout?.trim() || "";
	} catch {
		cachedNpmGlobalRoot = "";
	}
	return cachedNpmGlobalRoot;
}

/**
 * Reset module cache (tests only).
 */
export function resetNpmGlobalRootCache() {
	cachedNpmGlobalRoot = null;
}

/**
 * @param {string} filePath
 * @param {(p: string) => string} [realpathFn]
 */
function safeRealpath(filePath, realpathFn = fs.realpathSync) {
	try {
		return realpathFn(filePath);
	} catch {
		return path.resolve(filePath);
	}
}

/**
 * @param {(cmd: string) => string | null} [which]
 */
export function resolvePiOnPath(which = defaultWhich) {
	return which("pi");
}

function defaultWhich(cmd) {
	try {
		const out = execFileSync("which", [cmd], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const resolved = out.trim().split(/\r?\n/)[0]?.trim();
		return resolved || null;
	} catch {
		return null;
	}
}

/**
 * @param {string} [argv1]
 * @param {(p: string) => boolean} [exists]
 */
export function resolvePiCliFromArgv(argv1 = process.argv[1], exists = fs.existsSync) {
	const piEntry = String(argv1 ?? "").trim();
	if (piEntry.endsWith("cli.js") && exists(piEntry)) {
		return piEntry;
	}
	return null;
}

/**
 * Collect npm-global and static fallback bases for Pi CLI discovery.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {typeof spawnSync} [spawn]
 */
export function collectPiCliSearchBases(env = process.env, spawn = spawnSync) {
	const bases = [];
	const npmRoot = getNpmGlobalRoot(spawn);
	if (npmRoot) bases.push(npmRoot);

	const home = env.HOME || env.USERPROFILE || "";
	if (env.APPDATA) {
		bases.push(path.join(env.APPDATA, "npm", "node_modules"));
	}
	if (home) {
		bases.push(path.join(home, "AppData", "Roaming", "npm", "node_modules"));
		bases.push(path.join(home, ".npm-global", "lib", "node_modules"));
		bases.push(path.join(home, ".pi", "agent", "npm", "node_modules"));
	}
	if (env.NVM_SYMLINK) {
		bases.push(path.join(env.NVM_SYMLINK, "node_modules"));
	}
	if (env.NVM_BIN) {
		bases.push(path.join(env.NVM_BIN, "..", "lib", "node_modules"));
	}
	bases.push(path.join("/usr", "local", "lib", "node_modules"));
	bases.push(path.join("/opt", "homebrew", "lib", "node_modules"));
	return bases;
}

/**
 * @param {object} [options]
 * @param {string} [options.argv1]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {(p: string) => boolean} [options.exists]
 * @param {typeof spawnSync} [options.spawn]
 */
export function resolveAuthoritativePiCliPath({
	argv1 = process.argv[1],
	env = process.env,
	exists = fs.existsSync,
	spawn = spawnSync,
} = {}) {
	const fromArgv = resolvePiCliFromArgv(argv1, exists);
	if (fromArgv) {
		return { path: fromArgv, source: "argv" };
	}

	for (const base of collectPiCliSearchBases(env, spawn)) {
		for (const scope of PI_PACKAGE_SCOPES) {
			const candidate = path.join(base, scope, "pi-coding-agent", "dist", "cli.js");
			if (exists(candidate)) {
				return { path: candidate, source: "search" };
			}
		}
	}

	return { path: null, source: "unresolved" };
}

/**
 * @param {object} [options]
 * @param {string} [options.argv1]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {(cmd: string) => string | null} [options.which]
 * @param {(p: string) => boolean} [options.exists]
 * @param {(p: string) => string} [options.realpath]
 * @param {typeof spawnSync} [options.spawn]
 */
export function buildPiCliResolutionDoctorCheck({
	argv1 = process.argv[1],
	env = process.env,
	which,
	exists = fs.existsSync,
	realpath = fs.realpathSync,
	spawn = spawnSync,
} = {}) {
	const authoritative = resolveAuthoritativePiCliPath({ argv1, env, exists, spawn });
	const pathPi = resolvePiOnPath(which);

	if (!authoritative.path && !pathPi) {
		return {
			label: "pi CLI resolution",
			ok: true,
			warning: true,
			detail: "pi not found via argv/search or PATH",
			suggestedCommand: "npm install -g @earendil-works/pi-coding-agent",
		};
	}

	if (!authoritative.path) {
		return {
			label: "pi CLI resolution",
			ok: true,
			detail: `PATH: ${pathPi} (argv/search unresolved)`,
		};
	}

	const authResolved = safeRealpath(authoritative.path, realpath);
	const sourceLabel = authoritative.source === "argv" ? "argv" : "search";

	if (!pathPi) {
		return {
			label: "pi CLI resolution",
			ok: true,
			warning: true,
			detail: `resolved via ${sourceLabel}: ${authoritative.path} (not on PATH)`,
			suggestedCommand:
				process.platform === "win32"
					? "Add npm global bin to PATH or use npx pi"
					: 'export PATH="$(npm bin -g):$PATH"',
		};
	}

	const pathResolved = safeRealpath(pathPi, realpath);
	if (pathResolved === authResolved) {
		return {
			label: "pi CLI resolution",
			ok: true,
			detail: `${pathPi} (matches ${sourceLabel} resolution)`,
		};
	}

	return {
		label: "pi CLI resolution (PATH mismatch)",
		ok: true,
		warning: true,
		detail: `PATH: ${pathPi} — authoritative (${sourceLabel}): ${authoritative.path}`,
		suggestedCommand:
			process.platform === "win32"
				? "Align PATH with the Pi install npm bin directory"
				: 'export PATH="$(npm bin -g):$PATH"  # or use the argv-resolved pi directly',
	};
}
