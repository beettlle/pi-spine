/**
 * Stub delivery-only fileScopeMustChange detection (GitHub #67, SP-407).
 */

import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";

/** Repo roots that indicate implementation scope, not stub delivery. */
const IMPLEMENTATION_ROOT_PREFIXES = [
	"src/",
	"bin/",
	"tests/",
	"scripts/",
	"docs/",
	".github/",
];

/** Exact repo-root files that indicate implementation scope. */
const IMPLEMENTATION_ROOT_FILES = new Set([
	"package.json",
	"package-lock.json",
	"eslint.config.js",
]);

/**
 * @param {string} pattern
 */
function normalizePattern(pattern) {
	return String(pattern ?? "").replace(/\\/g, "/").trim();
}

/**
 * @param {string} tasksRoot
 */
function escapeRegex(tasksRoot) {
	return normalizePattern(tasksRoot).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} pattern
 */
export function isImplementationScopePattern(pattern) {
	const normalized = normalizePattern(pattern);
	if (!normalized) {
		return false;
	}
	if (IMPLEMENTATION_ROOT_FILES.has(normalized)) {
		return true;
	}
	for (const prefix of IMPLEMENTATION_ROOT_PREFIXES) {
		if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/**
 * True when a contract path pattern targets only stub delivery artifacts.
 *
 * @param {string} pattern
 * @param {string} [tasksRoot]
 */
export function isDeliveryArtifactPath(pattern, tasksRoot = DEFAULT_TASKS_ROOT) {
	const normalized = normalizePattern(pattern);
	if (!normalized) {
		return false;
	}
	if (isImplementationScopePattern(normalized)) {
		return false;
	}

	const root = escapeRegex(tasksRoot);

	if (new RegExp(`^${root}/\\*/STATUS\\.md$`).test(normalized)) {
		return true;
	}
	if (new RegExp(`^${root}/[^/]+/STATUS\\.md$`).test(normalized)) {
		return true;
	}
	if (new RegExp(`^${root}/\\*/\\.DONE$`).test(normalized)) {
		return true;
	}
	if (new RegExp(`^${root}/[^/]+/\\.DONE$`).test(normalized)) {
		return true;
	}
	if (normalized === ".DONE") {
		return true;
	}
	if (new RegExp(`^${root}/[^/]+/\\*\\*$`).test(normalized)) {
		return true;
	}
	if (new RegExp(`^${root}/[^/]+/.+`).test(normalized) && !normalized.includes("..")) {
		return true;
	}

	return false;
}

/**
 * True when every fileScopeMustChange pattern is stub delivery-only.
 *
 * @param {string[]} patterns
 * @param {string} [tasksRoot]
 */
export function isStubDeliveryOnlyScope(patterns, tasksRoot = DEFAULT_TASKS_ROOT) {
	if (!Array.isArray(patterns) || patterns.length === 0) {
		return false;
	}
	return patterns.every((pattern) => isDeliveryArtifactPath(pattern, tasksRoot));
}
