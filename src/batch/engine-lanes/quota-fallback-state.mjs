/**
 * Persisted quota-fallback state helpers (SP-808, partial #329).
 *
 * SP-807 (`../quota-fallback.mjs`) decides and shapes the single-hop fallback;
 * this module owns the side effects the engine lane paths need (SP-809 wires
 * the calls):
 *
 * - `applyQuotaFallback` persists `state.resilience.quotaFallback` and
 *   journals `batch.quota_fallback_applied` exactly once per hop;
 * - `recordQuotaFallbackRetry` appends the retried task and journals
 *   `task.quota_fallback_retry`;
 * - `recordQuotaFallbackExhausted` journals `batch.quota_fallback_exhausted`
 *   with every exhausted pool and its reset text;
 * - `quotaFallbackWorkerEnv` / `resolveEffectiveWorkerModel` /
 *   `loadQuotaFallbackForWorker` let `runWorker` re-apply the persisted hop to
 *   every later worker spawn (sticky override) and report the model actually
 *   used, all read-only.
 *
 * Persistence uses `saveEngineBatchState` — the same saver the engine lane
 * paths use (`engine-lanes/matrix-run.mjs`) — so an operator pause already on
 * disk or in the journal is never clobbered by the whole-file write.
 */

import { appendJournalEvent } from "../journal.mjs";
import { saveEngineBatchState } from "../pause.mjs";
import { buildQuotaFallbackState, markQuotaFallbackRetry } from "../quota-fallback.mjs";
import { loadSpineBatchState } from "../state-io.mjs";

/** @typedef {import("../quota-fallback.mjs").QuotaFallbackState} QuotaFallbackState */
/** @typedef {import("../quota-fallback.mjs").QuotaFallbackApplyResult} QuotaFallbackApplyResult */
/** @typedef {import("../quota-fallback.mjs").QuotaFallbackStopResult} QuotaFallbackStopResult */
/** @typedef {import("../provider-quota.mjs").ProviderQuotaError} ProviderQuotaError */

/**
 * Applies the single quota-fallback hop: builds the persisted state from the
 * SP-807 `apply` decision, stores it at `state.resilience.quotaFallback`,
 * persists the batch state, and journals `batch.quota_fallback_applied`. The
 * hop is sticky — callers must invoke this at most once per batch (the SP-807
 * decision layer refuses a second hop while a fallback state exists).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Record<string, any>} params.state Live batch state (mutated in place, then persisted).
 * @param {QuotaFallbackApplyResult} params.decision An `apply` result from `decideQuotaFallback`.
 * @param {ProviderQuotaError} params.classification Classification that produced the decision.
 * @param {string} params.taskId Task whose failure triggered the hop.
 * @param {Date|number} params.now Clock injection point.
 * @returns {Promise<QuotaFallbackState>} The persisted fallback state.
 */
export async function applyQuotaFallback({ projectRoot, batchId, state, decision, classification, taskId, now }) {
	const fallbackState = buildQuotaFallbackState(decision, { classification, taskId, now });
	if (!state.resilience || typeof state.resilience !== "object") {
		state.resilience = {};
	}
	state.resilience.quotaFallback = fallbackState;
	await saveEngineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "batch.quota_fallback_applied", {
		fromProfile: fallbackState.fromProfile,
		toProfile: fallbackState.toProfile,
		fromModel: fallbackState.fromModel,
		toModel: fallbackState.toModel,
		exhaustedPool: fallbackState.exhaustedPool,
		resetAtRaw: fallbackState.resetAtRaw,
		taskIds: [taskId],
	});
	return fallbackState;
}

/**
 * Records that a task consumed its one auto-retry onto the fallback pool:
 * appends the taskId to the persisted state (SP-807 `markQuotaFallbackRetry`,
 * idempotent), persists, and journals `task.quota_fallback_retry` with the
 * fallback destination.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Record<string, any>} params.state Live batch state carrying `resilience.quotaFallback`.
 * @param {string} params.taskId Task that was retried.
 * @returns {Promise<QuotaFallbackState>} The evolved fallback state.
 */
export async function recordQuotaFallbackRetry({ projectRoot, batchId, state, taskId }) {
	if (!state.resilience || typeof state.resilience !== "object") {
		state.resilience = {};
	}
	const fallbackState = markQuotaFallbackRetry(state.resilience.quotaFallback, taskId);
	state.resilience.quotaFallback = fallbackState;
	await saveEngineBatchState(projectRoot, state);
	appendJournalEvent(projectRoot, batchId, "task.quota_fallback_retry", {
		taskId,
		toProfile: fallbackState.toProfile,
		toModel: fallbackState.toModel,
	});
	return fallbackState;
}

/**
 * Journals `batch.quota_fallback_exhausted` for a SP-807 `stop` decision. The
 * payload carries every exhausted pool and its index-aligned raw reset text
 * (#329: the operator must see both reset windows when the fallback pool dies
 * too). Pure journal side effect — no state mutation.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {QuotaFallbackStopResult} params.decision A `stop` result from `decideQuotaFallback`.
 * @param {string} params.taskId Task whose failure produced the stop.
 */
export function recordQuotaFallbackExhausted({ projectRoot, batchId, decision, taskId }) {
	appendJournalEvent(projectRoot, batchId, "batch.quota_fallback_exhausted", {
		taskId,
		reason: decision.reason,
		exhaustedPools: Array.isArray(decision.exhaustedPools) ? [...decision.exhaustedPools] : [],
		resetAtRaw: Array.isArray(decision.resetAtRaw) ? [...decision.resetAtRaw] : [],
	});
}

/**
 * Maps a persisted fallback state to the child-env override every later worker
 * spawn must receive (SP-805 resolves `SPINE_AGENT_PROFILE_OVERRIDE` at config
 * load). Returns `{}` when no hop is active so callers can merge blindly.
 *
 * @param {QuotaFallbackState|null|undefined} fallbackState
 * @returns {Record<string, string>}
 */
export function quotaFallbackWorkerEnv(fallbackState) {
	const toProfile = typeof fallbackState?.toProfile === "string" ? fallbackState.toProfile.trim() : "";
	if (!toProfile) return {};
	return { SPINE_AGENT_PROFILE_OVERRIDE: toProfile };
}

/**
 * Resolves the worker model that is actually in effect: when a fallback hop is
 * active, the fallback profile's worker model; otherwise the configured worker
 * model. Used for quota classification and for the journaled `model` field so
 * both tell the truth after a hop. Returns `undefined` when neither source
 * yields a string (matching the pre-SP-808 `typeof === "string"` contract).
 *
 * @param {object|undefined} config Resolved spine config.
 * @param {QuotaFallbackState|null|undefined} fallbackState
 * @returns {string|undefined}
 */
export function resolveEffectiveWorkerModel(config, fallbackState) {
	const toProfile = typeof fallbackState?.toProfile === "string" ? fallbackState.toProfile.trim() : "";
	if (toProfile) {
		const profileModel = config?.agents?.profiles?.[toProfile]?.worker?.model;
		if (typeof profileModel === "string" && profileModel !== "") {
			return profileModel;
		}
	}
	const configured = config?.agents?.worker?.model;
	return typeof configured === "string" ? configured : undefined;
}

/**
 * Read-only load of the persisted quota fallback for a worker spawn
 * (`runWorker` must never write batch state). Returns the fallback state when
 * the on-disk batch state belongs to `batchId` and carries one; `null` when
 * the state file is missing, unreadable, stale (different batch), or has no
 * active hop — in every case the caller behaves as if no override exists.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @returns {QuotaFallbackState|null}
 */
export function loadQuotaFallbackForWorker({ projectRoot, batchId }) {
	if (!projectRoot || !batchId) return null;
	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	if (!state || typeof state !== "object") return null;
	if (String(state.batchId ?? "") !== String(batchId)) return null;
	const fallback = state.resilience?.quotaFallback;
	return fallback && typeof fallback === "object" ? fallback : null;
}
