/**
 * Step review spawn + verdict parsing (FR-REV, GAP-REV-01).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendJournalEvent } from "./journal.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "../..");

export const REVIEW_LEVEL_RE = /^##\s+Review Level:\s*(\d+)/m;

/**
 * @param {string} markdown
 */
export function parseReviewLevel(markdown) {
	const match = REVIEW_LEVEL_RE.exec(markdown);
	return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * @param {string} taskFolder
 */
export function readReviewLevel(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return 0;
	return parseReviewLevel(fs.readFileSync(promptPath, "utf-8"));
}

/**
 * @param {number} reviewLevel
 * @param {"plan"|"code"} reviewType
 */
export function isReviewTypeRequired(reviewLevel, reviewType) {
	if (reviewLevel <= 0) return false;
	if (reviewType === "plan") return reviewLevel >= 1;
	return reviewLevel >= 2;
}

/**
 * @param {Date} [date]
 */
export function formatReviewTimestamp(date = new Date()) {
	return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

/**
 * @param {string} taskFolder
 * @param {number} stepNumber
 * @param {Date} [date]
 */
export function buildReviewArtifactPath(taskFolder, stepNumber, date = new Date()) {
	return path.join(taskFolder, ".reviews", `${stepNumber}-${formatReviewTimestamp(date)}.md`);
}

/**
 * @param {string} reviewContent
 * @returns {{ verdict: "APPROVE"|"REVISE"|null, feedback: string }}
 */
export function parseReviewVerdict(reviewContent) {
	const jsonMatch = reviewContent.match(/```json\s*\n([\s\S]*?)\n```/i);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			const verdict = normalizeVerdict(parsed.verdict);
			if (verdict) {
				return {
					verdict,
					feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
				};
			}
		} catch {
			/* fall through */
		}
	}

	const headingMatch = reviewContent.match(/###?\s*Verdict[:\s]*(APPROVE|REVISE)/i);
	if (headingMatch) {
		return {
			verdict: normalizeVerdict(headingMatch[1]),
			feedback: extractSummary(reviewContent),
		};
	}

	const lower = reviewContent.toLowerCase();
	if (
		lower.includes("changes requested") ||
		lower.includes("request changes") ||
		lower.includes("needs revision")
	) {
		return { verdict: "REVISE", feedback: extractSummary(reviewContent) };
	}
	if (lower.includes("approve") && !lower.includes("do not approve") && !lower.includes("cannot approve")) {
		return { verdict: "APPROVE", feedback: extractSummary(reviewContent) };
	}

	return { verdict: null, feedback: extractSummary(reviewContent) };
}

/**
 * @param {unknown} value
 */
function normalizeVerdict(value) {
	if (typeof value !== "string") return null;
	const upper = value.trim().toUpperCase();
	return upper === "APPROVE" || upper === "REVISE" ? upper : null;
}

/**
 * @param {string} reviewContent
 */
function extractSummary(reviewContent) {
	const summaryMatch = reviewContent.match(/###?\s*Summary[:\s]*([\s\S]*?)(?=###|$)/i);
	return summaryMatch ? summaryMatch[1].trim().slice(0, 500) : "";
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
 * @param {string} cmd
 */
export function commandExists(cmd) {
	if (process.env.SPINE_REVIEW_TEST_NO_PI === "1") return false;
	try {
		spawnSync("which", [cmd], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
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
}) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const statusPath = path.join(taskFolder, "STATUS.md");
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
	const body = [
		`## ${reviewType === "plan" ? "Plan" : "Code"} Review: ${stepName}`,
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
function journalReviewEvent(type, journal, payload) {
	if (!journal?.projectRoot || !journal?.batchId) return;
	appendJournalEvent(journal.projectRoot, journal.batchId, type, {
		taskId: journal.taskId,
		laneNumber: journal.laneNumber,
		correlationId: journal.correlationId,
		...payload,
	});
}

/**
 * @param {object} params
 */
function spawnReviewerPi({ worktreePath, taskFolder, reviewPrompt, systemPrompt, config = {} }) {
	if (!commandExists("pi")) {
		return {
			spawnFailed: true,
			exitCode: 127,
			error: "pi not available for reviewer spawn",
		};
	}

	const reviewerAgentPath = path.join(worktreePath, ".spine", "agents", "reviewer.md");
	const reviewerModel = config?.agents?.reviewer?.model;
	const reviewerThinking = config?.agents?.reviewer?.thinking;

	const piArgs = ["-p", "--no-session"];
	if (reviewerAgentPath && fs.existsSync(reviewerAgentPath)) {
		piArgs.push("--append-system-prompt", reviewerAgentPath);
	}
	if (systemPrompt) {
		piArgs.push("--append-system-prompt", systemPrompt);
	}
	if (reviewerModel && reviewerModel !== "inherit") {
		piArgs.push("--model", reviewerModel);
	}
	if (reviewerThinking && reviewerThinking !== "off") {
		piArgs.push("--thinking", reviewerThinking);
	}
	piArgs.push(reviewPrompt);

	const result = spawnSync("pi", piArgs, {
		cwd: worktreePath || path.dirname(taskFolder),
		encoding: "utf-8",
		timeout: Number(process.env.SPINE_REVIEW_TIMEOUT_MS || 30 * 60 * 1000),
		env: {
			...process.env,
			SPINE_TASK_FOLDER: taskFolder,
			SPINE_WORKTREE: worktreePath,
		},
	});

	if (result.error?.code === "ETIMEDOUT") {
		return { spawnFailed: true, exitCode: 124, error: "reviewer spawn timed out" };
	}
	if (result.status !== 0) {
		return {
			spawnFailed: true,
			exitCode: result.status ?? 1,
			error: result.stderr?.trim() || `reviewer exited with code ${result.status ?? 1}`,
		};
	}
	return { spawnFailed: false, exitCode: 0, error: "" };
}

/**
 * @param {object} params
 */
export function runStepReview({
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

	const stepName = findStepName(taskFolder, stepNumber);
	const artifactPath = buildReviewArtifactPath(taskFolder, stepNumber);
	const reviewPrompt = buildReviewRequest({
		reviewType,
		stepNumber,
		stepName,
		taskFolder,
		worktreePath,
		outputPath: artifactPath,
		baseline,
		projectName,
	});

	journalReviewEvent("review.started", journal, {
		stepNumber,
		reviewType,
		reviewLevel,
		artifactPath,
	});

	const useStub =
		stub === true ||
		process.env.SPINE_REVIEW_STUB === "1" ||
		process.env.SPINE_REVIEW_STUB === "true" ||
		stubFail ||
		process.env.SPINE_REVIEW_STUB_FAIL === "1";

	if (useStub) {
		if (stubFail || process.env.SPINE_REVIEW_STUB_FAIL === "1") {
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

		const verdict = normalizeVerdict(stubVerdict) ?? "APPROVE";
		const feedback = verdict === "REVISE" ? "Stub reviewer requested changes." : "Stub reviewer approved.";
		writeStubReviewArtifact({
			artifactPath,
			reviewType,
			stepNumber,
			stepName,
			verdict,
			feedback,
		});

		const ok = verdict === "APPROVE";
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

	const systemPrompt = loadReviewerPrompt(worktreePath);
	const spawnResult = spawnReviewerPi({
		worktreePath,
		taskFolder,
		reviewPrompt,
		systemPrompt,
		config,
	});

	if (spawnResult.spawnFailed) {
		journalReviewEvent("review.failed", journal, {
			stepNumber,
			reviewType,
			reviewLevel,
			error: spawnResult.error,
			spawnFailed: true,
			exitCode: spawnResult.exitCode,
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
	const { verdict, feedback } = parseReviewVerdict(reviewContent);
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

	const ok = verdict === "APPROVE";
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
