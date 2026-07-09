/**
 * `spine cleanup worktrees` — prune stale batch dirs and dangling git worktree refs (#169).
 */

import { pruneStaleWorktrees, scanStaleWorktrees } from "../src/batch/worktree.mjs";

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string[]} params.args
 */
export function runSpineCleanup({ projectRoot, args }) {
	const subcommand = args[0];
	if (subcommand !== "worktrees") {
		return {
			exitCode: 1,
			output:
				"Usage: spine cleanup worktrees [--dry-run] [--yes] [--json]\n" +
				"  --dry-run  List stale batch dirs and dangling worktree refs (default without --yes)\n" +
				"  --yes      Remove empty batch shells and run git worktree prune\n" +
				"  --json     Emit machine-readable output\n",
		};
	}

	const dryRun = args.includes("--dry-run") || !args.includes("--yes");
	const json = args.includes("--json");

	if (dryRun) {
		const scan = scanStaleWorktrees(projectRoot);
		if (json) {
			return {
				exitCode: 0,
				output: `${JSON.stringify({ action: "dry-run", ...scan }, null, 2)}\n`,
			};
		}

		const lines = [];
		if (scan.batchIds.length === 0) {
			lines.push("No stale spine batch worktree dirs found.");
		} else {
			lines.push(`Stale batch dirs (${scan.batchIds.length}):`);
			for (const batchId of scan.batchIds) {
				const suffix = scan.emptyShells.includes(batchId) ? " (empty shell)" : "";
				lines.push(`  .worktrees/spine-${batchId}${suffix}`);
			}
		}

		if (scan.danglingWorktrees.length > 0) {
			lines.push(`Dangling worktree refs (${scan.danglingWorktrees.length}):`);
			for (const entry of scan.danglingWorktrees) {
				lines.push(`  ${entry}`);
			}
		} else {
			lines.push("No dangling worktree refs to prune.");
		}

		lines.push("Run with --yes to remove empty shells and git worktree prune.");
		return { exitCode: 0, output: `${lines.join("\n")}\n` };
	}

	const result = pruneStaleWorktrees(projectRoot, { dryRun: false });
	if (json) {
		return {
			exitCode: 0,
			output: `${JSON.stringify({ action: "prune", ...result }, null, 2)}\n`,
		};
	}

	const lines = [];
	if (result.removedShells.length === 0) {
		lines.push("No empty batch shells removed.");
	} else {
		lines.push(`Removed empty batch shells (${result.removedShells.length}):`);
		for (const batchId of result.removedShells) {
			lines.push(`  .worktrees/spine-${batchId}/`);
		}
	}

	if (result.prunedWorktrees.length === 0) {
		lines.push("git worktree prune: nothing to prune.");
	} else {
		lines.push(`git worktree prune (${result.prunedWorktrees.length}):`);
		for (const entry of result.prunedWorktrees) {
			lines.push(`  ${entry}`);
		}
	}

	return { exitCode: 0, output: `${lines.join("\n")}\n` };
}
