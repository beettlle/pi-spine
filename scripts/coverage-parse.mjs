/**
 * Parse Node test runner coverage summary output.
 */

import path from "node:path";

/**
 * @param {string} output Combined stdout/stderr from a coverage test run.
 * @returns {number | null} Aggregate line coverage percent, or null if not found.
 */
export function parseAggregateLineCoverage(output) {
	const tableMatch = output.match(/^\s*[^\s]*\s*all files\s+\|\s+([\d.]+)\s+\|/m);
	if (tableMatch) {
		const value = Number.parseFloat(tableMatch[1]);
		if (Number.isFinite(value)) {
			return value;
		}
	}

	const summaryMatch = output.match(/Line coverage \(in-scope\):\s*([\d.]+)%/);
	if (summaryMatch) {
		const value = Number.parseFloat(summaryMatch[1]);
		if (Number.isFinite(value)) {
			return value;
		}
	}

	return null;
}

/**
 * @param {string} output Combined stdout/stderr from a coverage test run.
 * @returns {Map<string, number>} Repo-relative path → line coverage percent.
 */
export function parsePerFileLineCoverage(output) {
	/** @type {Map<string, number>} */
	const byFile = new Map();
	const rowRe = /^\s*(?:[^\s]*\s+)?([^\s|]+\.(?:mjs|ts))\s+\|\s+([\d.]+)\s+\|/gm;
	for (const match of output.matchAll(rowRe)) {
		const filePath = match[1];
		const linePct = Number.parseFloat(match[2]);
		if (filePath === "all" || filePath === "files" || !Number.isFinite(linePct)) {
			continue;
		}
		byFile.set(filePath, linePct);
	}
	return byFile;
}

/**
 * @param {string} output
 * @param {Record<string, number>} thresholds
 * @returns {Array<{ path: string, actual: number | null, required: number }>}
 */
export function findFileCoverageFailures(output, thresholds) {
	const byFile = parsePerFileLineCoverage(output);
	/** @type {Array<{ path: string, actual: number | null, required: number }>} */
	const failures = [];
	for (const [filePath, required] of Object.entries(thresholds)) {
		const basename = path.basename(filePath);
		let actual = byFile.get(filePath) ?? null;
		if (actual === null) {
			actual = byFile.get(basename) ?? null;
		}
		if (actual === null || actual < required) {
			failures.push({ path: filePath, actual, required });
		}
	}
	return failures;
}
