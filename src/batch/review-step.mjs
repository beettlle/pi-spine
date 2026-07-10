// @ts-nocheck
/**
 * Step review helpers — spawn honor paths, prompts, journal attach (SP-597).
 * runStepReview lives in review-step-run.mjs (salvage for #192 / SP-593).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendJournalEvent, readJournalEvents } from "./journal.mjs";
import { loadSpineBatchState } from "./state.mjs";
import { buildReviewerContext } from "../config/reviewer-context.mjs";
import { resolveReviewScopePaths } from "./review-scope.mjs";
import { commandExists as pathCommandExists } from "../util/command-exists.mjs";
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
import {
	findCompletedFinalReview,
	readReviewLevel,
} from "./review-artifacts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

/**
 * @param {string} worktreePath
 */
export function loadReviewerPrompt(worktreePath) {
	const candidates = [
		path.join(worktreePath, ".spine", "agents", "reviewer.md"),
		path.join(PACKAGE_ROOT, "templates", "agents", "reviewer.md"),
	];
	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		const raw = fs.readFileSync(candidate, "utf-8");
		const fmEnd = raw.indexOf("---", 4);
		if (fmEnd > 0) return raw.slice(fmEnd + 3).trim();
		return raw.trim();
	}
	return "You are a code reviewer. Write your review to the specified output file.";
}

/**
 * Base reviewer agent prompt plus auto-selected Cursor rules (system prompt only).
 *
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {"plan"|"code"|"final"} params.reviewType
 * @param {string} [params.baseline]
 * @param {object} [params.config]
 * @param {object} [params.journal]
 */
export function buildReviewerSystemPrompt({
	worktreePath,
	taskFolder,
	reviewType,
	baseline,
	config = {},
	journal,
}) {
	let systemPrompt = loadReviewerPrompt(worktreePath);
	const { scopePaths } = resolveReviewScopePaths({
		worktreePath,
		baseline,
		reviewType,
		taskFolder,
	});
	const reviewerContext = buildReviewerContext({
		projectRoot: journal?.projectRoot ?? worktreePath ?? process.cwd(),
		config,
		reviewType,
		scopePaths,
		journal,
	});
	if (reviewerContext.text) {
		systemPrompt = `${systemPrompt}${reviewerContext.text}`;
	}
	return systemPrompt;
}

/**
 * @param {string} cmd
 */
export function commandExists(cmd) {
	if (process.env.SPINE_REVIEW_TEST_NO_PI === "1") return false;
	return pathCommandExists(cmd);
}

/**
 * @param {object} params
 */
export function buildReviewRequest({
	reviewType,
	stepNumber,
	stepName,
	taskFolder,
	worktreePath,
	outputPath,
	baseline,
	projectName = "project",
	contractVerifyResult = null,
}) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const statusPath = path.join(taskFolder, "STATUS.md");
	if (reviewType === "final") {
		const contractLines =
			contractVerifyResult && Array.isArray(contractVerifyResult.checks)
				? [
						"",
						"## Contract verification",
						`Machine verifier: ${contractVerifyResult.ok ? "PASS" : "FAIL"}`,
						...contractVerifyResult.checks.map(
							(check) =>
								`- ${check.ok ? "OK" : "FAIL"} ${check.field}: ${check.message}`,
						),
					]
				: [];

		return [
			"# Review Request: Final Verdict",
			"",
			`You are performing a final verdict review for a ${projectName} task.`,
			"",
			"## Task Context",
			`- **Task PROMPT:** ${promptPath}`,
			`- **Task STATUS:** ${statusPath}`,
			`- **Step completed:** Step ${stepNumber}: ${stepName}`,
			`- **Worktree:** ${worktreePath}`,
			"",
			"## Instructions",
			"Verify completion criteria and contract checks before returning a final verdict.",
			...contractLines,
			"",
			"## Output",
			`Write your review to: \`${outputPath}\``,
			"Include `### Verdict: PASS`, `### Verdict: REVISE`, or `### Verdict: REPLAN` and a JSON block.",
		].join("\n");
	}
	if (reviewType === "plan") {
		return [
			"# Review Request: Plan Review",
			"",
			`You are reviewing an implementation plan for a ${projectName} task.`,
			"",
			"## Task Context",
			`- **Task PROMPT:** ${promptPath}`,
			`- **Task STATUS:** ${statusPath}`,
			`- **Step being planned:** Step ${stepNumber}: ${stepName}`,
			`- **Worktree:** ${worktreePath}`,
			"",
			"## Output",
			`Write your review to: \`${outputPath}\``,
			"Include `### Verdict: APPROVE` or `### Verdict: REVISE` and a JSON block.",
		].join("\n");
	}

	const diffNamesCmd = baseline ? `git diff ${baseline}..HEAD --name-only` : "git diff --name-only";
	const diffCmd = baseline ? `git diff ${baseline}..HEAD` : "git diff";

	return [
		"# Review Request: Code Review",
		"",
		`You are reviewing code changes for a ${projectName} task.`,
		"",
		"## Task Context",
		`- **Task PROMPT:** ${promptPath}`,
		`- **Step reviewed:** Step ${stepNumber}: ${stepName}`,
		`- **Worktree:** ${worktreePath}`,
		...(baseline ? [`- **Baseline commit:** ${baseline}`] : []),
		"",
		"## Instructions",
		`1. Run \`${diffNamesCmd}\` to see changed files`,
		`2. Run \`${diffCmd}\` for the full diff`,
		"",
		"## Output",
		`Write your review to: \`${outputPath}\``,
		"Include `### Verdict: APPROVE` or `### Verdict: REVISE` and a JSON block.",
	].join("\n");
}

/**
 * @param {string} taskFolder
 * @param {number} stepNumber
 */
export function findStepName(taskFolder, stepNumber) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return `Step ${stepNumber}`;
	const content = fs.readFileSync(promptPath, "utf-8");
	const re = new RegExp(`###\\s+Step\\s+${stepNumber}[:\\s]+(.+)`);
	const match = content.match(re);
	return match ? match[1].trim() : `Step ${stepNumber}`;
}

/**
 * @param {object} params
 */
export function writeStubReviewArtifact({ artifactPath, reviewType, stepNumber, stepName, verdict, feedback }) {
	fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
	const reviewLabel =
		reviewType === "final" ? "Final" : reviewType === "plan" ? "Plan" : "Code";
	const body = [
		`## ${reviewLabel} Review: ${stepName}`,
		"",
		`### Verdict: ${verdict}`,
		"",
		"### Summary",
		feedback || `Stub ${reviewType} review for step ${stepNumber}.`,
		"",
		"```json",
		JSON.stringify({ verdict, feedback: feedback || "" }, null, 2),
		"```",
		"",
	].join("\n");
	fs.writeFileSync(artifactPath, body, "utf-8");
}

/**
 * @param {object} journal
 */
function isBatchJournalFrozen(journal) {
	const loaded = loadSpineBatchState(journal.projectRoot);
	if (!loaded.raw || loaded.raw.batchId !== journal.batchId) return false;
	const phase = String(loaded.raw.phase ?? "");
	return phase === "completed" || phase === "dismissed";
}

export function journalReviewEvent(type, journal, payload) {
	if (!journal?.projectRoot || !journal?.batchId) return;
	if (type === "review.failed" && isBatchJournalFrozen(journal)) {
		return;
	}
	appendJournalEvent(journal.projectRoot, journal.batchId, type, {
		taskId: journal.taskId,
		laneNumber: journal.laneNumber,
		correlationId: journal.correlationId,
		...payload,
	});
}

/**
 * In-worker plan/code checkpoints must journal `review.skipped` (SP-278/SP-308), never
 * `review.failed`, when nested reviewer spawn is blocked inside a pi worker session.
 *
 * @param {object} params
 */
export function completeNestedReviewSpawnSkipped({
	stepNumber,
	reviewType,
	reviewLevel,
	journal,
	artifactPath,
	feedback,
}) {
	const message = feedback ?? NESTED_REVIEW_SPAWN_BLOCKED;
	journalReviewEvent("review.skipped", journal, {
		stepNumber,
		reviewType,
		reviewLevel,
		reason: NESTED_REVIEW_SPAWN_REASON,
		message,
	});
	return {
		ok: true,
		skipped: true,
		reviewLevel,
		verdict: null,
		feedback: message,
		artifactPath,
		spawnFailed: false,
		exitCode: 0,
	};
}

/**
 * True when inherited worker batch env must not write to the live journal
 * (e.g. npm test subprocess with SPINE_JOURNAL_ATTACH=1).
 */
export function isJournalAttachBlocked() {
	return process.env.SPINE_SUPPRESS_JOURNAL_ATTACH === "1";
}

/**
 * Resolve batch journal target from env only when the batch engine opts in.
 * Prevents `npm test` (and other child processes) from polluting a live batch
 * journal via inherited SPINE_BATCH_ID / SPINE_PROJECT_ROOT.
 */
export function resolveBatchJournalContext() {
	if (process.env.SPINE_JOURNAL_ATTACH !== "1") return undefined;
	if (isJournalAttachBlocked()) return undefined;
	const projectRoot = process.env.SPINE_PROJECT_ROOT;
	const batchId = process.env.SPINE_BATCH_ID;
	if (!projectRoot || !batchId) return undefined;

	return {
		projectRoot,
		batchId,
		taskId: process.env.SPINE_TASK_ID,
		laneNumber: process.env.SPINE_LANE_NUMBER
			? Number(process.env.SPINE_LANE_NUMBER)
			: undefined,
		correlationId: process.env.SPINE_LANE_CORRELATION_ID,
	};
}

/**
 * When reviewer `pi` times out but the worker already left `.DONE` (and contract
 * passed for final review), honor the verdict instead of failing the task.
 *
 * @param {object} params
 * @returns {ReturnType<typeof runStepReview> | null}
 */
export function honorReviewSpawnFailureWhenEligible({
	spawnResult,
	reviewType,
	taskFolder,
	contractVerifyResult,
	journal,
	stepNumber,
	reviewLevel,
}) {
	if (!spawnResult?.spawnFailed) return null;
	if (spawnResult.exitCode !== REVIEW_SPAWN_TIMEOUT_EXIT_CODE) return null;
	if (!fs.existsSync(path.join(taskFolder, ".DONE"))) return null;

	if (reviewType === "final" && contractVerifyResult && !contractVerifyResult.ok) {
		return null;
	}

	const artifactPath =
		reviewType === "final"
			? buildFinalReviewArtifactPath(taskFolder)
			: buildReviewArtifactPath(taskFolder, stepNumber);
	const verdict =
		reviewType === "final"
			? contractVerifyResult?.ok === false
				? "REVISE"
				: "PASS"
			: "APPROVE";
	const feedback =
		reviewType === "final"
			? "Reviewer spawn timed out; honoring contract verification and worker .DONE."
			: "Reviewer spawn timed out; honoring worker .DONE and proceeding.";

	writeStubReviewArtifact({
		artifactPath,
		reviewType,
		verdict,
		feedback,
	});

	journalReviewEvent("review.completed", journal, {
		stepNumber,
		reviewType,
		reviewLevel,
		verdict,
		artifactPath,
		stub: true,
		honored: true,
		honorReason: "spawn_timeout_with_done",
	});

	const ok = reviewType === "final" ? verdict === "PASS" : verdict === "APPROVE";
	return {
		ok,
		skipped: false,
		honored: true,
		honorReason: "spawn_timeout_with_done",
		reviewLevel,
		verdict,
		feedback,
		artifactPath,
		spawnFailed: false,
		exitCode: ok ? 0 : 2,
	};
}

/**
 * Complete review from an on-disk artifact honored while reviewer pi is still running.
 *
 * @param {object} params
 * @returns {ReturnType<typeof runStepReview>}
 */
export function completeReviewFromHonoredArtifact({
	artifactPath,
	reviewType,
	journal,
	stepNumber,
	reviewLevel,
	honorReason = ARTIFACT_READY_HONOR_REASON,
}) {
	const reviewContent = fs.readFileSync(artifactPath, "utf-8");
	const { verdict, feedback } = parseReviewVerdict(reviewContent, { reviewType });
	if (!verdict) {
		const error = "honored review artifact missing structured verdict";
		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error,
			artifactPath,
			spawnFailed: true,
		});
		return {
			ok: false,
			skipped: false,
			reviewLevel,
			verdict: null,
			feedback,
			artifactPath,
			spawnFailed: true,
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
		honored: true,
		honorReason,
	});

	return {
		ok,
		skipped: false,
		honored: true,
		honorReason,
		reviewLevel,
		verdict,
		feedback,
		artifactPath,
		spawnFailed: false,
		exitCode: ok ? 0 : 2,
	};
}

export {
	assertReviewToolAvailable,
	runStepReview,
} from "./review-step-run.mjs";
