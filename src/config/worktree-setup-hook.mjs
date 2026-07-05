/**
 * Sandbox validation for worktreeSetupHook (SP-102).
 * Flutter gitignored-asset hook template and doctor helpers (SP-459, #80).
 *
 * worktreeSetupHook runs once per lane (cwd = lane worktree). The hook receives
 * SPINE_PROJECT_ROOT (main checkout), SPINE_WORKTREE, SPINE_BATCH_ID, and
 * SPINE_LANE_NUMBER. Symlink gitignored pubspec asset dirs from SPINE_PROJECT_ROOT
 * into the lane worktree so flutter test can resolve pubspec.yaml paths.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

/** Relative hook path copied by spine init for Flutter pubspec assets (#80). */
export const FLUTTER_WORKTREE_SETUP_HOOK_REL = "scripts/spine-worktree-setup-flutter.sh";

/** Package template source for {@link FLUTTER_WORKTREE_SETUP_HOOK_REL}. */
export const FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE = path.join(
	PACKAGE_ROOT,
	"templates",
	"spine-worktree-setup-flutter.sh",
);

/**
 * Remove template-only documentation keys before writing consumer config.
 *
 * @param {Record<string, unknown>} config
 */
export function stripTemplateOnlyKeys(config) {
	const stripped = structuredClone(config);
	delete stripped._examples;
	return stripped;
}

/**
 * Lightweight pubspec.yaml asset path extraction (no YAML dependency).
 *
 * @param {string} pubspecContent
 * @returns {string[]}
 */
export function extractPubspecAssetPaths(pubspecContent) {
	/** @type {string[]} */
	const paths = [];
	for (const line of pubspecContent.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const match = trimmed.match(/^-\s+(assets\/[^\s#]+)/);
		if (!match) continue;
		const assetPath = match[1].replace(/\/+$/, "");
		paths.push(assetPath);
	}
	return [...new Set(paths)];
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 */
function isGitignoredPath(projectRoot, relPath) {
	try {
		execFileSync("git", ["check-ignore", "-q", relPath], {
			cwd: projectRoot,
			stdio: "ignore",
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Asset paths listed in pubspec.yaml that are gitignored and present on the main checkout.
 *
 * @param {string} projectRoot
 * @returns {string[]}
 */
export function findGitignoredPubspecAssetsOnMain(projectRoot) {
	const pubspecPath = path.join(projectRoot, "pubspec.yaml");
	if (!fs.existsSync(pubspecPath)) return [];

	const assetPaths = extractPubspecAssetPaths(fs.readFileSync(pubspecPath, "utf-8"));
	/** @type {string[]} */
	const gitignoredOnMain = [];

	for (const relPath of assetPaths) {
		const absPath = path.join(projectRoot, relPath);
		if (!fs.existsSync(absPath)) continue;
		if (isGitignoredPath(projectRoot, relPath)) {
			gitignoredOnMain.push(relPath);
		}
	}

	return gitignoredOnMain;
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function listLaneWorktreePaths(projectRoot) {
	const worktreesRoot = path.join(projectRoot, ".worktrees");
	if (!fs.existsSync(worktreesRoot)) return [];

	/** @type {string[]} */
	const lanePaths = [];
	for (const batchEntry of fs.readdirSync(worktreesRoot, { withFileTypes: true })) {
		if (!batchEntry.isDirectory()) continue;
		const batchDir = path.join(worktreesRoot, batchEntry.name);
		for (const laneEntry of fs.readdirSync(batchDir, { withFileTypes: true })) {
			if (!laneEntry.isDirectory() || !laneEntry.name.startsWith("lane-")) continue;
			lanePaths.push(path.join(batchDir, laneEntry.name));
		}
	}
	return lanePaths;
}

/**
 * @param {string} lanePath
 * @param {string[]} assetPaths
 * @returns {string[]}
 */
function findMissingAssetsInLane(lanePath, assetPaths) {
	/** @type {string[]} */
	const missing = [];
	for (const relPath of assetPaths) {
		if (!fs.existsSync(path.join(lanePath, relPath))) {
			missing.push(relPath);
		}
	}
	return missing;
}

/**
 * Doctor advisory when Flutter pubspec assets would be missing in lane worktrees (#80).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} [params.config]
 */
export function buildGitignoredPubspecAssetsDoctorCheck({ projectRoot, config = {} }) {
	const gitignoredAssets = findGitignoredPubspecAssetsOnMain(projectRoot);
	if (gitignoredAssets.length === 0) {
		return {
			label: "flutter pubspec gitignored assets",
			ok: true,
			detail: "no gitignored pubspec assets on main checkout",
		};
	}

	const hookConfigured =
		typeof config.worktreeSetupHook === "string" && config.worktreeSetupHook.trim().length > 0;

	const lanePaths = listLaneWorktreePaths(projectRoot);
	/** @type {string[]} */
	const missingInLanes = [];
	for (const lanePath of lanePaths) {
		for (const relPath of findMissingAssetsInLane(lanePath, gitignoredAssets)) {
			missingInLanes.push(`${path.relative(projectRoot, lanePath)}:${relPath}`);
		}
	}

	if (!hookConfigured) {
		return {
			label: "flutter pubspec gitignored assets",
			ok: true,
			warning: true,
			detail: `${gitignoredAssets.length} gitignored asset path(s) on main; worktreeSetupHook not configured`,
			suggestion:
				`copy ${FLUTTER_WORKTREE_SETUP_HOOK_REL}, set worktreeSetupHook, customize paths — docs/adoption/flutter-worktree-guide.md`,
		};
	}

	if (missingInLanes.length > 0) {
		return {
			label: "flutter pubspec gitignored assets",
			ok: true,
			warning: true,
			detail: `missing in lane(s): ${missingInLanes.slice(0, 2).join(", ")}${missingInLanes.length > 2 ? "…" : ""}`,
			suggestion: "verify worktreeSetupHook paths; re-run spine batch or spine doctor",
		};
	}

	return {
		label: "flutter pubspec gitignored assets",
		ok: true,
		detail: `${gitignoredAssets.length} gitignored asset path(s); hook configured`,
	};
}

/**
 * Copy optional Flutter worktree setup hook template into consumer scripts/ on init.
 *
 * @param {string} projectRoot
 * @param {{ force?: boolean, dryRun?: boolean }} [options]
 */
export function copyFlutterWorktreeSetupHookTemplate(projectRoot, { force = false, dryRun = false } = {}) {
	const destRel = FLUTTER_WORKTREE_SETUP_HOOK_REL;
	const destPath = path.join(projectRoot, destRel);

	if (fs.existsSync(destPath) && !force) {
		return { action: "skip", path: destRel };
	}
	if (!fs.existsSync(FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE)) {
		return {
			action: "error",
			path: destRel,
			error: `Missing init template: ${FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE}`,
		};
	}

	if (!dryRun) {
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.copyFileSync(FLUTTER_WORKTREE_SETUP_HOOK_TEMPLATE, destPath);
		fs.chmodSync(destPath, 0o755);
	}

	return {
		action: fs.existsSync(destPath) && force ? "overwrite" : "create",
		path: destRel,
	};
}

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
