// @ts-nocheck
/**
 * Review artifact discovery, level parsing, and honor-signal helpers.
 * SP-579 extraction from review.mjs; spawn wiring stays in review.mjs (SP-597).
 */

import fs from "node:fs";
import path from "node:path";
import { detectOrphanedReviewStarted } from "./journal-rebuild.mjs";
import { NESTED_REVIEW_SPAWN_REASON } from "./review-spawn.mjs";
import { normalizeVerdict, parseReviewLevel, parseReviewVerdict } from "./review-shared.mjs";
import { shouldUseReviewStub } from "./engine-lanes/review-stub.mjs";

/**
 * @param {string} taskFolder
 */
export function readReviewLevel(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return 0;
	return parseReviewLevel(fs.readFileSync(promptPath, "utf-8"));
}

/**
 * Highest numbered ### Step N heading in PROMPT.md (defaults to 1).
 * @param {string} taskFolder
 */
export function findFinalReviewStepNumber(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return 1;
	const content = fs.readFileSync(promptPath, "utf-8");
	const matches = [...content.matchAll(/###\s+Step\s+(\d+)/g)];
	if (matches.length === 0) return 1;
	return Math.max(...matches.map((match) => Number(match[1])));
}

/**
 * Step number containing a code review checkpoint blockquote, else highest step.
 * @param {string} taskFolder
 */
export function findCodeReviewStepNumber(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return findFinalReviewStepNumber(taskFolder);
	const content = fs.readFileSync(promptPath, "utf-8");
	const stepBlocks = [...content.matchAll(/###\s+Step\s+(\d+)[:\s][\s\S]*?(?=###\s+Step\s+\d+|$)/g)];
	for (const match of stepBlocks) {
		if (/code\s+review\s+checkpoint/i.test(match[0])) {
			return Number(match[1]);
		}
	}
	return findFinalReviewStepNumber(taskFolder);
}

/**
 * Latest `.reviews/{stepNumber}-*.md` by mtime, if any.
 * @param {string} taskFolder
 * @param {number} stepNumber
 * @returns {{ artifactPath: string, mtimeMs: number }|null}
 */
export function findLatestStepReviewArtifact(taskFolder, stepNumber) {
	const reviewsDir = path.join(taskFolder, ".reviews");
	if (!fs.existsSync(reviewsDir)) return null;
	const prefix = `${stepNumber}-`;
	const candidates = fs
		.readdirSync(reviewsDir)
		.filter((name) => name.startsWith(prefix) && name.endsWith(".md"))
		.map((name) => {
			const artifactPath = path.join(reviewsDir, name);
			return { artifactPath, mtimeMs: fs.statSync(artifactPath).mtimeMs };
		})
		.sort((left, right) => right.mtimeMs - left.mtimeMs);
	return candidates[0] ?? null;
}

/**
 * Resolve a path to its real (symlink-free) absolute form. Falls back to a
 * plain lexical resolve when the target does not exist on disk — the guard
 * must still classify a vanished foreign artifact, not crash on it.
 *
 * @param {string} candidatePath
 */
function resolveRealPath(candidatePath) {
	try {
		return fs.realpathSync(candidatePath);
	} catch {
		return path.resolve(candidatePath);
	}
}

/**
 * True when candidatePath is the folder itself or nested inside it. Both
 * sides are realpath-resolved so symlinks and platform aliases (/var vs
 * /private/var on macOS) cannot smuggle a foreign artifact past the check.
 *
 * @param {string} candidatePath
 * @param {string} folderPath
 */
function isPathInsideFolder(candidatePath, folderPath) {
	if (!folderPath) return true;
	const candidate = resolveRealPath(candidatePath);
	const folder = resolveRealPath(folderPath);
	return candidate === folder || candidate.startsWith(`${folder}${path.sep}`);
}

/**
 * Trust predicate for journaled `review.completed` honors (SP-813 / #328).
 *
 * A live batch must never honor a verdict it cannot trust:
 * - `payload.stub === true` without `payload.honored === true` in a batch that
 *   is not in stub mode means a test process (or other foreign writer) leaked
 *   a stub verdict into the live journal. The spawn-timeout honor
 *   (`honorReason: "spawn_timeout_with_done"`) journals `stub: true, honored:
 *   true` in real batches and stays honorable.
 * - an absolute `payload.artifactPath` outside the task folder points at a
 *   foreign tree (e.g. another checkout's temp fixture) and is rejected.
 *   Relative paths are worker-relative to the lane worktree and are accepted
 *   when resolving them against `worktreePath` (then `taskFolder`) lands
 *   inside the task folder.
 *
 * `stubMode` is computed by the engine caller via `shouldUseReviewStub(env)`;
 * when omitted it defaults to the process env so direct callers that predate
 * the guard (review-step-run.mjs) keep their stub-batch behavior.
 *
 * @param {Record<string, any>} event
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {string} [params.worktreePath]
 * @param {boolean} [params.stubMode]
 * @returns {{ ok: true } | { ok: false, reason: "stub_verdict_in_live_batch" | "artifact_outside_task_folder" }}
 */
export function isHonorableReviewEvent(event, { taskFolder, worktreePath, stubMode } = {}) {
	const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
	const effectiveStubMode = stubMode ?? shouldUseReviewStub();
	if (payload.stub === true && payload.honored !== true && !effectiveStubMode) {
		return { ok: false, reason: "stub_verdict_in_live_batch" };
	}

	const artifactPath = typeof payload.artifactPath === "string" ? payload.artifactPath : "";
	if (artifactPath && path.isAbsolute(artifactPath)) {
		if (!isPathInsideFolder(artifactPath, taskFolder)) {
			return { ok: false, reason: "artifact_outside_task_folder" };
		}
		return { ok: true };
	}
	if (artifactPath && worktreePath) {
		const resolved = path.resolve(worktreePath, artifactPath);
		if (isPathInsideFolder(resolved, taskFolder)) {
			return { ok: true };
		}
	}
	return { ok: true };
}

/**
 * Resolve an existing worker or lane code review from journal and/or artifacts.
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {object[]} [params.journalEvents]
 * @param {string} [params.taskId]
 * @param {string} [params.worktreePath] Lane worktree used to resolve relative artifact paths.
 * @param {boolean} [params.stubMode] Whether the batch runs in review-stub mode (see isHonorableReviewEvent).
 * @param {(event: Record<string, any>, reason: string) => void} [params.onReject] Invoked once per journal event refused by the honor guard.
 * @returns {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
export function findCompletedCodeReview({
	taskFolder,
	journalEvents = [],
	taskId,
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
		if (payload.reviewType !== "code") continue;
		const verdict = normalizeVerdict(payload.verdict, "code");
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

	const stepNumber = findCodeReviewStepNumber(taskFolder);
	const latestArtifact = findLatestStepReviewArtifact(taskFolder, stepNumber);
	if (latestArtifact) {
		const reviewContent = fs.readFileSync(latestArtifact.artifactPath, "utf-8");
		const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType: "code" });
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

/** Journal honor events emitted when honoring a completed review artifact. */
export const REVIEW_HONOR_JOURNAL_EVENTS = {
	crashRecovered: "review.crash_recovered",
	skippedFreshArtifact: "review.skipped_fresh_artifact",
	resumed: "review.resumed",
};

/**
 * True when operator retry or reconcile re-enters review with a still-valid prior verdict.
 *
 * @param {object} params
 * @param {object[]} params.journalEvents
 * @param {string} params.taskId
 * @param {"code"|"final"} params.reviewType
 * @param {"journal"|"artifact"} [params.honorSource]
 */
export function isRetryReconcileFreshReview({
	journalEvents = [],
	taskId,
	reviewType,
	honorSource,
}) {
	let lastReviewCompletedIndex = -1;
	let lastRetryIndex = -1;
	let lastReconciledCompleteIndex = -1;

	for (let index = 0; index < journalEvents.length; index += 1) {
		const event = journalEvents[index];
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const eventTaskId = event.taskId ?? payload.taskId;
		if (eventTaskId !== taskId) continue;

		if (event.type === "review.completed" && payload.reviewType === reviewType) {
			lastReviewCompletedIndex = index;
		}
		if (event.type === "task.retry_requested") {
			lastRetryIndex = index;
		}
		if (
			event.type === "task.completed" &&
			(payload.reconcileReason === "done_in_lane_terminal" || payload.reconciled === true)
		) {
			lastReconciledCompleteIndex = index;
		}
	}

	if (lastReviewCompletedIndex < 0) {
		return false;
	}
	if (lastRetryIndex > lastReviewCompletedIndex) {
		return true;
	}
	if (honorSource === "journal" && lastReconciledCompleteIndex > lastReviewCompletedIndex) {
		return true;
	}
	return false;
}

/**
 * True when journal shows a review spawn crash/failure that warrants crash_recovered.
 *
 * @param {object} params
 * @param {object[]} params.journalEvents
 * @param {string} params.taskId
 * @param {"code"|"final"} params.reviewType
 */
export function hasReviewSpawnFailureForHonor({ journalEvents = [], taskId, reviewType }) {
	const orphaned = detectOrphanedReviewStarted(journalEvents);
	for (const event of orphaned) {
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const eventTaskId = event.taskId ?? payload.taskId;
		if (eventTaskId === taskId && payload.reviewType === reviewType) {
			return true;
		}
	}

	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const eventTaskId = event.taskId ?? payload.taskId;
		if (eventTaskId !== taskId) continue;

		if (event.type === "review.failed") {
			if (payload.reviewType !== reviewType) continue;
			if (payload.reason === NESTED_REVIEW_SPAWN_REASON) continue;
			return true;
		}
		if (event.type === "review.completed" && payload.reviewType === reviewType) {
			break;
		}
	}
	return false;
}

/**
 * Resolve explicit journal event for honoring a completed review artifact.
 *
 * @param {object} params
 * @param {object[]} params.journalEvents
 * @param {string} params.taskId
 * @param {"code"|"final"} params.reviewType
 * @param {"journal"|"artifact"} [params.honorSource]
 * @param {number} [params.reviewAttempt]
 * @returns {"review.crash_recovered"|"review.skipped_fresh_artifact"|null}
 */
export function resolveReviewHonorJournalEvent({
	journalEvents = [],
	taskId,
	reviewType,
	honorSource,
	reviewAttempt = 0,
}) {
	if (
		isRetryReconcileFreshReview({ journalEvents, taskId, reviewType, honorSource }) &&
		!hasReviewSpawnFailureForHonor({ journalEvents, taskId, reviewType })
	) {
		return REVIEW_HONOR_JOURNAL_EVENTS.skippedFreshArtifact;
	}
	if (hasReviewSpawnFailureForHonor({ journalEvents, taskId, reviewType })) {
		return REVIEW_HONOR_JOURNAL_EVENTS.crashRecovered;
	}
	if (reviewAttempt > 0) {
		return REVIEW_HONOR_JOURNAL_EVENTS.crashRecovered;
	}
	return null;
}

/**
 * Map honor journal event to task.verdict_recorded reviewPassKind.
 *
 * @param {"review.crash_recovered"|"review.skipped_fresh_artifact"|null} honorJournalEvent
 * @returns {"recovered"|"fresh_skip"|"normal"}
 */
export function resolveReviewPassKind(honorJournalEvent) {
	if (honorJournalEvent === REVIEW_HONOR_JOURNAL_EVENTS.crashRecovered) {
		return "recovered";
	}
	if (honorJournalEvent === REVIEW_HONOR_JOURNAL_EVENTS.skippedFreshArtifact) {
		return "fresh_skip";
	}
	return "normal";
}

/**
 * True when review should emit review.resumed before spawning after operator retry.
 *
 * @param {object} params
 * @param {object[]} params.journalEvents
 * @param {string} params.taskId
 */
export function shouldEmitReviewResumed({ journalEvents = [], taskId }) {
	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (event.type !== "task.retry_requested") continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const eventTaskId = event.taskId ?? payload.taskId;
		if (eventTaskId === taskId) {
			return true;
		}
	}
	return false;
}

/**
 * Latest review honor/resume signal for diagnose and dashboard surfaces.
 *
 * @param {object[]} journalEvents
 * @param {string|null} [activeTaskId]
 * @returns {{ taskId: string, reviewType: string, kind: string, honorSource?: string, reviewPassKind?: string }|null}
 */
export function findLatestReviewHonorSignal(journalEvents, activeTaskId = null) {
	const honorTypes = new Set([
		REVIEW_HONOR_JOURNAL_EVENTS.crashRecovered,
		REVIEW_HONOR_JOURNAL_EVENTS.skippedFreshArtifact,
		REVIEW_HONOR_JOURNAL_EVENTS.resumed,
	]);

	for (let index = journalEvents.length - 1; index >= 0; index -= 1) {
		const event = journalEvents[index];
		if (!honorTypes.has(event.type)) continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const taskId = event.taskId ?? payload.taskId;
		if (!taskId) continue;
		if (activeTaskId && taskId !== activeTaskId) continue;
		return {
			taskId,
			reviewType: payload.reviewType,
			kind: event.type,
			honorSource: payload.honorSource,
			reviewPassKind: payload.reviewPassKind,
		};
	}
	return null;
}

/**
 * @param {object|null|undefined} reviewHonorSignal
 * @returns {string|null}
 */
export function buildReviewHonorHeadlineSuffix(reviewHonorSignal) {
	if (!reviewHonorSignal?.kind) return null;
	const reviewLabel =
		reviewHonorSignal.reviewType === "final" ? "final review" : "code review";
	if (reviewHonorSignal.kind === "review.crash_recovered") {
		return `recovered ${reviewLabel} crash — prior verdict honored from ${reviewHonorSignal.honorSource ?? "artifact"}`;
	}
	if (reviewHonorSignal.kind === "review.skipped_fresh_artifact") {
		return `skipped redundant ${reviewLabel} — fresh artifact honored`;
	}
	if (reviewHonorSignal.kind === "review.resumed") {
		return `${reviewLabel} resumed after operator retry`;
	}
	return null;
}

/**
 * Latest `.reviews/final-*.md` by mtime, if any.
 * @param {string} taskFolder
 * @returns {{ artifactPath: string, mtimeMs: number }|null}
 */
export function findLatestFinalReviewArtifact(taskFolder) {
	const reviewsDir = path.join(taskFolder, ".reviews");
	if (!fs.existsSync(reviewsDir)) return null;

	const candidates = fs
		.readdirSync(reviewsDir)
		.filter((name) => name.startsWith("final-") && name.endsWith(".md"))
		.map((name) => {
			const artifactPath = path.join(reviewsDir, name);
			return { artifactPath, mtimeMs: fs.statSync(artifactPath).mtimeMs };
		})
		.sort((left, right) => right.mtimeMs - left.mtimeMs);

	return candidates[0] ?? null;
}

/**
 * Resolve an existing worker or lane final review from journal and/or artifacts.
 * Honors PASS from journal `review.completed` or latest final artifact.
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {object[]} [params.journalEvents]
 * @param {string} [params.taskId]
 * @param {string} [params.worktreePath] Lane worktree used to resolve relative artifact paths.
 * @param {boolean} [params.stubMode] Whether the batch runs in review-stub mode (see isHonorableReviewEvent).
 * @param {(event: Record<string, any>, reason: string) => void} [params.onReject] Invoked once per journal event refused by the honor guard.
 * @returns {{ verdict: "PASS"|"REVISE"|"REPLAN", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
export function findCompletedFinalReview({
	taskFolder,
	journalEvents = [],
	taskId,
	worktreePath,
	stubMode,
	onReject,
}) {
	/** @type {{ verdict: "PASS"|"REVISE"|"REPLAN", feedback: string, artifactPath: string, source: "journal"|"artifact", seq: number }|null} */
	let journalMatch = null;
	for (let index = 0; index < journalEvents.length; index += 1) {
		const event = journalEvents[index];
		if (taskId && event.taskId !== taskId) continue;
		if (event.type !== "review.completed") continue;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		if (payload.reviewType !== "final") continue;
		const verdict = normalizeVerdict(payload.verdict, "final");
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

	if (journalMatch?.verdict === "PASS") {
		const { seq: _seq, ...result } = journalMatch;
		return result;
	}

	const latestArtifact = findLatestFinalReviewArtifact(taskFolder);
	if (latestArtifact) {
		const reviewContent = fs.readFileSync(latestArtifact.artifactPath, "utf-8");
		const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType: "final" });
		if (verdict) {
			const artifactMatch = {
				verdict,
				feedback,
				artifactPath: latestArtifact.artifactPath,
				source: /** @type {"artifact"} */ ("artifact"),
			};
			if (verdict === "PASS") return artifactMatch;
			if (!journalMatch) return artifactMatch;
		}
	}

	if (!journalMatch) return null;
	const { seq: _seq, ...result } = journalMatch;
	return result;
}
