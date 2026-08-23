// @ts-check
/**
 * Batch ID validation and uniquified generation (SP-714, issue #258).
 *
 * Batch IDs become directory names under `.spine/runtime/{batchId}` and are
 * also accepted from operators via CLI `--batch`. Validation is allowlist-based
 * so path traversal (`..`, `/`, `\`, NUL, empty, absolute paths) is rejected at
 * the CLI boundary before any `path.join`.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Allowlist pattern for batch IDs.
 *
 * The first character must be alphanumeric so `.`, `..`, and hidden relative
 * segments can never pass; the remainder permits `.`, `_`, and `-` for
 * backward compatibility with archived timestamp IDs (`YYYYMMDDTHHMMSS`) and
 * the uniquified `YYYYMMDDTHHMMSS-xxxx` form. Slashes, backslashes, colons,
 * and NUL are excluded, which also rejects absolute and UNC paths.
 */
export const BATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * @param {unknown} batchId
 * @returns {string|null} rejection reason, or null when the ID is valid
 */
export function batchIdRejectionReason(batchId) {
	if (typeof batchId !== "string" || batchId.length === 0) {
		return "must be a non-empty string";
	}
	if (batchId.includes("\0")) {
		return "must not contain NUL bytes";
	}
	if (!BATCH_ID_PATTERN.test(batchId)) {
		return (
			`must match ${BATCH_ID_PATTERN} ` +
			"(letters, digits, dot, underscore, dash; must start with a letter or digit; no path separators)"
		);
	}
	if (batchId.includes("..")) {
		return 'must not contain ".." path traversal sequences';
	}
	return null;
}

/**
 * @param {unknown} batchId
 * @returns {boolean}
 */
export function isValidBatchId(batchId) {
	return batchIdRejectionReason(batchId) === null;
}

/**
 * Assert a batch ID is safe to join under `.spine/runtime/`; throw otherwise.
 *
 * @param {unknown} batchId
 * @returns {string} the validated batch ID
 */
export function validateBatchId(batchId) {
	const reason = batchIdRejectionReason(batchId);
	if (reason) {
		throw new Error(`Invalid batch ID ${JSON.stringify(String(batchId))}: ${reason}`);
	}
	return /** @type {string} */ (batchId);
}

const MAX_UNIQUIFY_ATTEMPTS = 64;

/**
 * Generate a collision-resistant batch ID `{YYYYMMDD}T{HHmmss}-{hex4}` (UTC).
 *
 * The random 4-hex suffix keeps concurrent calls distinct; when `projectRoot`
 * is provided the loop also re-draws while `.spine/runtime/{id}` exists, so a
 * stale runtime/archive directory can never be reused.
 *
 * @param {Date} [now]
 * @param {string|null} [projectRoot] when set, loop until the runtime dir is absent
 * @param {(() => string)|null} [randomSuffix] injectable suffix source for tests
 * @returns {string}
 */
export function generateBatchId(now = new Date(), projectRoot = null, randomSuffix = null) {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	const d = String(now.getUTCDate()).padStart(2, "0");
	const h = String(now.getUTCHours()).padStart(2, "0");
	const min = String(now.getUTCMinutes()).padStart(2, "0");
	const s = String(now.getUTCSeconds()).padStart(2, "0");
	const base = `${y}${m}${d}T${h}${min}${s}`;
	const draw = randomSuffix ?? (() => crypto.randomBytes(2).toString("hex"));

	for (let attempt = 0; attempt < MAX_UNIQUIFY_ATTEMPTS; attempt += 1) {
		const id = `${base}-${draw()}`;
		if (!projectRoot) return id;
		if (!fs.existsSync(path.join(projectRoot, ".spine", "runtime", id))) return id;
	}
	throw new Error(
		`Unable to generate a unique batch ID after ${MAX_UNIQUIFY_ATTEMPTS} attempts`,
	);
}
