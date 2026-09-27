/**
 * Journal event checksums and bounded jsonl append (extracted from journal.mjs
 * so the facade stays under the Phase 23 500 LOC cap).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Bounded retry policy for transient append failures (EBUSY/ENOENT). */
const APPEND_RETRY_ATTEMPTS = 3;
const APPEND_RETRY_DELAY_MS = 25;
const RETRYABLE_APPEND_CODES = new Set(["EBUSY", "ENOENT"]);

/**
 * Synchronous sleep for retry backoff. Atomics.wait is permitted on the Node
 * main thread (unlike browsers), so this works in the sync append path.
 * @param {number} ms
 */
function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * SHA-256 integrity checksum for new journal events. Computed over the
 * canonical JSON of the entry without the checksum field; the field is
 * appended last so JSON.parse preserves key order and readers can recompute
 * by stripping `checksum` and re-stringifying. Legacy lines without the
 * field remain valid.
 * @param {Record<string, unknown>} entry Entry without a checksum field.
 * @returns {string} Hex digest.
 */
export function computeJournalChecksum(entry) {
	return crypto.createHash("sha256").update(JSON.stringify(entry), "utf-8").digest("hex");
}

/**
 * Verify a parsed journal line's checksum when present.
 * @param {Record<string, unknown>} event
 * @returns {boolean} True when checksum is absent (legacy) or matches.
 */
export function verifyJournalChecksum(event) {
	if (!event || typeof event !== "object") return false;
	const { checksum, ...rest } = event;
	if (typeof checksum !== "string" || !checksum) return true;
	return computeJournalChecksum(rest) === checksum;
}

const NEWLINE_BYTE = 0x0a;

/**
 * Isolate a torn tail before appending: when a previous append was torn by a
 * crash or disk-full, the file can end mid-line without a trailing newline.
 * Writing a newline first keeps the torn fragment on its own line so the new
 * event stays parseable and the corruption stops propagating (SP-780).
 * @param {string} filePath
 */
function appendNewlineIfTornTail(filePath) {
	if (!fs.existsSync(filePath)) return;
	const stat = fs.statSync(filePath);
	if (stat.size === 0) return;
	const fd = fs.openSync(filePath, "r");
	try {
		const tail = Buffer.alloc(1);
		fs.readSync(fd, tail, 0, 1, stat.size - 1);
		if (tail[0] !== NEWLINE_BYTE) {
			fs.appendFileSync(filePath, "\n", "utf-8");
		}
	} finally {
		fs.closeSync(fd);
	}
}

/**
 * Append one jsonl line with fsync and bounded EBUSY/ENOENT retry.
 * Does not rewrite the journal file. In-process callers remain serialized
 * because this function is fully synchronous.
 * @param {string} filePath
 * @param {string} line
 */
export function appendJsonlLineSync(filePath, line) {
	let lastError;
	let appended = false;
	for (let attempt = 1; attempt <= APPEND_RETRY_ATTEMPTS; attempt += 1) {
		try {
			if (!appended) {
				fs.mkdirSync(path.dirname(filePath), { recursive: true });
				appendNewlineIfTornTail(filePath);
				fs.appendFileSync(filePath, line, "utf-8");
				appended = true;
			}

			const fd = fs.openSync(filePath, "r+");
			try {
				fs.fsyncSync(fd);
			} finally {
				fs.closeSync(fd);
			}
			return;
		} catch (error) {
			lastError = error;
			const code = error && /** @type {NodeJS.ErrnoException} */ (error).code;
			if (typeof code !== "string" || !RETRYABLE_APPEND_CODES.has(code) || attempt === APPEND_RETRY_ATTEMPTS) {
				throw error;
			}
			sleepSync(APPEND_RETRY_DELAY_MS);
		}
	}
	throw lastError;
}
