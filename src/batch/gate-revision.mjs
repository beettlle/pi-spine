// @ts-nocheck
/**
 * Gate targetRevision helpers — orch tip SHA pinning at gate open (FR-REL250-01 / SP-623).
 */

import { gitExec } from "./git-exec.mjs";

/**
 * Resolve durable `targetRevision` as the orch tip SHA at gate open.
 * Fail closed when orch branch is missing or unreadable.
 *
 * @param {string} projectRoot
 * @param {object|null|undefined} batchState
 * @returns {string} Full commit SHA
 */
export function resolveGateTargetRevision(projectRoot, batchState) {
	const orchBranch = String(batchState?.orchBranch ?? "").trim();
	if (!orchBranch) {
		throw new Error("Cannot resolve gate targetRevision: batchState.orchBranch is missing.");
	}

	const sha = gitExec(projectRoot, ["rev-parse", "--verify", `${orchBranch}^{commit}`], {
		throwOnError: false,
		projectRoot,
	});
	if (!sha) {
		throw new Error(
			`Cannot resolve gate targetRevision: failed to read tip of ${orchBranch}.`,
		);
	}
	return sha;
}
