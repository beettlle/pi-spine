/**
 * Worker `.DONE` marker parse/write and backgrounded-verification detection (#276).
 * Extracted from worker-output.mjs so that module stays under the LOC cap.
 */

import fs from "node:fs";
import { writeJsonAtomic } from "../fs/atomic-write.mjs";

/**
 * Targeted `worker_done_missing` hint for backgrounded verifications (SP-741, #276).
 * A worker that exits while a long verification is still running (waiting on a
 * completion wake) cannot be resumed — the session dies with the turn.
 */
export const BACKGROUND_VERIFICATION_HINT =
	"backgrounded verification detected — long verifications must run in the foreground and finish in-session before .DONE";

/** Output phrases that on their own indicate background-and-exit behavior. */
const BACKGROUND_VERIFICATION_STRONG_MARKERS = [
	"completion wake",
	"running in the background",
	"background monitor",
	"backgrounded",
	"monitorcreate",
];

/** Output phrases indicating a verification has not finished yet. */
const BACKGROUND_VERIFICATION_PENDING_MARKERS = [
	"still running",
	"still in progress",
	"not finished",
	"hasn't finished",
	"has not finished",
];

/** Phrases that pair with pending work to indicate it was detached/backgrounded. */
const BACKGROUND_VERIFICATION_CONTEXT_MARKERS = [
	"background",
	"wake",
	"monitor",
	"redirected",
	"detached",
];

/**
 * Detect worker output suggesting a long verification was backgrounded instead
 * of run in the foreground (#276). Matched against the captured output tail
 * at `worker_done_missing` diagnosis time; advisory only.
 *
 * @param {string|null|undefined} outputText
 * @returns {boolean}
 */
export function detectBackgroundedVerification(outputText) {
	if (!outputText || !String(outputText).trim()) return false;
	const normalized = String(outputText).toLowerCase();
	if (BACKGROUND_VERIFICATION_STRONG_MARKERS.some((marker) => normalized.includes(marker))) {
		return true;
	}
	const hasPending = BACKGROUND_VERIFICATION_PENDING_MARKERS.some((marker) =>
		normalized.includes(marker),
	);
	if (!hasPending) return false;
	return BACKGROUND_VERIFICATION_CONTEXT_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Parse a `.DONE` marker body. Legacy empty/text markers remain valid (SP-321).
 *
 * @param {string} content
 */
export function parseWorkerDoneMarker(content) {
	const trimmed = String(content ?? "").trim();
	if (!trimmed) {
		return { valid: true, legacy: true, kind: "empty" };
	}

	if (trimmed.startsWith("{")) {
		try {
			const data = JSON.parse(trimmed);
			if (
				typeof data?.taskId === "string" &&
				data.taskId.length > 0 &&
				typeof data?.completedAt === "string" &&
				data.completedAt.length > 0
			) {
				return {
					valid: true,
					legacy: false,
					kind: "json",
					taskId: data.taskId,
					completedAt: data.completedAt,
				};
			}
			return { valid: false, legacy: false, kind: "json_partial", reason: "missing_fields" };
		} catch {
			return { valid: false, legacy: false, kind: "json_partial", reason: "parse_error" };
		}
	}

	return { valid: true, legacy: true, kind: "text" };
}

/**
 * @param {string} content
 */
export function isWorkerDoneMarkerValid(content) {
	return parseWorkerDoneMarker(content).valid;
}

/**
 * @param {string} donePath
 */
export function readWorkerDoneMarker(donePath) {
	if (!fs.existsSync(donePath)) {
		return { present: false, valid: false };
	}
	const parsed = parseWorkerDoneMarker(fs.readFileSync(donePath, "utf-8"));
	return { present: true, ...parsed };
}

/**
 * Atomically write a structured `.DONE` marker for engine validation.
 *
 * @param {string} donePath
 * @param {{ taskId: string }} params
 */
export function writeWorkerDoneMarker(donePath, { taskId }) {
	writeJsonAtomic(donePath, {
		taskId,
		completedAt: new Date().toISOString(),
	});
}
