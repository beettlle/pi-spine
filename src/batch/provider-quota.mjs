/**
 * Pure classifier for provider quota exhaustion and transient overload in
 * worker output (SP-804, partial #329).
 *
 * The worker runner forwards pi's stderr/stdout on a non-zero exit
 * (`bin/spine-worker-runner.mjs`), so provider API error payloads end up
 * verbatim inside `workerResult.output`. This module recognizes the payload
 * shapes seen in retained `task.failed` events — Z.ai usage-limit JSON
 * (`{"code":"1308",...}`) and Kimi error envelopes
 * (`{"error":{"type":...}}`) — and reports the shared quota pool the model
 * belongs to. Matching depends only on the payload text, never on the model;
 * the model is used solely to resolve the pool id via `resolvePoolId`, so a
 * mislabelled model cannot fabricate or hide a quota signal.
 */
import { resolvePoolId } from "../metrics/quota-snapshot.mjs";

/**
 * @typedef {"quota_exhausted"|"transient_overload"} ProviderQuotaKind
 */

/**
 * @typedef {object} ProviderQuotaError
 * @property {ProviderQuotaKind} kind Why the output was classified.
 * @property {string} poolId Shared quota pool the model belongs to (`resolvePoolId`).
 * @property {number|null} httpStatus Three-digit HTTP status preceding the JSON payload, when present.
 * @property {string|null} providerCode z.ai `code` or Kimi `error.type` of the matched rule, when matched.
 * @property {string|null} resetAtRaw Raw text after "reset at" in the provider message (z.ai), when present.
 * @property {null} resetAt Always null for now: the z.ai reset text carries no timezone (UTC+8 is inferred, not confirmed — #329).
 * @property {string} message Provider message string, truncated to 300 characters.
 */

/** Provider messages can embed long URLs/pricing pitches; keep a bounded slice. */
const MAX_MESSAGE_LENGTH = 300;

/**
 * Matches a standalone three-digit HTTP status immediately followed —
 * optionally via `:` and/or whitespace — by a JSON object, exactly as
 * providers and pi print it, e.g. `429: {"code":"1308",...}` or
 * `403 {"error":{...}}`. The `\b` anchors keep multi-digit numbers
 * (timestamps, token counts) from matching.
 */
const STATUS_JSON_PATTERN = /\b(\d{3})\b\s*:?\s*\{/g;

/**
 * Truncates a provider message to {@link MAX_MESSAGE_LENGTH} characters.
 *
 * @param {string} message
 * @returns {string}
 */
function truncateMessage(message) {
	return message.length > MAX_MESSAGE_LENGTH ? message.slice(0, MAX_MESSAGE_LENGTH) : message;
}

/**
 * Extracts the substring of a balanced JSON object starting at `startIndex`
 * (which must point at `{`). Tracks string and escape state so braces inside
 * message text cannot truncate the payload.
 *
 * @param {string} text
 * @param {number} startIndex
 * @returns {string|null} The object substring, or null when unbalanced.
 */
function extractBalancedObject(text, startIndex) {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = startIndex; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return text.slice(startIndex, i + 1);
		}
	}
	return null;
}

/**
 * Collects every status-prefixed JSON payload in the output, in order of
 * appearance. Fragments that do not parse as JSON objects are ignored — they
 * are not provider payloads.
 *
 * @param {string} output
 * @returns {{httpStatus: number, payload: object}[]}
 */
function collectStatusPayloads(output) {
	const candidates = [];
	STATUS_JSON_PATTERN.lastIndex = 0;
	let match;
	while ((match = STATUS_JSON_PATTERN.exec(output)) !== null) {
		const objectStart = match.index + match[0].length - 1;
		const raw = extractBalancedObject(output, objectStart);
		if (raw === null) continue;
		try {
			const payload = JSON.parse(raw);
			if (payload && typeof payload === "object" && !Array.isArray(payload)) {
				candidates.push({ httpStatus: Number(match[1]), payload });
			}
		} catch {
			// Malformed JSON is not a provider payload; keep scanning.
		}
	}
	return candidates;
}

/**
 * Extracts the raw text following "reset at" in a z.ai usage-limit message.
 * The timestamp carries no timezone, so it is kept verbatim; parsing it into
 * a Date would require guessing UTC+8 (#329).
 *
 * @param {string} message
 * @returns {string|null}
 */
function extractResetAtRaw(message) {
	const match = message.match(/reset at\s+(.+)$/i);
	if (!match) return null;
	return match[1].trim().replace(/[.!]+$/, "");
}

/**
 * Applies the classification rules to a single payload. The HTTP status is
 * part of every rule so unrelated 4xx/5xx output never matches; a payload
 * that matches no rule returns null rather than a best guess.
 *
 * Rules (#329):
 * - z.ai 429, top-level `code` "1308" (5-hour window) or "1310"
 *   (weekly/monthly) → quota_exhausted.
 * - Kimi 403, `error.type` "permission_error", message mentions
 *   "usage limit" (billing-cycle exhaustion) → quota_exhausted.
 * - Kimi 429, `error.type` "rate_limit_error", message mentions
 *   "currently overloaded" → transient_overload.
 *
 * @param {number} httpStatus
 * @param {object} payload
 * @returns {{kind: ProviderQuotaKind, providerCode: string, resetAtRaw: string|null, message: string}|null}
 */
function classifyPayload(httpStatus, payload) {
	// Z.ai usage limits: flat `{"code":"1308","message":"..."}` right after the status.
	if (httpStatus === 429 && typeof payload.code === "string" && typeof payload.message === "string") {
		if (payload.code !== "1308" && payload.code !== "1310") return null;
		return {
			kind: "quota_exhausted",
			providerCode: payload.code,
			resetAtRaw: extractResetAtRaw(payload.message),
			message: truncateMessage(payload.message),
		};
	}

	// Kimi: nested error envelope `{"error":{"type":...,"message":...}}`.
	const error = payload.error && typeof payload.error === "object" ? payload.error : null;
	const errorMessage = typeof error?.message === "string" ? error.message : null;
	if (!error || errorMessage === null) return null;

	if (
		httpStatus === 403 &&
		error.type === "permission_error" &&
		errorMessage.toLowerCase().includes("usage limit")
	) {
		return {
			kind: "quota_exhausted",
			providerCode: "permission_error",
			resetAtRaw: null,
			message: truncateMessage(errorMessage),
		};
	}
	if (
		httpStatus === 429 &&
		error.type === "rate_limit_error" &&
		errorMessage.toLowerCase().includes("currently overloaded")
	) {
		return {
			kind: "transient_overload",
			providerCode: "rate_limit_error",
			resetAtRaw: null,
			message: truncateMessage(errorMessage),
		};
	}
	return null;
}

/**
 * Classifies provider quota exhaustion / transient overload in raw worker
 * output. Pure: no I/O, no clocks, no configuration reads. When several
 * status-prefixed payloads appear, the last one is classified — it is the
 * terminal error the worker actually died on — and if it matches no rule the
 * result is null even when an earlier payload would have matched.
 *
 * @param {string|null|undefined} output Forwarded worker stderr/stdout.
 * @param {string|null|undefined} [model] Model identifier used only for the pool id.
 * @returns {ProviderQuotaError|null}
 */
export function classifyProviderQuotaError(output, model) {
	if (typeof output !== "string" || !output) return null;

	const candidates = collectStatusPayloads(output);
	const last = candidates.length > 0 ? candidates[candidates.length - 1] : null;
	if (!last) return null;

	const classified = classifyPayload(last.httpStatus, last.payload);
	if (!classified) return null;

	return {
		kind: classified.kind,
		poolId: resolvePoolId(model),
		httpStatus: last.httpStatus,
		providerCode: classified.providerCode,
		resetAtRaw: classified.resetAtRaw,
		resetAt: null,
		message: classified.message,
	};
}
