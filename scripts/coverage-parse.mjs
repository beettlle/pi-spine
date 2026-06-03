/**
 * Parse Node test runner coverage summary output.
 */

/**
 * @param {string} output Combined stdout/stderr from a coverage test run.
 * @returns {number | null} Aggregate line coverage percent, or null if not found.
 */
export function parseAggregateLineCoverage(output) {
	const match = output.match(/^\s*[^\s]*\s*all files\s+\|\s+([\d.]+)\s+\|/m);
	if (!match) return null;
	const value = Number.parseFloat(match[1]);
	return Number.isFinite(value) ? value : null;
}
