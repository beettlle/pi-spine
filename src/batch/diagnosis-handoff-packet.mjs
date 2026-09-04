// @ts-nocheck
/**
 * Diagnose handoff packet fields (#278 / SP-745) — SBAR Background + Assessment rationale.
 * Kept out of diagnosis.mjs so the parent stays under the phase23 LOC cap.
 */

/**
 * SBAR Background — short decision-relevant facts that explain the state the
 * assessment was derived from. Facts are additive; consumers that ignore
 * unknown fields keep working.
 *
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {string[]}
 */
export function buildBackground(diagnosis, ctx = {}) {
	const facts = [];
	if (ctx.batchId) {
		facts.push(`Batch: ${ctx.batchId}`);
	}
	if (ctx.phase || ctx.macroPhase) {
		facts.push(`Phase: ${ctx.phase ?? "unknown"}${ctx.macroPhase ? ` (macro: ${ctx.macroPhase})` : ""}`);
	}
	if (ctx.totalTasks != null) {
		const progressBits = [`${ctx.succeededTasks ?? 0}/${ctx.totalTasks} tasks succeeded`];
		if (ctx.failedTasks) progressBits.push(`${ctx.failedTasks} failed`);
		if (ctx.pendingTaskCount) progressBits.push(`${ctx.pendingTaskCount} pending`);
		facts.push(`Progress: ${progressBits.join(", ")}`);
	}
	if (ctx.failedTaskId) {
		facts.push(
			`Failed task: ${ctx.failedTaskId}${ctx.exitReason ? ` (exit: ${ctx.exitReason})` : ""}`,
		);
	}
	if (ctx.launchFailureKind) {
		facts.push(`Launch failure kind: ${ctx.launchFailureKind}`);
	}
	if (ctx.engineStillRunning === true && ctx.enginePid != null) {
		facts.push(`Engine PID ${ctx.enginePid} is still running`);
	}
	if (ctx.staleEnginePid === true && ctx.enginePid != null) {
		facts.push(`Engine PID ${ctx.enginePid} is stale (process not alive)`);
	}
	if (ctx.engineOrphanCause) {
		facts.push(`Engine orphan cause: ${ctx.engineOrphanCause}`);
	}
	if (ctx.mergeFailed) {
		facts.push(
			`Lane merge failed${ctx.failedWaveIndex != null ? ` (wave index ${ctx.failedWaveIndex})` : ""}`,
		);
	}
	if (ctx.gitMerged === true) {
		facts.push(`Orch branch already merged to ${ctx.baseBranch ?? "base"}`);
	}
	if (ctx.integrateGateOpen === true) {
		facts.push("Integrate gate is open");
	}
	if (ctx.salvageRetryCommand) {
		facts.push(`Tried: ${ctx.salvageRetryCommand}`);
	}
	if (Array.isArray(ctx.journalHints)) {
		for (const hint of ctx.journalHints) {
			if (typeof hint === "string") {
				facts.push(`Journal: ${hint}`);
			} else if (hint && typeof hint === "object" && (hint.summary || hint.type)) {
				facts.push(`Journal: ${hint.type ?? "event"}${hint.summary ? ` — ${hint.summary}` : ""}`);
			}
		}
	}
	return facts;
}

/**
 * SBAR Assessment rationale — why this diagnosis enum was selected from
 * reconcile signals, not just its label.
 *
 * @param {string} diagnosis
 * @param {object} ctx
 * @returns {string}
 */
export function buildAssessmentReason(diagnosis, ctx = {}) {
	switch (diagnosis) {
		case "engine_still_running":
			return `Engine PID ${ctx.enginePid ?? "?"} is alive, so completion was refused to avoid clobbering an active run`;
		case "limbo_stale":
			return "Batch ended but state is stale and no engine or worker is active — only a dismiss can clear it";
		case "completed_manual":
			return "Work is already on the base branch while the batch record is still active — operator completed it manually";
		case "needs_retry":
			if (ctx.failedTaskId && ctx.exitReason) {
				return `Task ${ctx.failedTaskId} exited "${ctx.exitReason}" without completing its contract, so the batch cannot proceed until it is retried`;
			}
			if (ctx.failedTaskId) {
				return `Worker for task ${ctx.failedTaskId} died before writing .DONE, so the batch cannot proceed until it is retried`;
			}
			return "Failed phase left only pending tasks with no live workers — retry limbo resolves as a retry";
		case "state_drift":
			return ctx.failedTaskId
				? `Journal history for task ${ctx.failedTaskId} disagrees with the batch-state cache — no single source of truth`
				: "Journal history disagrees with the batch-state cache — no single source of truth";
		case "worker_orphaned":
			if (ctx.engineDead) {
				return `Engine and lane worker both died while task ${ctx.failedTaskId ?? "?"} was still running`;
			}
			if (ctx.ghostRunningCluster) {
				return `Lane worker died but multiple tasks are still marked running (ghost running cluster)${ctx.failedTaskId ? `, e.g. ${ctx.failedTaskId}` : ""}`;
			}
			return `Lane worker stopped while task ${ctx.failedTaskId ?? "?"} was still marked running — heartbeats ended without a terminal journal event`;
		case "worker_done_missing":
			return `Task ${ctx.failedTaskId ?? "?"} reported progress in the journal but no .DONE file was found in the lane or batch tasks root`;
		case "engine_orphaned":
			if (ctx.engineOrphanCause) {
				return `Engine process is gone (${ctx.engineOrphanCause}) while tasks were still running`;
			}
			return `Engine process died mid-run${ctx.failedTaskId ? ` with task ${ctx.failedTaskId} still running` : ""} — journal has no engine shutdown event`;
		case "needs_merge":
			return "All assigned tasks finished in their lanes, but lane merges into the orch branch are still pending";
		case "needs_integrate":
			if (ctx.integrateGateOpen) {
				return "Land loop is paused at the integrate gate with the gate open — approval continues the land";
			}
			return `Tasks are terminal-success and merged to the orch branch, which is not yet integrated into ${ctx.baseBranch ?? "base"}`;
		case "needs_replan":
			return ctx.failedTaskId
				? `Task ${ctx.failedTaskId} failed in a way that requires a contract (PROMPT.md) change, not just a retry`
				: "Failed tasks require a contract (PROMPT.md) change, not just a retry";
		case "running":
			return "Engine and workers are alive with no failure, drift, or orphan signals observed";
		case "paused":
			return `Batch was paused by an operator or gate with ${ctx.pendingTaskCount ?? 0} task(s) pending — resume continues from journal state`;
		case "failed":
			return `Batch recorded failure in phase ${ctx.phase ?? "unknown"} (${ctx.failedTasks ?? 0} failed task(s)) with no recoverable retry path`;
		case "aborted":
			return "Batch was aborted by an operator; state remains for audit";
		case "completed":
			return `All tasks succeeded and the orch branch landed on ${ctx.baseBranch ?? "base"}`;
		case "human_base_diverged": {
			const overlapCount = Array.isArray(ctx.overlapPaths) ? ctx.overlapPaths.length : 0;
			return `Human commits on ${ctx.baseBranch ?? "base"} overlap orch land${overlapCount > 0 ? ` (${overlapCount} path(s))` : ""} — reconciliation needs a human sync decision`;
		}
		case "integrate_isolated_ok":
			return "Isolated integrate landed cleanly; the human checkout only needs a sync with base";
		case "pending_lane_land":
			return "Done-in-lane work is sitting in lane worktrees waiting to be landed";
		default:
			return `Reconcile signals selected "${diagnosis}" for phase ${ctx.phase ?? "unknown"}`;
	}
}
