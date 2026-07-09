// @ts-nocheck
/**
 * Parent-shell exit vs engine crash hints for engine_orphaned diagnosis (SP-560 / #185).
 */

import { DETACHED_ENGINE_LOG_REL } from "./detached-spawn.mjs";

/** Journal types that indicate an uncaught engine crash (not parent shell exit). */
const ENGINE_CRASH_JOURNAL_TYPES = new Set(["engine.crash", "engine.uncaught_exception"]);

/**
 * @param {object[]} [journalEvents]
 * @returns {boolean}
 */
export function journalHasEngineCrash(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => ENGINE_CRASH_JOURNAL_TYPES.has(event.type));
}

/**
 * @param {object[]} [journalEvents]
 * @returns {boolean}
 */
export function journalIndicatesParentExit(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => {
		if (event.type !== "engine.parent_died") return false;
		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		return payload.signal === "parent_exit" || event.signal === "parent_exit";
	});
}

/**
 * @param {object[]} [journalEvents]
 * @returns {boolean}
 */
export function journalHasBatchResumed(journalEvents) {
	if (!Array.isArray(journalEvents) || journalEvents.length === 0) return false;
	return journalEvents.some((event) => event.type === "batch.resumed");
}

/**
 * Infer whether engine_orphaned is likely parent shell exit vs engine crash.
 *
 * @param {object} [ctx]
 * @param {object[]} [ctx.journalEvents]
 * @param {boolean} [ctx.staleEnginePid]
 * @returns {{ kind: "parent_exit" | "parent_exit_likely" | "crash" | "unknown", detachedEngineLogRef: string|null }}
 */
export function inferEngineOrphanCause(ctx = {}) {
	const { journalEvents, staleEnginePid } = ctx;
	const logRef = staleEnginePid === true ? DETACHED_ENGINE_LOG_REL : null;

	if (journalHasEngineCrash(journalEvents)) {
		return { kind: "crash", detachedEngineLogRef: logRef };
	}

	if (journalIndicatesParentExit(journalEvents)) {
		return { kind: "parent_exit", detachedEngineLogRef: logRef };
	}

	// Detached resume stall (SP-297) — not parent shell exit from attached mode.
	if (journalHasBatchResumed(journalEvents)) {
		return { kind: "unknown", detachedEngineLogRef: logRef };
	}

	// Attached start orphan without crash journal (#185).
	if (
		Array.isArray(journalEvents) &&
		journalEvents.some((event) => event.type === "batch.started")
	) {
		return { kind: "parent_exit_likely", detachedEngineLogRef: logRef };
	}

	return { kind: "unknown", detachedEngineLogRef: logRef };
}

/**
 * @param {string} batchLabel
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 * @param {{ kind: string, detachedEngineLogRef?: string|null }} [ctx.engineOrphanCause]
 * @returns {string|null}
 */
export function buildEngineOrphanParentExitHeadline(batchLabel, ctx = {}) {
	const cause = ctx.engineOrphanCause;
	if (!cause) return null;

	const taskHint = ctx.failedTaskId ? ` (task ${ctx.failedTaskId} still running)` : "";
	const logHint = cause.detachedEngineLogRef ? ` — see ${cause.detachedEngineLogRef}` : "";

	if (cause.kind === "parent_exit") {
		return `${batchLabel} attached engine parent shell exited${taskHint} — use detached resume, not a crash${logHint}`;
	}

	if (cause.kind === "parent_exit_likely") {
		return `${batchLabel} engine likely orphaned by parent shell exit${taskHint} — use detached resume (no engine.crash in journal)${logHint}`;
	}

	if (cause.kind === "crash") {
		return null;
	}

	return null;
}

/**
 * @param {object} ctx
 * @param {string|null} [ctx.failedTaskId]
 * @param {{ kind: string }} [ctx.engineOrphanCause]
 * @returns {string|null}
 */
export function buildEngineOrphanParentExitSuggestedCommand(ctx = {}) {
	const cause = ctx.engineOrphanCause;
	if (!cause) return null;

	if (cause.kind === "parent_exit" || cause.kind === "parent_exit_likely") {
		if (ctx.failedTaskId) {
			return `spine batch retry ${ctx.failedTaskId}`;
		}
		return "spine batch resume --force";
	}

	return null;
}
