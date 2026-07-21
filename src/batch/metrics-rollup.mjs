// @ts-nocheck
/**
 * Usage rollup helpers for run-metrics.jsonl.
 *
 * Aggregates numeric usage fields (`tokensIn`, `tokensOut`, `estimatedUsd`) by
 * batch, model, and agent role. Only task-style records with finite usage
 * contribute; groups with no usage are omitted so totals stay clean.
 */

const USAGE_FIELDS = ["tokensIn", "tokensOut", "estimatedUsd"];

/**
 * @param {object[]} lines
 * @returns {{ byBatch: Record<string, object>, byModel: Record<string, object>, byRole: Record<string, object> } | null}
 */
export function rollupMetrics(lines) {
	/** @type {Record<string, Record<string, number>>} */
	const byBatch = {};
	/** @type {Record<string, Record<string, number>>} */
	const byModel = {};
	/** @type {Record<string, Record<string, number>>} */
	const byRole = {};

	let anyUsage = false;
	for (const line of lines) {
		if (!line || typeof line !== "object") continue;
		// Call each bucket independently — `||` would skip model/role after batch hits.
		const hitBatch = addUsage(byBatch, line.batchId ?? "—", line);
		const hitModel = addUsage(byModel, line.model ?? "—", line);
		const hitRole = addUsage(byRole, line.role ?? line.agentRole ?? "—", line);
		if (hitBatch || hitModel || hitRole) anyUsage = true;
	}

	if (!anyUsage) return null;
	return { byBatch, byModel, byRole };
}

/**
 * Accumulate finite usage fields into a single bucket, creating the bucket
 * only when the line actually carries usage data.
 *
 * @param {Record<string, Record<string, number>>} store
 * @param {string} key
 * @param {object} line
 * @returns {boolean} true when the line contributed at least one usage field
 */
function addUsage(store, key, line) {
	let contributed = false;
	for (const field of USAGE_FIELDS) {
		const value = line[field];
		if (Number.isFinite(value)) {
			store[key] ??= {};
			store[key][field] = (store[key][field] ?? 0) + value;
			contributed = true;
		}
	}
	if (contributed) {
		store[key] ??= {};
		store[key].count = (store[key].count ?? 0) + 1;
	}
	return contributed;
}

/**
 * Format rollups as a short human-readable section with one table per grouping.
 *
 * @param {{ byBatch: Record<string, object>, byModel: Record<string, object>, byRole: Record<string, object> }} rollups
 * @returns {string}
 */
export function formatMetricsRollups(rollups) {
	if (!rollups) return "";

	const sections = [
		formatRollupTable("Usage by batch", rollups.byBatch),
		formatRollupTable("Usage by model", rollups.byModel),
		formatRollupTable("Usage by role", rollups.byRole),
	];
	const body = sections.filter(Boolean).join("\n");
	if (!body) return "";
	return `\n${body}`;
}

/**
 * @param {string} title
 * @param {Record<string, object>} groups
 * @returns {string}
 */
function formatRollupTable(title, groups) {
	const entries = Object.entries(groups);
	if (entries.length === 0) return "";

	const header = ["Group", "Tokens In", "Tokens Out", "Est. USD", "Records"];
	const rows = entries.map(([key, bucket]) => [
		key,
		formatNumber(bucket.tokensIn),
		formatNumber(bucket.tokensOut),
		formatNumber(bucket.estimatedUsd),
		formatNumber(bucket.count),
	]);

	const widths = header.map((col, index) =>
		Math.max(col.length, ...rows.map((row) => String(row[index]).length)),
	);

	const formatRow = (row) =>
		row.map((cell, index) => String(cell).padStart(widths[index])).join("  ");

	return `${title}:\n${[formatRow(header), ...rows.map(formatRow)].join("\n")}`;
}

/**
 * @param {number | undefined} value
 * @returns {string}
 */
function formatNumber(value) {
	if (value == null || !Number.isFinite(value)) return "—";
	if (Number.isInteger(value)) return String(value);
	return value.toFixed(4);
}
