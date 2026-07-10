// @ts-nocheck
/**
 * runStepReview + assertReviewToolAvailable (SP-606 salvage / #192 — review-step LOC).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { loadSpineBatchState } from "./state.mjs";
import { buildReviewerContext } from "../config/reviewer-context.mjs";
import { resolveReviewScopePaths } from "./review-scope.mjs";
import {
	ARTIFACT_READY_HONOR_REASON,
	NESTED_REVIEW_SPAWN_BLOCKED,
	NESTED_REVIEW_SPAWN_REASON,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	shouldBlockNestedReviewerSpawn,
	spawnReviewerPi,
} from "./review-spawn.mjs";
import {
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	normalizeVerdict,
	parseReviewVerdict,
} from "./review-shared.mjs";
import { readReviewLevel } from "./review-artifacts.mjs";
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

	const spawnResult = await spawnReviewerPi({
		worktreePath,
		taskFolder,
		reviewPrompt,
		systemPrompt,
		config,
		artifactPath,
		reviewType,
		contractVerifyResult,
	});

	if (spawnResult.honored && spawnResult.honorReason === ARTIFACT_READY_HONOR_REASON) {
		return completeReviewFromHonoredArtifact({
			artifactPath: spawnResult.artifactPath ?? artifactPath,
			reviewType,
			journal,
			stepNumber,
			reviewLevel,
		});
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

		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error: spawnResult.error,
			spawnFailed: true,
			exitCode: spawnResult.exitCode,
			...(spawnResult.reason ? { reason: spawnResult.reason } : {}),
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
		};
	}

	if (!fs.existsSync(artifactPath)) {
		const error = "reviewer exited but produced no artifact";
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

