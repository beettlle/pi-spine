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
 * - `clearExpiredQuotaFallback` / `clearQuotaFallbackByOperator` delete the hop
 *   (reset time passed, or explicit `spine batch quota-fallback clear`) and
 *   journal `batch.quota_fallback_cleared` once (SP-843, #350);
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
import {
	buildQuotaFallbackState,
	isQuotaFallbackExpired,
	markQuotaFallbackRetry,
} from "../quota-fallback.mjs";
import { loadMutableBatch } from "../retry.mjs";
import { loadSpineBatchState, updateSpineBatchState } from "../state-io.mjs";

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
 * Journals `batch.quota_fallback_cleared` for a hop that was just deleted.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {"expired"|"operator"} params.reason
 * @param {QuotaFallbackState} params.fallbackState The deleted hop.
 */
function journalQuotaFallbackCleared({ projectRoot, batchId, reason, fallbackState }) {
	appendJournalEvent(projectRoot, batchId, "batch.quota_fallback_cleared", {
		reason,
		fromProfile: fallbackState.fromProfile ?? null,
		toProfile: fallbackState.toProfile ?? null,
		exhaustedPool: fallbackState.exhaustedPool ?? null,
		resetAt: fallbackState.resetAt ?? null,
	});
}

/**
 * Clears the hop when its parsed reset time (plus grace) has passed: deletes
 * `state.resilience.quotaFallback`, persists, and journals
 * `batch.quota_fallback_cleared` with `reason: "expired"` exactly once. The
 * in-memory delete happens before the first `await`, so parallel lanes sharing
 * `state` in one engine process cannot both journal the clear. A hop with no
 * parsable reset time never expires.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Record<string, any>} params.state Live batch state (mutated in place, then persisted).
 * @param {Date|number} [params.now] Clock injection point (default `Date.now()`).
 * @returns {Promise<QuotaFallbackState|null>} The cleared hop, or null when nothing expired.
 */
export async function clearExpiredQuotaFallback({ projectRoot, batchId, state, now = Date.now() }) {
	const fallbackState = state.resilience?.quotaFallback;
	if (!fallbackState || typeof fallbackState !== "object" || !isQuotaFallbackExpired(fallbackState, now)) {
		return null;
	}
	delete state.resilience.quotaFallback;
	await saveEngineBatchState(projectRoot, state);
	journalQuotaFallbackCleared({ projectRoot, batchId, reason: "expired", fallbackState });
	return fallbackState;
}

/** Batch phases in which the operator may clear the hop (the engine is not mutating state). */
const OPERATOR_CLEAR_PHASES = new Set(["paused", "failed", "needs_retry"]);

/**
 * Operator `spine batch quota-fallback clear`: deletes the hop from a batch that
 * is not running and journals `batch.quota_fallback_cleared` with
 * `reason: "operator"`. Refuses while the batch runs (the engine would rewrite
 * the hop from its in-memory state) and when no hop is active.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @returns {{ ok: boolean, exitCode: number, error?: string, output: string, batchId?: string, phase?: string, cleared?: QuotaFallbackState, nextCommands?: string[] }}
 */
export function clearQuotaFallbackByOperator({ projectRoot }) {
	const loaded = loadMutableBatch(projectRoot);
	if (!loaded.ok) return loaded.result;
	const state = /** @type {Record<string, any>} */ (loaded.state);
	const batchId = String(state.batchId ?? "");
	const phase = String(state.phase ?? "");

	if (!OPERATOR_CLEAR_PHASES.has(phase)) {
		return {
			ok: false,
			exitCode: 1,
			error: "cannot_clear_quota_fallback",
			output: `Cannot clear the quota fallback while batch phase is ${phase}. Pause the batch first (paused, failed, or needs_retry batches only).\n`,
			batchId,
			phase,
		};
	}
	const fallbackState = state.resilience?.quotaFallback;
	if (!fallbackState || typeof fallbackState !== "object") {
		return {
			ok: false,
			exitCode: 1,
			error: "no_quota_fallback",
			output: `No quota fallback is active for batch ${batchId}.\n`,
			batchId,
			phase,
		};
	}

	const updated = updateSpineBatchState(projectRoot, (draft) => {
		if (!draft.resilience?.quotaFallback) return false;
		delete draft.resilience.quotaFallback;
		return true;
	});
	if (!updated.ok) {
		return {
			ok: false,
			exitCode: 1,
			error: updated.reason ?? "state_write_failed",
			output: `Could not clear the quota fallback: ${updated.reason ?? "state write failed"}.\n`,
			batchId,
			phase,
		};
	}
	if (!updated.changed) {
		return {
			ok: false,
			exitCode: 1,
			error: "no_quota_fallback",
			output: `No quota fallback is active for batch ${batchId}.\n`,
			batchId,
			phase,
		};
	}

	journalQuotaFallbackCleared({ projectRoot, batchId, reason: "operator", fallbackState });
	const failedTaskIds = (state.tasks ?? [])
		.filter((/** @type {any} */ task) => task?.status === "failed")
		.map((/** @type {any} */ task) => String(task.taskId));
	const nextCommands = [
		...failedTaskIds.map((/** @type {string} */ taskId) => `spine batch retry ${taskId}`),
		"spine batch resume",
	];
	return {
		ok: true,
		exitCode: 0,
		output:
			`Cleared quota fallback for batch ${batchId} (was ${fallbackState.exhaustedPool ?? "?"} → ${fallbackState.toProfile ?? "?"}).\n` +
			`Next: ${nextCommands.join(" , then ")}\n`,
		batchId,
		phase,
		cleared: fallbackState,
		nextCommands,
	};
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
	// The config arrives untyped; read the narrow slice this helper needs.
	const cfg = /** @type {{ agents?: { profiles?: Record<string, any>, worker?: { model?: unknown } } }} */ (config ?? {});
	const toProfile = typeof fallbackState?.toProfile === "string" ? fallbackState.toProfile.trim() : "";
	if (toProfile) {
		const profileModel = cfg.agents?.profiles?.[toProfile]?.worker?.model;
		if (typeof profileModel === "string" && profileModel !== "") {
			return profileModel;
		}
	}
	const configured = cfg.agents?.worker?.model;
	return typeof configured === "string" ? configured : undefined;
}

/**
 * Read-only load of the persisted quota fallback for a worker spawn
 * (`runWorker` must never write batch state). Returns the fallback state when
 * the on-disk batch state belongs to `batchId` and carries one; `null` when
 * the state file is missing, unreadable, stale (different batch), has no
 * active hop, or the hop is expired at `now` (SP-843) — in every case the
 * caller behaves as if no override exists. The expired hop is only ignored
 * here; the engine deletes and journals it via {@link clearExpiredQuotaFallback}.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Date|number} [params.now] Clock injection point (default `Date.now()`).
 * @returns {QuotaFallbackState|null}
 */
export function loadQuotaFallbackForWorker({ projectRoot, batchId, now = Date.now() }) {
	if (!projectRoot || !batchId) return null;
	const loaded = loadSpineBatchState(projectRoot);
	const state = loaded.raw;
	if (!state || typeof state !== "object") return null;
	if (String(state.batchId ?? "") !== String(batchId)) return null;
	const fallback = state.resilience?.quotaFallback;
	if (!fallback || typeof fallback !== "object") return null;
	return isQuotaFallbackExpired(fallback, now) ? null : fallback;
}

/**
 * One-call resolution of everything `runWorker` needs for the sticky
 * override: the persisted fallback (read-only), the effective worker model
 * (fallback profile model when a hop is active, else the configured worker
 * model), and the child env with the profile override merged UNDER the
 * caller's `extraEnv` (caller keys win — e.g. matrix row identity, #229).
 * Kept here so `worker-host.mjs` stays under its 500-LOC module cap.
 *
 * @param {object} params
 * @param {string} [params.projectRoot]
 * @param {string} [params.batchId]
 * @param {object|undefined} params.config Resolved spine config.
 * @param {Record<string, string>} [params.extraEnv] Caller-supplied child env.
 * @param {Date|number} [params.now] Clock injection point (default `Date.now()`).
 * @returns {{ fallback: QuotaFallbackState|null, workerModel: string|undefined, extraEnv: Record<string, string> }}
 */
export function resolveWorkerQuotaFallbackContext({ projectRoot, batchId, config, extraEnv, now = Date.now() }) {
	const fallback = projectRoot && batchId ? loadQuotaFallbackForWorker({ projectRoot, batchId, now }) : null;
	return {
		fallback,
		workerModel: resolveEffectiveWorkerModel(config, fallback),
		extraEnv: { ...quotaFallbackWorkerEnv(fallback), ...(extraEnv ?? {}) },
	};
}
