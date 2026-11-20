/**
 * Unit tests for the pure pi `--mode json` usage parser (SP-878, partial #338).
 *
 * Fixtures under `tests/fixtures/pi-json-stream/` mirror pi 1.5.2 event shapes
 * from `docs/json.md` / `docs/message-types.md`:
 *
 * - `sample-run.jsonl` — full run with assistant `message_end` usage, nested
 *   `tool_execution_end` usage, and successful `compaction_end` usage, plus
 *   cumulative `message_update` snapshots that must NOT be double-counted.
 *   Expected totals: tokensIn 520, tokensOut 170, estimatedUsd 0.0037.
 * - `no-usage.jsonl` — no usage anywhere (assistant message without `usage`,
 *   tool result without nested usage, aborted/failed compaction) → no keys.
 * - `truncated-run.jsonl` — killed mid-response; only `message_update`
 *   snapshots carry usage → no keys (under-count, never over-count).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { extractTextFromPiJsonStream, sumUsageFromPiJsonStream } from "../../src/batch/pi-json-usage.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/pi-json-stream");

/**
 * @param {string} name
 * @returns {string}
 */
function readFixture(name) {
	return fs.readFileSync(path.join(FIXTURES, name), "utf-8");
}

/** Float-safe comparison for summed `cost.total` values. */
const USD_EPSILON = 1e-12;

test("sample-run fixture sums assistant message_end, compaction_end, and nested tool usage", () => {
	const totals = sumUsageFromPiJsonStream(readFixture("sample-run.jsonl"));
	assert.equal(totals.tokensIn, 520);
	assert.equal(totals.tokensOut, 170);
	assert.ok(
		Math.abs((totals.estimatedUsd ?? 0) - 0.0037) < USD_EPSILON,
		`expected estimatedUsd ≈ 0.0037, got ${totals.estimatedUsd}`,
	);
});

test("sample-run fixture never double-counts message_update snapshots", () => {
	// message_update carries cumulative usage (0.0006/0.0007 input-side costs and
	// 18/45 output tokens) — if summed, tokensOut would exceed 170.
	const totals = sumUsageFromPiJsonStream(readFixture("sample-run.jsonl"));
	assert.equal(totals.tokensOut, 170);
	assert.equal(Object.keys(totals).sort().join(","), "estimatedUsd,tokensIn,tokensOut");
});

test("no-usage fixture returns no usage keys (never invent costs)", () => {
	const totals = sumUsageFromPiJsonStream(readFixture("no-usage.jsonl"));
	assert.deepEqual(totals, {});
	assert.equal("tokensIn" in totals, false);
	assert.equal("tokensOut" in totals, false);
	assert.equal("estimatedUsd" in totals, false);
});

test("truncated-run fixture counts nothing without an authoritative message_end", () => {
	const totals = sumUsageFromPiJsonStream(readFixture("truncated-run.jsonl"));
	assert.deepEqual(totals, {});
});

test("accepts an array of records identically to whole-text input", () => {
	const text = readFixture("sample-run.jsonl");
	const fromText = sumUsageFromPiJsonStream(text);
	const fromLines = sumUsageFromPiJsonStream(text.split("\n"));
	assert.deepEqual(fromLines, fromText);
});

test("accepts iterable chunks with embedded newlines and CRLF framing", () => {
	const chunks = [
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":7,"output":3,"cost":{"total":0.5}}}}\r\n',
		'{"type":"compaction_end","result":{"usage":{"input":2,"output":1,"cost":{"total":0.25}}}}\r\n{"type":"agent_end","messages":[]}',
	];
	const totals = sumUsageFromPiJsonStream(chunks);
	assert.equal(totals.tokensIn, 9);
	assert.equal(totals.tokensOut, 4);
	assert.ok(Math.abs((totals.estimatedUsd ?? 0) - 0.75) < USD_EPSILON);
});

test("skips malformed and non-object records without throwing", () => {
	const stream = [
		"not json at all",
		"{}",
		"123",
		'"a string"',
		"null",
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":7,"output":3,"cost":{"total":0.5}}}}',
		"",
	].join("\n");
	assert.deepEqual(sumUsageFromPiJsonStream(stream), { tokensIn: 7, tokensOut: 3, estimatedUsd: 0.5 });
});

test("keeps reported zeros and omits sides pi did not report", () => {
	const allZero = sumUsageFromPiJsonStream(
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"cost":{"total":0}}}}',
	);
	assert.deepEqual(allZero, { tokensIn: 0, tokensOut: 0, estimatedUsd: 0 });

	const outputOnly = sumUsageFromPiJsonStream(
		'{"type":"message_end","message":{"role":"assistant","usage":{"output":42}}}',
	);
	assert.deepEqual(outputOnly, { tokensOut: 42 });
});

test("ignores non-finite and negative counters instead of inventing usage", () => {
	const totals = sumUsageFromPiJsonStream(
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":NaN,"output":-5,"cacheRead":Infinity,"cost":{"total":"0.5"}}}}',
	);
	assert.deepEqual(totals, {});
});

test("does not re-add reasoning or cacheWrite1h (already included by pi)", () => {
	const totals = sumUsageFromPiJsonStream(
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":100,"cacheRead":0,"cacheWrite":50,"cacheWrite1h":20,"output":30,"reasoning":10,"cost":{"total":0.01}}}}',
	);
	// tokensIn = input + cacheRead + cacheWrite (cacheWrite1h is a subset);
	// tokensOut = output (reasoning already inside it).
	assert.deepEqual(totals, { tokensIn: 150, tokensOut: 30, estimatedUsd: 0.01 });
});

test("ignores usage attached to non-assistant message_end records", () => {
	const totals = sumUsageFromPiJsonStream(
		'{"type":"message_end","message":{"role":"user","usage":{"input":999,"output":999,"cost":{"total":9}}}}',
	);
	assert.deepEqual(totals, {});
});

test("sums across multiple assistant messages in one stream", () => {
	const stream = [
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":1,"output":2,"cost":{"total":0.1}}}}',
		'{"type":"message_end","message":{"role":"assistant","usage":{"input":3,"output":4,"cost":{"total":0.2}}}}',
	].join("\n");
	const totals = sumUsageFromPiJsonStream(stream);
	assert.equal(totals.tokensIn, 4);
	assert.equal(totals.tokensOut, 6);
	assert.ok(Math.abs((totals.estimatedUsd ?? 0) - 0.3) < USD_EPSILON);
});

test("throws TypeError when input is not a string or iterable of strings", () => {
	assert.throws(() => sumUsageFromPiJsonStream(/** @type {any} */ (42)), TypeError);
	assert.throws(() => sumUsageFromPiJsonStream(/** @type {any} */ (null)), TypeError);
	assert.throws(() => sumUsageFromPiJsonStream(/** @type {any} */ ([1, 2])), TypeError);
	assert.throws(() => sumUsageFromPiJsonStream(/** @type {any} */ ({})), TypeError);
	assert.throws(() => extractTextFromPiJsonStream(/** @type {any} */ ({})), TypeError);
	assert.throws(() => extractTextFromPiJsonStream(/** @type {any} */ (42)), TypeError);
});

test("extractTextFromPiJsonStream returns assistant text segments in stream order", () => {
	const segments = extractTextFromPiJsonStream(readFixture("sample-run.jsonl"));
	assert.deepEqual(segments, ["Scanning the repository now.", "Done — 2 files changed."]);
});

test("extractTextFromPiJsonStream skips tool-call, thinking, and non-assistant content", () => {
	const stream = [
		'{"type":"message_end","message":{"role":"assistant","content":[{"type":"toolCall","id":"call_x","name":"bash","arguments":{}}]}}',
		'{"type":"message_end","message":{"role":"assistant","content":[{"type":"thinking","thinking":"hmm"},{"type":"text","text":"Answer"}]}}',
		'{"type":"message_end","message":{"role":"user","content":"ignore me"}}',
		'{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"partial"}}',
	].join("\n");
	assert.deepEqual(extractTextFromPiJsonStream(stream), ["Answer"]);
});

test("extractTextFromPiJsonStream returns an empty array when no assistant text exists", () => {
	assert.deepEqual(extractTextFromPiJsonStream(readFixture("truncated-run.jsonl")), []);
});
