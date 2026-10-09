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
 * @param {string} params.taskFolder
 * @param {string} params.worktreePath
 * @param {Record<string, any>} [params.config]
 * @param {number} [params.attempt]
 * @param {any} [params.contractVerifyResult]
 * @param {Record<string, any>} [params.journal]
 * @param {{ next: () => string } | null} [params.stubVerdicts]
 * @returns {Promise<{ ok: boolean, [key: string]: any }>}
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
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.batchId
 * @param {Record<string, any>} params.task
 * @param {Record<string, any>} params.lane
 * @param {string} params.laneCorrelationId
 * @param {any} params.contractVerifyResult
 * @param {Record<string, any>} params.config
 * @param {string} params.taskFolder
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
 * @param {string} params.projectRoot
 * @param {Record<string, any>} params.state
 * @param {string} params.batchId
 * @param {Record<string, any>} params.task
 * @param {Record<string, any>} params.lane
 * @param {string} params.laneCorrelationId
 * @param {string} params.exitReason
 * @param {string|null} params.verdict
 * @param {number} params.finalAttempt
 * @param {Record<string, any>} params.config
 * @param {string} params.taskFolder
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
 * Params: projectRoot, state, batchId, config, task, lane,
 * taskFolderInWorktree, wt, taskBranch, laneCorrelationId, fileScopePaths,
 * baseBranch.
 * Loosely typed because callers may forward a shared params bag
 * (resume-lane-reviews.mjs) — same `Record<string, any>` pattern as
 * state-guards.mjs.
 *
 * @param {Record<string, any>} params
 * @returns {Promise<{ ok: boolean, [key: string]: any }>}
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

	// SP-813 / #328: contract verification must run before the honor fast path
	// so a task can never complete through an honored final-review verdict
	// without `contract.verified` in the journal. The result computed here is
	// consumed by the first poll-loop iteration (contractVerifiedPending) so
	// the contract is verified exactly once per phase entry; rework iterations
	// re-verify as before. Respects shouldRunContractVerifyForWorker, so stub
	// batches (and contracts without verifiable fields) keep skipping.
	let contractVerifyResult =
		/** @type {{ ok: boolean, checks: Array<{ field: string, ok: boolean, message: string }>, retries?: number } | null} */ (
			null
		);
	let contractVerifiedPending = false;
	const runContractVerifyGate = async () => {
		contractVerifyResult = null;
		contractVerifiedPending = true;
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
			const result = await verifyContract(wt, parsedContract, {
				...config,
				baseBranch,
				sinceCommit: sinceCommit ?? undefined,
				projectRoot,
				batchId,
				taskId,
				taskFolder: taskFolderInWorktree,
			});
			contractVerifyResult = result;
			task.contractOk = result.ok;
			saveSpineBatchState(projectRoot, state);
			appendJournalEvent(projectRoot, batchId, "contract.verified", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				ok: result.ok,
				checks: result.checks,
			});
			if (!result.ok) {
				removeDoneFile(taskFolderInWorktree);
				recordContractVerifyTaskFailure({
					projectRoot,
					state,
					batchId,
					task,
					lane,
					laneCorrelationId,
					contractVerifyResult: result,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { contractFailed: true };
			}
		}
		return { contractFailed: false };
	};

	const preHonorContractGate = await runContractVerifyGate();
	if (preHonorContractGate.contractFailed) {
		return { ok: false, exitReason: "contract_failed", verdict: "CONTRACT_FAIL" };
	}

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
		worktreePath: wt,
	});
	if (honoredResult) return honoredResult;

	return await runReviewPollLoop({
		reviewType: "final",
		passVerdict: "PASS",
		attemptField: "finalAttempts",
		attemptKey: "finalAttempt",
		maxAttempts: maxFinalAttempts,
		runEngineReview: (params) =>
			runEngineFinalReview(/** @type {any} */ ({ ...params, stubVerdicts })),
		recordReviewTaskFailure: recordFinalReviewTaskFailure,
		invalidVerdictOutput: "final review artifact missing PASS, REVISE, or REPLAN verdict",
		allowReplan: true,
		beforeReview: async () => {
			if (contractVerifiedPending) {
				// Consume the phase-entry verification so the first poll iteration
				// does not double-verify; later rework iterations run the full gate.
				contractVerifiedPending = false;
				return { extraReviewParams: { contractVerifyResult } };
			}
			const gate = await runContractVerifyGate();
			if (gate.contractFailed) {
				return {
					abort: { ok: false, exitReason: "contract_failed", verdict: "CONTRACT_FAIL" },
				};
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
