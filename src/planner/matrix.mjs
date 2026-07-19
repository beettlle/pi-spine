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
