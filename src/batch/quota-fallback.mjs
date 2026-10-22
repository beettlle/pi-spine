/**
 * Pure decision and state helpers for single-hop provider quota fallback
 * (SP-807, partial #329).
 *
 * `decideQuotaFallback` encodes the #329 fallback rules as a truth table over
 * the resolved config, the batch's `state.resilience.quotaFallback` state, the
 * SP-804 classification, and the worker backend:
 *
 * - at most one hop per batch (sticky once applied — a second exhaustion can
 *   only re-route lanes still pinned to the old pool, never pick a new pool)
 *   until the hop is cleared: it expires once its parsed reset time plus a
 *   grace window has passed, or the operator clears it (SP-843, #350);
 * - one auto-retry per task (`retriedTaskIds`), so no task ping-pongs;
 * - transient overload, an unset fallback key, and the in-process
 *   `agentSession` backend never fall back;
 * - same-pool and probe-reported-exhausted fallback targets are refused.
 *
 * Everything here is pure: no state reads/writes, no journal, no probes, no
 * clocks (the caller passes `now` in). The engine wiring lands in SP-809.
 * `agents.escalatePolicy` is deliberately not consulted (#329 alternatives:
 * fallback is not escalation) and only a single fallback profile is supported.
 */
import { resolvePoolId } from "../metrics/quota-snapshot.mjs";

/**
 * @typedef {import("./provider-quota.mjs").ProviderQuotaError} ProviderQuotaError
 */

/** @typedef {"apply"|"retry"|"stop"|"none"} QuotaFallbackAction */

/**
 * Persisted fallback hop for a batch, stored by the engine at
 * `state.resilience.quotaFallback`. Its presence alone means the hop already
 * happened — no second hop is ever decided.
 *
 * @typedef {object} QuotaFallbackState
 * @property {string|null} fromProfile Profile active when the hop was applied.
 * @property {string} toProfile Fallback profile the batch moved to.
 * @property {string|null} fromModel Worker model before the hop.
 * @property {string} toModel Worker model after the hop.
 * @property {string} exhaustedPool Pool whose exhaustion triggered the hop.
 * @property {string|null} resetAtRaw Raw provider reset text for that pool, when it had one.
 * @property {number|null} [resetAt] Epoch ms the exhausted pool resets (SP-843), or null when `resetAtRaw` is not parsable. Absent on hops persisted before SP-843 (never expires).
 * @property {string} triggerTaskId Task whose failure triggered the hop.
 * @property {string} at ISO timestamp of the hop.
 * @property {string[]} retriedTaskIds Tasks already auto-retried onto the fallback pool.
 */

/**
 * Early-out result: the batch must keep running as configured.
 *
 * @typedef {object} QuotaFallbackNoneResult
 * @property {"none"} action
 * @property {"disabled"|"not_quota"|"backend_unsupported"} reason
 */

/**
 * Terminal result: the fallback chain is exhausted (or misconfigured); no hop
 * and no retry. Carries every pool exhausted so far so the caller can report
 * both reset times (#329 wants the operator to see each window).
 *
 * @typedef {object} QuotaFallbackStopResult
 * @property {"stop"} action
 * @property {"profile_missing"|"task_retry_spent"|"fallback_pool_exhausted"|"fallback_model_unresolved"|"same_pool"|"probe_exhausted"} reason
 * @property {string[]} exhaustedPools Pools exhausted so far — recorded hop pool first (when present), current classification last.
 * @property {(string|null)[]} resetAtRaw Reset text per pool, index-aligned with `exhaustedPools`.
 */

/**
 * Re-route result: a lane still pinned to the old pool hit the same
 * exhaustion; retry it onto the already-applied fallback (no new hop).
 *
 * @typedef {object} QuotaFallbackRetryResult
 * @property {"retry"} action
 * @property {string} toProfile
 * @property {string} toModel
 */

/**
 * Apply result: move the batch to the fallback profile (the single hop).
 *
 * @typedef {object} QuotaFallbackApplyResult
 * @property {"apply"} action
 * @property {string|null} fromProfile
 * @property {string} toProfile
 * @property {string|null} fromModel
 * @property {string} toModel
 * @property {string} exhaustedPool
 * @property {string} toPool
 */

/** @typedef {QuotaFallbackApplyResult|QuotaFallbackRetryResult|QuotaFallbackStopResult|QuotaFallbackNoneResult} QuotaFallbackDecision */

/**
 * Structural slice of the resolved spine config this module reads. The config
 * arrives untyped from config loading; this keeps checkJs honest without
 * pulling in the full config schema.
 *
 * @typedef {{ agents?: { activeProfile?: unknown, worker?: { model?: unknown }, profiles?: Record<string, any>, quotaFallbackProfile?: unknown } }} QuotaFallbackConfig
 */

/** Grace after the parsed reset time before the hop expires (provider clocks drift). */
export const QUOTA_FALLBACK_EXPIRY_GRACE_MS = 5 * 60 * 1000;

/** z.ai reset text carries no timezone; the provider's local time is assumed UTC+8 (#329). */
const ZAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

const ZAI_RESET_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const RETRY_IN_PATTERN = /^retry in (\d+(?:\.\d+)?)s$/i;

/**
 * Parses the raw provider reset text into an epoch-ms reset time. Pure.
 *
 * - z.ai `YYYY-MM-DD HH:MM:SS` → that wall-clock time read as UTC+8;
 * - Google `retry in <N>s` → `at + N*1000` (relative to when the error was seen);
 * - anything else (Kimi `10pm PT`, blank, non-string, impossible dates) → `null`.
 *
 * @param {unknown} resetAtRaw
 * @param {{ at?: Date|number|string|null }} [options] `at`: when the exhaustion was observed (hop time); needed for `retry in <N>s`.
 * @returns {number|null}
 */
export function parseQuotaResetAt(resetAtRaw, { at = null } = {}) {
	if (typeof resetAtRaw !== "string") return null;
	const text = resetAtRaw.trim();

	const zai = ZAI_RESET_PATTERN.exec(text);
	if (zai) {
		const [year, month, day, hour, minute, second] = zai.slice(1).map(Number);
		const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
		// Date.UTC rolls impossible values over (month 13, Feb 31); reject them.
		if (
			wall.getUTCFullYear() !== year ||
			wall.getUTCMonth() !== month - 1 ||
			wall.getUTCDate() !== day ||
			wall.getUTCHours() !== hour ||
			wall.getUTCMinutes() !== minute ||
			wall.getUTCSeconds() !== second
		) {
			return null;
		}
		return wall.getTime() - ZAI_UTC_OFFSET_MS;
	}

	const relative = RETRY_IN_PATTERN.exec(text);
	if (relative && at !== null && at !== undefined) {
		const base = new Date(at).getTime();
		if (!Number.isFinite(base)) return null;
		return base + Math.round(Number(relative[1]) * 1000);
	}
	return null;
}

/**
 * True when a persisted hop has a parsed reset time and `now` is past it plus
 * {@link QUOTA_FALLBACK_EXPIRY_GRACE_MS}. A hop without a parsable reset
 * (`resetAt` null/absent, including hops persisted before SP-843) never expires.
 *
 * @param {QuotaFallbackState|null|undefined} fallbackState
 * @param {Date|number} now
 * @returns {boolean}
 */
export function isQuotaFallbackExpired(fallbackState, now) {
	const resetAt = fallbackState?.resetAt;
	if (typeof resetAt !== "number" || !Number.isFinite(resetAt)) return false;
	const nowMs = new Date(now).getTime();
	return Number.isFinite(nowMs) && nowMs >= resetAt + QUOTA_FALLBACK_EXPIRY_GRACE_MS;
}

/**
 * Reads `agents.quotaFallbackProfile` from a resolved config. An unset,
 * non-string, or blank value disables fallback entirely (SP-805 lets `""`
 * clear the key).
 *
 * @param {QuotaFallbackConfig|undefined} config
 * @returns {string|null} Profile name, or null when fallback is disabled.
 */
function readFallbackProfileName(config) {
	const raw = config?.agents?.quotaFallbackProfile;
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	return trimmed === "" ? null : trimmed;
}

/**
 * Looks up a profile by name using the same membership rule as the config
 * schema (`Object.prototype.hasOwnProperty` on a plain object), so inherited
 * or malformed entries cannot fabricate a fallback target.
 *
 * @param {QuotaFallbackConfig|undefined} config
 * @param {string} name
 * @returns {{ worker?: { model?: unknown } } | null}
 */
function lookupProfile(config, name) {
	const profiles = config?.agents?.profiles;
	if (!profiles || typeof profiles !== "object") return null;
	if (!Object.prototype.hasOwnProperty.call(profiles, name)) return null;
	const profile = profiles[name];
	return profile && typeof profile === "object" ? /** @type {{ worker?: { model?: unknown } }} */ (profile) : null;
}

/**
 * Builds the parallel `exhaustedPools`/`resetAtRaw` report carried by every
 * stop result: the pool/reset recorded in the fallback state (when a hop
 * already happened), then the current classification's. Entries are appended
 * verbatim — a same-pool repeat keeps both reset readings, the later one
 * being the newer window — and stay index-aligned.
 *
 * @param {QuotaFallbackState|null} fallbackState
 * @param {ProviderQuotaError} classification
 * @returns {{exhaustedPools: string[], resetAtRaw: (string|null)[]}}
 */
function buildExhaustedReport(fallbackState, classification) {
	const exhaustedPools = [];
	const resetAtRaw = [];
	if (fallbackState) {
		exhaustedPools.push(fallbackState.exhaustedPool);
		resetAtRaw.push(typeof fallbackState.resetAtRaw === "string" ? fallbackState.resetAtRaw : null);
	}
	exhaustedPools.push(classification.poolId);
	resetAtRaw.push(typeof classification.resetAtRaw === "string" ? classification.resetAtRaw : null);
	return { exhaustedPools, resetAtRaw };
}

/**
 * Decides what the engine should do about a provider quota exhaustion, as a
 * pure function of its arguments. Precedence (first match wins):
 *
 * 1. `none/disabled` — `agents.quotaFallbackProfile` unset or blank.
 * 2. `none/not_quota` — no classification, or not `quota_exhausted`
 *    (transient overload never falls back, even mid-fallback).
 * 3. `none/backend_unsupported` — `agentSession` workers run in-process and
 *    ignore child env pins, so fallback cannot reach them.
 * 4. `stop/profile_missing` — fallback profile absent from `agents.profiles`
 *    (defensive: the schema normally rejects this; fail closed on drift).
 * 5. Fallback already applied (sticky until it expires or is cleared; one
 *    hop at a time). A hop that is expired at `now` counts as cleared, so a
 *    later exhaustion can hop again (SP-843):
 *    `stop/task_retry_spent` when the task already used its auto-retry;
 *    `retry` when the classification hits the original pool (a lane still
 *    pinned there) — re-route it, no new hop; otherwise
 *    `stop/fallback_pool_exhausted` (the fallback pool died too).
 * 6. `stop/fallback_model_unresolved` — fallback profile has no usable
 *    worker model (`missing`/`inherit`).
 * 7. `stop/same_pool` — fallback model shares the exhausted pool.
 * 8. `stop/probe_exhausted` — a live probe already reported the fallback
 *    pool exhausted.
 * 9. `apply` — perform the single hop.
 *
 * @param {object} [params]
 * @param {QuotaFallbackConfig} [params.config] Resolved spine config.
 * @param {QuotaFallbackState|null} [params.fallbackState] `state.resilience.quotaFallback ?? null`.
 * @param {ProviderQuotaError|null} [params.classification] SP-804 result.
 * @param {string} [params.taskId] Task the classification came from.
 * @param {string} [params.workerBackend] Resolved worker backend.
 * @param {string[]} [params.probeExhaustedPools] Pools a live probe reported exhausted.
 * @param {Date|number} [params.now] When set, an expired `fallbackState` is treated as cleared (SP-843). Omitted: no expiry check.
 * @returns {QuotaFallbackDecision}
 */
export function decideQuotaFallback({
	config,
	fallbackState: persistedFallbackState = null,
	classification = null,
	taskId,
	workerBackend,
	probeExhaustedPools,
	now,
} = {}) {
	const fallbackState =
		now !== undefined && isQuotaFallbackExpired(persistedFallbackState, now) ? null : persistedFallbackState;

	// Row 1 — no fallback target configured.
	const toProfileName = readFallbackProfileName(config);
	if (toProfileName === null) {
		return { action: "none", reason: "disabled" };
	}

	// Row 2 — transient overload and everything non-quota stays on the active profile.
	if (!classification || classification.kind !== "quota_exhausted") {
		return { action: "none", reason: "not_quota" };
	}

	// Row 3 — the in-process backend ignores child env, so a hop could not take effect.
	if (workerBackend === "agentSession") {
		return { action: "none", reason: "backend_unsupported" };
	}

	/** Stop results report every pool exhausted so far so callers can show both reset times. */
	/**
	 * @param {QuotaFallbackStopResult["reason"]} reason
	 * @returns {QuotaFallbackStopResult}
	 */
	const stop = (reason) => ({
		action: "stop",
		reason,
		...buildExhaustedReport(fallbackState, classification),
	});

	// Row 4 — fail closed on config drift instead of guessing a target.
	const targetProfile = lookupProfile(config, toProfileName);
	if (targetProfile === null) {
		return stop("profile_missing");
	}

	// Row 5 — sticky: while the hop is active, no second hop is decided. An
	// expired or cleared hop is `null` here, so the batch may hop again.
	if (fallbackState) {
		const retriedTaskIds = Array.isArray(fallbackState.retriedTaskIds) ? fallbackState.retriedTaskIds : [];
		if (taskId !== undefined && taskId !== null && retriedTaskIds.includes(taskId)) {
			return stop("task_retry_spent");
		}
		if (classification.poolId === fallbackState.exhaustedPool) {
			// A lane pinned to the old pool hit the same exhaustion: re-route it
			// to the fallback that is already applied (recorded in the state, so
			// later config edits cannot change the destination mid-batch).
			return { action: "retry", toProfile: fallbackState.toProfile, toModel: fallbackState.toModel };
		}
		return stop("fallback_pool_exhausted");
	}

	// Row 6 — `inherit`/missing resolves to the "unknown" pool, which can never
	// be a real destination, so it is refused before any pool comparison.
	const toModel = typeof targetProfile.worker?.model === "string" ? targetProfile.worker.model : null;
	if (toModel === null || toModel === "inherit") {
		return stop("fallback_model_unresolved");
	}

	// Row 7 — a fallback inside the exhausted pool buys nothing.
	const toPool = resolvePoolId(toModel);
	if (toPool === classification.poolId) {
		return stop("same_pool");
	}

	// Row 8 — trust the live probe over blind configuration.
	const probes = Array.isArray(probeExhaustedPools) ? probeExhaustedPools : [];
	if (probes.includes(toPool)) {
		return stop("probe_exhausted");
	}

	// Row 9 — the single hop.
	return {
		action: "apply",
		fromProfile: typeof config?.agents?.activeProfile === "string" ? config.agents.activeProfile : null,
		toProfile: toProfileName,
		fromModel: typeof config?.agents?.worker?.model === "string" ? config.agents.worker.model : null,
		toModel,
		exhaustedPool: classification.poolId,
		toPool,
	};
}

/**
 * Builds the persisted fallback state from an `apply` decision. Pure: the
 * timestamp comes from the injected `now`, and the returned object shares no
 * references with the decision or classification.
 *
 * @param {QuotaFallbackApplyResult} decision An `apply` result from {@link decideQuotaFallback}.
 * @param {object} params
 * @param {ProviderQuotaError} params.classification The classification that produced the decision.
 * @param {string} params.taskId Task whose failure triggered the hop.
 * @param {Date|number} params.now Injection point for the clock.
 * @returns {QuotaFallbackState}
 */
export function buildQuotaFallbackState(decision, { classification, taskId, now }) {
	const at = new Date(now);
	const resetAtRaw = typeof classification.resetAtRaw === "string" ? classification.resetAtRaw : null;
	return {
		fromProfile: decision.fromProfile,
		toProfile: decision.toProfile,
		fromModel: decision.fromModel,
		toModel: decision.toModel,
		exhaustedPool: decision.exhaustedPool,
		resetAtRaw,
		resetAt: parseQuotaResetAt(resetAtRaw, { at }),
		triggerTaskId: taskId,
		at: at.toISOString(),
		retriedTaskIds: [],
	};
}

/**
 * Records that a task consumed its one auto-retry onto the fallback pool.
 * Pure: returns a new state object and never mutates the input; appending an
 * already-recorded task is a no-op duplicate-wise (idempotent).
 *
 * @param {QuotaFallbackState} fallbackState State to evolve (must be an object).
 * @param {string} taskId Task that was retried.
 * @returns {QuotaFallbackState}
 * @throws {TypeError} When `fallbackState` is not an object, so a missing hop
 *   cannot silently produce an empty-looking state.
 */
export function markQuotaFallbackRetry(fallbackState, taskId) {
	if (!fallbackState || typeof fallbackState !== "object") {
		throw new TypeError("markQuotaFallbackRetry requires a QuotaFallbackState object");
	}
	const retriedTaskIds = Array.isArray(fallbackState.retriedTaskIds) ? fallbackState.retriedTaskIds : [];
	if (retriedTaskIds.includes(taskId)) {
		return { ...fallbackState, retriedTaskIds: [...retriedTaskIds] };
	}
	return { ...fallbackState, retriedTaskIds: [...retriedTaskIds, taskId] };
}
