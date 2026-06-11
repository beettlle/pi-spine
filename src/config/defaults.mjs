/**
 * spine-config.json v2.0 default sections (handoff §6.2).
 * Contract defaults are added in SP-142.
 */

/** @type {Readonly<{ requireFinalVerdict: boolean; maxFinalAttempts: number }>} */
export const REVIEW_DEFAULTS = Object.freeze({
	requireFinalVerdict: true,
	maxFinalAttempts: 3,
});

/** @type {Readonly<{ path: string; autoWriteOn: readonly string[] }>} */
export const HANDOFF_DEFAULTS = Object.freeze({
	path: ".spine/handoff.md",
	autoWriteOn: Object.freeze([]),
});

/** @type {Readonly<{ enabled: boolean; path: string }>} */
export const METRICS_DEFAULTS = Object.freeze({
	enabled: true,
	path: ".spine/run-metrics.jsonl",
});

/** @type {Readonly<{ review: typeof REVIEW_DEFAULTS; handoff: typeof HANDOFF_DEFAULTS; metrics: typeof METRICS_DEFAULTS }>} */
export const CONFIG_V2_SECTION_DEFAULTS = Object.freeze({
	review: REVIEW_DEFAULTS,
	handoff: HANDOFF_DEFAULTS,
	metrics: METRICS_DEFAULTS,
});
