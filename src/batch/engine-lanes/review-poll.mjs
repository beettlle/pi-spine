// @ts-nocheck
/**
 * Shared review poll-loop mechanics for the engine lane review phases
 * (SP-727 / #262). Extracted from review.mjs so the plan, code, and final
 * phases share one honor fast-path and one while(true) review/rework poll.
 * Behavior-preserving: phase-specific policy (gates, caps, verdict sets,
 * contract verify) stays in review.mjs and is injected via callbacks.
 */

import fs from "node:fs";
import path from "node:path";
import { recordLaneTaskMetric } from "./queue.mjs";
import { appendJournalEvent } from "../journal.mjs";
import {
	recomputeTaskCounters,
	saveSpineBatchState,
	updateSegmentForTask,
} from "../state.mjs";
import { runWorker } from "../worker-host.mjs";
import {
	REVIEW_TIMEOUT_REASON,
	resolveReviewHonorJournalEvent,
	resolveReviewPassKind,
	shouldEmitReviewResumed,
} from "../review.mjs";

/**
 * @param {string} taskFolder
 */
export function removeDoneFile(taskFolder) {
	const donePath = path.join(taskFolder, ".DONE");
	if (fs.existsSync(donePath)) {
		fs.unlinkSync(donePath);
	}
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {object} params.task
 * @param {object} params.lane
 * @param {string} params.laneCorrelationId
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {number} params.reviewAttempt
 * @param {object} params.honored
 * @param {"review.crash_recovered"|"review.skipped_fresh_artifact"|null} params.honorJournalEvent
 */
export function appendReviewHonorJournalEvents({
	projectRoot,
	batchId,
	task,
	lane,
	laneCorrelationId,
	reviewType,
	reviewAttempt,
	honored,
	honorJournalEvent,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	if (!honorJournalEvent) return;

	const basePayload = {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		reviewType,
		artifactPath: honored.artifactPath,
		honorSource: honored.source,
		reviewPassKind: resolveReviewPassKind(honorJournalEvent),
	};

	if (reviewType === "plan") {
		appendJournalEvent(projectRoot, batchId, honorJournalEvent, {
			...basePayload,
			planReviewAttempt: reviewAttempt,
		});
		return;
	}

	if (reviewType === "code") {
		appendJournalEvent(projectRoot, batchId, honorJournalEvent, {
			...basePayload,
			codeReviewAttempt: reviewAttempt,
		});
		return;
	}

	appendJournalEvent(projectRoot, batchId, honorJournalEvent, {
		...basePayload,
		finalAttempt: reviewAttempt,
	});
}

/**
 * Honor fast-path shared by the three review phases: when a completed review
 * with the pass verdict already exists in the journal or artifacts, record it
 * and skip the poll loop. Returns the phase result, or null when not honored.
 *
 * @param {object} params
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {"APPROVE"|"PASS"} params.passVerdict
 * @param {string} params.attemptField Task state field, e.g. "codeReviewAttempts".
 * @param {string} params.attemptKey Journal payload key, e.g. "codeReviewAttempt".
 * @param {Function} params.findCompletedReview ({ taskFolder, journalEvents, taskId }) => honored|null
 */
export function honorCompletedReview({
	reviewType,
	passVerdict,
	attemptField,
	attemptKey,
	findCompletedReview,
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	taskFolder,
	journalEvents,
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	const reviewAttempt = task[attemptField] ?? 0;
	const honored = findCompletedReview({ taskFolder, journalEvents, taskId });
	if (honored?.verdict !== passVerdict) return null;

	const honorJournalEvent = resolveReviewHonorJournalEvent({
		journalEvents,
		taskId,
		reviewType,
		honorSource: honored.source,
		reviewAttempt,
	});
	appendReviewHonorJournalEvents({
		projectRoot,
		batchId,
		task,
		lane,
		laneCorrelationId,
		reviewType,
		reviewAttempt,
		honored,
		honorJournalEvent,
	});
	appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
		taskId,
		laneNumber,
		laneId: lane.laneId,
		correlationId: laneCorrelationId,
		reviewType,
		verdict: passVerdict,
		feedback: honored.feedback,
		artifactPath: honored.artifactPath,
		[attemptKey]: reviewAttempt + 1,
		honored: true,
		honorSource: honored.source,
		reviewPassKind: resolveReviewPassKind(honorJournalEvent),
	});
	task[attemptField] = reviewAttempt + 1;
	saveSpineBatchState(projectRoot, state);
	return { ok: true, verdict: passVerdict, [attemptKey]: reviewAttempt + 1, honored: true };
}

/**
 * Generic review/rework poll loop shared by the plan, code, and final phases.
 * Runs the injected engine review, records verdicts, respawns the worker on
 * REVISE until the per-phase attempt cap, and fails closed on spawn failure,
 * exhaustion, or an invalid verdict. The optional `beforeReview` hook runs at
 * the top of each iteration (final phase uses it for contract verification)
 * and may abort the loop or pass extra params to the engine review.
 *
 * @param {object} params
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {"APPROVE"|"PASS"} params.passVerdict
 * @param {string} params.attemptField Task state field, e.g. "codeReviewAttempts".
 * @param {string} params.attemptKey Journal payload key, e.g. "codeReviewAttempt".
 * @param {number} params.maxAttempts
 * @param {Function} params.runEngineReview Async engine review fn (e.g. runEngineCodeReview).
 * @param {Function} params.recordReviewTaskFailure Phase-specific failure recorder.
 * @param {string} params.invalidVerdictOutput Output message for the invalid-verdict failure.
 * @param {boolean} [params.allowReplan] Final phase only: handle REPLAN as needs_replan.
 * @param {Function} [params.beforeReview] Async hook per iteration; returns
 *   { abort: result } to stop the loop or { extraReviewParams: object } to continue.
 */
export async function runReviewPollLoop({
	reviewType,
	passVerdict,
	attemptField,
	attemptKey,
	maxAttempts,
	runEngineReview,
	recordReviewTaskFailure,
	invalidVerdictOutput,
	allowReplan = false,
	beforeReview = null,
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
}) {
	const taskId = task.taskId;
	const laneNumber = lane.laneNumber;
	let reviewAttempt = task[attemptField] ?? 0;
	const maxAttemptsKey = `max${attemptKey[0].toUpperCase()}${attemptKey.slice(1)}s`;

	const journal = {
		projectRoot,
		batchId,
		taskId,
		laneNumber,
		correlationId: laneCorrelationId,
	};

	let reviewResumedEmitted = false;

	while (true) {
		if (
			!reviewResumedEmitted &&
			shouldEmitReviewResumed({ journalEvents, taskId })
		) {
			appendJournalEvent(projectRoot, batchId, "review.resumed", {
				taskId,
				laneNumber,
				laneId: lane.laneId,
				correlationId: laneCorrelationId,
				reviewType,
				[attemptKey]: reviewAttempt + 1,
			});
			reviewResumedEmitted = true;
		}

		let extraReviewParams = {};
		if (beforeReview) {
			const gate = await beforeReview({ attempt: reviewAttempt });
			if (gate?.abort) return gate.abort;
			extraReviewParams = gate?.extraReviewParams ?? {};
		}

		const reviewResult = await runEngineReview({
			taskFolder: taskFolderInWorktree,
			worktreePath: wt,
			config,
			attempt: reviewAttempt + 1,
			journal,
			...extraReviewParams,
		});

		if (reviewResult.spawnFailed) {
			const spawnExitReason =
				reviewResult.reason === REVIEW_TIMEOUT_REASON
					? `${reviewType}_review_timeout`
					: `${reviewType}_review_spawn_failed`;
			recordReviewTaskFailure({
				projectRoot,
				state,
				batchId,
				task,
				lane,
				laneCorrelationId,
				exitReason: spawnExitReason,
				verdict: null,
				[attemptKey]: reviewAttempt,
				config,
				taskFolder: taskFolderInWorktree,
			});
			return {
				ok: false,
				error: spawnExitReason,
				output: reviewResult.error ?? `${reviewType} review spawn failed`,
			};
		}

		if (reviewResult.skipped) {
			return { ok: true, skipped: true };
		}

		appendJournalEvent(projectRoot, batchId, "task.verdict_recorded", {
			taskId,
			laneNumber,
			laneId: lane.laneId,
			correlationId: laneCorrelationId,
			reviewType,
			verdict: reviewResult.verdict,
			feedback: reviewResult.feedback,
			artifactPath: reviewResult.artifactPath,
			[attemptKey]: reviewAttempt + 1,
		});

		if (reviewResult.verdict === passVerdict) {
			task[attemptField] = reviewAttempt + 1;
			saveSpineBatchState(projectRoot, state);
			return { ok: true, verdict: passVerdict, [attemptKey]: reviewAttempt + 1 };
		}

		if (allowReplan && reviewResult.verdict === "REPLAN") {
			removeDoneFile(taskFolderInWorktree);
			task[attemptField] = reviewAttempt + 1;
			recordReviewTaskFailure({
				projectRoot,
				state,
				batchId,
				task,
				lane,
				laneCorrelationId,
				exitReason: "needs_replan",
				verdict: "REPLAN",
				[attemptKey]: reviewAttempt + 1,
				config,
				taskFolder: taskFolderInWorktree,
			});
			return { ok: false, exitReason: "needs_replan", verdict: "REPLAN" };
		}

		if (reviewResult.verdict === "REVISE") {
			reviewAttempt++;
			task[attemptField] = reviewAttempt;
			saveSpineBatchState(projectRoot, state);

			if (reviewAttempt >= maxAttempts) {
				removeDoneFile(taskFolderInWorktree);
				appendJournalEvent(projectRoot, batchId, "review.exhausted", {
					taskId,
					laneNumber,
					laneId: lane.laneId,
					correlationId: laneCorrelationId,
					[attemptKey]: reviewAttempt,
					[maxAttemptsKey]: maxAttempts,
					reviewType,
				});
				recordReviewTaskFailure({
					projectRoot,
					state,
					batchId,
					task,
					lane,
					laneCorrelationId,
					exitReason: "review_exhausted",
					verdict: "REVISE",
					[attemptKey]: reviewAttempt,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, exitReason: "review_exhausted", verdict: "REVISE" };
			}

			removeDoneFile(taskFolderInWorktree);
			const reworkResult = await runWorker({
				worktreePath: wt,
				taskFolder: taskFolderInWorktree,
				projectRoot,
				batchId,
				laneNumber,
				taskId,
				laneBranch: taskBranch,
				laneCorrelationId,
				fileScopePaths,
				config,
				onHeartbeat: (timestamp) => {
					lane.lastHeartbeatAt = timestamp;
					saveSpineBatchState(projectRoot, state);
				},
				onWorkerPid: (pid) => {
					if (pid > 0) {
						lane.workerPid = pid;
						saveSpineBatchState(projectRoot, state);
					}
				},
			});
			if (!reworkResult.ok) {
				const aborted = reworkResult.classification === "aborted";
				task.status = aborted ? "aborted" : "failed";
				task.endedAt = Date.now();
				task.exitReason = reworkResult.classification ?? "worker_failed";
				updateSegmentForTask(state, taskId, aborted ? "aborted" : "failed");
				recomputeTaskCounters(state);
				saveSpineBatchState(projectRoot, state);
				recordLaneTaskMetric({
					projectRoot,
					batchId,
					task,
					config,
					taskFolder: taskFolderInWorktree,
				});
				return { ok: false, aborted, workerResult: reworkResult };
			}

			appendJournalEvent(projectRoot, batchId, "lane.completed", {
				laneNumber,
				laneId: lane.laneId,
				taskId,
				correlationId: laneCorrelationId,
				phase: `${reviewType}_rework`,
			});
			continue;
		}

		recordReviewTaskFailure({
			projectRoot,
			state,
			batchId,
			task,
			lane,
			laneCorrelationId,
			exitReason: `${reviewType}_review_invalid_verdict`,
			verdict: reviewResult.verdict,
			[attemptKey]: reviewAttempt,
			config,
			taskFolder: taskFolderInWorktree,
		});
		return {
			ok: false,
			error: `${reviewType}_review_invalid_verdict`,
			output: invalidVerdictOutput,
		};
	}
}
