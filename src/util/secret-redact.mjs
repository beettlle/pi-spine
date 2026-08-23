/**
 * Unified secret redaction policy shared across journal, worker-output,
 * handoff, and metrics channels (SP-716, closes #260).
 *
 * Two complementary mechanisms:
 *   1. Key denylist — object keys matching REDACT_KEY_PATTERN have their
 *      values replaced wholesale (see redactSecretsDeep).
 *   2. Value patterns — well-known secret shapes (sk-, ghp_, bearer headers,
 *      connection strings, ENV-style assignments) are masked inside free
 *      text (see redactTextSecrets).
 */

export const REDACTED = "[REDACTED]";

/**
 * Keys whose values are always redacted, matched case-insensitively.
 * Must stay non-global: it is used with RegExp.prototype.test, which is
 * stateful for global regexes.
 */
export const REDACT_KEY_PATTERN = /key|token|secret|password/i;

/**
 * Value-shaped secret patterns, ordered most-specific first so that
 * assignment-shaped matches (e.g. OPENAI_API_KEY=sk-...) are consumed whole
 * before the generic key:value fallback can leave partial fragments behind.
 *
 * Safety: these regexes carry the global flag and are only safe to use with
 * String.prototype.replace, which resets lastIndex before iterating. Do not
 * use them with .test() or .exec().
 */
export const SECRET_VALUE_PATTERNS = Object.freeze([
	// ENV-style assignments: OPENAI_API_KEY=..., GITHUB_TOKEN = ...
	/\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*\S+/g,
	// Bearer authorization headers.
	/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
	// Database connection strings embed credentials.
	/(?:postgres|mysql|mongodb)(?:\+srv)?:\/\/[^\s]+/gi,
	/\bDATABASE_URL=\S+/gi,
	// Well-known token shapes.
	/\bsk-[A-Za-z0-9_-]{8,}/g,
	/\bghp_[A-Za-z0-9]{8,}/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,}/g,
	/\bAKIA[0-9A-Z]{16}/g,
	/\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
	// Generic key:value / key=value fallback.
	/\b(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi,
]);

/**
 * Mask value-shaped secrets in free text. Extra caller-supplied patterns
 * (e.g. workerOutputDenyPatterns from config) run after the builtin set.
 *
 * @param {unknown} text
 * @param {RegExp[]} [extraPatterns]
 * @returns {unknown}
 */
export function redactTextSecrets(text, extraPatterns = []) {
	if (typeof text !== "string" || !text) return text;
	let out = text;
	for (const pattern of SECRET_VALUE_PATTERNS) {
		out = out.replace(pattern, REDACTED);
	}
	for (const pattern of extraPatterns) {
		out = out.replace(pattern, REDACTED);
	}
	return out;
}

/**
 * Recursively redact secrets in a JSON-shaped value:
 *   - object keys matching the key denylist are replaced wholesale,
 *   - string values are scanned for value-shaped secrets,
 *   - arrays and nested objects are traversed.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {RegExp} [options.keyPattern] Override key denylist (must be
 *   non-global; RegExp.prototype.test is stateful for global regexes).
 * @param {Set<string>} [options.allowedKeys] Keys exempt from the denylist
 *   (e.g. usage counters like tokensIn).
 * @param {RegExp[]} [options.extraPatterns] Additional value patterns.
 * @returns {unknown}
 */
export function redactSecretsDeep(value, options = {}) {
	const keyPattern = options.keyPattern ?? REDACT_KEY_PATTERN;
	const allowedKeys = options.allowedKeys ?? null;
	const extraPatterns = Array.isArray(options.extraPatterns) ? options.extraPatterns : [];

	if (typeof value === "string") {
		return redactTextSecrets(value, extraPatterns);
	}
	if (value == null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => redactSecretsDeep(entry, options));
	}

	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [key, entry] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
		if (keyPattern.test(key) && !(allowedKeys && allowedKeys.has(key))) {
			out[key] = REDACTED;
		} else {
			out[key] = redactSecretsDeep(entry, options);
		}
	}
	return out;
}

/**
 * Cap a JSON-serializable payload by UTF-8 bytes — not string length — so
 * multi-byte characters cannot push the serialized record past the budget.
 * Returns the payload unchanged when it already fits; otherwise returns a
 * truncation marker record whose preview is sliced on byte boundaries.
 *
 * @param {Record<string, unknown>} payload
 * @param {number} maxBytes
 * @returns {Record<string, unknown>}
 */
export function capPayloadBytes(payload, maxBytes) {
	const serialized = JSON.stringify(payload);
	const originalBytes = Buffer.byteLength(serialized, "utf-8");
	if (originalBytes <= maxBytes) {
		return payload;
	}

	// Reserve 256 bytes of headroom for the truncation wrapper so the
	// re-serialized record stays near maxBytes. Buffer.subarray slices on byte
	// boundaries; decoding never emits invalid UTF-8 (partial trailing
	// sequences become U+FFFD).
	const budget = Math.max(0, maxBytes - 256);
	const preview = Buffer.from(serialized, "utf-8").subarray(0, budget).toString("utf-8");
	return {
		_truncated: true,
		_originalBytes: originalBytes,
		_maxBytes: maxBytes,
		preview,
	};
}
