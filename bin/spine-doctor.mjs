/**
 * spine doctor — installation and project configuration checks (SP-093 manifest warnings).
 */

import {
	c,
	FAIL,
	isCliEntrypoint,
	OK,
	WARN,
} from "./spine-cli/shared.mjs";
import { runDoctorChecks } from "../src/doctor/run-doctor-checks.mjs";

export {
	buildAttachedOrphanRiskDoctorCheck,
	detectAttachedOrphanRiskPatterns,
} from "../src/doctor/attached-orphan-risk.mjs";
export {
	buildDuplicateInstallDoctorCheck,
	detectDuplicatePiSpineInstall,
} from "../src/doctor/duplicate-install.mjs";
export {
	buildPiCliResolutionDoctorCheck,
	resolveAuthoritativePiCliPath,
} from "../src/doctor/pi-cli-resolution.mjs";
export { buildTestingEvidenceDoctorChecks, runDoctorChecks } from "../src/doctor/run-doctor-checks.mjs";

export function cmdDoctor() {
	const projectRoot = process.cwd();
	const result = runDoctorChecks(projectRoot);

	console.log(`\n${c.bold}pi-spine Doctor${c.reset}\n`);

	for (const check of result.checks) {
		if (check.warning) {
			console.log(`  ${WARN} ${check.label} ${c.dim}(${check.detail})${c.reset}`);
			if (check.suggestedCommand) {
				console.log(`     ${c.dim}→ Run: ${check.suggestedCommand}${c.reset}`);
			}
			continue;
		}

		const info = check.detail ? ` ${c.dim}(${check.detail})${c.reset}` : "";
		console.log(`  ${check.ok ? OK : FAIL} ${check.label}${info}`);
		if (!check.ok && check.suggestedCommand) {
			console.log(`     ${c.dim}→ Run: ${c.cyan}${check.suggestedCommand}${c.reset}`);
		}
	}

	console.log();
	if (result.ok) {
		console.log(`${OK} ${c.green}All checks passed!${c.reset}\n`);
		return;
	}

	console.log(
		`${FAIL} ${result.issueCount} issue(s) found. Run ${c.cyan}spine init${c.reset} to fix config issues.\n`,
	);
	process.exit(1);
}

if (isCliEntrypoint(import.meta.url)) {
	cmdDoctor();
}
