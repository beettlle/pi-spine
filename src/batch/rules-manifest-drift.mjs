/**
 * Rules-manifest drift resolution for integrate prep (SP-317 / #22).
 */

import { gitExec } from "./git-exec.mjs";
import {
	fingerprintRulesManifest,
	loadRulesManifest,
	parseRulesManifestJson,
	resolveRulesManifestGeneratedAtMerge,
	RULES_MANIFEST_REL_PATH,
} from "../config/cursor-rules/discover.mjs";
import { gitPorcelain } from "./lane-commit.mjs";

/**
 * @param {string} line
 * @returns {string | null}
 */
function extractPorcelainPath(line) {
	if (!line.trim()) return null;
	let filePath = line.length > 2 && line[2] === " " ? line.slice(3) : line.slice(2);
	filePath = filePath.trim();
	if (!filePath) return null;
	if (filePath.includes(" -> ")) {
		return filePath.split(" -> ").pop()?.trim() ?? null;
	}
	return filePath;
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
export function listIntegrateDirtyPaths(projectRoot) {
	const output = gitPorcelain(projectRoot);
	if (!output) return [];
	return output
		.split("\n")
		.map((line) => extractPorcelainPath(line))
		.filter((entry) => Boolean(entry));
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function readRulesManifestFromRef(projectRoot, ref) {
	const output = gitExec(
		projectRoot,
		["show", `${ref}:${RULES_MANIFEST_REL_PATH}`],
		{ throwOnError: false, projectRoot },
	);
	if (output == null) {
		return { ok: false, error: `missing ${RULES_MANIFEST_REL_PATH} at ${ref}` };
	}
	return parseRulesManifestJson(output);
}

/**
 * @param {string} projectRoot
 */
function restoreRulesManifestFromHead(projectRoot) {
	gitExec(
		projectRoot,
		["restore", "--source=HEAD", "--staged", "--worktree", RULES_MANIFEST_REL_PATH],
		{ projectRoot },
	);
}

/**
 * Before orch→main integrate, resolve manifest-only drift on the base worktree.
 * Restores HEAD when drift is generatedAt-only or when uncommitted manifest matches orch
 * (worker-generated entries on main that orch merge will land).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 */
export function resolveRulesManifestIntegrateDrift({ projectRoot, baseBranch, orchBranch }) {
	const dirtyPaths = listIntegrateDirtyPaths(projectRoot);
	if (dirtyPaths.length === 0) {
		return { ok: true, resolved: false };
	}

	if (dirtyPaths.length !== 1 || dirtyPaths[0] !== RULES_MANIFEST_REL_PATH) {
		const preview = dirtyPaths.slice(0, 5).join(", ");
		const suffix = dirtyPaths.length > 5 ? ` (+${dirtyPaths.length - 5} more)` : "";
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error:
				`integrate refused — working tree has uncommitted changes (${preview}${suffix}); ` +
				"commit or stash before integrate",
			dirtyPaths,
		};
	}

	const working = loadRulesManifest(projectRoot);
	if (!working) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: `${RULES_MANIFEST_REL_PATH} is dirty but unreadable`,
		};
	}

	const headResult = readRulesManifestFromRef(projectRoot, baseBranch);
	const orchResult = readRulesManifestFromRef(projectRoot, orchBranch);
	if (!headResult.ok || !orchResult.ok) {
		return {
			ok: false,
			failureClass: "DirtyWorktree",
			error: "unable to read rules-manifest from base or orch branch",
		};
	}

	const workingFingerprint = fingerprintRulesManifest(working);
	const headFingerprint = fingerprintRulesManifest(headResult.manifest);
	const orchFingerprint = fingerprintRulesManifest(orchResult.manifest);

	if (workingFingerprint !== headFingerprint) {
		if (workingFingerprint !== orchFingerprint) {
			return {
				ok: false,
				failureClass: "DirtyWorktree",
				error:
					`${RULES_MANIFEST_REL_PATH} has uncommitted content changes beyond generatedAt — ` +
					"commit or stash before integrate",
			};
		}

		restoreRulesManifestFromHead(projectRoot);
		return {
			ok: true,
			resolved: true,
			action: "restored_head_worker_manifest_drift",
		};
	}

	if (headFingerprint !== orchFingerprint) {
		const contentMerge = resolveRulesManifestGeneratedAtMerge({
			ours: headResult.manifest,
			theirs: orchResult.manifest,
		});
		if (!contentMerge.ok) {
			return contentMerge;
		}
	}

	restoreRulesManifestFromHead(projectRoot);
	return {
		ok: true,
		resolved: true,
		action: "restored_head_for_merge",
	};
}
