/**
 * Sequence auto-approve gate safety (GitHub #54 Tier 2 SP-E).
 * Release profile guardrails (FR-STA-25 / SP-536).
 */

import { isStubWorkerMode } from "./stall-config.mjs";

/** Cross-link only — canonical profile lives in src/batch/sequence.mjs. */
export const SEQUENCE_RELEASE_MANIFEST_DOC = "docs/release/manifest-v1.10.0-example.md";
const RELEASE_PROFILE_ID = "release";

const AUTO_APPROVE_REFUSAL_MESSAGE =
	"--auto-approve-gate bypasses the human integrate gate and is blocked for real pi workers. " +
	"Use SPINE_WORKER_STUB=1 for CI/stub sequences, or pass --force after reviewing the risk.";

const RELEASE_AUTO_APPROVE_REFUSAL_MESSAGE =
	"--auto-approve-gate is blocked for release sequence profiles on real pi. " +
	"Release harness uses a gate-only operator loop — approve integrate gates manually between waves. " +
	`See ${SEQUENCE_RELEASE_MANIFEST_DOC} for operator gates.`;

/**
 * @param {object} [params]
 * @param {boolean} [params.autoApproveGate]
 * @param {boolean} [params.force]
 * @param {{ id?: string }|null} [params.profile]
 */
export function validateSequenceAutoApproveGate({
	autoApproveGate = false,
	force = false,
	profile = null,
} = {}) {
	if (!autoApproveGate) {
		return { ok: true };
	}

	if (isStubWorkerMode()) {
		return { ok: true, stubMode: true };
	}

	if (force) {
		return { ok: true, forced: true };
	}

	const isReleaseProfile = profile?.id === RELEASE_PROFILE_ID;
	const output = isReleaseProfile
		? `${RELEASE_AUTO_APPROVE_REFUSAL_MESSAGE}\n`
		: `${AUTO_APPROVE_REFUSAL_MESSAGE}\n`;

	return {
		ok: false,
		error: "auto_approve_gate_unsafe",
		output,
		suggestedCommand: isReleaseProfile
			? `spine run sequence <scope> --dry-run  # see ${SEQUENCE_RELEASE_MANIFEST_DOC}`
			: "SPINE_WORKER_STUB=1 spine run sequence <scope> --auto-approve-gate",
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
			"real pi — flag blocked unless --force; release profile uses gate-only loop (manual spine gate approve between waves)",
		suggestedCommand: `spine run sequence <scope> --dry-run  # manifest: ${SEQUENCE_RELEASE_MANIFEST_DOC}`,
	};
}

/**
 * Doctor advisory for release sequence profile usage.
 */
export function buildSequenceReleaseProfileDoctorCheck() {
	return {
		label: "sequence release profile",
		ok: true,
		detail:
			"comma-separated scope or --profile release; wave cap 4; gate-only pause: gate_approve",
		suggestedCommand: `spine run sequence <release-scope> --dry-run  # ${SEQUENCE_RELEASE_MANIFEST_DOC}`,
	};
}
