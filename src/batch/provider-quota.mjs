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
 * @property {string|null} providerCode z.ai `code` Kimi/Anthropic `error.type`, or Google `error.status` of the matched rule, when matched.
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
 * Matches the opening of an unprefixed provider error envelope: Google /
 * OpenAI style `{"error":{...}}` and Anthropic style `{"type":"error",...}`.
 * The key must be the object's first member so arbitrary objects embedded in
 * logs do not qualify.
 */
const BARE_ENVELOPE_PATTERN = /\{\s*"(?:error|type)"\s*:/g;

/** Anthropic SDK reports overload as HTTP 529; mid-stream SSE errors drop the prefix. */
const ANTHROPIC_OVERLOADED_STATUS = 529;

/**
 * Derives the HTTP status of an unprefixed provider envelope, or null when
 * the object is not a recognised provider error envelope (#351):
 * - `{"error":{"code":<3-digit>,...}}` (Google) → `error.code`.
 * - `{"type":"error","error":{"type":"overloaded_error",...}}` (Anthropic
 *   mid-stream SSE) → 529.
 *
 * @param {Record<string, any>} payload
 * @returns {number|null}
 */
function bareEnvelopeStatus(payload) {
	const error = payload.error && typeof payload.error === "object" ? payload.error : null;
	if (!error) return null;
	if (Number.isInteger(error.code) && error.code >= 100 && error.code <= 999) return error.code;
	if (payload.type === "error" && error.type === "overloaded_error") return ANTHROPIC_OVERLOADED_STATUS;
	return null;
}

/**
 * Collects every provider error JSON payload in the output, in order of
 * appearance: status-prefixed payloads (`429 {...}`) plus unprefixed
 * envelopes recognised by {@link bareEnvelopeStatus} (Google `ApiError`
 * text, Anthropic mid-stream SSE). A bare envelope nested inside a
 * status-prefixed payload is not collected separately. Fragments that do not
 * parse as JSON objects are ignored — they are not provider payloads.
 *
 * @param {string} output
 * @returns {{httpStatus: number, payload: Record<string, any>}[]}
 */
export function collectStatusPayloads(output) {
	const candidates = [];
	/** @type {{start: number, end: number}[]} */
	const prefixedRanges = [];
	STATUS_JSON_PATTERN.lastIndex = 0;
	let match;
	while ((match = STATUS_JSON_PATTERN.exec(output)) !== null) {
		const objectStart = match.index + match[0].length - 1;
		const raw = extractBalancedObject(output, objectStart);
		if (raw === null) continue;
		try {
			const payload = JSON.parse(raw);
			if (payload && typeof payload === "object" && !Array.isArray(payload)) {
				candidates.push({ httpStatus: Number(match[1]), payload, position: objectStart });
				prefixedRanges.push({ start: objectStart, end: objectStart + raw.length });
			}
		} catch {
			// Malformed JSON is not a provider payload; keep scanning.
		}
	}

	BARE_ENVELOPE_PATTERN.lastIndex = 0;
	while ((match = BARE_ENVELOPE_PATTERN.exec(output)) !== null) {
		const objectStart = match.index;
		if (prefixedRanges.some((range) => objectStart >= range.start && objectStart < range.end)) continue;
		const raw = extractBalancedObject(output, objectStart);
		if (raw === null) continue;
		// Skip nested objects of this envelope whether or not it is accepted.
		BARE_ENVELOPE_PATTERN.lastIndex = objectStart + raw.length;
		try {
			const payload = JSON.parse(raw);
			if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
			const httpStatus = bareEnvelopeStatus(payload);
			if (httpStatus !== null) candidates.push({ httpStatus, payload, position: objectStart });
		} catch {
			// Malformed JSON is not a provider payload; keep scanning.
		}
	}

	// "Last payload wins" must hold across both passes: order by position.
	candidates.sort((a, b) => a.position - b.position);
	return candidates.map(({ httpStatus, payload }) => ({ httpStatus, payload }));
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

/** Google retry hints below this many seconds mean a short (per-minute) window. */
const GOOGLE_TRANSIENT_RETRY_SECONDS = 120;

/**
 * Parses a Google `RetryInfo.retryDelay` duration string such as `"34s"` or
 * `"34.5s"` into seconds.
 *
 * @param {unknown} retryDelay
 * @returns {number|null} Seconds, or null when absent or unparseable.
 */
function parseRetryDelaySeconds(retryDelay) {
	if (typeof retryDelay !== "string") return null;
	const match = retryDelay.trim().match(/^(\d+(?:\.\d+)?)s$/);
	return match ? Number(match[1]) : null;
}

/**
 * Reads Google `error.details[]`: the `RetryInfo.retryDelay` string and
 * whether any `QuotaFailure.violations[].quotaId` names a per-minute quota.
 *
 * @param {unknown} details
 * @returns {{retryDelay: string|null, perMinute: boolean}}
 */
function readGoogleQuotaDetails(details) {
	let retryDelay = null;
	let perMinute = false;
	if (!Array.isArray(details)) return { retryDelay, perMinute };
	for (const detail of details) {
		if (!detail || typeof detail !== "object") continue;
		const type = typeof detail["@type"] === "string" ? detail["@type"] : "";
		if (type.endsWith("google.rpc.RetryInfo") && typeof detail.retryDelay === "string") {
			retryDelay = detail.retryDelay;
		} else if (type.endsWith("google.rpc.QuotaFailure") && Array.isArray(detail.violations)) {
			for (const violation of detail.violations) {
				if (typeof violation?.quotaId === "string" && violation.quotaId.includes("PerMinute")) perMinute = true;
			}
		}
	}
	return { retryDelay, perMinute };
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
 * - Google 429, `error.code` 429 + `error.status` "RESOURCE_EXHAUSTED" →
 *   transient_overload when a `QuotaFailure` quotaId contains "PerMinute" or
 *   `RetryInfo.retryDelay` < 120 s, else quota_exhausted (#351).
 * - Anthropic 529 (or unprefixed SSE) `overloaded_error` → transient_overload;
 *   429 `rate_limit_error` (not Kimi's "currently overloaded") →
 *   transient_overload; 400 `invalid_request_error` "credit balance is too
 *   low" → quota_exhausted (#351).
 *
 * @param {number} httpStatus
 * @param {Record<string, any>} payload
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

	// Google: `{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[...]}}`.
	if (httpStatus === 429 && error.code === 429 && error.status === "RESOURCE_EXHAUSTED") {
		const { retryDelay, perMinute } = readGoogleQuotaDetails(error.details);
		const retrySeconds = parseRetryDelaySeconds(retryDelay);
		const transient = perMinute || (retrySeconds !== null && retrySeconds < GOOGLE_TRANSIENT_RETRY_SECONDS);
		return {
			kind: transient ? "transient_overload" : "quota_exhausted",
			providerCode: "RESOURCE_EXHAUSTED",
			resetAtRaw: retryDelay !== null ? `retry in ${retryDelay}` : null,
			message: truncateMessage(errorMessage),
		};
	}

	// Anthropic: `{"type":"error","error":{"type":...,"message":...}}`.
	if (httpStatus === ANTHROPIC_OVERLOADED_STATUS && error.type === "overloaded_error") {
		return {
			kind: "transient_overload",
			providerCode: "overloaded_error",
			resetAtRaw: null,
			message: truncateMessage(errorMessage),
		};
	}
	if (httpStatus === 429 && error.type === "rate_limit_error") {
		// Kimi's "currently overloaded" wording is handled (first) above; any
		// other rate_limit_error is Anthropic's per-minute limit.
		return {
			kind: "transient_overload",
			providerCode: "rate_limit_error",
			resetAtRaw: null,
			message: truncateMessage(errorMessage),
		};
	}
	if (
		httpStatus === 400 &&
		error.type === "invalid_request_error" &&
		errorMessage.toLowerCase().includes("credit balance is too low")
	) {
		return {
			kind: "quota_exhausted",
			providerCode: "credit_balance_too_low",
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
		// Narrow null → undefined for resolvePoolId's optional string param; the
		// JSDoc accepts null from callers, and both map to pool "unknown".
		poolId: resolvePoolId(model ?? undefined),
		httpStatus: last.httpStatus,
		providerCode: classified.providerCode,
		resetAtRaw: classified.resetAtRaw,
		resetAt: null,
		message: classified.message,
	};
}
