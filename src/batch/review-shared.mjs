// @ts-nocheck
/**
 * Pure review helpers shared by `review.mjs` and `engine-lanes/review.mjs`.
 * SP-265 extraction target; SP-266 wires imports.
 */

import path from "node:path";
import { REVIEW_DEFAULTS } from "../config/defaults.mjs";

export const REVIEW_LEVEL_RE = /^##\s+Review Level:\s*(\d+)/m;

/**
 * @param {string} markdown
 */
export function parseReviewLevel(markdown) {
	const match = REVIEW_LEVEL_RE.exec(markdown);
	return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * @param {number} reviewLevel
 * @param {"plan"|"code"|"final"} reviewType
 */
export function isReviewTypeRequired(reviewLevel, reviewType) {
	if (reviewLevel <= 0) return false;
	if (reviewType === "final") return reviewLevel >= 1;
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
 * @param {string} taskFolder
 * @param {Date} [date]
 */
export function buildFinalReviewArtifactPath(taskFolder, date = new Date()) {
	return path.join(taskFolder, ".reviews", `final-${formatReviewTimestamp(date)}.md`);
}

/**
 * @param {unknown} value
 * @param {"plan"|"code"|"final"} [reviewType]
 * @returns {"APPROVE"|"REVISE"|"PASS"|"REPLAN"|null}
 */
export function normalizeVerdict(value, reviewType = "code") {
	if (typeof value !== "string") return null;
	const upper = value.trim().toUpperCase();
	if (reviewType === "final") {
		return upper === "PASS" || upper === "REVISE" || upper === "REPLAN" ? upper : null;
	}
	return upper === "APPROVE" || upper === "REVISE" ? upper : null;
}

/**
 * @param {unknown} value
 * @returns {"PASS"|"REVISE"|"REPLAN"|null}
 */
export function normalizeFinalVerdict(value) {
	return normalizeVerdict(value, "final");
}

/**
 * @param {unknown} value
 * @returns {"APPROVE"|"REVISE"|null}
 */
export function normalizeCodeVerdict(value) {
	return normalizeVerdict(value, "code");
}

/**
 * @param {string} reviewContent
 */
function extractSummary(reviewContent) {
	const summaryMatch = reviewContent.match(/###?\s*Summary[:\s]*([\s\S]*?)(?=###|$)/i);
	return summaryMatch ? summaryMatch[1].trim().slice(0, 500) : "";
}

/**
 * @param {string} reviewContent
 * @param {{ reviewType?: "plan"|"code"|"final" }} [options]
 * @returns {{ verdict: "APPROVE"|"REVISE"|"PASS"|"REPLAN"|null, feedback: string }}
 */
export function parseReviewVerdict(reviewContent, options = {}) {
	const reviewType = options.reviewType ?? "code";
	const isFinal = reviewType === "final";

	const jsonMatch = reviewContent.match(/```json\s*\n([\s\S]*?)\n```/i);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			const verdict = normalizeVerdict(parsed.verdict, reviewType);
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

	const headingPattern = isFinal
		? /###?\s*Verdict[:\s]*(PASS|REVISE|REPLAN)/i
		: /###?\s*Verdict[:\s]*(APPROVE|REVISE)/i;
	const headingMatch = reviewContent.match(headingPattern);
	if (headingMatch) {
		return {
			verdict: normalizeVerdict(headingMatch[1], reviewType),
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
	if (isFinal && (lower.includes("replan") || lower.includes("re-plan"))) {
		return { verdict: "REPLAN", feedback: extractSummary(reviewContent) };
	}
	if (isFinal && lower.includes("pass") && !lower.includes("cannot pass") && !lower.includes("do not pass")) {
		return { verdict: "PASS", feedback: extractSummary(reviewContent) };
	}
	if (lower.includes("approve") && !lower.includes("do not approve") && !lower.includes("cannot approve")) {
		return { verdict: "APPROVE", feedback: extractSummary(reviewContent) };
	}

	return { verdict: null, feedback: extractSummary(reviewContent) };
}

/**
 * Engine-lane final verdict parser (heading feedback omitted; no heuristic fallbacks).
 *
 * @param {string} reviewContent
 * @returns {{ verdict: "PASS"|"REVISE"|"REPLAN"|null, feedback: string }}
 */
export function parseFinalReviewVerdict(reviewContent) {
	const jsonMatch = reviewContent.match(/```json\s*\n([\s\S]*?)\n```/i);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			const verdict = normalizeFinalVerdict(parsed.verdict);
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

	const headingMatch = reviewContent.match(/###?\s*Verdict[:\s]*(PASS|REVISE|REPLAN)/i);
	if (headingMatch) {
		return {
			verdict: normalizeFinalVerdict(headingMatch[1]),
			feedback: "",
		};
	}

	return { verdict: null, feedback: "" };
}

/**
 * @param {object} params
 */
export function shouldRunCodeReview({ reviewLevel }) {
	return reviewLevel >= 2;
}

/**
 * @param {object} params
 */
export function shouldRunFinalReview({ config, reviewLevel }) {
	const requireFinal = config?.review?.requireFinalVerdict ?? REVIEW_DEFAULTS.requireFinalVerdict;
	return requireFinal && reviewLevel >= 1;
}
