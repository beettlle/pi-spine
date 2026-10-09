// @ts-nocheck
/**
 * runStepReview + assertReviewToolAvailable (SP-606 salvage / #192 — review-step LOC).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJournalEvents } from "./journal.mjs";
import {
	ARTIFACT_READY_HONOR_REASON,
	NESTED_REVIEW_SPAWN_REASON,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
	shouldBlockNestedReviewerSpawn,
	spawnReviewerPi,
} from "./review-spawn.mjs";
import { buildReviewerOutputTail, persistReviewerOutputLog } from "./reviewer-output.mjs";
import {
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	normalizeVerdict,
	parseReviewVerdict,
} from "./review-shared.mjs";
import {
	findCompletedFinalReview,
	readReviewLevel,
} from "./review-artifacts.mjs";
import {
	buildReviewRequest,
	buildReviewerSystemPrompt,
	commandExists,
	completeNestedReviewSpawnSkipped,
	completeReviewFromHonoredArtifact,
	findStepName,
	honorReviewSpawnFailureWhenEligible,
	journalReviewEvent,
	writeStubReviewArtifact,
} from "./review-step.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

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
 * @param {object} params.spawnResult
 * @param {string} params.artifactPath
 */
function isReviewSpawnRetryEligible({ spawnResult, artifactPath }) {
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
 * @returns {{ logPath: string, logRef: string }|null}
 */
function persistReviewerLogForAttempt({
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
 * @param {object} spawnResult
 * @param {object} config
 */
function buildSpawnFailureDiagnostics(spawnResult, config) {
	const outputTail = buildReviewerOutputTail(spawnResult, config);
	return {
		...(typeof spawnResult?.durationMs === "number" ? { durationMs: spawnResult.durationMs } : {}),
		...(outputTail ? { outputTail } : {}),
	};
}

/**
 * @param {object} params
 */
export async function runStepReview({
	taskFolder,
	worktreePath,
	stepNumber,
	reviewType = "plan",
	baseline,
	config = {},
	journal,
	stub,
	stubVerdict = "APPROVE",
	stubFail = false,
	projectName,
	contractVerifyResult = null,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!isReviewTypeRequired(reviewLevel, reviewType)) {
		return {
			ok: true,
			skipped: true,
			reviewLevel,
			verdict: null,
			feedback: "",
			artifactPath: "",
			spawnFailed: false,
			exitCode: 0,
		};
	}

	if (reviewType === "final" && journal?.projectRoot && journal?.batchId) {
		const honored = findCompletedFinalReview({
			taskFolder,
			journalEvents: readJournalEvents(journal.projectRoot, journal.batchId),
			taskId: journal.taskId,
		});
		if (honored?.verdict === "PASS") {
			return {
				ok: true,
				skipped: true,
				honored: true,
				honorSource: honored.source,
				reviewLevel,
				verdict: "PASS",
				feedback: honored.feedback,
				artifactPath: honored.artifactPath,
				spawnFailed: false,
				exitCode: 0,
			};
		}
	}

	const stepName = findStepName(taskFolder, stepNumber);
	const artifactPath =
		reviewType === "final"
			? buildFinalReviewArtifactPath(taskFolder)
			: buildReviewArtifactPath(taskFolder, stepNumber);
	const reviewPrompt = buildReviewRequest({
		reviewType,
		stepNumber,
		stepName,
		taskFolder,
		worktreePath,
		outputPath: artifactPath,
		baseline,
		projectName,
		contractVerifyResult,
	});

	journalReviewEvent("review.started", journal, {
		stepNumber,
		reviewType,
		reviewLevel,
		artifactPath,
	});

	const useStub =
		stub === true ||
		stubFail === true ||
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true";

	const stubFailRequested =
		stubFail === true ||
		(useStub &&
			(process.env.SPINE_REVIEW_STUB === "1" ||
				process.env.SPINE_REVIEW_STUB === "true") &&
			(process.env.SPINE_REVIEW_STUB_FAIL === "1" ||
				process.env.SPINE_REVIEW_STUB_FAIL === "true"));

	if (useStub) {
		if (stubFailRequested) {
			const error = "review spawn failed (stub)";
			journalReviewEvent("review.failed", journal, {
				stepNumber,
				reviewType,
				reviewLevel,
				error,
				spawnFailed: true,
			});
			return {
				ok: false,
				skipped: false,
				reviewLevel,
				verdict: null,
				feedback: "",
				artifactPath,
				spawnFailed: true,
				error,
				exitCode: 1,
			};
		}

		const defaultVerdict = reviewType === "final" ? "PASS" : "APPROVE";
		const verdict = normalizeVerdict(stubVerdict, reviewType) ?? defaultVerdict;
		const feedback =
			verdict === "REVISE"
				? "Stub reviewer requested changes."
				: verdict === "REPLAN"
					? "Stub reviewer requested replan."
					: reviewType === "final"
						? "Stub reviewer passed final verdict."
						: "Stub reviewer approved.";
		writeStubReviewArtifact({
			artifactPath,
			reviewType,
			stepNumber,
			stepName,
			verdict,
			feedback,
		});

		const ok = reviewType === "final" ? verdict === "PASS" : verdict === "APPROVE";
		journalReviewEvent("review.completed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			verdict,
			artifactPath,
			stub: true,
		});

		return {
			ok,
			skipped: false,
			reviewLevel,
			verdict,
			feedback,
			artifactPath,
			spawnFailed: false,
			exitCode: ok ? 0 : 2,
		};
	}

	const systemPrompt = buildReviewerSystemPrompt({
		worktreePath,
		taskFolder,
		reviewType,
		baseline,
		config,
		journal,
	});

	if (shouldBlockNestedReviewerSpawn()) {
		return completeNestedReviewSpawnSkipped({
			stepNumber,
			reviewType,
			reviewLevel,
			journal,
			artifactPath,
		});
	}

	const spawnParams = {
		worktreePath,
		taskFolder,
		reviewPrompt,
		systemPrompt,
		config,
		artifactPath,
		reviewType,
		contractVerifyResult,
	};
	let spawnResult = await spawnReviewerPi(spawnParams);

	/** @returns {ReturnType<typeof runStepReview>|null} */
	const completeIfHonored = () =>
		spawnResult.honored && spawnResult.honorReason === ARTIFACT_READY_HONOR_REASON
			? completeReviewFromHonoredArtifact({
					artifactPath: spawnResult.artifactPath ?? artifactPath,
					reviewType,
					journal,
					stepNumber,
					reviewLevel,
				})
			: null;

	const honoredFirstAttempt = completeIfHonored();
	if (honoredFirstAttempt) return honoredFirstAttempt;

	// One bounded re-spawn for transient no-artifact exits and non-timeout
	// spawn failures (SP-814 / #332): journal the retry with diagnostics, then
	// spawn again with the same prompt and artifact path.
	let attempt = 1;
	while (
		attempt < REVIEW_SPAWN_MAX_ATTEMPTS &&
		isReviewSpawnRetryEligible({ spawnResult, artifactPath })
	) {
		const failedAttempt = attempt;
		const log = persistReviewerLogForAttempt({
			journal,
			taskFolder,
			stepNumber,
			reviewType,
			attempt: failedAttempt,
			spawnResult,
			config,
		});
		journalReviewEvent("review.spawn_retry", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			attempt: failedAttempt + 1,
			reason: spawnResult.spawnFailed
				? (spawnResult.reason ?? REVIEW_SPAWN_RETRY_REASON_SPAWN_FAILED)
				: REVIEW_SPAWN_RETRY_REASON_NO_ARTIFACT,
			exitCode: spawnResult.exitCode ?? 0,
			durationMs: spawnResult.durationMs ?? null,
			...(log?.logRef ? { reviewerOutputLogRef: log.logRef } : {}),
		});
		spawnResult = await spawnReviewerPi(spawnParams);
		attempt += 1;
		const honoredRetry = completeIfHonored();
		if (honoredRetry) return honoredRetry;
	}

	if (spawnResult.spawnFailed) {
		if (spawnResult.reason === NESTED_REVIEW_SPAWN_REASON) {
			return completeNestedReviewSpawnSkipped({
				stepNumber,
				reviewType,
				reviewLevel,
				journal,
				artifactPath,
				feedback: spawnResult.error,
			});
		}

		const honored = honorReviewSpawnFailureWhenEligible({
			spawnResult,
			reviewType,
			taskFolder,
			contractVerifyResult,
			journal,
			stepNumber,
			reviewLevel,
		});
		if (honored) {
			return honored;
		}

		const log = persistReviewerLogForAttempt({
			journal,
			taskFolder,
			stepNumber,
			reviewType,
			attempt,
			spawnResult,
			config,
		});
		const diagnostics = {
			...buildSpawnFailureDiagnostics(spawnResult, config),
			...(log?.logRef ? { reviewerOutputLogRef: log.logRef } : {}),
		};
		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error: spawnResult.error,
			spawnFailed: true,
			exitCode: spawnResult.exitCode,
			...(spawnResult.reason ? { reason: spawnResult.reason } : {}),
			...diagnostics,
		});
		return {
			ok: false,
			skipped: false,
			reviewLevel,
			verdict: null,
			feedback: "",
			artifactPath,
			spawnFailed: true,
			error: spawnResult.error,
			exitCode: spawnResult.exitCode ?? 1,
			reason: spawnResult.reason,
			...diagnostics,
		};
	}

	if (!fs.existsSync(artifactPath)) {
		const error = "reviewer exited but produced no artifact";
		const log = persistReviewerLogForAttempt({
			journal,
			taskFolder,
			stepNumber,
			reviewType,
			attempt,
			spawnResult,
			config,
		});
		const diagnostics = {
			...buildSpawnFailureDiagnostics(spawnResult, config),
			...(log?.logRef ? { reviewerOutputLogRef: log.logRef } : {}),
		};
		// The payload carries the reviewer's real exit code (typically 0) while
		// the returned result keeps a non-zero exit code: the CLI and worker
		// tools treat result exit 0 as success and must still fail closed.
		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error,
			spawnFailed: true,
			exitCode: spawnResult.exitCode ?? 0,
			...diagnostics,
		});
		return {
			ok: false,
			skipped: false,
			reviewLevel,
			verdict: null,
			feedback: "",
			artifactPath,
			spawnFailed: true,
			error,
			exitCode: 1,
			...diagnostics,
		};
	}

	const reviewContent = fs.readFileSync(artifactPath, "utf-8");
	const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType });
	if (!verdict) {
		const error = "review artifact missing structured verdict";
		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error,
			artifactPath,
		});
		return {
			ok: false,
			skipped: false,
			reviewLevel,
			verdict: null,
			feedback,
			artifactPath,
			spawnFailed: false,
			error,
			exitCode: 1,
		};
	}

	const ok = reviewType === "final" ? verdict === "PASS" : verdict === "APPROVE";
	journalReviewEvent("review.completed", journal, {
		stepNumber,
		reviewType,
		reviewLevel,
		verdict,
		artifactPath,
		feedback,
	});

	return {
		ok,
		skipped: false,
		reviewLevel,
		verdict,
		feedback,
		artifactPath,
		spawnFailed: false,
		exitCode: ok ? 0 : 2,
	};
}

/**
 * @param {object} params
 */
export function assertReviewToolAvailable({ taskFolder }) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (reviewLevel <= 0) {
		return { ok: true, reviewLevel };
	}

	const reviewScript = path.join(PACKAGE_ROOT, "bin", "spine-review-step.mjs");
	if (!fs.existsSync(reviewScript)) {
		return {
			ok: false,
			reviewLevel,
			error: `Review level ${reviewLevel} requires spine-review-step but ${reviewScript} is missing`,
		};
	}

	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" || process.env.SPINE_REVIEW_STUB === "true";
	if (!useStub && !commandExists("pi")) {
		return {
			ok: false,
			reviewLevel,
			error: `Review level ${reviewLevel} requires pi for reviewer spawn (fail closed, FR-REV-06)`,
		};
	}

	return { ok: true, reviewLevel };
}

