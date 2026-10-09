// @ts-nocheck
/**
 * Reviewer output log persistence (SP-814 / #332).
 *
 * Every failed reviewer attempt leaves a bounded, redacted log next to the
 * worker output logs under `.spine/runtime/<batchId>/lanes/lane-<n>/`. The
 * helpers reuse the worker output conventions from `worker-output.mjs`
 * (redaction, tail caps, atomic writes) without modifying that module, which
 * sits at its line-count policy cap.
 */

import fs from "node:fs";
import path from "node:path";
import { writeTextAtomic } from "../fs/atomic-write.mjs";
import {
	captureWorkerOutputTail,
	redactWorkerOutput,
	resolveWorkerOutputConfig,
} from "./worker-output.mjs";

/** Diagnostic output tail budget for `review.failed` payloads (SP-814 / #332). */
export const REVIEWER_FAILURE_OUTPUT_TAIL_MAX_BYTES = 2048;

/**
 * Absolute path of the reviewer output log for one (task, reviewType) pair.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 * @param {string} reviewType
 */
export function reviewerOutputLogPath(projectRoot, batchId, laneNumber, taskId, reviewType) {
	return path.join(
		projectRoot,
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`reviewer-output-${taskId}-${reviewType}.log`,
	);
}

/**
 * Root-relative journal/log reference for the reviewer output log.
 *
 * @param {string} batchId
 * @param {number} laneNumber
 * @param {string} taskId
 * @param {string} reviewType
 */
export function reviewerOutputLogRef(batchId, laneNumber, taskId, reviewType) {
	return path.join(
		".spine",
		"runtime",
		batchId,
		"lanes",
		`lane-${laneNumber}`,
		`reviewer-output-${taskId}-${reviewType}.log`,
	);
}

/**
 * Combined stderr + stdout diagnostic tail (redacted, ≤ 2 KB) for failure
 * payloads. Stderr leads because reviewer diagnostics conventionally land
 * there; stdout follows so silent reviewer exits stay explainable.
 *
 * @param {object} spawnResult Result from `spawnReviewerPi`.
 * @param {object} [config]
 */
export function buildReviewerOutputTail(spawnResult, config = {}) {
	const outputConfig = resolveWorkerOutputConfig(config);
	const stderrTail = redactWorkerOutput(spawnResult?.stderrTail ?? "", outputConfig).trim();
	const stdoutTail = redactWorkerOutput(spawnResult?.stdoutTail ?? "", outputConfig).trim();

	const parts = [];
	if (stderrTail) parts.push(`--- stderr ---\n${stderrTail}`);
	if (stdoutTail) parts.push(`--- stdout ---\n${stdoutTail}`);
	const joined = parts.join("\n");
	if (!joined) return "";

	const tailConfig = { ...outputConfig, maxBytes: REVIEWER_FAILURE_OUTPUT_TAIL_MAX_BYTES };
	return captureWorkerOutputTail(joined, tailConfig);
}

/**
 * Append one redacted, tail-capped attempt section to the reviewer log for a
 * (task, reviewType) pair. One file per pair: attempts append so a re-spawn
 * never erases the previous attempt's diagnostics.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {number} params.laneNumber
 * @param {string} params.taskId
 * @param {string} params.reviewType
 * @param {number|null} [params.stepNumber]
 * @param {number} [params.attempt]
 * @param {object} [params.spawnResult] Result from `spawnReviewerPi`.
 * @param {object} [params.config]
 * @returns {{ logPath: string, logRef: string }|null}
 */
export function persistReviewerOutputLog({
	projectRoot,
	batchId,
	laneNumber,
	taskId,
	reviewType,
	stepNumber = null,
	attempt = 1,
	spawnResult = {},
	config = {},
}) {
	const outputConfig = resolveWorkerOutputConfig(config);
	const stderrTail = captureWorkerOutputTail(
		redactWorkerOutput(spawnResult.stderrTail ?? "", outputConfig),
		outputConfig,
	);
	const stdoutTail = captureWorkerOutputTail(
		redactWorkerOutput(spawnResult.stdoutTail ?? "", outputConfig),
		outputConfig,
	);

	const header = [
		`# reviewer attempt ${attempt} — ${new Date().toISOString()}`,
		`taskId=${taskId} reviewType=${reviewType} step=${stepNumber ?? "?"}`,
		`spawnFailed=${spawnResult.spawnFailed === true} exitCode=${
			spawnResult.exitCode ?? "null"
		} durationMs=${spawnResult.durationMs ?? "null"}`,
	].join("\n");
	const section = [
		header,
		"--- stderr ---",
		stderrTail.trim() || "(empty)",
		"--- stdout ---",
		stdoutTail.trim() || "(empty)",
	].join("\n");

	const logPath = reviewerOutputLogPath(projectRoot, batchId, laneNumber, taskId, reviewType);
	let previous = "";
	if (fs.existsSync(logPath)) {
		previous = fs.readFileSync(logPath, "utf-8").trim();
	}
	const content = previous ? `${previous}\n\n${section}\n` : `${section}\n`;
	writeTextAtomic(logPath, content);

	return {
		logPath,
		logRef: reviewerOutputLogRef(batchId, laneNumber, taskId, reviewType),
	};
}
