/**
 * Parse Node test runner coverage summary output.
 */

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
