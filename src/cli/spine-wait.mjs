/**
 * spine wait --until validation and land-loop pseudo-diagnosis matching (SP-479, issue #105).
 */

import { DIAGNOSIS_TAXONOMY } from "../batch/diagnosis.mjs";
import { RUNNING_PHASES } from "../batch/reconcile-light-cache.mjs";

/** Operator-facing wait targets not in reconcile diagnosis taxonomy. */
export const WAIT_UNTIL_PSEUDO_DIAGNOSES = [
	"gate_open",
	"needs_approval",
	"post_merge_limbo",
];

/** @type {ReadonlySet<string>} */
export const VALID_UNTIL_DIAGNOSES = new Set([
	...DIAGNOSIS_TAXONOMY,
	...WAIT_UNTIL_PSEUDO_DIAGNOSES,
]);

/**
 * Comma-separated list for CLI error messages.
 */
export function formatValidWaitUntilDiagnoses() {
	return [...DIAGNOSIS_TAXONOMY, ...WAIT_UNTIL_PSEUDO_DIAGNOSES].join(", ");
}

/**
 * @param {string} raw
 * @returns {Set<string>}
 */
export function parseUntilDiagnoses(raw) {
	const trimmed = String(raw).trim();
	if (trimmed.length === 0) {
		throw new Error("--until requires a comma-separated diagnosis list");
	}

	/** @type {Set<string>} */
	const diagnoses = new Set();
	for (const part of trimmed.split(",")) {
		const diagnosis = part.trim();
		if (diagnosis.length === 0) {
			throw new Error("--until contains an empty diagnosis entry");
		}
		if (!VALID_UNTIL_DIAGNOSES.has(diagnosis)) {
			throw new Error(
				`Unknown diagnosis in --until: ${diagnosis} (valid: ${formatValidWaitUntilDiagnoses()})`,
			);
		}
		diagnoses.add(diagnosis);
	}

	return diagnoses;
}

/**
 * Derive land-loop pseudo-diagnoses from a reconcile snapshot.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} result
 * @returns {Set<string>}
 */
export function deriveWaitPseudoDiagnoses(result) {
	/** @type {Set<string>} */
	const pseudo = new Set();
	const suggestedCommand = String(result.suggestedCommand ?? "");
	const headline = String(result.headline ?? "");
	const macroPhase = String(result.macroPhase ?? "");

	const gateOpened =
		suggestedCommand === "spine gate approve" || headline.includes("gate opened");
	if (gateOpened) {
		pseudo.add("gate_open");
		pseudo.add("needs_approval");
	}

	const postMergeLimbo =
		macroPhase === "gating" &&
		(suggestedCommand.includes("batch resume --force") ||
			headline.includes("gate not opened") ||
			headline.includes("finalizing land loop"));
	if (postMergeLimbo && !gateOpened) {
		pseudo.add("post_merge_limbo");
	}

	return pseudo;
}

/**
 * @param {string | null | undefined} diagnosis
 * @param {Set<string>} untilDiagnoses
 */
export function diagnosisMatchesUntil(diagnosis, untilDiagnoses) {
	if (diagnosis == null) {
		return false;
	}
	return untilDiagnoses.has(diagnosis);
}

/**
 * Partial-failure diagnoses that reconcile can report while sibling lane
 * workers are still running (#375). All three derive from reconcile's
 * `hasFailedTasks` branch, which fires on the first terminal-failure task —
 * even mid-batch — so waking a land loop on them while a sibling lane is
 * still live would pause/salvage/kill healthy lanes.
 *
 * @type {ReadonlySet<string>}
 */
export const WAIT_LIVE_SIBLING_GATED_DIAGNOSES = new Set([
	"needs_retry",
	"worker_done_missing",
	"needs_replan",
]);

/**
 * Whether any in-scope lane task is still live (#375). Prefers
 * `signals.hasRunningTasks` — the per-task running classification reconcile
 * itself derives — and only falls back to the batch phase when the result
 * carries no signals block (injected reconcile fns, non-verbose results):
 * the engine holds the phase in a live run state while lane workers are
 * active and transitions to failed/completed only after lanes settle.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} result
 * @returns {boolean}
 */
export function hasLiveSiblingLaneWorker(result) {
	const signals = /** @type {Record<string, unknown> | null | undefined} */ (result?.signals);
	if (signals != null && typeof signals === "object") {
		return signals.hasRunningTasks === true;
	}
	return RUNNING_PHASES.has(String(result?.phase ?? ""));
}

/**
 * Resolve which `--until` entry (taxonomy diagnosis, `failed` phase alias, or
 * land-loop pseudo) a reconcile result matches; null when nothing matches.
 * Single source of truth for match order — `describeMatchedDiagnosis` in the
 * wait poll names the matched token through this helper.
 *
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} result
 * @param {Set<string>} untilDiagnoses
 * @returns {string | null}
 */
export function matchReconciliationUntil(result, untilDiagnoses) {
	if (diagnosisMatchesUntil(result.diagnosis ?? null, untilDiagnoses)) {
		return result.diagnosis;
	}

	// `--until failed` must wake on terminal batch failure even when reconcile
	// reports a failure-class diagnosis (worker_done_missing, worker_orphaned,
	// engine_orphaned) instead of the literal "failed" token (#252). Explicit
	// diagnosis tokens still match directly via the check above.
	if (untilDiagnoses.has("failed") && result.phase === "failed") {
		return "failed";
	}

	for (const pseudo of deriveWaitPseudoDiagnoses(result)) {
		if (untilDiagnoses.has(pseudo)) {
			return pseudo;
		}
	}

	return null;
}

/**
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} result
 * @param {Set<string>} untilDiagnoses
 */
export function reconciliationMatchesUntil(result, untilDiagnoses) {
	const matched = matchReconciliationUntil(result, untilDiagnoses);
	if (matched == null) {
		return false;
	}
	// Partial-failure hold (#375): needs_retry / worker_done_missing /
	// needs_replan fire on the first failed task even while sibling lane
	// workers are still running. Hold the match until the live siblings
	// settle; terminal aliases (`failed`), success/integrate diagnoses, and
	// gate pseudos keep their current behavior so a fully terminal batch
	// never waits on imaginary siblings.
	if (WAIT_LIVE_SIBLING_GATED_DIAGNOSES.has(matched) && hasLiveSiblingLaneWorker(result)) {
		return false;
	}
	return true;
}
