// @ts-check

/**
 * Parse a markdown table into an array of objects.
 * 
 * @param {string} markdown
 * @returns {{ rows: Array<Record<string, string>>, columns: string[] }}
 */
export function parseMatrixTable(markdown) {
	if (!markdown || !markdown.trim()) {
		return { rows: [], columns: [] };
	}

	const lines = markdown.split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('|') && line.endsWith('|'));
	
	if (lines.length < 2) { 
		return { rows: [], columns: [] };
	}

	/** @param {string} line */
	const parseCells = (line) => {
		const parts = line.split('|');
		// Remove the first and last parts since they are outside the bounding pipes
		return parts.slice(1, parts.length - 1).map(s => s.trim());
	};

	const columns = parseCells(lines[0]);
	if (columns.length === 0 || columns.every(c => !c)) {
		return { rows: [], columns: [] };
	}

	/** @type {Array<Record<string, string>>} */
	const rows = [];
	// Skip line[1] which is the separator
	for (let i = 2; i < lines.length; i++) {
		const cellValues = parseCells(lines[i]);
		/** @type {Record<string, string>} */
		const rowObj = {};
		let hasValue = false;
		for (let c = 0; c < columns.length; c++) {
			const col = columns[c];
			if (!col) continue; // Skip empty header columns
			const val = cellValues[c] ?? "";
			rowObj[col] = val;
			if (val) hasValue = true;
		}
		if (hasValue) {
			rows.push(rowObj);
		}
	}

	return { rows, columns };
}

/**
 * Derives a string id for a row. Prefer `run_id`, else join values.
 * @param {Record<string, string>} row 
 * @param {string[]} columns 
 * @returns {string}
 */
export function deriveMatrixRowId(row, columns) {
	if (row['run_id']) {
		return row['run_id'];
	}
	return columns.map(col => row[col]).join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Matches `{matrix.<column>}` placeholders. Column names are `[a-zA-Z0-9_-]+`. */
const MATRIX_VAR_RE = /\{matrix\.([a-zA-Z0-9_-]+)\}/g;

/**
 * Substitute `{matrix.<column>}` placeholders in a template string with the
 * matching value from a matrix row.
 *
 * Fails loud (throws) on any reference whose column is absent from the row, so a
 * typo such as `{matrix.rnu_id}` never silently reaches execution. When no row is
 * supplied, text without placeholders is returned unchanged (non-matrix tasks).
 *
 * @param {string} template Arbitrary text (PROMPT body, contract field, step command).
 * @param {Record<string, string> | null | undefined} row Matrix row values keyed by column.
 * @returns {string}
 */
export function substituteMatrixVariables(template, row) {
	const text = String(template ?? "");

	// No row: a template without placeholders (non-matrix task) is returned verbatim.
	// A leftover {matrix.X} with no row is an authoring error — fail loud.
	if (!row) {
		return text.replace(MATRIX_VAR_RE, (match, column) => {
			throw new Error(`Unknown matrix variable reference: {matrix.${column}}`);
		});
	}

	const values = row;
	return text.replace(MATRIX_VAR_RE, (match, column) => {
		if (!Object.prototype.hasOwnProperty.call(values, column)) {
			throw new Error(`Unknown matrix variable reference: {matrix.${column}}`);
		}
		const value = values[column];
		return value == null ? "" : String(value);
	});
}

/**
 * Substitute `{matrix.<column>}` placeholders in parsed step titles and bodies.
 * Returns a new steps array; the input is returned unchanged when no row is
 * supplied (non-matrix tasks are untouched).
 *
 * @param {Array<{ number: number, title: string, body: string }>} steps Parsed steps from `parsePrompt`.
 * @param {Record<string, string> | null | undefined} row Matrix row values keyed by column.
 * @returns {Array<{ number: number, title: string, body: string }>}
 */
export function applyMatrixRowToSteps(steps, row) {
	if (!Array.isArray(steps) || !row || Object.keys(row).length === 0) {
		return steps;
	}
	return steps.map((step) => ({
		...step,
		title: substituteMatrixVariables(step.title, row),
		body: substituteMatrixVariables(step.body, row),
	}));
}

/**
 * Substitute `{matrix.<column>}` placeholders across an entire raw PROMPT.md
 * document for one matrix row. This is the LLM-row serving vehicle (#232):
 * workers consume the raw markdown, so whole-document substitution is the
 * composition of `applyMatrixRowToSteps` (step titles/bodies),
 * `applyMatrixRowToContract` (contract table fields), and the File Scope paths
 * in a single pass, with the same fail-loud semantics via
 * `substituteMatrixVariables` — an unknown `{matrix.X}` reference throws.
 *
 * The input is returned unchanged when no row is supplied or the row is empty
 * (non-matrix tasks keep their PROMPT verbatim), mirroring the guards on the
 * structured helpers.
 *
 * @param {string} promptText Raw PROMPT.md content.
 * @param {Record<string, string> | null | undefined} row Matrix row values keyed by column.
 * @returns {string}
 */
export function applyMatrixRowToPrompt(promptText, row) {
	if (typeof promptText !== "string" || !row || Object.keys(row).length === 0) {
		return promptText;
	}
	return substituteMatrixVariables(promptText, row);
}
