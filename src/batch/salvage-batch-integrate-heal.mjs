/**
 * Heal failed-task gates after a successful salvage integrate (#292 / SP-763).
 *
 * When `spine batch salvage --lane N --integrate` lands lane work on the base
 * branch, the active batch state still records the salvaged tasks as failed
 * (status "failed", failed segment, failedTasks counter), so
 * `spine batch complete` keeps refusing (`needs_retry` / `pending_lane_land`)
 * and operators are forced to `dismiss --force`. Once the land succeeded there
 * is no unresolved failure left for those tasks, so the failed-task gate is
 * healed here: each salvageable task is promoted with `recordTaskSucceeded`
 * (task status, segments, and succeeded/failed counters in one step) and a
 * reconciled `task.completed` journal event keeps journal-derived rebuilds in
 * agreement — the same promotion `reconcileBatchStateDrift` applies on
 * done-in-lane terminal evidence.
 *
 * Tasks outside the salvage set are never touched: non-salvageable failures
 * (contract/review failures) and evidence-less worker deaths remain failed and
 * keep blocking complete (SP-763 completion criteria).
 *
 * SP-862 / #374: when the heal leaves zero non-terminal tasks, the batch has no
 * unresolved failure left, so the state also records `salvageLandedAllTasks`
 * evidence (+ a `batch.salvage_landed_all_tasks` journal event). `complete` and
 * `dismiss` use it to accept the salvage land as the batch's merge evidence —
 * salvage merges lane task branches onto base, not the batch orch branch, so
 * the orch-based merge gates (`mergeSatisfied`, needs_merge dismiss gate) would
 * otherwise keep refusing and force `dismiss --force`. Fail-closed: the
 * evidence alone never opens a gate — complete/dismiss still require every
 * task terminal-success at gate time, so a later retry that re-opens tasks
 * re-arms the refusal.
 */

import { loadBatchStateFile } from "./batch-state-io.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { recordTaskSucceeded, saveSpineBatchState } from "./state.mjs";

/**
 * Heal the failed-task gate for a lane a salvage integrate just landed, and
 * journal `batch.salvage_heal_failed` when the heal itself fails without
 * failing the integrate — the merge has already landed (#292 / SP-763).
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} lane
 * @param {string|null} mergeCommit
 * @returns {{ ok: boolean, healedTaskIds: string[], healError: string|null }}
 */
export function healAfterSalvageLand(projectRoot, batchId, lane, mergeCommit) {
	const heal = healSalvagedTasksAfterIntegrate(projectRoot, batchId, {
		salvageableTasks: lane.salvageableTasks ?? [],
		mergeCommit,
	});
	if (!heal.ok) {
		appendJournalEvent(projectRoot, batchId, "batch.salvage_heal_failed", {
			laneNumber: lane.laneNumber ?? null,
			salvageableTasks: lane.salvageableTasks ?? [],
			reason: heal.reason,
			error: heal.error,
		});
	}
	return { ok: heal.ok, healedTaskIds: heal.healedTaskIds, healError: heal.ok ? null : heal.error };
}

/**
 * Heal the failed-task gate for tasks whose lane work a salvage integrate just
 * landed on the base branch. Never throws into the salvage path: the merge has
 * already landed, so a heal problem is reported as a result, not a command
 * failure.
 *
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {object} [options]
 * @param {string[]} [options.salvageableTasks] Task ids the salvage landed.
 * @param {string|null} [options.mergeCommit] Salvage merge commit, when known.
 * @returns {{ ok: boolean, healedTaskIds: string[], reason: string|null, error: string|null }}
 */
export function healSalvagedTasksAfterIntegrate(projectRoot, batchId, options = {}) {
	const salvageableTasks = (options.salvageableTasks ?? []).map((taskId) => String(taskId ?? "")).filter(Boolean);
	const mergeCommit = options.mergeCommit ?? null;
	if (salvageableTasks.length === 0) {
		return { ok: true, healedTaskIds: [], reason: "no_salvageable_tasks", error: null };
	}

	try {
		const loaded = loadBatchStateFile(projectRoot);
		// Salvage also runs against archived batches; without an active state
		// there is no gate to heal and `complete` is not applicable anyway.
		if (!loaded.path || !loaded.raw) {
			return { ok: true, healedTaskIds: [], reason: "no_active_batch_state", error: null };
		}
		if (loaded.parseError) {
			return { ok: false, healedTaskIds: [], reason: "batch_state_unreadable", error: loaded.parseError };
		}
		const stateBatchId = String(loaded.raw.batchId ?? loaded.raw.id ?? "");
		if (stateBatchId !== batchId) {
			return { ok: true, healedTaskIds: [], reason: "batch_id_mismatch", error: null };
		}

		const healedTaskIds = [];
		for (const taskId of salvageableTasks) {
			const task = (loaded.raw.tasks ?? []).find(
				(entry) => entry && typeof entry === "object" && entry.taskId === taskId,
			);
			if (!task) continue;
			const status = String(task.status ?? "").toLowerCase();
			if (status === "succeeded" || status === "skipped") continue;
			if (!recordTaskSucceeded(loaded.raw, taskId, { exitReason: "done", doneFileFound: true })) continue;
			healedTaskIds.push(taskId);
			appendJournalEvent(projectRoot, batchId, "task.completed", {
				taskId,
				laneNumber: task.laneNumber ?? null,
				reconciled: true,
				reconcileReason: "salvage_integrated",
				mergeCommit,
			});
		}

		if (healedTaskIds.length === 0) {
			return { ok: true, healedTaskIds, reason: "nothing_to_heal", error: null };
		}

		// SP-862 / #374: no unresolved task remains after this heal — record the
		// salvage land as batch-level merge evidence so complete/dismiss can accept
		// it without --force (see module docstring for the fail-closed contract).
		if (allTasksTerminalSuccess(loaded.raw)) {
			loaded.raw.salvageLandedAllTasks = {
				at: Date.now(),
				mergeCommit: mergeCommit ?? null,
				tasks: [...healedTaskIds],
			};
			appendJournalEvent(projectRoot, batchId, "batch.salvage_landed_all_tasks", {
				mergeCommit: mergeCommit ?? null,
				healedTaskIds: [...healedTaskIds],
			});
		}

		saveSpineBatchState(projectRoot, loaded.raw);
		return { ok: true, healedTaskIds, reason: null, error: null };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, healedTaskIds: [], reason: "heal_threw", error: message };
	}
}

/**
 * True when every task in the raw batch state is terminal-success
 * (`succeeded` / `skipped`) — i.e. no unresolved failure is left after the
 * salvage heal. Unknown/missing statuses fail closed.
 *
 * @param {object} raw
 * @returns {boolean}
 */
function allTasksTerminalSuccess(raw) {
	const tasks = Array.isArray(raw?.tasks) ? raw.tasks : [];
	if (tasks.length === 0) return false;
	return tasks.every((task) => {
		if (!task || typeof task !== "object") return false;
		const status = String(task.status ?? "").toLowerCase();
		return status === "succeeded" || status === "skipped";
	});
}
