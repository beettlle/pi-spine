// @ts-nocheck
/**
 * Running diagnosis headlines when batch phase is active but no workers are scheduled (GitHub #68).
 */
import { isRunningWithoutActiveWorkers } from "../dashboard/running-tail-state.mjs";
import { macroPhaseLabel } from "./macro-phase.mjs";

export { isRunningWithoutActiveWorkers };

/**
 * Whether batch-state records a live resume/batch engine PID (#198 / SP-637).
 *
 * @param {object} ctx
 * @returns {boolean}
 */
export function isEngineStillRunning(ctx = {}) {
	if (ctx.engineStillRunning === true) {
		return true;
	}
	const enginePid = ctx.enginePid;
	if (enginePid == null) {
		return false;
	}
	if (ctx.staleEnginePid === true) {
		return false;
	}
	return true;
}

/**
 * Post-integrate limbo: orch merged, tasks terminal-success, engine PID still alive.
 * Stale segment pending must not mask limbo when lane workers are idle (#198 / SP-637).
 *
 * @param {object} ctx
 * @returns {boolean}
 */
export function isPostIntegrateEngineLimbo(ctx = {}) {
	if (ctx.allTasksTerminalSuccess !== true) {
		return false;
	}
	if (ctx.gitMerged !== true) {
		return false;
	}
	if (!isEngineStillRunning(ctx)) {
		return false;
	}
	if (ctx.hasRunningTasks === true) {
		return false;
	}
	const phase = ctx.phase ?? "";
	if (phase !== "running" && phase !== "merging") {
		return false;
	}
	return true;
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @returns {string|null}
 */
export function buildPostIntegrateEngineLimboHeadline(batchLabel, ctx = {}) {
	const enginePid = ctx.enginePid;
	const pidSuffix =
		enginePid != null && Number.isFinite(Number(enginePid))
			? ` (PID ${enginePid})`
			: "";
	return `${batchLabel} resume engine still running after integrate${pidSuffix} — wait, abort, or batch complete after exit`;
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @returns {string|null}
 */
export function buildRunningTailHeadline(batchLabel, ctx = {}) {
	if (isPostIntegrateEngineLimbo(ctx)) {
		return buildPostIntegrateEngineLimboHeadline(batchLabel, ctx);
	}

	if (!isRunningWithoutActiveWorkers(ctx)) {
		return null;
	}

	const macroPhase = ctx.macroPhase ?? null;

	if (ctx.postMergeLimbo || macroPhase === "gating") {
		if (ctx.integrateGateOpen) {
			return `${batchLabel} gate opened — approve to continue land loop`;
		}
		if (ctx.stalePathSpine) {
			return `${batchLabel} merged but gate not opened — use node bin/spine.mjs batch resume --attached (PATH spine may be stale)`;
		}
		return `${batchLabel} finalizing land loop — opening integrate gate…`;
	}

	if (macroPhase === "integrating") {
		return `${batchLabel} integrating orch branch to main…`;
	}

	if (macroPhase === "merging" || ctx.phase === "merging") {
		return `${batchLabel} tasks done — merging lane branches…`;
	}

	if (macroPhase === "reviewing") {
		if (ctx.allTasksTerminalSuccess === true && isEngineStillRunning(ctx)) {
			return buildPostIntegrateEngineLimboHeadline(batchLabel, ctx);
		}
		return `${batchLabel} running reviews — no workers scheduled`;
	}

	if (macroPhase === "planning") {
		return `${batchLabel} planning — no workers scheduled`;
	}

	// Macro Failed must not surface in running tail — drift/orphan may still be recoverable (#165).
	if (macroPhase === "failed") {
		return `${batchLabel} finalizing batch — no active workers`;
	}

	if (macroPhase != null && macroPhase !== "executing") {
		const label = macroPhaseLabel(macroPhase);
		return `${batchLabel} ${label.toLowerCase()} — finalizing batch`;
	}

	if (ctx.gitMerged === false || ctx.allTasksTerminalSuccess === true) {
		return `${batchLabel} tasks done — merging lane branches…`;
	}

	return `${batchLabel} finalizing batch — no active workers`;
}
