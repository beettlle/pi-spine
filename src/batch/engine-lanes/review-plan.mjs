/**
 * Engine lane plan review phase (SP-730 / #262).
 */

import fs from "node:fs";
import path from "node:path";
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
	isReviewTypeRequired,
	normalizeCodeVerdict,
	parseReviewVerdict,
} from "../review-shared.mjs";
import {
	findLatestStepReviewArtifact,
	readReviewLevel,
	runStepReview,
} from "../review.mjs";
import { isHonorableReviewEvent } from "../review-artifacts.mjs";
import { honorCompletedReview, runReviewPollLoop } from "./review-poll.mjs";
import {
	createPhaseStubVerdictQueue,
	shouldUseReviewStub,
	writeStubReviewArtifact,
} from "./review-stub.mjs";

/**
 * Step number containing a plan review checkpoint marker, else the lowest step.
 * Local mirror of findCodeReviewStepNumber for the engine plan phase (SP-695).
 *
 * SP-874 / #294: this is the LAST step of {@link findPlanReviewStepOrder} —
 * the checkpoint (or fallback) step the phase reviews after the step-0
 * (minimum-step) review has run and approved.
 *
 * @param {string} taskFolder
 */
function findPlanReviewStepNumber(taskFolder) {
	return findPlanReviewStepOrder(taskFolder).at(-1) ?? 0;
}

/**
 * Ordered plan-review steps for the engine phase (SP-874 / #294): the minimum
 * step (step 0) first, then any explicit plan-review checkpoint step. A packet
 * that declares a plan-review checkpoint at a later step must not silently
 * drop the required step-0 plan review — step 0 is queued before the later
 * checkpoint review so no later-step plan review runs while step 0 is
 * unreviewed (#294 Expected item 1).
 *
 * - No PROMPT.md or no `### Step N` blocks → `[0]`.
 * - No plan-review checkpoint marker → `[minStep]` (unchanged SP-695 fallback).
 * - Checkpoint at C: `C > min` → `[min, C]`; `C <= min` → `[C]` (unchanged).
 *
 * @param {string} taskFolder
 * @returns {number[]}
 */
export function findPlanReviewStepOrder(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return [0];
	const content = fs.readFileSync(promptPath, "utf-8");
	const stepBlocks = [...content.matchAll(/###\s+Step\s+(\d+)[:\s][\s\S]*?(?=###\s+Step\s+\d+|$)/g)];
	if (stepBlocks.length === 0) return [0];
	const minStep = Math.min(...stepBlocks.map((match) => Number(match[1])));
	let checkpointStep = null;
	for (const match of stepBlocks) {
		if (/plan[-\s]review\s+checkpoint/i.test(match[0])) {
			checkpointStep = Number(match[1]);
			break;
		}
	}
	if (checkpointStep == null) return [minStep];
	return checkpointStep > minStep ? [minStep, checkpointStep] : [checkpointStep];
}

/**
 * Resolve an existing worker or lane plan review from journal and/or artifacts.
 * Mirrors findCompletedCodeReview with reviewType "plan" (SP-695), including
 * the honor guard for untrusted journal verdicts (SP-813 / #328).
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {Array<Record<string, any>>} [params.journalEvents]
 * @param {string} [params.taskId]
 * @param {number} [params.stepNumber] Restrict the scan to this step's verdict (SP-874 / #294 ordering).
 * @param {string} [params.worktreePath] Lane worktree used to resolve relative artifact paths.
 * @param {boolean} [params.stubMode] Whether the batch runs in review-stub mode (see isHonorableReviewEvent).
 * @param {(event: Record<string, any>, reason: string) => void} [params.onReject] Invoked once per journal event refused by the honor guard.
 * @returns {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
function findCompletedPlanReview({
	taskFolder,
	journalEvents = [],
	taskId,
	stepNumber,
	worktreePath,
	stubMode,
	onReject,
}) {
	/** @type {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact", seq: number }|null} */
	let journalMatch = null;
	for (let index = 0; index < journalEvents.length; index += 1) {
		const event = journalEvents[index];
		if (taskId && event.taskId !== taskId) continue;
		if (event.type !== "review.completed") continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (payload.reviewType !== "plan") continue;
		// SP-874 / #294 ordering: a later-step plan verdict must not satisfy an
		// earlier step's gate — events that declare a step must match the scan's
		// step exactly. Legacy events without a stepNumber cannot claim a later
		// step and stay honorable for the phase's target step.
		if (stepNumber != null && payload.stepNumber != null && payload.stepNumber !== stepNumber) continue;
		const verdict = normalizeCodeVerdict(payload.verdict);
		if (!verdict) continue;
		const honorGuard = isHonorableReviewEvent(event, { taskFolder, worktreePath, stubMode });
		if (!honorGuard.ok) {
			// Untrusted event: skip it exactly as if it were absent so the scan
			// still honors a later trustworthy event or the artifact fallback.
			if (typeof onReject === "function") onReject(event, honorGuard.reason);
			continue;
		}
		journalMatch = {
			verdict,
			feedback: typeof payload.feedback === "string" ? payload.feedback : "",
			artifactPath: typeof payload.artifactPath === "string" ? payload.artifactPath : "",
			source: "journal",
			seq: index,
		};
	}

	if (journalMatch?.verdict === "APPROVE") {
		const { seq: _seq, ...result } = journalMatch;
		return result;
	}

	const artifactStepNumber = stepNumber ?? findPlanReviewStepNumber(taskFolder);
	const latestArtifact = findLatestStepReviewArtifact(taskFolder, artifactStepNumber);
	if (latestArtifact) {
		const reviewContent = fs.readFileSync(latestArtifact.artifactPath, "utf-8");
		const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType: "plan" });
		if (verdict) {
			const artifactMatch = {
				// Narrowed by the `if (verdict)` guard above; parseReviewVerdict's
				// union spans code/final verdicts, so cast to the plan verdict set.
				verdict: /** @type {"APPROVE"|"REVISE"} */ (verdict),
				feedback,
				artifactPath: latestArtifact.artifactPath,
				source: /** @type {"artifact"} */ ("artifact"),
			};
			if (verdict === "APPROVE") return artifactMatch;
			if (!journalMatch) return artifactMatch;
		}
	}

	if (!journalMatch) return null;
	const { seq: _seq, ...result } = journalMatch;
	return result;
}

/**
 * Engine-owned plan review — mirror of runEngineCodeReview with reviewType "plan".
 * Uses agents.reviewer.plan pins via runStepReview → buildReviewerPiArgs (SP-695 / #250).
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {string} params.worktreePath
 * @param {Record<string, any>} [params.config]
 * @param {number} [params.attempt]
 * @param {Record<string, any>} [params.journal]
 * @param {{ next: () => string } | null} [params.stubVerdicts]
 * @param {number} [params.planReviewStep] Explicit plan-review step override (SP-874 / #294 ordering); defaults to findPlanReviewStepNumber.
 * @returns {Promise<{ ok: boolean, [key: string]: any }>}
 */
export async function runEnginePlanReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	journal,
	stubVerdicts = null,
	planReviewStep,
}) {
	const reviewLevel = readReviewLevel(taskFolder);
	if (!isReviewTypeRequired(reviewLevel, "plan")) {
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

	const stepNumber = planReviewStep ?? findPlanReviewStepNumber(taskFolder);
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);
	const useStub = shouldUseReviewStub();

	if (useStub) {
		const queue = stubVerdicts ?? createPhaseStubVerdictQueue("plan");
		const verdict = queue.next();
		const feedback =
			verdict === "REVISE" ? "Stub reviewer requested changes." : "Stub reviewer approved.";
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.started", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "plan",
				reviewLevel,
				artifactPath,
			});
		}
		writeStubReviewArtifact({ artifactPath, title: "Plan Review", verdict, feedback });
		if (journal?.projectRoot && journal?.batchId) {
			appendJournalEvent(journal.projectRoot, journal.batchId, "review.completed", {
				taskId: journal.taskId,
				laneNumber: journal.laneNumber,
				correlationId: journal.correlationId,
				stepNumber,
				reviewType: "plan",
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
		reviewType: "plan",
		config,
		journal,
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
 * @param {number} params.planReviewAttempt
 * @param {Record<string, any>} params.config
 * @param {string} params.taskFolder
 */
function recordPlanReviewTaskFailure({
	projectRoot,
	state,
	batchId,
	task,
	lane,
	laneCorrelationId,
	exitReason,
	verdict,
	planReviewAttempt,
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
		planVerdict: verdict ?? null,
		planReviewAttempt,
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
 * Engine-owned plan review phase after worker success (SP-695 / #250).
 * Mirrors runCodeReviewPhase: RL gate (plan required for RL≥1), honor of an
 * existing plan artifact/journal verdict, rework loop on REVISE, fail-closed
 * on exhaustion or invalid verdict.
 *
 * SP-874 / #294: plan reviews are queued via findPlanReviewStepOrder — the
 * step-0 (minimum-step) review is scheduled BEFORE any later-step
 * (plan-review checkpoint) review for the same task/lane. Each queued step
 * runs the honor fast-path then the review/rework poll loop; a spawn failure
 * or exhausted rework loop at any step fails the task closed (the remaining
 * schedule is not silently skipped).
 *
 * Params: projectRoot, state, batchId, config, task, lane,
 * taskFolderInWorktree, wt, taskBranch, laneCorrelationId, fileScopePaths.
 * Loosely typed because callers may forward a shared params bag
 * (resume-lane-reviews.mjs) — same `Record<string, any>` pattern as
 * state-guards.mjs.
 *
 * @param {Record<string, any>} params
 * @returns {Promise<{ ok: boolean, [key: string]: any }>}
 */
export async function runPlanReviewPhase({
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
	if (!isReviewTypeRequired(reviewLevel, "plan")) {
		return { ok: true, skipped: true };
	}

	// Per-phase cap with fallback to maxFinalAttempts when the dedicated key is unset (SP-725 / #265).
	const maxPlanReviewAttempts =
		config?.review?.maxPlanReviewAttempts ??
		config?.review?.maxFinalAttempts ??
		REVIEW_DEFAULTS.maxFinalAttempts;

	// Materialize the stub queue once per phase and pass it via params so
	// parallel lanes never share or mutate process.env stub state (SP-728).
	// The queue spans the whole ordered schedule (SP-874): verdicts pop in
	// order across steps, never reset per step.
	const stubVerdicts = shouldUseReviewStub() ? createPhaseStubVerdictQueue("plan") : null;

	// SP-874 / #294: step 0 first, then any later plan-review checkpoint step.
	const planReviewSteps = findPlanReviewStepOrder(taskFolderInWorktree);

	/** @type {{ ok: boolean, [key: string]: any }} */
	let phaseResult = { ok: true };
	for (const planReviewStep of planReviewSteps) {
		// Re-read per step so the next step's honor scan sees verdicts the
		// previous step just recorded.
		const journalEvents = readJournalEvents(projectRoot, batchId);
		const honoredResult = honorCompletedReview({
			reviewType: "plan",
			passVerdict: "APPROVE",
			attemptField: "planReviewAttempts",
			attemptKey: "planReviewAttempt",
			findCompletedReview: (/** @type {Record<string, any>} */ finderParams) =>
				findCompletedPlanReview(/** @type {any} */ ({ ...finderParams, stepNumber: planReviewStep })),
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
		if (honoredResult) {
			phaseResult = honoredResult;
			continue;
		}

		phaseResult = await runReviewPollLoop({
			reviewType: "plan",
			passVerdict: "APPROVE",
			attemptField: "planReviewAttempts",
			attemptKey: "planReviewAttempt",
			maxAttempts: maxPlanReviewAttempts,
			runEngineReview: (params) =>
				runEnginePlanReview(/** @type {any} */ ({ ...params, stubVerdicts, planReviewStep })),
			recordReviewTaskFailure: recordPlanReviewTaskFailure,
			invalidVerdictOutput: "plan review artifact missing APPROVE or REVISE verdict",
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
		// Fail-closed (#294 item 2): a spawn failure, exhausted rework loop, or
		// invalid verdict at any queued step stops the schedule — later-step
		// plan reviews must not run while an earlier step is unreviewed.
		if (!phaseResult.ok) return phaseResult;
	}
	return phaseResult;
}
