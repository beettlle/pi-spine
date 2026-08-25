/**
 * spine-config.json v2.0 default sections (handoff §6.2).
 * Contract defaults are added in SP-142.
 */

import { ORCHESTRATOR_DEFAULTS } from "./spine-config-schema.mjs";

/**
 * `maxCodeReviewAttempts` / `maxPlanReviewAttempts` default to `null` (= unset), which
 * falls back to `maxFinalAttempts` at the phase runners (SP-725 / #265). Numeric defaults
 * here would be merged into every loaded config by `applyConfigDefaults` and silently
 * clobber a custom `maxFinalAttempts`, so `null` keeps existing configs behavior-identical.
 *
 * @type {Readonly<{ requireFinalVerdict: boolean; maxFinalAttempts: number; maxCodeReviewAttempts: number | null; maxPlanReviewAttempts: number | null }>}
 */
export const REVIEW_DEFAULTS = Object.freeze({
	requireFinalVerdict: true,
	maxFinalAttempts: 3,
	maxCodeReviewAttempts: null,
	maxPlanReviewAttempts: null,
});

/** @type {Readonly<{ path: string; autoWriteOn: readonly string[] }>} */
export const HANDOFF_DEFAULTS = Object.freeze({
	path: ".spine/handoff.md",
	autoWriteOn: Object.freeze(["session_start"]),
});

/** @type {Readonly<{ enabled: boolean; path: string }>} */
export const METRICS_DEFAULTS = Object.freeze({
	enabled: true,
	path: ".spine/run-metrics.jsonl",
});

/** @type {Readonly<{ mode: string; legacyTaskIdPrefixes: readonly string[] }>} */
export const CONTRACT_DEFAULTS = Object.freeze({
	mode: "required",
	legacyTaskIdPrefixes: Object.freeze(["TP-"]),
});

/** @type {Readonly<{ cleanupWorktreesOnComplete: boolean }>} */
export const LANES_DEFAULTS = Object.freeze({
	cleanupWorktreesOnComplete: true,
});

/** @type {Readonly<{ isolatedWorktree: boolean; allowHumanOnBaseBranch: "warn" | "block" | "allow" }>} */
export const INTEGRATE_DEFAULTS = Object.freeze({
	isolatedWorktree: true,
	allowHumanOnBaseBranch: "warn",
});

/** @type {Readonly<{ review: typeof REVIEW_DEFAULTS; handoff: typeof HANDOFF_DEFAULTS; metrics: typeof METRICS_DEFAULTS; contract: typeof CONTRACT_DEFAULTS; lanes: typeof LANES_DEFAULTS; integrate: typeof INTEGRATE_DEFAULTS; orchestrator: typeof ORCHESTRATOR_DEFAULTS }>} */
export const CONFIG_V2_SECTION_DEFAULTS = Object.freeze({
	review: REVIEW_DEFAULTS,
	handoff: HANDOFF_DEFAULTS,
	metrics: METRICS_DEFAULTS,
	contract: CONTRACT_DEFAULTS,
	lanes: LANES_DEFAULTS,
	integrate: INTEGRATE_DEFAULTS,
	orchestrator: ORCHESTRATOR_DEFAULTS,
});
