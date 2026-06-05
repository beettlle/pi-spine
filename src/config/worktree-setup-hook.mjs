/**
 * Sandbox validation for worktreeSetupHook (SP-102).
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} projectRoot
 * @param {string} configured
 */
export function validateWorktreeSetupHookPath(projectRoot, configured) {
	const root = fs.realpathSync.native?.(projectRoot) ?? fs.realpathSync(projectRoot);
	if (typeof configured !== "string" || !configured.trim()) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_INVALID",
			message: "worktreeSetupHook must be a non-empty string when set",
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}

	const trimmed = configured.trim().replace(/\\/g, "/");
	if (path.isAbsolute(trimmed)) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_INVALID",
			message: "worktreeSetupHook must be relative to the project root",
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}
	if (trimmed.includes("..")) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_UNSAFE",
			message: "worktreeSetupHook must not traverse outside the project",
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}

	const normalized = path.posix.normalize(trimmed);
	const scriptsPrefix = "scripts/";
	if (!normalized.startsWith(scriptsPrefix)) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_UNSAFE",
			message: `worktreeSetupHook must live under ${scriptsPrefix}`,
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}

	const absPath = path.resolve(root, normalized);
	const rel = path.relative(root, absPath);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_UNSAFE",
			message: "worktreeSetupHook resolves outside the project root",
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
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
			code: "CONFIG_SETUP_HOOK_UNSAFE",
			message: `Cannot resolve worktree setup hook: ${err instanceof Error ? err.message : String(err)}`,
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}

	const resolvedRel = path.relative(root, resolvedPath).replace(/\\/g, "/");
	if (resolvedRel.startsWith("..") || path.isAbsolute(resolvedRel) || !resolvedRel.startsWith(scriptsPrefix)) {
		return {
			ok: false,
			code: "CONFIG_SETUP_HOOK_UNSAFE",
			message: "worktreeSetupHook symlink escapes project scripts/",
			suggestedCommand: "spine settings set worktreeSetupHook scripts/spine-worktree-setup.sh",
		};
	}

	return { ok: true, scriptPath: resolvedPath, relPath: resolvedRel };
}

/**
 * @param {object} config
 * @param {string} [projectRoot]
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validateWorktreeSetupHookConfig(config, projectRoot = process.cwd()) {
	const configured = config?.worktreeSetupHook;
	if (configured == null || configured === "") return null;
	const result = validateWorktreeSetupHookPath(projectRoot, configured);
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
export function resolveWorktreeSetupHook(projectRoot, config = {}) {
	const root = fs.existsSync(projectRoot)
		? (fs.realpathSync.native?.(projectRoot) ?? fs.realpathSync(projectRoot))
		: projectRoot;
	const configured = config?.worktreeSetupHook;
	if (typeof configured !== "string" || !configured.trim()) return null;

	const validated = validateWorktreeSetupHookPath(root, configured);
	if (!validated.ok || !fs.existsSync(validated.scriptPath)) return null;
	return validated.scriptPath;
}
