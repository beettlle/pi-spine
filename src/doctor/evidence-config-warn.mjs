/**
 * Advisory doctor checks for gate-evidence command safety (SP-710, #254).
 *
 * Every `testing.*` evidence slot runs through the no-shell argv executor in
 * `src/batch/evidence-command.mjs` at integrate-gate time. When a configured
 * command would be rejected there (unallowed executable, shell metacharacters,
 * arbitrary `$` expansion), evidence output degrades to a `[rejected]` line and
 * operators lose test/build proof. These checks surface that misconfiguration
 * early as non-blocking warnings (`ok: true, warning: true`) — doctor and
 * preflight must stay green.
 */

import { parseEvidenceCommandChain } from "../batch/evidence-command.mjs";

/** Evidence slots executed through the no-shell evidence executor. */
const EVIDENCE_TESTING_KEYS = ["build", "test", "testWithCoverage", "review"];

/**
 * Warn (non-blocking) when a configured `testing.*` evidence command would be
 * rejected by the gate evidence validator.
 *
 * @param {{ testing?: Record<string, string> }} [config] spine-config object
 * @returns {Array<{ label: string, ok: boolean, warning?: boolean, detail: string, suggestedCommand?: string }>}
 */
export function buildEvidenceConfigWarnDoctorChecks(config = {}) {
	const testing = config.testing ?? {};
	/** @type {Array<{ label: string, ok: boolean, warning?: boolean, detail: string, suggestedCommand?: string }>} */
	const checks = [];

	for (const key of EVIDENCE_TESTING_KEYS) {
		const command = testing[key];
		if (typeof command !== "string" || !command.trim()) {
			continue;
		}
		try {
			parseEvidenceCommandChain(command);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			checks.push({
				label: `testing.${key} evidence-safe`,
				ok: true,
				warning: true,
				detail: `testing.${key} would be rejected at gate evidence time: ${message}`,
				suggestedCommand: `spine settings set testing.${key} "<allowlisted evidence command>"`,
			});
		}
	}

	return checks;
}
