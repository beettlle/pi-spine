import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Route `spine run` subcommands.
 * - `spine run sequence <scope>` — planner wave sequence (GitHub #54 Tier 2)
 * - `spine run <scope>` — alias for `spine batch start <scope>` (TP-024)
 *
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {string[]} options.args
 */
export async function runSpineRun({ projectRoot, args }) {
	if (args[0] === "sequence") {
		const { runSpineSequence } = await import("../src/cli/sequence.mjs");
		return runSpineSequence({
			projectRoot,
			args: args.slice(1),
			spineBin: path.join(__dirname, "spine.mjs"),
		});
	}

	const { runSpineBatch } = await import("./spine-batch.mjs");
	return runSpineBatch({
		projectRoot,
		args: ["start", ...args],
	});
}
