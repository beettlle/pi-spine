import { integrateOrchToBase } from "../src/batch/integrate.mjs";
import { validateBatchId } from "../src/batch/batch-id.mjs";
import { parseStrictArgs, strictArgsError } from "./spine-cli/cli-args.mjs";

const INTEGRATE_USAGE = `
Usage: spine integrate [options]

  Merge the batch orch branch into the base branch (requires an approved gate).

Options:
  --batch ID           Target batch (default: active batch)
  --dry-run            Show the merge plan without changing anything
  --force-integrate    Bypass the gate (requires SPINE_ALLOW_FORCE=1)
  --no-issue-sync      Skip the opt-in post-integrate GitHub issue sync (#383)
  --json               Machine-readable output
  --help, -h           Show this help without changing state
`;

/**
 * Human-readable GitHub sync summary lines (#383). Rendered after the merge
 * details; soft failures show the hint without changing the exit code.
 *
 * @param {string[]} lines
 * @param {object} sync githubSync summary from syncIssuesOnLand
 */
function appendGithubSyncLines(lines, sync) {
	if (sync.skipped) {
		if (sync.reason === "no_issue_sync_flag") {
			lines.push("", "  GitHub: sync skipped (--no-issue-sync)");
		}
		return;
	}
	const synced = Array.isArray(sync.synced) ? sync.synced : [];
	const failures = Array.isArray(sync.failures) ? sync.failures : [];
	if (synced.length > 0) {
		const closed = synced.filter((s) => s.closed).map((s) => `#${s.issue}`);
		const commented = synced.filter((s) => !s.closed).map((s) => `#${s.issue}`);
		const parts = [];
		if (closed.length) parts.push(`closed ${closed.join(", ")}`);
		if (commented.length) parts.push(`commented ${commented.join(", ")}`);
		lines.push("", `  GitHub: synced ${synced.length} issue(s) — ${parts.join("; ")}`);
	}
	if (failures.length > 0) {
		lines.push(`  GitHub: ${failures.length} issue(s) failed — see journal (github.issue_sync_failed)`);
	} else if (synced.length === 0 && sync.softFailed && sync.hint) {
		lines.push("", `  GitHub: sync skipped — ${sync.hint}`);
	}
}

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
	if (result.githubSync) {
		appendGithubSyncLines(lines, result.githubSync);
	}
	if (result.failureClass === "GateBlocked") {
		// Integrate actually stopped for a pending/missing/rejected gate (#359).
		lines.push("", "  Gate: integrate blocked until approved");
	} else if (result.dryRun && result.gatePending) {
		// Dry-run plan: approval will be required before the real merge.
		lines.push("", "  Gate: approval required before integrate");
	} else if (result.ok && result.gateRequired && !result.gateForced) {
		// Successful merge with a configured gate — it was satisfied, not pending (#359).
		lines.push("", "  Gate: approved");
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
		boolean: ["--dry-run", "--force-integrate", "--json", "--no-issue-sync"],
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

	// SP-869 (#313): reject unsafe --batch IDs before runtime path joins.
	const batchArg = parsed.values.get("--batch") ?? null;
	if (batchArg) {
		try {
			validateBatchId(batchArg);
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			return {
				exitCode: 2,
				output: `${error}\n${INTEGRATE_USAGE}`,
				result: { ok: false, error },
			};
		}
	}

	const result = integrateOrchToBase({
		projectRoot,
		dryRun: flags.has("--dry-run"),
		batchId: parsed.values.get("--batch") ?? null,
		forceIntegrate: flags.has("--force-integrate"),
		noIssueSync: flags.has("--no-issue-sync"),
	});

	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatIntegrateHuman(result, flags.has("--json")),
		result,
	};
}
