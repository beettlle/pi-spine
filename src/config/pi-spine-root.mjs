/**
 * Resolve pi-spine package root for worker subprocess env (SP-103).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} root
 * @returns {boolean}
 */
function looksLikePiSpinePackage(root) {
	return (
		fs.existsSync(path.join(root, "package.json")) &&
		fs.existsSync(path.join(root, "bin", "spine.mjs"))
	);
}

/**
 * @param {string} root
 * @returns {string}
 */
function realpathOrResolve(root) {
	try {
		return fs.realpathSync(root);
	} catch {
		return root;
	}
}

/**
 * @param {object} [config]
 * @param {string} [projectRoot]
 * @param {string} [importMetaUrl]
 * @returns {string}
 */
export function resolvePiSpineRoot(
	config = {},
	projectRoot = process.cwd(),
	importMetaUrl = import.meta.url,
) {
	const configured = config?.development?.piSpineRoot;
	if (typeof configured === "string" && configured.trim()) {
		const trimmed = configured.trim();
		const resolved = path.isAbsolute(trimmed)
			? trimmed
			: path.resolve(projectRoot, trimmed);
		return realpathOrResolve(resolved);
	}

	const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
	const packageRoot = path.resolve(moduleDir, "../..");
	return realpathOrResolve(packageRoot);
}

/**
 * @param {object} [config]
 * @param {string} [projectRoot]
 * @returns {{ code: string, message: string, suggestedCommand: string } | null}
 */
export function validatePiSpineRootConfig(config, projectRoot = process.cwd()) {
	const configured = config?.development?.piSpineRoot;
	if (configured == null || configured === "") return null;

	if (typeof configured !== "string" || !configured.trim()) {
		return {
			code: "CONFIG_PI_SPINE_ROOT_INVALID",
			message: "development.piSpineRoot must be a non-empty string when set",
			suggestedCommand: "spine settings set development.piSpineRoot /path/to/pi-spine",
		};
	}

	const resolved = resolvePiSpineRoot(config, projectRoot);
	if (!fs.existsSync(resolved)) {
		return {
			code: "CONFIG_PI_SPINE_ROOT_MISSING",
			message: `development.piSpineRoot path does not exist: ${resolved}`,
			suggestedCommand: "spine doctor",
		};
	}

	if (!looksLikePiSpinePackage(resolved)) {
		return {
			code: "CONFIG_PI_SPINE_ROOT_INVALID",
			message:
				"development.piSpineRoot must point at a pi-spine package (package.json and bin/spine.mjs)",
			suggestedCommand: "spine doctor",
		};
	}

	return null;
}
