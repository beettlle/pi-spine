import { integrateOrchToBase } from "../src/batch/integrate.mjs";

/**
 * @param {object} result
 * @param {boolean} json
 */
export function formatIntegrateHuman(result, json = false) {
	if (json) return `${JSON.stringify(result, null, 2)}\n`;

	const lines = ["", result.ok ? "Integrate" : "Integrate failed", "", `  ${result.headline}`];

	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.batchId) {
		lines.push("", `  Batch: ${result.batchId}`);
	}
	if (result.baseBranch && result.orchBranch) {
		lines.push(`  Branches: ${result.orchBranch} → ${result.baseBranch}`);
	}
	if (result.commitsAhead != null) {
		lines.push(`  Commits ahead: ${result.commitsAhead}`);
	}
	if (result.mergeCommit) {
		lines.push(`  Merge commit: ${result.mergeCommit}`);
	}
	if (result.mergePlan) {
		lines.push(`  Plan: ${result.mergePlan}`);
	}
	if (result.gateRequired) {
		lines.push("", "  Gate: approval required before integrate");
	}
	if (result.failureClass === "GateBlocked") {
		lines.push("", "  Gate: integrate blocked until approved");
	}

	lines.push("", `  → ${result.suggestedCommand}`);

	if (result.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of result.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export function runSpineIntegrate(options) {
	const { projectRoot, args } = options;
	const flags = new Set(args.filter((a) => a.startsWith("--")));

	let batchId = null;
	const batchIdx = args.indexOf("--batch");
	if (batchIdx >= 0 && args[batchIdx + 1]) {
		batchId = args[batchIdx + 1];
	}

	const result = integrateOrchToBase({
		projectRoot,
		dryRun: flags.has("--dry-run"),
		batchId,
		forceIntegrate: flags.has("--force-integrate"),
	});

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatIntegrateHuman(result, flags.has("--json")),
		result,
	};
}
