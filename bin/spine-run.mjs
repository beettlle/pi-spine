import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Route `spine run` subcommands.
 * - `spine run sequence <scope>` — planner wave sequence (GitHub #54 Tier 2)
 *   Release scope: comma-separated SP-IDs or `--profile release` (FR-STA-25 / SP-536).
 *   Dry-run: `spine run sequence <scope> --dry-run` — see docs/release/manifest-v1.10.0-example.md
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
