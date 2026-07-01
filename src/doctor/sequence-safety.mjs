/**
 * Sequence auto-approve gate safety (GitHub #54 Tier 2 SP-E).
 */

import { isStubWorkerMode } from "./stall-config.mjs";

const AUTO_APPROVE_REFUSAL_MESSAGE =
	"--auto-approve-gate bypasses the human integrate gate and is blocked for real pi workers. " +
	"Use SPINE_WORKER_STUB=1 for CI/stub sequences, or pass --force after reviewing the risk.";

/**
 * @param {object} [params]
 * @param {boolean} [params.autoApproveGate]
 * @param {boolean} [params.force]
 */
export function validateSequenceAutoApproveGate({ autoApproveGate = false, force = false } = {}) {
	if (!autoApproveGate) {
		return { ok: true };
	}

	if (isStubWorkerMode()) {
		return { ok: true, stubMode: true };
	}

	if (force) {
		return { ok: true, forced: true };
	}

	return {
		ok: false,
		error: "auto_approve_gate_unsafe",
		output: `${AUTO_APPROVE_REFUSAL_MESSAGE}\n`,
		suggestedCommand: "SPINE_WORKER_STUB=1 spine run sequence <scope> --auto-approve-gate",
	};
}

/**
 * Doctor advisory for sequence auto-approve gate usage.
 */
export function buildSequenceAutoApproveDoctorCheck() {
	if (isStubWorkerMode()) {
		return {
			label: "sequence --auto-approve-gate",
			ok: true,
			detail: "SPINE_WORKER_STUB set — auto gate approval permitted for stub/CI sequences",
		};
	}

	return {
		label: "sequence --auto-approve-gate",
		ok: true,
		warning: true,
		detail:
			"real pi — flag blocked unless --force; use manual spine gate approve between waves",
		suggestedCommand: "spine doctor  # verify SPINE_WORKER_STUB is unset before production runs",
	};
}
