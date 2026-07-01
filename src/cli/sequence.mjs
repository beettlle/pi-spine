/**
 * CLI for planner wave sequence runner (GitHub #54 Tier 2).
 * Entry: `spine run sequence <scope>` — not `spine batch sequence` (see issue #54 open Q1).
 */

import { buildSequencePlan, runSequence } from "../batch/sequence.mjs";
import { resolveDefaultSpineBin } from "../batch/post-merge-limbo.mjs";

/**
 * @param {string[]} argv
 */
export function parseSequenceArgs(argv) {
	/** @type {{ scope: string, fromWave: number, throughWave: number|null, attached: boolean, stopOnFailure: boolean, dryRun: boolean, json: boolean, skipPreflight: boolean, resume: boolean }} */
	const parsed = {
		scope: "pending",
		fromWave: 0,
		throughWave: null,
		attached: false,
		stopOnFailure: true,
		dryRun: false,
		json: false,
		skipPreflight: false,
		resume: false,
	};

	/** @type {string[]} */
	const positional = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--from-wave") {
			parsed.fromWave = Number(argv[++i]);
		} else if (arg === "--through-wave") {
			parsed.throughWave = Number(argv[++i]);
		} else if (arg === "--attached") {
			parsed.attached = true;
		} else if (arg === "--stop-on-failure") {
			parsed.stopOnFailure = true;
		} else if (arg === "--no-stop-on-failure") {
			parsed.stopOnFailure = false;
		} else if (arg === "--dry-run") {
			parsed.dryRun = true;
		} else if (arg === "--json") {
			parsed.json = true;
		} else if (arg === "--skip-preflight") {
			parsed.skipPreflight = true;
		} else if (arg === "--resume") {
			parsed.resume = true;
		} else if (!arg.startsWith("--")) {
			positional.push(arg);
		}
	}

	if (positional.length > 0) {
		parsed.scope = positional.join(" ");
	}

	return parsed;
}

/**
 * @param {object} result
 * @param {boolean} json
 */
export function formatSequenceResult(result, json) {
	if (json) {
		return `${JSON.stringify(result, null, 2)}\n`;
	}
	return result.output ?? "";
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} [options.args]
 * @param {string|null} [options.spineBin]
 */
export async function runSpineSequence({ projectRoot, args = [], spineBin = null }) {
	const parsed = parseSequenceArgs(args);
	const built = buildSequencePlan(projectRoot, parsed.scope);
	if (!built.ok) {
		const failure = {
			ok: false,
			exitCode: 1,
			error: built.error,
			output: built.output,
		};
		return {
			exitCode: 1,
			output: formatSequenceResult(failure, parsed.json),
			result: failure,
		};
	}

	const result = await runSequence({
		projectRoot,
		plan: built.plan,
		scope: parsed.scope,
		fromWave: parsed.fromWave,
		throughWave: parsed.throughWave,
		resume: parsed.resume,
		attached: parsed.attached,
		stopOnFailure: parsed.stopOnFailure,
		dryRun: parsed.dryRun,
		skipPreflight: parsed.skipPreflight,
		spineBin: parsed.attached ? null : resolveDefaultSpineBin(spineBin),
	});

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatSequenceResult(result, parsed.json),
		result,
	};
}
