/**
 * Sandbox validation for development.workerLaunchScript (SP-077).
 */

import fs from "node:fs";
import path from "node:path";

export const DEFAULT_WORKER_LAUNCH_SCRIPT = "scripts/spine-worker-launch.sh";

/**
 * @param {string} projectRoot
 * @param {string} configured
 */
export function validateWorkerLaunchScriptPath(projectRoot, configured) {
	const root = fs.realpathSync.native?.(projectRoot) ?? fs.realpathSync(projectRoot);
	if (typeof configured !== "string" || !configured.trim()) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_INVALID",
			message: "development.workerLaunchScript must be a non-empty string",
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	const trimmed = configured.trim().replace(/\\/g, "/");
	if (path.isAbsolute(trimmed)) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_INVALID",
			message: "development.workerLaunchScript must be relative to the project root",
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}
	if (trimmed.includes("..")) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_UNSAFE",
			message: "development.workerLaunchScript must not traverse outside the project",
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	const normalized = path.posix.normalize(trimmed);
	const scriptsPrefix = "scripts/";
	if (!normalized.startsWith(scriptsPrefix)) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_UNSAFE",
			message: `development.workerLaunchScript must live under ${scriptsPrefix}`,
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	const absPath = path.resolve(root, normalized);
	const rel = path.relative(root, absPath);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_UNSAFE",
			message: "development.workerLaunchScript resolves outside the project root",
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	let resolvedPath = absPath;
	try {
		if (fs.existsSync(absPath)) {
			resolvedPath = fs.realpathSync(absPath);
		}
	} catch (err) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_UNSAFE",
			message: `Cannot resolve worker launch script: ${err instanceof Error ? err.message : String(err)}`,
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	const resolvedRel = path.relative(root, resolvedPath).replace(/\\/g, "/");
	if (resolvedRel.startsWith("..") || path.isAbsolute(resolvedRel) || !resolvedRel.startsWith(scriptsPrefix)) {
		return {
			ok: false,
			code: "CONFIG_LAUNCH_SCRIPT_UNSAFE",
			message: "development.workerLaunchScript symlink escapes project scripts/",
			suggestedCommand: `spine settings set development.workerLaunchScript ${DEFAULT_WORKER_LAUNCH_SCRIPT}`,
		};
	}

	return { ok: true, scriptPath: resolvedPath, relPath: resolvedRel };
}

/**
 * @param {object} config
 * @param {string} [projectRoot]
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validateWorkerLaunchScriptConfig(config, projectRoot = process.cwd()) {
	const configured = config?.development?.workerLaunchScript;
	if (configured == null || configured === "") return null;
	const result = validateWorkerLaunchScriptPath(projectRoot, configured);
	if (result.ok) return null;
	return {
		code: result.code,
		message: result.message,
		suggestedCommand: result.suggestedCommand,
	};
}

/**
 * @param {string} projectRoot
 * @param {object} [config]
 * @returns {string|null}
 */
export function resolveSafeWorkerLaunchScript(projectRoot, config = {}) {
	const root = fs.existsSync(projectRoot)
		? (fs.realpathSync.native?.(projectRoot) ?? fs.realpathSync(projectRoot))
		: projectRoot;
	const configured = config?.development?.workerLaunchScript;
	if (typeof configured === "string" && configured.trim()) {
		const validated = validateWorkerLaunchScriptPath(root, configured);
		if (!validated.ok || !fs.existsSync(validated.scriptPath)) return null;
		return validated.scriptPath;
	}

	const conventional = path.join(root, DEFAULT_WORKER_LAUNCH_SCRIPT);
	if (!fs.existsSync(conventional)) return null;
	const validated = validateWorkerLaunchScriptPath(root, DEFAULT_WORKER_LAUNCH_SCRIPT);
	if (!validated.ok) return null;
	return validated.scriptPath;
}
