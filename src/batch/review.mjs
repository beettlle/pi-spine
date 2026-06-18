/**
 * Step review spawn + verdict parsing (FR-REV, GAP-REV-01).
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
	DEFAULT_REVIEW_SPAWN_TIMEOUT_MS,
	ARTIFACT_READY_HONOR_REASON,
	isActiveWorkerSession,
	NESTED_REVIEW_SPAWN_BLOCKED,
	NESTED_REVIEW_SPAWN_REASON,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
	spawnReviewerPi,
} from "./review-spawn.mjs";
import {
	REVIEW_LEVEL_RE,
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	normalizeVerdict,
	parseReviewLevel,
	parseReviewVerdict,
} from "./review-shared.mjs";

export {
	REVIEW_LEVEL_RE,
	buildFinalReviewArtifactPath,
	buildReviewArtifactPath,
	isReviewTypeRequired,
	parseReviewLevel,
	parseReviewVerdict,
} from "./review-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

export {
	DEFAULT_REVIEW_SPAWN_TIMEOUT_MS,
	ARTIFACT_READY_HONOR_REASON,
	isActiveWorkerSession,
	NESTED_REVIEW_SPAWN_BLOCKED,
	NESTED_REVIEW_SPAWN_REASON,
	REVIEW_SPAWN_TIMEOUT_EXIT_CODE,
	REVIEW_TIMEOUT_REASON,
} from "./review-spawn.mjs";

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
 * Resolve an existing worker or lane code review from journal and/or artifacts.
 *
 * @param {object} params
 * @param {string} params.taskFolder
 * @param {object[]} [params.journalEvents]
 * @param {string} [params.taskId]
 * @returns {{ verdict: "APPROVE"|"REVISE", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
export function findCompletedCodeReview({ taskFolder, journalEvents = [], taskId }) {
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
 * @returns {{ verdict: "PASS"|"REVISE"|"REPLAN", feedback: string, artifactPath: string, source: "journal"|"artifact" }|null}
 */
export function findCompletedFinalReview({ taskFolder, journalEvents = [], taskId }) {
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
function writeStubReviewArtifact({ artifactPath, reviewType, stepNumber, stepName, verdict, feedback }) {
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
 * @param {object} params
 */
/**
 * @param {object} journal
 */
function isBatchJournalFrozen(journal) {
	const loaded = loadSpineBatchState(journal.projectRoot);
	if (!loaded.raw || loaded.raw.batchId !== journal.batchId) return false;
	const phase = String(loaded.raw.phase ?? "");
	return phase === "completed" || phase === "dismissed";
}

function journalReviewEvent(type, journal, payload) {
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
			const feedback = spawnResult.error ?? NESTED_REVIEW_SPAWN_BLOCKED;
			journalReviewEvent("review.skipped", journal, {
				stepNumber,
				reviewType,
				reviewLevel,
				reason: NESTED_REVIEW_SPAWN_REASON,
				message: feedback,
			});
			return {
				ok: true,
				skipped: true,
				reviewLevel,
				verdict: null,
				feedback,
				artifactPath,
				spawnFailed: false,
				exitCode: 0,
			};
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
