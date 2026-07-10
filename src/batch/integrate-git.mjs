// @ts-nocheck
/**
 * Git helpers for orch→base integrate recovery (FR-SHIP-02 / #116).
 */

import { gitExec } from "./git-exec.mjs";

/**
 * Best-effort checkout restore after integrate failure.
 * Leaves the operator on the current branch when checkout fails (dirty tree / lock).
 *
 * @param {string} projectRoot
 * @param {string} branch Target branch (typically previous HEAD or baseBranch)
 */
export function tryRestoreBranch(projectRoot, branch) {
	try {
		gitExec(projectRoot, ["checkout", branch], { projectRoot });
	} catch {
		// Leave operator on current branch for manual recovery.
	}
}
