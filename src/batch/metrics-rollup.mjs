// @ts-nocheck
/**
 * Usage rollup helpers for run-metrics.jsonl.
 *
 * Aggregates numeric usage fields (`tokensIn`, `tokensOut`, `estimatedUsd`) by
 * batch, model, and agent role. Only task-style records with finite usage
 * contribute; groups with no usage are omitted so totals stay clean.
 */

const USAGE_FIELDS = ["tokensIn", "tokensOut", "estimatedUsd"];
const REVIEW_TYPE_ORDER = ["plan", "code", "final"];

/**
 * Group `recordType: "review"` rows by `(reviewType, model)` (SP-837 / #325).
 * Tolerates rows missing any new field (`—` / `inherit` buckets, zero counts).
 *
 * @param {object[]} lines
 * @returns {Array<{ reviewType: string, model: string, count: number, verdicts: Record<string, number>, meanAttempts: number | null, failures: Record<string, number>, failureCount: number }>}
 */
export function rollupReviews(lines) {
	/** @type {Map<string, { reviewType: string, model: string, count: number, verdicts: Record<string, number>, attemptSum: number, attemptCount: number, failures: Record<string, number>, failureCount: number }>} */
	const groups = new Map();
	for (const line of lines) {
		if (!line || typeof line !== "object" || line.recordType !== "review") continue;
		const reviewType = typeof line.reviewType === "string" ? line.reviewType : "—";
		const model = typeof line.model === "string" && line.model !== "" ? line.model : "inherit";
		const key = `${reviewType}\u0000${model}`;
		let group = groups.get(key);
		if (!group) {
			group = {
				reviewType,
				model,
				count: 0,
				verdicts: {},
				attemptSum: 0,
				attemptCount: 0,
				failures: {},
				failureCount: 0,
			};
			groups.set(key, group);
		}
		group.count += 1;
		const isFailure = typeof line.outcome === "string" && line.outcome !== "verdict";
		if (isFailure) {
			group.failures[line.outcome] = (group.failures[line.outcome] ?? 0) + 1;
			group.failureCount += 1;
		} else {
			const verdict = typeof line.verdict === "string" && line.verdict !== "" ? line.verdict : "—";
			group.verdicts[verdict] = (group.verdicts[verdict] ?? 0) + 1;
			if (Number.isFinite(line.attempt)) {
				group.attemptSum += line.attempt;
				group.attemptCount += 1;
			}
		}
	}

	const orderOf = (type) => {
		const index = REVIEW_TYPE_ORDER.indexOf(type);
		return index === -1 ? REVIEW_TYPE_ORDER.length : index;
	};
	return [...groups.values()]
		.sort(
			(a, b) =>
				orderOf(a.reviewType) - orderOf(b.reviewType) ||
				a.reviewType.localeCompare(b.reviewType) ||
				a.model.localeCompare(b.model),
		)
		.map(({ attemptSum, attemptCount, ...group }) => ({
			...group,
			meanAttempts: attemptCount > 0 ? attemptSum / attemptCount : null,
		}));
}

/**
 * @param {object[]} lines
 * @returns {{ byBatch: Record<string, object>, byModel: Record<string, object>, byRole: Record<string, object>, reviews: ReturnType<typeof rollupReviews> } | null}
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

	const reviews = rollupReviews(lines);
	if (!anyUsage && reviews.length === 0) return null;
	return { byBatch, byModel, byRole, reviews };
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
 * @param {{ byBatch: Record<string, object>, byModel: Record<string, object>, byRole: Record<string, object>, reviews?: ReturnType<typeof rollupReviews> }} rollups
 * @returns {string}
 */
export function formatMetricsRollups(rollups) {
	if (!rollups) return "";

	const sections = [
		formatRollupTable("Usage by batch", rollups.byBatch),
		formatRollupTable("Usage by model", rollups.byModel),
		formatRollupTable("Usage by role", rollups.byRole),
		formatReviewRollupTable(rollups.reviews),
	];
	const body = sections.filter(Boolean).join("\n");
	if (!body) return "";
	return `\n${body}`;
}

/**
 * @param {ReturnType<typeof rollupReviews> | undefined} reviews
 * @returns {string}
 */
function formatReviewRollupTable(reviews) {
	if (!Array.isArray(reviews) || reviews.length === 0) return "";

	const header = ["Review", "Model", "Records", "Verdicts", "Mean Attempts", "Failures"];
	const formatCounts = (counts) =>
		Object.entries(counts)
			.map(([name, count]) => `${name}=${count}`)
			.join(" ") || "—";
	const rows = reviews.map((group) => [
		group.reviewType,
		group.model,
		String(group.count),
		formatCounts(group.verdicts),
		group.meanAttempts == null ? "—" : group.meanAttempts.toFixed(2),
		group.failureCount > 0 ? formatCounts(group.failures) : "0",
	]);

	const widths = header.map((col, index) =>
		Math.max(col.length, ...rows.map((row) => String(row[index]).length)),
	);
	const formatRow = (row) =>
		row.map((cell, index) => String(cell).padStart(widths[index])).join("  ");

	return `Reviews by type and model:\n${[formatRow(header), ...rows.map(formatRow)].join("\n")}`;
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
