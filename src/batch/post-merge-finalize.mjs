// @ts-nocheck
/**
 * Post-merge finalize leaf — wave-merge finalize hook without the limbo module graph (SP-734 / #267).
 *
 * Cycle-safe imports only (`journal.mjs`, `merge/wave-merge-state.mjs`). The heavy
 * dependencies (`detectPostMergeLimboForResume` from resume-multi-validate.mjs and
 * `tryFinalizePostMergeLimbo` from post-merge-limbo.mjs, which transitively pull in
 * gate.mjs → reconcile → resume-multi) are injected via `createMaybeFinalizeAfterWaveMerge`
 * so `engine-lanes/merge.mjs` never imports `post-merge-limbo.mjs`.
 */

import { readJournalEvents } from "./journal.mjs";
import { recordWaveMergeResult } from "./merge/wave-merge-state.mjs";

/**
 * Sync missing mergeResults rows from journal merge_completed events (SP-378, GitHub #59).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {object} params.state
 * @param {string} params.batchId
 */
export function hydrateMergeResultsFromJournal({ projectRoot, state, batchId }) {
	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) {
		return false;
	}

	const events = readJournalEvents(projectRoot, batchId);
	const mergeCompleted = events.filter((event) => event.type === "batch.merge_completed");
	if (mergeCompleted.length < 1) {
		return false;
	}

	let changed = false;
	for (let waveIndex = 0; waveIndex < totalWaves; waveIndex++) {
		const waveEvents = mergeCompleted.filter(
			(event) => Number(event.payload?.waveIndex ?? -1) === waveIndex,
		);
		if (waveEvents.length < 1) {
			continue;
		}

		const existing = (state.mergeResults ?? []).find((entry) => entry?.waveIndex === waveIndex);
		if (existing && String(existing.status ?? "") === "succeeded") {
			continue;
		}

		const lastEvent = waveEvents.at(-1);
		const mergeCommit =
			typeof lastEvent?.payload?.mergeCommit === "string" ? lastEvent.payload.mergeCommit : null;
		recordWaveMergeResult({
			state,
			waveIndex,
			status: "succeeded",
			mergeCommit,
		});
		changed = true;
	}

	return changed;
}

/**
 * @param {object|null|undefined} state
 * @param {number} waveIndex
 */
export function isLastWaveIndex(state, waveIndex) {
	if (!state || typeof state !== "object") return false;
	const totalWaves = Number(state.totalWaves ?? state.wavePlan?.length ?? 0);
	if (!Number.isFinite(totalWaves) || totalWaves <= 0) return false;
	return waveIndex >= totalWaves - 1;
}

/**
 * Build the post-wave-merge finalize hook with injected limbo dependencies (SP-734).
 * Keeps `engine-lanes/merge.mjs` free of the post-merge-limbo → gate → reconcile →
 * resume-multi import cycle: callers that already own the limbo graph inject the real
 * implementations.
 *
 * @param {object} deps
 * @param {(params: { projectRoot: string, state: object }) => boolean} deps.detectPostMergeLimbo
 * @param {(params: object) => object|null} deps.tryFinalizeLimbo
 * @returns {(params: object) => object|null}
 */
export function createMaybeFinalizeAfterWaveMerge({ detectPostMergeLimbo, tryFinalizeLimbo }) {
	/**
	 * Finalize immediately after the last wave merge so post-merge limbo never opens
	 * (SP-280, SP-281 — attached engine + resume orphan race).
	 *
	 * @param {object} params
	 * @param {string} params.projectRoot
	 * @param {object} params.state
	 * @param {string} params.batchId
	 * @param {string} params.orchBranch
	 * @param {number} params.waveIndex
	 * @param {boolean} [params.resumed]
	 * @param {boolean} [params.resumeForced]
	 */
	return function maybeFinalizeAfterWaveMerge({
		projectRoot,
		state,
		batchId,
		orchBranch,
		waveIndex,
		resumed = false,
		resumeForced = false,
	}) {
		if (String(state.phase ?? "") === "completed") {
			return null;
		}
		hydrateMergeResultsFromJournal({ projectRoot, state, batchId: String(state.batchId ?? "") });
		if (!isLastWaveIndex(state, waveIndex)) {
			return null;
		}
		if (!detectPostMergeLimbo({ projectRoot, state })) {
			return null;
		}
		return tryFinalizeLimbo({
			projectRoot,
			state,
			batchId,
			orchBranch,
			resumed,
			resumeForced,
		});
	};
}
