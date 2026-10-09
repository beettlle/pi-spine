/**
 * Reviewer re-spawn policy and failure diagnostics for runStepReview (SP-814 / #332).
 */

import fs from "node:fs";
import path from "node:path";
import {
	NESTED_REVIEW_SPAWN_REASON,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
} from "./review-spawn.mjs";
import { buildReviewerOutputTail, persistReviewerOutputLog } from "./reviewer-output.mjs";

/**
 * @typedef {import("./reviewer-output.mjs").ReviewerSpawnResult & {
 *   honored?: boolean,
 *   reason?: string,
 * }} ReviewSpawnAttemptResult
 */

/** Bounded automatic re-spawn budget for reviewer children (SP-814 / #332). */
export const REVIEW_SPAWN_MAX_ATTEMPTS = 2;

/** `review.spawn_retry` reason when the reviewer exited 0 without an artifact. */
export const REVIEW_SPAWN_RETRY_REASON_NO_ARTIFACT = "no_artifact";

/** `review.spawn_retry` reason fallback for a non-timeout spawn failure. */
export const REVIEW_SPAWN_RETRY_REASON_SPAWN_FAILED = "spawn_failed";

/**
 * A reviewer attempt may be re-spawned once when it exited 0 without writing
 * the artifact, or failed for a reason other than a timeout (exit 124 /
 * `review_timeout`) or the nested-spawn guard — those keep their dedicated
 * honor/skip paths so engine classification is unchanged (SP-814 / #332).
 *
 * @param {object} params
 * @param {ReviewSpawnAttemptResult|null|undefined} params.spawnResult
 * @param {string} params.artifactPath
 * @returns {boolean}
 */
export function isReviewSpawnRetryEligible({ spawnResult, artifactPath }) {
	if (!spawnResult || spawnResult.honored) return false;
	if (spawnResult.reason === NESTED_REVIEW_SPAWN_REASON) return false;
	if (spawnResult.reason === REVIEW_TIMEOUT_REASON) return false;
	if (spawnResult.exitCode === REVIEW_SPAWN_TIMEOUT_EXIT_CODE) return false;
	if (spawnResult.spawnFailed) return true;
	return !fs.existsSync(artifactPath);
}

/**
 * Persist the reviewer log for a failed attempt when the journal context is
 * available. Log persistence must never fail the review path itself, so a
 * write error degrades to `null` (the journal event still carries outputTail).
 *
 * @param {object} params
 * @param {{ projectRoot?: string, batchId?: string, laneNumber?: number, taskId?: string }|null|undefined} params.journal
 * @param {string} params.taskFolder
 * @param {number} params.stepNumber
 * @param {string} params.reviewType
 * @param {number} params.attempt
 * @param {ReviewSpawnAttemptResult} params.spawnResult
 * @param {object} [params.config]
 * @returns {{ logPath: string, logRef: string }|null}
 */
export function persistReviewerLogForAttempt({
	journal,
	taskFolder,
	stepNumber,
	reviewType,
	attempt,
	spawnResult,
	config,
}) {
	if (!journal?.projectRoot || !journal?.batchId) return null;
	try {
		return persistReviewerOutputLog({
			projectRoot: journal.projectRoot,
			batchId: journal.batchId,
			laneNumber: journal.laneNumber ?? 1,
			taskId: journal.taskId ?? path.basename(taskFolder),
			reviewType,
			stepNumber,
			attempt,
			spawnResult,
			config,
		});
	} catch {
		return null;
	}
}

/**
 * Diagnostics shared by the `review.failed` payload and the returned result:
 * reviewer duration plus a redacted combined output tail (≤ 2 KB).
 *
 * @param {ReviewSpawnAttemptResult} spawnResult
 * @param {object} [config]
 * @returns {{ durationMs?: number, outputTail?: string }}
 */
export function buildSpawnFailureDiagnostics(spawnResult, config) {
	const outputTail = buildReviewerOutputTail(spawnResult, config);
	return {
		...(typeof spawnResult?.durationMs === "number" ? { durationMs: spawnResult.durationMs } : {}),
		...(outputTail ? { outputTail } : {}),
	};
}
