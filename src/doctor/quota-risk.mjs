// @ts-nocheck
/**
 * Quota-risk advisory doctor check (GitHub #251, SP-700).
 *
 * Warns when worker pins that matter for escalation (base worker, active
 * profile worker, or the `escalatePolicy.toProfile` target worker) point at
 * known quota-constrained provider pools without live/estimate headroom
 * evidence. Optionally surfaces recent launch-storm / quota-abort patterns
 * from run-metrics when metrics lines are supplied.
 *
 * This check is advisory only: it always returns `ok: true` (with
 * `warning: true` when risk is detected) so doctor/preflight stay
 * non-blocking. Live probes are never run from doctor — probe results are an
 * injectable input; when probes/auth are absent the check degrades closed
 * (warns) instead of claiming headroom it cannot prove.
 */

import { resolvePoolId } from "../metrics/quota-snapshot.mjs";

/** Default window for launch-storm / quota-abort signal detection. */
const DEFAULT_SIGNAL_WINDOW_MS = 60 * 60 * 1000;
/** Failed tasks under this duration count toward a launch storm. */
const LAUNCH_STORM_MAX_DURATION_MS = 5 * 60 * 1000;
/** Minimum failed short tasks inside the window to flag a launch storm. */
const LAUNCH_STORM_MIN_FAILURES = 3;

export const QUOTA_RISK_CHECK_LABEL = "quota risk: escalate/hard worker pins (#251)";
export const QUOTA_RISK_SUGGESTED_COMMAND = "spine metrics quota";

/**
 * @typedef {object} QuotaPinTarget
 * @property {string} model
 * @property {string} poolId
 * @property {string} source Human-readable origin of the pin.
 */

/**
 * Collect worker model pins that matter for escalation risk: the base
 * worker pin, the active-profile worker pin, and the escalate-policy target
 * profile worker pin. Only pins resolving to a known quota pool are kept.
 *
 * @param {object} [config]
 * @returns {QuotaPinTarget[]}
 */
export function collectQuotaPinTargets(config = {}) {
	const agents = config?.agents;
	if (!agents || typeof agents !== "object") return [];

	/** @type {Array<{ model: unknown, source: string }>} */
	const candidates = [
		{ model: agents.worker?.model, source: "agents.worker.model" },
	];

	const activeProfile = typeof agents.activeProfile === "string" ? agents.activeProfile.trim() : "";
	if (activeProfile && agents.profiles?.[activeProfile]) {
		candidates.push({
			model: agents.profiles[activeProfile]?.worker?.model,
			source: `agents.profiles.${activeProfile}.worker.model (active profile)`,
		});
	}

	const escalate = agents.escalatePolicy;
	const escalateTarget =
		escalate && typeof escalate === "object" && escalate.enabled !== false
			? String(escalate.toProfile ?? "").trim()
			: "";
	if (escalateTarget && agents.profiles?.[escalateTarget]) {
		candidates.push({
			model: agents.profiles[escalateTarget]?.worker?.model,
			source: `agents.profiles.${escalateTarget}.worker.model (escalate target)`,
		});
	}

	/** @type {QuotaPinTarget[]} */
	const targets = [];
	const seen = new Set();
	for (const candidate of candidates) {
		if (typeof candidate.model !== "string") continue;
		const model = candidate.model.trim();
		if (!model || model === "inherit") continue;
		const poolId = resolvePoolId(model);
		if (poolId === "unknown") continue;
		const key = `${poolId}::${model}`;
		if (seen.has(key)) continue;
		seen.add(key);
		targets.push({ model, poolId, source: candidate.source });
	}
	return targets;
}

/**
 * Evaluate headroom evidence for one pool from an optional probe result.
 * Degrades closed: absent probes/auth mean "no headroom evidence", never an
 * invented remaining percentage.
 *
 * @param {QuotaPinTarget} target
 * @param {import("../metrics/quota-probes.mjs").ProbeResult | undefined} probe
 * @returns {{ hasHeadroom: boolean, reason: string }}
 */
function evaluateHeadroom(target, probe) {
	const pin = `${target.source} → ${target.model} (pool: ${target.poolId})`;

	if (probe?.source === "live") {
		const usage = probe.usage && typeof probe.usage === "object" ? probe.usage : {};
		if (Number.isFinite(probe.limit) && Number.isFinite(usage.tokensOut)) {
			const headroom = probe.limit - usage.tokensOut;
			if (headroom > 0) {
				return { hasHeadroom: true, reason: `${pin} — live probe reports headroom` };
			}
			return { hasHeadroom: false, reason: `${pin} — live probe reports quota exhausted` };
		}
		if (Number.isFinite(usage.estimatedUsd)) {
			if (usage.estimatedUsd > 0) {
				return { hasHeadroom: true, reason: `${pin} — live probe reports positive balance` };
			}
			return { hasHeadroom: false, reason: `${pin} — live probe reports zero/negative balance` };
		}
		return {
			hasHeadroom: true,
			reason: `${pin} — live probe reachable, provider reported no explicit limit`,
		};
	}

	return {
		hasHeadroom: false,
		reason: `${pin} — quota-constrained pool with no live/estimate headroom evidence (probe/auth absent)`,
	};
}

/**
 * Detect recent launch-storm and quota-abort signals in task metric records.
 * Pure heuristic over injected records; nothing is fabricated when fields are
 * missing.
 *
 * @param {object[]} [metricsLines]
 * @param {object} [options]
 * @param {number | string | Date} [options.now]
 * @param {number} [options.windowMs]
 * @returns {string[]}
 */
export function detectQuotaRiskSignals(metricsLines, { now = Date.now(), windowMs = DEFAULT_SIGNAL_WINDOW_MS } = {}) {
	if (!Array.isArray(metricsLines) || metricsLines.length === 0) return [];

	const nowMs = new Date(now).getTime();
	if (!Number.isFinite(nowMs)) return [];

	const windowStart = nowMs - windowMs;
	const records = metricsLines.filter(
		(line) => line && typeof line === "object" && line.recordType === "task",
	);

	let shortFailures = 0;
	let quotaAborts = 0;
	for (const record of records) {
		if (record.outcome !== "failed") continue;
		const startedMs = new Date(record.startedAt ?? 0).getTime();
		if (!Number.isFinite(startedMs) || startedMs < windowStart) continue;

		const haystack = [record.diagnosis, record.failureKind, record.exitReason]
			.filter((value) => typeof value === "string")
			.join(" ")
			.toLowerCase();
		if (haystack.includes("quota") || haystack.includes("rate limit") || haystack.includes("429")) {
			quotaAborts += 1;
			continue;
		}
		if (Number.isFinite(record.durationMs) && record.durationMs <= LAUNCH_STORM_MAX_DURATION_MS) {
			shortFailures += 1;
		}
	}

	/** @type {string[]} */
	const signals = [];
	if (quotaAborts > 0) {
		signals.push(`${quotaAborts} recent quota-abort task failure(s) in run-metrics`);
	}
	if (shortFailures >= LAUNCH_STORM_MIN_FAILURES) {
		signals.push(
			`${shortFailures} short-lived task failure(s) in the last hour — possible launch storm`,
		);
	}
	return signals;
}

/**
 * Build the advisory quota-risk doctor check.
 *
 * @param {object} [options]
 * @param {object} [options.config] Resolved spine config.
 * @param {Record<string, import("../metrics/quota-probes.mjs").ProbeResult>} [options.probeResults]
 *   Optional live probe results keyed by pool id; doctor never runs probes itself.
 * @param {object[]} [options.metricsLines] Optional parsed run-metrics records.
 * @param {number | string | Date} [options.now]
 * @returns {{ label: string, ok: true, warning?: boolean, detail: string, suggestedCommand?: string }}
 */
export function buildQuotaRiskDoctorCheck({ config = {}, probeResults, metricsLines, now } = {}) {
	const targets = collectQuotaPinTargets(config);
	const probes = probeResults && typeof probeResults === "object" ? probeResults : {};

	/** @type {string[]} */
	const risks = [];
	for (const target of targets) {
		const { hasHeadroom, reason } = evaluateHeadroom(target, probes[target.poolId]);
		if (!hasHeadroom) risks.push(reason);
	}

	const signals = detectQuotaRiskSignals(metricsLines, { now });
	risks.push(...signals);

	if (risks.length === 0) {
		const detail =
			targets.length === 0
				? "no escalate/hard worker pins on quota-constrained pools"
				: `${targets.length} quota-pool pin(s) with headroom evidence`;
		return {
			label: QUOTA_RISK_CHECK_LABEL,
			ok: true,
			detail,
		};
	}

	return {
		label: QUOTA_RISK_CHECK_LABEL,
		ok: true,
		warning: true,
		detail: risks.join("; "),
		suggestedCommand: QUOTA_RISK_SUGGESTED_COMMAND,
	};
}
