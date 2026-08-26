// @ts-nocheck
/**
 * Engine lane final review phase (SP-729 / #262).
 */

import fs from "node:fs";
import path from "node:path";
import { recordLaneTaskMetric } from "./queue.mjs";
import { REVIEW_DEFAULTS } from "../../config/defaults.mjs";
import { parseContract } from "../../tasks/packet/parse-prompt.mjs";
import { resolveTaskStartCommit } from "../contract-task-start.mjs";
import { shouldRunContractVerifyForWorker, verifyContract } from "../contract-verify.mjs";
import { appendJournalEvent, readJournalEvents } from "../journal.mjs";
import {
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../state.mjs";
import {
	buildFinalReviewArtifactPath,
	shouldRunFinalReview,
} from "../review-shared.mjs";
import {
	findCompletedFinalReview,
	findFinalReviewStepNumber,
	readReviewLevel,
	runStepReview,
} from "../review.mjs";
import {
	honorCompletedReview,
	removeDoneFile,
	runReviewPollLoop,
} from "./review-poll.mjs";
import {
	createPhaseStubVerdictQueue,
	shouldUseReviewStub,
	writeStubReviewArtifact,
} from "./review-stub.mjs";

/**
 * @param {object} params
 */
export async function runEngineFinalReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	contractVerifyResult = null,
	journal,
	stubVerdicts = null,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!shouldRunFinalReview({ config, reviewLevel })) {
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

	const artifactPath = buildFinalReviewArtifactPath(taskFolder);
	const useStub = shouldUseReviewStub();

	if (useStub) {
		const queue = stubVerdicts ?? createPhaseStubVerdictQueue("final");
		const verdict = queue.next();
		const feedback =
			verdict === "REVISE"
				? "Stub reviewer requested changes."
				: verdict === "REPLAN"
					? "Stub reviewer requested replan."
					: "Stub reviewer passed.";
		writeStubReviewArtifact({ artifactPath, title: "Final Review", verdict, feedback });
		return {
			ok: verdict === "PASS",
			skipped: false,
			reviewLevel,
			verdict,
			feedback,
			artifactPath,
			spawnFailed: false,
			exitCode: verdict === "PASS" ? 0 : 2,
			attempt,
		};
	}

	const stepNumber = findFinalReviewStepNumber(taskFolder);
	return await runStepReview({
		taskFolder,
		worktreePath,
		stepNumber,
		reviewType: "final",
		config,
		journal,
		contractVerifyResult,
	});
}

/**
 * @param {object} params
 */
function recordContractVerifyTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	contractVerifyResult,
	config,
	taskFolder,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	task.status = "failed";
	task.endedAt = Date.now();
	task.exitReason = "contract_failed";
	task.contractOk = false;
	updateSegmentForTask(state, taskId, "failed");
	recomputeTaskCounters(state);
	saveSpineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "contract.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		checks: contractVerifyResult?.checks ?? [],
	});
	appendJournalEvent(projectRoot, batchId, "task.failed", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		classification: "contract_failed",
		exitCode: 1,
		contractOk: false,
		failureKind: "contract",
	});
	recordLaneTaskMetric({
		projectRoot,
		batchId,
		task,
		config,
		taskFolder,
		lane,
	});
}

/**
 * @param {object} params
 */
function recordFinalReviewTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	exitReason,
	verdict,
	finalAttempt,
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
		finalVerdict: verdict ?? null,
		finalAttempt,
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
export async function runFinalReviewPhase({
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
	baseBranch = "main",
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const reviewLevel = readReviewLevel(taskFolderInWorktree);
	if (!shouldRunFinalReview({ config, reviewLevel })) {
		return { ok: true, skipped: true };
	}

	const maxFinalAttempts = config?.review?.maxFinalAttempts ?? REVIEW_DEFAULTS.maxFinalAttempts;

	// Materialize the stub queue once per phase and pass it via params so
	// parallel lanes never share or mutate process.env stub state (SP-728).
	const stubVerdicts = shouldUseReviewStub() ? createPhaseStubVerdictQueue("final") : null;

	const journalEvents = readJournalEvents(projectRoot, batchId);
	const honoredResult = honorCompletedReview({
		reviewType: "final",
		passVerdict: "PASS",
		attemptField: "finalAttempts",
		attemptKey: "finalAttempt",
		findCompletedReview: findCompletedFinalReview,
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

	return await runReviewPollLoop({
		reviewType: "final",
		passVerdict: "PASS",
		attemptField: "finalAttempts",
		attemptKey: "finalAttempt",
		maxAttempts: maxFinalAttempts,
		runEngineReview: (params) => runEngineFinalReview({ ...params, stubVerdicts }),
		recordReviewTaskFailure: recordFinalReviewTaskFailure,
		invalidVerdictOutput: "final review artifact missing PASS, REVISE, or REPLAN verdict",
		allowReplan: true,
		beforeReview: async () => {
			let contractVerifyResult = null;
			const promptMarkdown = fs.readFileSync(path.join(taskFolderInWorktree, "PROMPT.md"), "utf-8");
			const parsedContract = parseContract(promptMarkdown);
			if (shouldRunContractVerifyForWorker(promptMarkdown, parsedContract, config)) {
				const events = readJournalEvents(projectRoot, batchId);
				const sinceCommit = resolveTaskStartCommit({
					journal: events,
					taskId,
					laneId: lane.laneId,
					batchId,
					worktreePath: wt,
				});
				contractVerifyResult = verifyContract(wt, parsedContract, {
					...config,
					baseBranch,
					sinceCommit: sinceCommit ?? undefined,
					projectRoot,
					batchId,
					taskId,
					taskFolder: taskFolderInWorktree,
				});
				task.contractOk = contractVerifyResult.ok;
				saveSpineBatchState(projectRoot, state);
				appendJournalEvent(projectRoot, batchId, "contract.verified", {
					taskId,
					laneNumber,
					laneId: lane.laneId,
					correlationId: laneCorrelationId,
					ok: contractVerifyResult.ok,
					checks: contractVerifyResult.checks,
				});
				if (!contractVerifyResult.ok) {
					removeDoneFile(taskFolderInWorktree);
					recordContractVerifyTaskFailure({
						projectRoot,
						state,
						batchId,
						task,
						lane,
						laneCorrelationId,
						contractVerifyResult,
						config,
						taskFolder: taskFolderInWorktree,
					});
					return { abort: { ok: false, exitReason: "contract_failed", verdict: "CONTRACT_FAIL" } };
				}
			}
			return { extraReviewParams: { contractVerifyResult } };
		},
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
