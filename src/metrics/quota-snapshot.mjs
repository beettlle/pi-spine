// @ts-nocheck
/**
 * Privacy-safe quota/headroom snapshot builder.
 *
 * Joins the expected role→model mapping from `spine-config.json` with observed
 * burn from `.spine/run-metrics.jsonl`. Provider prefixes are mapped to shared
 * quota pools. Usage is aggregated from task metric records, preferring
 * explicit usage fields (`tokensIn`, `tokensOut`, `estimatedUsd`) when present and
 * falling back to duration-based attribution when they are absent.
 *
 * No live provider probes are used here — that is SP-681. Snapshots produced
 * by this module report `source: "estimate"` when observed metrics exist and
 * `source: "absent"` when a pool has no observed burn. `source: "live"` is
 * reserved for probe-enriched snapshots.
 */

import { metricsFilePath, readMetricsLines } from "../batch/metrics.mjs";

/**
 * Known provider prefixes that map to shared quota pools.
 *
 * The prefix is the segment before the first `/` in a model identifier. The
 * mapping is intentionally simple: all models under the same provider share a
 * pool because provider-level quotas (e.g. Z.ai, Google, Kimi) are typically
 * account- or key-wide, not model-wide.
 */
const POOL_PREFIXES = new Set(["zai", "kimi-coding", "google", "cursor"]);

/**
 * Resolves a model identifier to a shared quota pool id.
 *
 * @param {string} [model]
 * @returns {string}
 */
export function resolvePoolId(model) {
	if (typeof model !== "string" || !model.trim()) return "unknown";
	if (model === "inherit") return "unknown";

	const [provider] = model.split("/");
	if (provider && POOL_PREFIXES.has(provider)) return provider;
	if (provider) return "unknown";

	// Cursor Admin/Enterprise quotas are not keyed by model name, so we keep a
	// dedicated cursor pool even when no model slug is present.
	if (model.toLowerCase().startsWith("cursor")) return "cursor";

	return "unknown";
}

/**
 * Extract agent model identifiers from a shallow agent config object (worker,
 * reviewer and its sub-phases, supervisor). Nested profiles are handled by the
 * caller.
 *
 * @param {object} agents
 * @param {Set<string>} models
 */
function collectAgentModels(agents, models) {
	if (!agents || typeof agents !== "object") return;
	if (typeof agents.worker?.model === "string") models.add(agents.worker.model);
	if (typeof agents.reviewer?.model === "string") models.add(agents.reviewer.model);
	if (typeof agents.reviewer?.plan?.model === "string") models.add(agents.reviewer.plan.model);
	if (typeof agents.reviewer?.code?.model === "string") models.add(agents.reviewer.code.model);
	if (typeof agents.reviewer?.final?.model === "string") models.add(agents.reviewer.final.model);
	if (typeof agents.supervisor?.model === "string") models.add(agents.supervisor.model);
}

/**
 * Extract all expected model identifiers from the spine config, including the
 * active profile if one is configured. Profiles that are not active are ignored
 * so the snapshot reflects the configured runtime, not every possible profile.
 *
 * @param {object} config
 * @returns {string[]}
 */
export function collectExpectedModels(config) {
	const models = new Set();
	const agents = config?.agents;
	if (!agents || typeof agents !== "object") return [];

	collectAgentModels(agents, models);

	const activeProfile = typeof agents.activeProfile === "string" ? agents.activeProfile : "";
	if (activeProfile && agents.profiles?.[activeProfile]) {
		collectAgentModels(agents.profiles[activeProfile], models);
	}

	return [...models].filter((m) => m && m !== "inherit");
}

/**
 * @typedef {object} PoolUsage
 * @property {number} taskCount
 * @property {number} durationMs
 * @property {number} [tokensIn]
 * @property {number} [tokensOut]
 * @property {number} [estimatedUsd]
 */

/**
 * Aggregate usage for a list of task metric records. Fields are omitted when
 * no record in the pool carries them, so callers never receive invented values.
 *
 * @param {object[]} records
 * @returns {PoolUsage}
 */
export function aggregatePoolUsage(records) {
	/** @type {PoolUsage} */
	const usage = { taskCount: 0, durationMs: 0 };
	let tokensIn = 0;
	let tokensOut = 0;
	let estimatedUsd = 0;
	let hasTokensIn = false;
	let hasTokensOut = false;
	let hasEstimatedUsd = false;

	for (const record of records) {
		if (!record || typeof record !== "object") continue;
		usage.taskCount += 1;
		if (Number.isFinite(record.durationMs)) {
			usage.durationMs += Math.max(0, record.durationMs);
		}
		if (Number.isFinite(record.tokensIn)) {
			tokensIn += Math.max(0, record.tokensIn);
			hasTokensIn = true;
		}
		if (Number.isFinite(record.tokensOut)) {
			tokensOut += Math.max(0, record.tokensOut);
			hasTokensOut = true;
		}
		if (Number.isFinite(record.estimatedUsd)) {
			estimatedUsd += Math.max(0, record.estimatedUsd);
			hasEstimatedUsd = true;
		}
	}

	if (hasTokensIn) usage.tokensIn = tokensIn;
	if (hasTokensOut) usage.tokensOut = tokensOut;
	if (hasEstimatedUsd) usage.estimatedUsd = estimatedUsd;

	return usage;
}

/**
 * Build a drift report for a single pool from the expected and observed model
 * sets.
 *
 * @param {string[]} expectedModels
 * @param {string[]} observedModels
 */
function buildPoolDrift(expectedModels, observedModels) {
	const expectedSet = new Set(expectedModels);
	const observedSet = new Set(observedModels);
	const unexpectedModels = observedModels.filter((m) => !expectedSet.has(m));
	const missingModels = expectedModels.filter((m) => !observedSet.has(m));
	return { unexpectedModels, missingModels };
}

/**
 * @typedef {object} PoolSnapshot
 * @property {string} poolId
 * @property {"live" | "estimate" | "absent"} source
 * @property {string[]} expectedModels
 * @property {string[]} observedModels
 * @property {PoolUsage} usage
 * @property {{unexpectedModels: string[], missingModels: string[]}} drift
 */

/**
 * @typedef {object} QuotaSnapshot
 * @property {string} generatedAt
 * @property {"live" | "estimate" | "absent"} snapshotSource
 * @property {Record<string, PoolSnapshot>} pools
 */

/**
 * Build a privacy-safe quota snapshot from spine config and run metrics.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.config
 * @param {object[]} [params.metricsLines]
 * @param {number | string | Date} [params.now]
 * @returns {QuotaSnapshot}
 */
export function buildQuotaSnapshot({ projectRoot, config, metricsLines, now = Date.now() }) {
	const resolvedNow = new Date(now).toISOString();

	let lines = metricsLines;
	if (lines == null) {
		const filePath = metricsFilePath(projectRoot, config);
		lines = readMetricsLines(filePath);
	}
	const taskRecords = (lines ?? []).filter(
		(line) => line && typeof line === "object" && line.recordType === "task",
	);

	const expectedModels = collectExpectedModels(config);
	const expectedByPool = new Map();
	for (const model of expectedModels) {
		const poolId = resolvePoolId(model);
		if (!expectedByPool.has(poolId)) expectedByPool.set(poolId, new Set());
		expectedByPool.get(poolId).add(model);
	}

	const observedByPool = new Map();
	for (const record of taskRecords) {
		const model =
			typeof record.model === "string" && record.model !== "inherit"
				? record.model
				: "inherit";
		const poolId = resolvePoolId(model);
		if (!observedByPool.has(poolId)) observedByPool.set(poolId, { records: [], models: new Set() });
		const entry = observedByPool.get(poolId);
		entry.records.push(record);
		entry.models.add(model);
	}

	const poolIds = new Set([...expectedByPool.keys(), ...observedByPool.keys()]);
	let overallHasEstimate = false;
	let overallHasAbsent = false;

	/** @type {Record<string, PoolSnapshot>} */
	const pools = {};
	for (const poolId of poolIds) {
		const expectedSet = expectedByPool.get(poolId) ?? new Set();
		const observedEntry = observedByPool.get(poolId);
		const observedRecords = observedEntry?.records ?? [];
		const observedSet = observedEntry?.models ?? new Set();
		const source = observedRecords.length > 0 ? "estimate" : "absent";

		if (source === "estimate") overallHasEstimate = true;
		if (source === "absent") overallHasAbsent = true;

		pools[poolId] = {
			poolId,
			source,
			expectedModels: [...expectedSet].sort(),
			observedModels: [...observedSet].sort(),
			usage: aggregatePoolUsage(observedRecords),
			drift: buildPoolDrift([...expectedSet], [...observedSet]),
		};
	}

	const snapshotSource = overallHasEstimate ? "estimate" : overallHasAbsent ? "absent" : "absent";

	return {
		generatedAt: resolvedNow,
		snapshotSource,
		pools,
	};
}
