/**
 * Fake-async arch guard for batch hot paths (SP-732 / #270).
 *
 * Two layers:
 * 1. Migrated-symbol assertions — the SP-732 batch exports must stay non-async
 *    (or genuinely await). The allowlist is intentionally empty.
 * 2. Heuristic sweep of the SP-732 file scope — any `async function` declared
 *    in these files must contain `await`, `new Promise`, or a `.then(` chain,
 *    i.e. real async work. Add new batch files here only after auditing them.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Symbols migrated off fake-async by SP-732 (#270 batch rows).
 * Each must be declared as a plain `function` (or contain real awaits).
 *
 * @type {ReadonlyArray<{ file: string, symbol: string }>}
 */
const MIGRATED_SYMBOLS = [
	{ file: "src/batch/engine-lanes/merge.mjs", symbol: "mergeWaveLanesToOrch" },
	{ file: "src/batch/engine-lanes/queue.mjs", symbol: "skipTaskDoneOnDisk" },
	{ file: "src/batch/review-spawn.mjs", symbol: "spawnReviewerPi" },
];

/**
 * Remaining fake-async symbols tolerated during migration.
 * MUST stay empty — SP-732 completed the batch-scope migration.
 *
 * @type {ReadonlyArray<{ file: string, symbol: string }>}
 */
const FAKE_ASYNC_ALLOWLIST = [];

/** Files swept by the heuristic fake-async check (SP-732 file scope). */
const SWEPT_FILES = [...new Set(MIGRATED_SYMBOLS.map((entry) => entry.file))];

/**
 * Extract a braced body starting at the first `{` at/after `fromIndex`.
 * Tolerates braces inside strings/template literals well enough for a lint guard.
 *
 * @param {string} source
 * @param {number} fromIndex
 * @returns {string|null}
 */
function extractBracedBody(source, fromIndex) {
	const start = source.indexOf("{", fromIndex);
	if (start < 0) return null;
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		const ch = source[i];
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	return null;
}

/**
 * @param {string} body
 * @returns {boolean} true when the body performs real async work.
 */
function hasRealAsyncWork(body) {
	return /\bawait\b/.test(body) || /new\s+Promise\b/.test(body) || /\.then\(/.test(body);
}

/**
 * @param {string} filePath
 * @returns {Array<{ symbol: string, async: boolean, realAsync: boolean }>}
 */
function listFunctionDeclarations(filePath) {
	const source = fs.readFileSync(filePath, "utf-8");
	const pattern = /(export\s+)?(async\s+)?function\s+([A-Za-z0-9_$]+)/g;
	/** @type {Array<{ symbol: string, async: boolean, realAsync: boolean }>} */
	const found = [];
	let match = pattern.exec(source);
	while (match) {
		const body = extractBracedBody(source, match.index) ?? "";
		found.push({
			symbol: match[3],
			async: Boolean(match[2]),
			realAsync: hasRealAsyncWork(body),
		});
		match = pattern.exec(source);
	}
	return found;
}

for (const { file, symbol } of MIGRATED_SYMBOLS) {
	test(`${symbol} in ${file} is not fake-async (#270)`, () => {
		const declarations = listFunctionDeclarations(path.join(REPO_ROOT, file)).filter(
			(entry) => entry.symbol === symbol,
		);
		assert.ok(declarations.length > 0, `${symbol} must exist in ${file}`);
		for (const declaration of declarations) {
			assert.ok(
				!declaration.async || declaration.realAsync,
				`${symbol} is declared async without real async work — make it sync or add real awaits`,
			);
		}
	});
}

test("fake-async allowlist is empty (SP-732 migration complete)", () => {
	assert.deepEqual(FAKE_ASYNC_ALLOWLIST, []);
});

test("no new fake-async functions in SP-732 batch file scope", () => {
	const allowlistKeys = new Set(
		FAKE_ASYNC_ALLOWLIST.map((entry) => `${entry.file}::${entry.symbol}`),
	);
	/** @type {string[]} */
	const violations = [];
	for (const file of SWEPT_FILES) {
		for (const declaration of listFunctionDeclarations(path.join(REPO_ROOT, file))) {
			if (!declaration.async || declaration.realAsync) continue;
			if (allowlistKeys.has(`${file}::${declaration.symbol}`)) continue;
			violations.push(`${file}: ${declaration.symbol}`);
		}
	}
	assert.deepEqual(
		violations,
		[],
		`fake-async functions detected (async with no real async work): ${violations.join("; ")}`,
	);
});
