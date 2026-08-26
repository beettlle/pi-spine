// @ts-nocheck
/**
 * Engine lane code review phase (SP-729 / #262).
 */

import { recordLaneTaskMetric } from "./queue.mjs";
import { REVIEW_DEFAULTS } from "../../config/defaults.mjs";
import { appendJournalEvent, readJournalEvents } from "../journal.mjs";
import {
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../state.mjs";
import {
	buildReviewArtifactPath,
	shouldRunCodeReview,
} from "../review-shared.mjs";
import {
	findCodeReviewStepNumber,
	findCompletedCodeReview,
	readReviewLevel,
	runStepReview,
} from "../review.mjs";
import { honorCompletedReview, runReviewPollLoop } from "./review-poll.mjs";
import {
	createPhaseStubVerdictQueue,
	shouldUseReviewStub,
	writeStubReviewArtifact,
} from "./review-stub.mjs";

/**
 * @param {object} params
 */
export async function runEngineCodeReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	journal,
	stubVerdicts = null,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!shouldRunCodeReview({ reviewLevel })) {
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

	const stepNumber = findCodeReviewStepNumber(taskFolder);
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);
	const useStub = shouldUseReviewStub();

	if (useStub) {
		const queue = stubVerdicts ?? createPhaseStubVerdictQueue("code");
		const verdict = queue.next();
		const feedback =
			verdict === "REVISE" ? "Stub reviewer requested changes." : "Stub reviewer approved.";
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.started", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "code",
				reviewLevel,
				artifactPath,
			});
		}
		writeStubReviewArtifact({ artifactPath, title: "Code Review", verdict, feedback });
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.completed", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "code",
				reviewLevel,
				verdict,
				artifactPath,
				stub: true,
			});
		}
		return {
			ok: verdict === "APPROVE",
			skipped: false,
			reviewLevel,
			verdict,
			feedback,
			artifactPath,
			spawnFailed: false,
			exitCode: verdict === "APPROVE" ? 0 : 2,
			attempt,
		};
	}

	return await runStepReview({
		taskFolder,
		worktreePath,
		stepNumber,
		reviewType: "code",
		config,
		journal,
	});
}

/**
 * @param {object} params
 */
function recordCodeReviewTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	exitReason,
	verdict,
	codeReviewAttempt,
	config,
	taskFolder,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = exitReason;
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: exitReason,
		exitCode: 1,
		codeVerdict: verdict ?? null,
		codeReviewAttempt,
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
	});
}

/**
 * @param {object} params
 */
export async function runCodeReviewPhase({
	projectRoot,
	state,
	batchId,
	config,
	task,
	lane,
	taskFolderInWorktree,
	wt,
	taskBranch,
	laneCorrelationId,
	fileScopePaths,
}) {
	const reviewLevel = readReviewLevel(taskFolderInWorktree);
	if (!shouldRunCodeReview({ reviewLevel })) {
		return { ok: true, skipped: true };
	}

	const maxCodeReviewAttempts =
		config?.review?.maxCodeReviewAttempts ??
		config?.review?.maxFinalAttempts ??
		REVIEW_DEFAULTS.maxFinalAttempts;

	const journalEvents = readJournalEvents(projectRoot, batchId);
	const honoredResult = honorCompletedReview({
		reviewType: "code",
		passVerdict: "APPROVE",
		attemptField: "codeReviewAttempts",
		attemptKey: "codeReviewAttempt",
		findCompletedReview: findCompletedCodeReview,
		projectRoot,
		state,
		batchId,
		task,
		lane,
		laneCorrelationId,
		taskFolder: taskFolderInWorktree,
		journalEvents,
	});
	if (honoredResult) return honoredResult;

	const stubVerdicts = shouldUseReviewStub() ? createPhaseStubVerdictQueue("code") : null;

	return await runReviewPollLoop({
		reviewType: "code",
		passVerdict: "APPROVE",
		attemptField: "codeReviewAttempts",
		attemptKey: "codeReviewAttempt",
		maxAttempts: maxCodeReviewAttempts,
		runEngineReview: (params) => runEngineCodeReview({ ...params, stubVerdicts }),
		recordReviewTaskFailure: recordCodeReviewTaskFailure,
		invalidVerdictOutput: "code review artifact missing APPROVE or REVISE verdict",
		journalEvents,
		projectRoot,
		state,
		batchId,
		config,
		task,
		lane,
		taskFolderInWorktree,
		wt,
		taskBranch,
		laneCorrelationId,
		fileScopePaths,
	});
}
