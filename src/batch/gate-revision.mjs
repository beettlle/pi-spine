// @ts-nocheck
/**
 * Gate targetRevision helpers — orch tip SHA pinning at gate open (FR-REL250-01 / SP-623).
 */

import { gitExec } from "./git-exec.mjs";

/**
 * Resolve durable `targetRevision` as the orch tip SHA at gate open.
 *
 * Prefer `batchState.orchBranch` tip via `git rev-parse`. When that tip is
 * missing or unreadable, fall back to project `HEAD` so the gate still pins a
 * durable SHA. Fail closed only when no revision can be resolved.
 *
 * @param {string} projectRoot
 * @param {object|null|undefined} batchState
 * @returns {string} Full commit SHA
 */
export function resolveGateTargetRevision(projectRoot, batchState) {
	const orchBranch = String(batchState?.orchBranch ?? "").trim();
	if (orchBranch) {
		const orchSha = gitExec(projectRoot, ["rev-parse", "--verify", `${orchBranch}^{commit}`], {
			throwOnError: false,
			projectRoot,
		});
		if (orchSha) {
			return orchSha;
		}
	}

	// Documented fallback: pin HEAD when orch tip is absent or unreadable.
	const headSha = gitExec(projectRoot, ["rev-parse", "--verify", "HEAD"], {
		throwOnError: false,
		projectRoot,
	});
	if (headSha) {
		return headSha;
	}

	if (!orchBranch) {
		throw new Error("Cannot resolve gate targetRevision: batchState.orchBranch is missing and HEAD is unreadable.");
	}
	throw new Error(
		`Cannot resolve gate targetRevision: failed to read tip of ${orchBranch} and HEAD.`,
	);
}
