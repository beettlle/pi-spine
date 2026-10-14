/**
 * Pure classifier for provider request errors in reviewer output
 * (SP-820, partial #334).
 *
 * When the reviewer's model provider rejects the request — Gemini HTTP 400
 * `INVALID_ARGUMENT` ("Function call is missing a thought_signature") or a
 * `MALFORMED_FUNCTION_CALL` finish reason — the reviewer exits non-zero, or
 * exits 0 without writing the review artifact. Both used to collapse into the
 * generic `${reviewType}_review_spawn_failed` exit reason, indistinguishable
 * from a missing `pi` binary or an empty model turn. This module recognizes
 * the provider payload shapes and reports the provider's message so the
 * journal records *why* the reviewer died.
 *
 * Quota exhaustion (HTTP 429 / z.ai `1308` / Kimi usage limits) keeps its own
 * path: `classifyReviewerProviderError` returns null whenever
 * `classifyProviderQuotaError` matches, so quota output is never relabelled.
 */
import {
	classifyProviderQuotaError,
	collectStatusPayloads,
} from "./provider-quota.mjs";

/** `reason` carried by the `review.failed` payload and the review result. */
export const REVIEW_PROVIDER_ERROR_REASON = "review_provider_error";

/** Provider messages can embed long request dumps; keep a bounded slice. */
const MAX_PROVIDER_MESSAGE_LENGTH = 500;

/**
 * Markers that identify a provider request error even without a
 * status-prefixed JSON payload (plain-text stdout/stderr from pi, or a
 * finishReason inside a larger JSON chunk).
 */
const PROVIDER_ERROR_MARKERS = [
	"INVALID_ARGUMENT",
	"thought_signature",
	"MALFORMED_FUNCTION_CALL",
];

/**
 * @param {string} message
 * @returns {string}
 */
function truncateProviderMessage(message) {
	return message.length > MAX_PROVIDER_MESSAGE_LENGTH
		? message.slice(0, MAX_PROVIDER_MESSAGE_LENGTH)
		: message;
}

/**
 * Extracts the provider's message text from a parsed status payload:
 * nested `error.message` (Gemini/Kimi envelope) or flat `message` (z.ai).
 *
 * @param {Record<string, any>} payload
 * @returns {string|null}
 */
function payloadProviderMessage(payload) {
	const error = payload?.error && typeof payload.error === "object" ? payload.error : null;
	if (typeof error?.message === "string" && error.message.trim()) return error.message.trim();
	if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim();
	return null;
}

/**
 * Finds the first output line containing a provider error marker, trimmed
 * and capped — the provider message for marker-only matches.
 *
 * @param {string} output
 * @returns {string|null}
 */
function markerLine(output) {
	for (const line of output.split("\n")) {
		if (PROVIDER_ERROR_MARKERS.some((marker) => line.includes(marker))) {
			return truncateProviderMessage(line.trim());
		}
	}
	return null;
}

/**
 * Classifies a provider request error in raw reviewer output. Pure: no I/O,
 * no clocks, no configuration reads.
 *
 * Match rules (SP-820 / #334):
 * - any status-prefixed JSON payload with an HTTP 4xx status other than
 *   408 (request timeout) and 429 (rate limit — quota's own path), or
 * - any of the markers `INVALID_ARGUMENT`, `thought_signature`,
 *   `MALFORMED_FUNCTION_CALL` anywhere in the output.
 *
 * Returns null when `classifyProviderQuotaError(output)` matches (quota
 * keeps its own handling), and for empty or non-string input. When several
 * payloads qualify, the last one is classified — it is the terminal error
 * the reviewer actually died on.
 *
 * @param {string|null|undefined} output Reviewer error text / redacted output tails.
 * @returns {{ httpStatus: number|null, providerMessage: string }|null}
 */
export function classifyReviewerProviderError(output) {
	if (typeof output !== "string" || !output) return null;
	if (classifyProviderQuotaError(output)) return null;

	const payloads = collectStatusPayloads(output);
	for (let i = payloads.length - 1; i >= 0; i--) {
		const { httpStatus, payload } = payloads[i];
		if (httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429) {
			return {
				httpStatus,
				providerMessage: truncateProviderMessage(
					payloadProviderMessage(payload) ?? markerLine(output) ?? JSON.stringify(payload),
				),
			};
		}
	}

	const marker = markerLine(output);
	if (marker) return { httpStatus: null, providerMessage: marker };
	return null;
}

/**
 * SP-820 fields added to the `review.failed` payload and the returned review
 * result when the terminal attempt matched the classifier. Empty for generic
 * failures, quota payloads (their own path), and timeouts.
 *
 * @param {{ httpStatus: number|null, providerMessage: string }|null} providerError
 * @returns {Record<string, any>}
 */
export function providerErrorFields(providerError) {
	if (!providerError) return {};
	return {
		reason: REVIEW_PROVIDER_ERROR_REASON,
		providerMessage: providerError.providerMessage,
		...(typeof providerError.httpStatus === "number" ? { httpStatus: providerError.httpStatus } : {}),
	};
}

/**
 * Runs the classifier over a reviewer spawn attempt's error text and redacted
 * output tails, joined in failure-order (error, stderr, stdout). Quota
 * payloads anywhere in the combined text keep the generic path.
 *
 * @param {{ error?: string, stderrTail?: string, stdoutTail?: string }|null|undefined} spawnResult
 * @returns {{ httpStatus: number|null, providerMessage: string }|null}
 */
export function classifyReviewerSpawnFailure(spawnResult) {
	const combined = [spawnResult?.error, spawnResult?.stderrTail, spawnResult?.stdoutTail]
		.filter((part) => typeof part === "string" && part)
		.join("\n");
	return classifyReviewerProviderError(combined);
}
