import { integrateOrchToBase } from "../src/batch/integrate.mjs";
import { parseStrictArgs, strictArgsError } from "./spine-cli/cli-args.mjs";

const INTEGRATE_USAGE = `
Usage: spine integrate [options]

  Merge the batch orch branch into the base branch (requires an approved gate).

Options:
  --batch ID           Target batch (default: active batch)
  --dry-run            Show the merge plan without changing anything
  --force-integrate    Bypass the gate (requires SPINE_ALLOW_FORCE=1)
  --json               Machine-readable output
  --help, -h           Show this help without changing state
`;

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
	const parsed = parseStrictArgs(args, {
		valued: ["--batch"],
		boolean: ["--dry-run", "--force-integrate", "--json"],
	});
	const flags = parsed.flags;
	if (parsed.help) {
		return { exitCode: 0, output: INTEGRATE_USAGE, result: { ok: true, help: true } };
	}
	const usageError =
		strictArgsError(parsed) ??
		(parsed.positional.length > 0 ? `Unexpected argument(s): ${parsed.positional.join(" ")}` : null);
	if (usageError) {
		return { exitCode: 2, output: `${usageError}\n${INTEGRATE_USAGE}`, result: { ok: false, error: usageError } };
	}

	const result = integrateOrchToBase({
		projectRoot,
		dryRun: flags.has("--dry-run"),
		batchId: parsed.values.get("--batch") ?? null,
		forceIntegrate: flags.has("--force-integrate"),
	});

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatIntegrateHuman(result, flags.has("--json")),
		result,
	};
}
