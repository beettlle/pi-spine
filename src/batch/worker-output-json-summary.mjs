/**
 * Compact `--mode json` failure summaries for `task.failed` journals (SP-882 / #381).
 *
 * Extracted from worker-output.mjs so that module stays under the LOC cap.
 */

import { extractTextFromPiJsonStream } from "./pi-json-usage.mjs";

/** Soft cap for journaled failure summaries (well under MAX_PAYLOAD_BYTES). */
const JSON_FAILURE_SUMMARY_MAX_CHARS = 6_000;

/**
 * True when stdout looks like a `pi --mode json` NDJSON event stream.
 * Used so failure journals can summarize instead of dumping the system prompt.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function looksLikePiJsonNdjson(text) {
	if (!text || typeof text !== "string") return false;
	const head = text.slice(0, 4096);
	return (
		head.includes('"type":"session"') ||
		head.includes('"type": "session"') ||
		head.includes('"type":"message_start"') ||
		head.includes('"type": "message_start"') ||
		head.includes('"type":"agent_start"') ||
		head.includes('"type": "agent_start"')
	);
}

/**
 * Compact failure summary for `task.failed` when workers use `--mode json`.
 * Full NDJSON remains on disk via worker-output logs; journals get exit signal
 * + assistant/error text only (SP-882 / #381).
 *
 * @param {string} rawOutput
 * @param {{ exitCode?: number | null, classification?: string, logRef?: string | null }} [meta]
 * @returns {string}
 */
export function summarizePiJsonFailureOutput(rawOutput, meta = {}) {
	const exitCode = meta.exitCode;
	const classification = meta.classification ?? "failed";
	const logRef = meta.logRef ?? null;

	/** @type {string[]} */
	const errorBits = [];
	for (const line of String(rawOutput).split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			const event = JSON.parse(line);
			if (event?.type === "error") {
				const msg =
					typeof event.error === "string"
						? event.error
						: typeof event.message === "string"
							? event.message
							: JSON.stringify(event.error ?? event).slice(0, 400);
				if (msg) errorBits.push(msg);
			}
		} catch {
			// non-JSON line — ignore for summary
		}
	}

	let assistantText = "";
	try {
		assistantText = extractTextFromPiJsonStream(rawOutput).join("\n").trim();
	} catch {
		assistantText = "";
	}

	const parts = [
		`pi --mode json failure: classification=${classification}` +
			(exitCode != null ? ` exitCode=${exitCode}` : ""),
	];
	if (errorBits.length > 0) {
		parts.push(`errors: ${errorBits.slice(0, 5).join(" | ")}`);
	}
	if (assistantText) {
		const clipped =
			assistantText.length > JSON_FAILURE_SUMMARY_MAX_CHARS
				? `${assistantText.slice(0, JSON_FAILURE_SUMMARY_MAX_CHARS)}\n…[assistant text truncated]`
				: assistantText;
		parts.push(`assistant:\n${clipped}`);
	} else if (errorBits.length === 0) {
		parts.push(
			"no assistant text or error events in stream (often SIGTERM/early exit after system prompt)",
		);
	}
	if (logRef) {
		parts.push(`fullLog: ${logRef}`);
	}
	return parts.join("\n");
}
