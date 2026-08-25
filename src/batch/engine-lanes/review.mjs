// @ts-nocheck
/**
 * Engine lane review-phase wiring — code/final review loops after worker success.
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
	buildReviewArtifactPath,
	isReviewTypeRequired,
	normalizeCodeVerdict,
	normalizeFinalVerdict,
	parseReviewVerdict,
	shouldRunCodeReview,
	shouldRunFinalReview,
} from "../review-shared.mjs";
import {
	findCodeReviewStepNumber,
	findCompletedCodeReview,
	findCompletedFinalReview,
	findFinalReviewStepNumber,
	findLatestStepReviewArtifact,
	readReviewLevel,
	runStepReview,
} from "../review.mjs";
import {
	honorCompletedReview,
	removeDoneFile,
	runReviewPollLoop,
} from "./review-poll.mjs";

export {
	buildFinalReviewArtifactPath,
	parseFinalReviewVerdict,
	shouldRunCodeReview,
	shouldRunFinalReview,
} from "../review-shared.mjs";

/**
 * @returns {"PASS"|"REVISE"|"REPLAN"}
 */
function resolveFinalStubVerdict() {
	const queue = process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS;
	if (queue) {
		const parts = queue.split(",").map((entry) => entry.trim()).filter(Boolean);
		const verdict = parts.shift() ?? "PASS";
		process.env.SPINE_ENGINE_FINAL_STUB_VERDICTS = parts.join(",");
		return normalizeFinalVerdict(verdict) ?? "PASS";
	}
	const single = process.env.SPINE_ENGINE_FINAL_STUB_VERDICT ?? "PASS";
	return normalizeFinalVerdict(single) ?? "PASS";
}

/**
 * @returns {"APPROVE"|"REVISE"}
 */
function resolveCodeStubVerdict() {
	const queue = process.env.SPINE_ENGINE_CODE_STUB_VERDICTS;
	if (queue) {
		const parts = queue.split(",").map((entry) => entry.trim()).filter(Boolean);
		const verdict = parts.shift() ?? "APPROVE";
		process.env.SPINE_ENGINE_CODE_STUB_VERDICTS = parts.join(",");
		return normalizeCodeVerdict(verdict) ?? "APPROVE";
	}
	const single = process.env.SPINE_ENGINE_CODE_STUB_VERDICT ?? "APPROVE";
	return normalizeCodeVerdict(single) ?? "APPROVE";
}

/**
 * @param {object} params
 */
function writeFinalStubReviewArtifact({ artifactPath, verdict, feedback }) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const body = [
		"## Final Review",
		"",
		`### Verdict: ${verdict}`,
		"",
		"### Summary",
		feedback || `Stub final review returned ${verdict}.`,
		"",
		"```json",
		JSON.stringify({ verdict, feedback: feedback || "" }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

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
	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		process.env.SPINE_WORKER_STUB === "1";

	if (useStub) {
		const verdict = resolveFinalStubVerdict();
		const feedback =
			verdict === "REVISE"
				? "Stub reviewer requested changes."
				: verdict === "REPLAN"
					? "Stub reviewer requested replan."
					: "Stub reviewer passed.";
		writeFinalStubReviewArtifact({ artifactPath, verdict, feedback });
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
 * @returns {"APPROVE"|"REVISE"}
 */
function resolvePlanStubVerdict() {
	const queue = process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS;
	if (queue) {
		const parts = queue.split(",").map((entry) => entry.trim()).filter(Boolean);
		const verdict = parts.shift() ?? "APPROVE";
		process.env.SPINE_ENGINE_PLAN_STUB_VERDICTS = parts.join(",");
		return normalizeCodeVerdict(verdict) ?? "APPROVE";
	}
	const single = process.env.SPINE_ENGINE_PLAN_STUB_VERDICT ?? "APPROVE";
	return normalizeCodeVerdict(single) ?? "APPROVE";
}

/**
 * Step number containing a plan review checkpoint marker, else the lowest step.
 * Local mirror of findCodeReviewStepNumber for the engine plan phase (SP-695).
 *
 * @param {string} taskFolder
 */
function findPlanReviewStepNumber(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return 0;
	const content = fs.readFileSync(promptPath, "utf-8");
	const stepBlocks = [...content.matchAll(/###\s+Step\s+(\d+)[:\s][\s\S]*?(?=###\s+Step\s+\d+|$)/g)];
	for (const match of stepBlocks) {
		if (/plan[-\s]review\s+checkpoint/i.test(match[0])) {
			return Number(match[1]);
		}
	}
	if (stepBlocks.length === 0) return 0;
	return Math.min(...stepBlocks.map((match) => Number(match[1])));
}

/**
 * Resolve an existing worker or lane plan review from journal and/or artifacts.
 * Mirrors findCompletedCodeReview with reviewType "plan" (SP-695).
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {object[]} [params.journalEvents]
 * @param {string} [params.taskId]
 * @returns {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
function findCompletedPlanReview({ taskFolder, journalEvents = [], taskId }) {
	/** @type {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact", seq: number }|null} */
	let journalMatch = null;
	for (let index = 0; index < journalEvents.length; index += 1) {
		const event = journalEvents[index];
		if (taskId && event.taskId !== taskId) continue;
		if (event.type !== "review.completed") continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (payload.reviewType !== "plan") continue;
		const verdict = normalizeCodeVerdict(payload.verdict);
		if (!verdict) continue;
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

	const stepNumber = findPlanReviewStepNumber(taskFolder);
	const latestArtifact = findLatestStepReviewArtifact(taskFolder, stepNumber);
	if (latestArtifact) {
		const reviewContent = fs.readFileSync(latestArtifact.artifactPath, "utf-8");
		const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType: "plan" });
		if (verdict) {
			const artifactMatch = {
				verdict,
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
 */
export async function runEnginePlanReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	journal,
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

	const stepNumber = findPlanReviewStepNumber(taskFolder);
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);
	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		process.env.SPINE_WORKER_STUB === "1";

	if (useStub) {
		const verdict = resolvePlanStubVerdict();
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
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		const body = [
			"## Plan Review",
			"",
			`### Verdict: ${verdict}`,
			"",
			"### Summary",
			feedback,
			"",
			"```json",
			JSON.stringify({ verdict, feedback }, null, 2),
			"```",
			"",
		].join("\n");
		fs.writeFileSync(artifactPath, body, "utf-8");
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
 */
export async function runEngineCodeReview({
	taskFolder,
	worktreePath,
	config = {},
	attempt = 1,
	journal,
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
	const useStub =
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		process.env.SPINE_WORKER_STUB === "1";

	if (useStub) {
		const verdict = resolveCodeStubVerdict();
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
		fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
		const body = [
			"## Code Review",
			"",
			`### Verdict: ${verdict}`,
			"",
			"### Summary",
			feedback,
			"",
			"```json",
			JSON.stringify({ verdict, feedback }, null, 2),
			"```",
			"",
		].join("\n");
		fs.writeFileSync(artifactPath, body, "utf-8");
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
async function runCodeReviewPhase({
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

	// Per-phase cap with fallback to maxFinalAttempts when the dedicated key is unset (SP-725 / #265).
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

	return await runReviewPollLoop({
		reviewType: "code",
		passVerdict: "APPROVE",
		attemptField: "codeReviewAttempts",
		attemptKey: "codeReviewAttempt",
		maxAttempts: maxCodeReviewAttempts,
		runEngineReview: runEngineCodeReview,
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

/**
 * @param {object} params
 */
async function runFinalReviewPhase({
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
		runEngineReview: runEngineFinalReview,
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

/**
 * Engine-owned plan review phase after worker success (SP-695 / #250).
 * Mirrors runCodeReviewPhase: RL gate (plan required for RL≥1), honor of an
 * existing plan artifact/journal verdict, rework loop on REVISE, fail-closed
 * on exhaustion or invalid verdict.
 *
 * @param {object} params
 */
async function runPlanReviewPhase({
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

	const journalEvents = readJournalEvents(projectRoot, batchId);
	const honoredResult = honorCompletedReview({
		reviewType: "plan",
		passVerdict: "APPROVE",
		attemptField: "planReviewAttempts",
		attemptKey: "planReviewAttempt",
		findCompletedReview: findCompletedPlanReview,
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
		reviewType: "plan",
		passVerdict: "APPROVE",
		attemptField: "planReviewAttempts",
		attemptKey: "planReviewAttempt",
		maxAttempts: maxPlanReviewAttempts,
		runEngineReview: runEnginePlanReview,
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
}

export { runCodeReviewPhase, runFinalReviewPhase, runPlanReviewPhase };
