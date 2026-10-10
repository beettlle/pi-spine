/**
 * In-lane automatic single-hop quota fallback retry (SP-809, partial #329).
 *
 * Wraps one lane task run (`runOnce`) so a `provider_quota_exhausted` failure
 * re-routes the batch onto the fallback profile exactly once and retries the
 * task once in the same lane worktree, without an operator `spine batch retry`:
 *
 * - SP-807 (`../quota-fallback.mjs`) decides the action; SP-808
 *   (`./quota-fallback-state.mjs`) owns the persisted hop at
 *   `state.resilience.quotaFallback`, the journal events, and the sticky
 *   `SPINE_AGENT_PROFILE_OVERRIDE` the worker host re-applies to every later
 *   spawn;
 * - the decide → apply section stays synchronous (no `await` between reading
 *   `state.resilience.quotaFallback` in `decideQuotaFallback` and the write at
 *   the top of `applyQuotaFallback`), so parallel lanes sharing the in-memory
 *   `state` in one engine process produce exactly one
 *   `batch.quota_fallback_applied` — the second lane sees the sticky hop and
 *   gets `retry` instead;
 * - `stop` journals `batch.quota_fallback_exhausted` and returns the original
 *   failure; `none` returns it untouched (journal unchanged, pre-fallback
 *   behaviour); every non-quota classification and every `ok` result passes
 *   straight through;
 * - the retry reuses the lane worktree (partial work kept) and runs `runOnce`
 *   exactly once more; a second quota failure is only journaled, never retried
 *   again (the SP-807 decision returns `stop/task_retry_spent` for a task
 *   already in `retriedTaskIds`).
 *
 * Matrix tasks, reviewer, and supervisor runs are out of scope by design.
 */

import {
	applyQuotaFallback,
	recordQuotaFallbackExhausted,
	recordQuotaFallbackRetry,
	resolveEffectiveWorkerModel,
} from "./quota-fallback-state.mjs";
import { decideQuotaFallback } from "../quota-fallback.mjs";
import { resetTaskForRetry } from "../state.mjs";
import { saveEngineBatchState } from "../pause.mjs";

/**
 * @typedef {import("../provider-quota.mjs").ProviderQuotaError} ProviderQuotaError
 */

/**
 * Pins `task.workerModel` to the model the next `runOnce()` will actually use,
 * so run-metrics report the configured model before a hop and the fallback
 * profile's model after it (SP-808 `buildTaskMetricRecord` prefers the field).
 *
 * @param {Record<string, any>} state
 * @param {Record<string, any>|undefined} config
 * @param {string} taskId
 * @returns {void}
 */
function pinTaskWorkerModel(state, config, taskId) {
	const task = (state.tasks ?? []).find((/** @type {any} */ entry) => entry?.taskId === taskId);
	if (task && typeof task === "object") {
		task.workerModel = resolveEffectiveWorkerModel(config, state.resilience?.quotaFallback);
	}
}

/**
 * Runs `runOnce` with automatic single-hop quota fallback (#329): decide
 * synchronously on a `provider_quota_exhausted` failure, apply the persisted
 * hop at most once per batch, reset the task, and retry once in the same lane
 * worktree. Any second quota failure is only journaled (`stop`), never retried.
 *
 * @param {() => Promise<{ ok: boolean, [key: string]: any }>} runOnce One lane
 *   task run (the `runNonMatrixTaskOnLane` / `runResumedTaskOnLane` call).
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.batchId
 * @param {Record<string, any>} params.state Live in-memory batch state (mutated in place).
 * @param {string} params.taskId
 * @param {Record<string, any>|undefined} params.config Resolved spine config.
 * @param {string} params.workerBackend Resolved worker backend (SP-807 refuses `agentSession`).
 * @param {Date|number} [params.now] Clock injection point (default `Date.now()`).
 * @returns {Promise<{ ok: boolean, [key: string]: any }>} The retry result when
 *   a retry ran, otherwise the original `runOnce` result unchanged.
 */
export async function runWithQuotaFallback(
	runOnce,
	{ projectRoot, batchId, state, taskId, config, workerBackend, now = Date.now() },
) {
	pinTaskWorkerModel(state, config, taskId);
	const result = await runOnce();
	if (result.ok || result.workerResult?.classification !== "provider_quota_exhausted") {
		return result;
	}
	const classification =
		/** @type {ProviderQuotaError | null} */ (result.workerResult?.providerQuota ?? null);
	// A quota exit without the SP-806 payload cannot drive a decision; the
	// SP-807 truth table would answer `none/not_quota`, so bail out here.
	if (!classification) {
		return result;
	}

	// Synchronous decide → apply section: no `await` between the read inside
	// decideQuotaFallback and the `state.resilience.quotaFallback` write at the
	// top of applyQuotaFallback, so parallel lanes cannot both decide `apply`.
	const decision = decideQuotaFallback({
		config,
		fallbackState: state.resilience?.quotaFallback ?? null,
		classification,
		taskId,
		workerBackend,
	});
	if (decision.action === "stop") {
		recordQuotaFallbackExhausted({ projectRoot, batchId, decision, taskId });
		return result;
	}
	if (decision.action === "none") {
		return result;
	}
	if (decision.action === "apply") {
		await applyQuotaFallback({
			projectRoot,
			batchId,
			state,
			decision,
			classification,
			taskId,
			now,
		});
	}

	// `apply` and `retry` both retry the task once: record the consumed retry,
	// reset the failed task for a fresh run (counters recomputed), persist, and
	// pin the now-effective fallback model before the run so metrics stay true.
	await recordQuotaFallbackRetry({ projectRoot, batchId, state, taskId });
	resetTaskForRetry(state, taskId);
	pinTaskWorkerModel(state, config, taskId);
	await saveEngineBatchState(projectRoot, state);
	const retried = await runOnce();
	if (
		!retried.ok &&
		retried.workerResult?.classification === "provider_quota_exhausted"
	) {
		// Decision runs once more only to journal exhaustion — the task is in
		// `retriedTaskIds`, so SP-807 can only answer `stop`; never a second hop.
		const second = decideQuotaFallback({
			config,
			fallbackState: state.resilience?.quotaFallback ?? null,
			classification: /** @type {ProviderQuotaError | null} */ (retried.workerResult?.providerQuota ?? null),
			taskId,
			workerBackend,
		});
		if (second.action === "stop") {
			recordQuotaFallbackExhausted({ projectRoot, batchId, decision: second, taskId });
		}
	}
	return retried;
}
