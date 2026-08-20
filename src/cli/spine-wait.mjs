/**
 * spine wait --until validation and land-loop pseudo-diagnosis matching (SP-479, issue #105).
 */

import { DIAGNOSIS_TAXONOMY } from "../batch/diagnosis.mjs";

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
 * @param {import("../batch/reconcile.mjs").ReconciliationResult & Record<string, unknown>} result
 * @param {Set<string>} untilDiagnoses
 */
export function reconciliationMatchesUntil(result, untilDiagnoses) {
	if (diagnosisMatchesUntil(result.diagnosis ?? null, untilDiagnoses)) {
		return true;
	}

	// `--until failed` must wake on terminal batch failure even when reconcile
	// reports a failure-class diagnosis (worker_done_missing, worker_orphaned,
	// engine_orphaned) instead of the literal "failed" token (#252). Explicit
	// diagnosis tokens still match directly via the check above.
	if (untilDiagnoses.has("failed") && result.phase === "failed") {
		return true;
	}

	for (const pseudo of deriveWaitPseudoDiagnoses(result)) {
		if (untilDiagnoses.has(pseudo)) {
			return true;
		}
	}

	return false;
}
