import { reconcileBatch } from "../src/batch/reconcile.mjs";

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {boolean} [options.diagnose]
 * @param {boolean} [options.verbose]
 * @param {boolean} [options.json]
 */
export function runSpineStatus(options) {
	const { projectRoot, diagnose = false, verbose = false, json = false } = options;
	const result = reconcileBatch({ projectRoot, verbose: verbose || diagnose });

	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify(result, null, 2)}\n`,
		};
	}

	const lines = ["", "Batch status", ""];

	if (result.batchId) {
		lines.push(`  Batch:     ${result.batchId}`);
	}
	if (result.phase) {
		lines.push(`  Phase:     ${result.phase}`);
	}
	if (result.diagnosis) {
		lines.push(`  Diagnosis: ${result.diagnosis}`);
	}

	lines.push("", `  ${result.headline}`, "");
	lines.push(`  → ${result.suggestedCommand}`);

	if (result.alternatives?.length) {
		lines.push("", "  Alternatives:");
		for (const alt of result.alternatives) {
			lines.push(`    • ${alt}`);
		}
	}

	if (diagnose && result.signals) {
		lines.push("", "  Signals:");
		lines.push(`    ${JSON.stringify(result.signals, null, 2).split("\n").join("\n    ")}`);
	}

	if (verbose && result.signals?.segments?.length) {
		lines.push("", "  Segment frontier:");
		for (const segment of result.signals.segments) {
			lines.push(`    ${segment.segmentId}: ${segment.status} (${segment.classification})`);
		}
	}

	lines.push("");
	return { exitCode: 0, output: lines.join("\n") };
}
