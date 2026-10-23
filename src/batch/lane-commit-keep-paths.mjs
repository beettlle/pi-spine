/**
 * Lane-commit keep paths (SP-844 / #349): gitignored artifact roots that hold
 * active tool state — stet sessions, baseline refs — which the lane-commit
 * sanitizer must preserve across lane commits serialized on one worktree.
 */

/**
 * Normalize a keep path for root comparison: backslashes → slashes, no
 * leading "./", no trailing slash.
 *
 * @param {string} keepPath
 * @returns {string}
 */
export function normalizeKeepPath(keepPath) {
	let normalized = String(keepPath).trim().replace(/\\/g, "/");
	if (normalized.startsWith("./")) normalized = normalized.slice(2);
	while (normalized.endsWith("/")) {
		normalized = normalized.slice(0, -1);
	}
	return normalized;
}

/**
 * Whether a cleaned artifact root is covered by a keep path. `.review/` keeps
 * the artifact root `.review` and every root under it.
 *
 * @param {string} artifactRoot
 * @param {string[]} keepPaths
 * @returns {boolean}
 */
export function isKeptArtifactRoot(artifactRoot, keepPaths) {
	if (!artifactRoot || !Array.isArray(keepPaths) || keepPaths.length === 0) {
		return false;
	}
	const root = normalizeKeepPath(artifactRoot);
	if (root === "") return false;
	return keepPaths.some((keepPath) => {
		const kept = normalizeKeepPath(keepPath);
		return kept !== "" && (root === kept || root.startsWith(`${kept}/`));
	});
}

/**
 * Split artifact roots into roots the sanitizer may clean and roots that must
 * survive the lane commit.
 *
 * @param {string[]} artifactRoots
 * @param {string[]} [keepPaths]
 * @returns {{ cleanableRoots: string[], keptRoots: string[] }}
 */
export function partitionArtifactRootsByKeepPaths(artifactRoots, keepPaths = []) {
	const cleanableRoots = [];
	const keptRoots = [];
	for (const root of Array.isArray(artifactRoots) ? artifactRoots : []) {
		if (isKeptArtifactRoot(root, keepPaths)) {
			keptRoots.push(root);
		} else {
			cleanableRoots.push(root);
		}
	}
	return { cleanableRoots, keptRoots };
}

/**
 * Whether a gitignored path sits under a kept root — kept paths are
 * operator-blessed tool state, not cleanable artifacts, so the lane-commit
 * dirty gate must not count them (SP-844 / #349).
 *
 * @param {string} filePath
 * @param {string[]} keepPaths
 * @returns {boolean}
 */
export function isPathUnderKeptRoot(filePath, keepPaths) {
	return isKeptArtifactRoot(filePath, keepPaths);
}
