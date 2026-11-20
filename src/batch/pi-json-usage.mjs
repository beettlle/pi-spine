/**
 * Pure parser for `pi --mode json` NDJSON streams (SP-878, partial #338).
 *
 * Sums provider-reported token usage and cost from a pi JSON event stream so
 * worker/reviewer producers (SP-879 / SP-880) can tee real usage into
 * run-metrics instead of discarding it. This module performs no I/O and never
 * invents values: usage keys are omitted from the result when pi reports none.
 *
 * Event shapes follow pi 1.5.2 `docs/json.md` and `docs/message-types.md`:
 *
 * - `message_end` — `message.usage` is the authoritative final usage for one
 *   assistant message. This is the primary counting source.
 * - `message_update` — carries a cumulative top-level `usage` for the
 *   in-flight response; deliberately NOT summed (it would double-count every
 *   message that later reaches `message_end`). A stream truncated before any
 *   `message_end` therefore under-counts rather than over-counts.
 * - `compaction_end` — `result.usage` on successful compaction (absent when
 *   aborted/failed).
 * - `tool_execution_end` — `result.usage` when a tool performed nested model
 *   work. pi docs confirm this is not part of the main model-call usage, so
 *   summing it adds real spend without double-counting.
 *
 * `Usage` shape: `{ input, output, cacheRead, cacheWrite, cacheWrite1h?,
 * reasoning?, totalTokens, cost: { input, output, cacheRead, cacheWrite,
 * total } }`. Per pi docs `reasoning` is already included in `output` and
 * `cacheWrite1h` is a subset of `cacheWrite`, so neither is added again:
 * `tokensIn = input + cacheRead + cacheWrite`, `tokensOut = output`.
 */

/**
 * Summed usage totals. Fields are present only when pi reported at least one
 * finite value for them; reported zeros are kept (they are real reports).
 *
 * @typedef {object} PiJsonUsageTotals
 * @property {number} [tokensIn] input + cacheRead + cacheWrite tokens.
 * @property {number} [tokensOut] output tokens (`reasoning` already included).
 * @property {number} [estimatedUsd] sum of provider-reported `cost.total`.
 */

/**
 * @typedef {{ type?: unknown, [key: string]: unknown }} PiJsonEvent
 */

/** @typedef {string | readonly string[] | Iterable<string>} PiJsonStreamInput */

/**
 * Validate one usage counter. Finite non-negative numbers are accepted as-is
 * (including `0`); `NaN`, `Infinity`, negatives, and non-numbers are treated
 * as absent so garbage cannot invent usage.
 *
 * @param {unknown} value
 * @returns {number | undefined}
 */
function finiteCount(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Normalize stream input into individual JSONL records. Strings split on LF
 * (pi framing: strict JSONL, optional preceding CR); iterables of strings are
 * treated as records and split further if they embed newlines.
 *
 * @param {PiJsonStreamInput} input
 * @yields {string}
 */
function* iterRecords(input) {
	if (typeof input === "string") {
		for (const record of input.split("\n")) {
			yield record;
		}
		return;
	}
	for (const record of input) {
		if (typeof record !== "string") {
			throw new TypeError("pi-json-usage: stream records must be strings");
		}
		if (record.includes("\n")) {
			for (const part of record.split("\n")) {
				yield part;
			}
		} else {
			yield record;
		}
	}
}

/**
 * Parse a pi JSON stream into event objects. Non-JSON and non-object records
 * are skipped (pi writes strict JSONL; leniency here only ignores noise, it
 * never fabricates usage).
 *
 * @param {PiJsonStreamInput} input
 * @yields {PiJsonEvent}
 */
function* iterEvents(input) {
	for (const record of iterRecords(input)) {
		const trimmed = record.endsWith("\r") ? record.slice(0, -1) : record;
		if (trimmed.trim().length === 0) continue;
		let parsed;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (parsed === null || typeof parsed !== "object") continue;
		yield /** @type {PiJsonEvent} */ (parsed);
	}
}

/**
 * Accumulate one pi `Usage` object into the running totals.
 *
 * @param {unknown} usage
 * @param {{ tokensIn: number, tokensOut: number, estimatedUsd: number, sawTokensIn: boolean, sawTokensOut: boolean, sawUsd: boolean }} totals
 */
function accumulateUsage(usage, totals) {
	if (usage === null || typeof usage !== "object") return;
	const input = finiteCount(/** @type {any} */ (usage).input);
	const cacheRead = finiteCount(/** @type {any} */ (usage).cacheRead);
	const cacheWrite = finiteCount(/** @type {any} */ (usage).cacheWrite);
	const output = finiteCount(/** @type {any} */ (usage).output);
	if (input !== undefined || cacheRead !== undefined || cacheWrite !== undefined) {
		totals.tokensIn += (input ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
		totals.sawTokensIn = true;
	}
	if (output !== undefined) {
		totals.tokensOut += output;
		totals.sawTokensOut = true;
	}
	const cost = /** @type {any} */ (usage).cost;
	if (cost !== null && typeof cost === "object") {
		const costTotal = finiteCount(cost.total);
		if (costTotal !== undefined) {
			totals.estimatedUsd += costTotal;
			totals.sawUsd = true;
		}
	}
}

/**
 * @param {PiJsonEvent} event
 * @param {{ tokensIn: number, tokensOut: number, estimatedUsd: number, sawTokensIn: boolean, sawTokensOut: boolean, sawUsd: boolean }} totals
 */
function accumulateEvent(event, totals) {
	const type = event.type;
	if (type === "message_end") {
		const message = event.message;
		if (message !== null && typeof message === "object" && /** @type {any} */ (message).role === "assistant") {
			accumulateUsage(/** @type {any} */ (message).usage, totals);
		}
		return;
	}
	if (type === "compaction_end") {
		const result = event.result;
		if (result !== null && typeof result === "object") {
			accumulateUsage(/** @type {any} */ (result).usage, totals);
		}
		return;
	}
	if (type === "tool_execution_end") {
		const result = event.result;
		if (result !== null && typeof result === "object") {
			accumulateUsage(/** @type {any} */ (result).usage, totals);
		}
		return;
	}
}

/**
 * Sum usage from a `pi --mode json` (JSONL) stream.
 *
 * Only authoritative events are counted (`message_end` assistant usage,
 * successful `compaction_end` usage, `tool_execution_end` nested usage), so
 * totals never double-count streaming `message_update` snapshots. Keys are
 * omitted when pi reported nothing — never invent costs.
 *
 * @param {PiJsonStreamInput} input Whole NDJSON text, an array of records, or any iterable of record strings.
 * @returns {PiJsonUsageTotals}
 * @throws {TypeError} when input is not a string/iterable or records are not strings.
 */
export function sumUsageFromPiJsonStream(input) {
	if (typeof input !== "string" && (input === null || typeof input !== "object")) {
		throw new TypeError("pi-json-usage: input must be a string or an iterable of strings");
	}
	const totals = {
		tokensIn: 0,
		tokensOut: 0,
		estimatedUsd: 0,
		sawTokensIn: false,
		sawTokensOut: false,
		sawUsd: false,
	};
	for (const event of iterEvents(input)) {
		accumulateEvent(event, totals);
	}
	/** @type {PiJsonUsageTotals} */
	const result = {};
	if (totals.sawTokensIn) result.tokensIn = totals.tokensIn;
	if (totals.sawTokensOut) result.tokensOut = totals.tokensOut;
	if (totals.sawUsd) result.estimatedUsd = totals.estimatedUsd;
	return result;
}

/**
 * Extract human-readable assistant text segments from a `pi --mode json`
 * stream, for tee-ing readable output into run logs alongside usage totals.
 *
 * Segments come from authoritative `message_end` assistant messages only:
 * their `text` content blocks are concatenated per message (tool-call and
 * thinking blocks are skipped), in stream order. Streaming deltas from
 * `message_update` are never used, so no partial/duplicated text leaks in.
 *
 * @param {PiJsonStreamInput} input Whole NDJSON text, an array of records, or any iterable of record strings.
 * @returns {string[]}
 * @throws {TypeError} when input is not a string/iterable or records are not strings.
 */
export function extractTextFromPiJsonStream(input) {
	if (typeof input !== "string" && (input === null || typeof input !== "object")) {
		throw new TypeError("pi-json-usage: input must be a string or an iterable of strings");
	}
	/** @type {string[]} */
	const segments = [];
	for (const event of iterEvents(input)) {
		if (event.type !== "message_end") continue;
		const message = /** @type {any} */ (event.message);
		if (message === null || typeof message !== "object" || message.role !== "assistant") continue;
		const content = message.content;
		if (!Array.isArray(content)) continue;
		const text = content
			.filter(
				/** @returns {block is { type: "text", text: string }} */
				(block) =>
					block !== null &&
					typeof block === "object" &&
					block.type === "text" &&
					typeof block.text === "string" &&
					block.text.length > 0,
			)
			.map((block) => block.text)
			.join("");
		if (text.length > 0) segments.push(text);
	}
	return segments;
}
