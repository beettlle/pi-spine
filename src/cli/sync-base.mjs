/**
 * `spine sync-base` — sync human checkout with landed base branch (FR-WT-08 / #91).
 */

import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { resolveCurrentGitBranch } from "../config/spine-preflight-lib.mjs";
import { syncPlumbingMergePathsToWorktree } from "../batch/integrate-worktree.mjs";
import {
	inspectGitState,
	inspectHumanBaseSync,
	loadBatchStateFile,
} from "../batch/reconcile.mjs";
import { readBaseBranchHeadAtStart } from "../batch/batch-state-io.mjs";
import { readJournalEvents } from "../batch/journal.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 * @param {{ throwOnError?: boolean }} [options]
 */
function git(projectRoot, args, { throwOnError = true } = {}) {
	try {
		return execFileSync("git", args, {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		}).trim();
	} catch (err) {
		if (!throwOnError) return "";
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(message);
	}
}

/**
 * @param {string} projectRoot
 * @param {string} ancestor
 * @param {string} descendant
 */
function gitIsAncestor(projectRoot, ancestor, descendant) {
	try {
		execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Sync the human checkout with the landed base branch ref.
 *
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {boolean} [options.dryRun]
 * @param {import("../batch/reconcile.mjs").HumanBaseSyncInspection|null} [options.inspection]
 */
export function syncHumanCheckoutWithBase(options) {
	const { projectRoot, dryRun = false, inspection: providedInspection } = options;
	const loaded = loadSpineConfig(projectRoot);
	const baseBranch = String(loaded.config?.baseBranch ?? "main").trim() || "main";

	let baseTip = "";
	try {
		baseTip = git(projectRoot, ["rev-parse", baseBranch]);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			exitCode: 1,
			headline: `Cannot resolve base branch ${baseBranch}`,
			error: message,
			suggestedCommand: "spine doctor",
		};
	}

	const inspection =
		providedInspection ??
		(() => {
			const loaded = loadBatchStateFile(projectRoot);
			const raw = loaded.raw;
			if (!raw) return null;
			const batchId = String(/** @type {{ batchId?: string }} */ (raw).batchId ?? "").trim();
			const orchBranch = String(/** @type {{ orchBranch?: string }} */ (raw).orchBranch ?? "").trim() || null;
			const journalEvents = batchId ? readJournalEvents(projectRoot, batchId) : [];
			const git = inspectGitState({
				projectRoot,
				batchId,
				baseBranch,
				orchBranch,
			});
			return inspectHumanBaseSync({
				projectRoot,
				baseBranch,
				baseBranchHeadAtStart: readBaseBranchHeadAtStart(raw),
				orchBranch,
				git,
				journalEvents,
			});
		})();

	const humanHead = git(projectRoot, ["rev-parse", "HEAD"]);
	const branchResult = resolveCurrentGitBranch(projectRoot);
	const onBaseBranch = branchResult.branch === baseBranch;

	if (!inspection) {
		if (humanHead === baseTip) {
			return {
				ok: true,
				exitCode: 0,
				headline: `Checkout already matches ${baseBranch}`,
				suggestedCommand: "spine status --diagnose",
				synced: false,
			};
		}
		if (onBaseBranch && gitIsAncestor(projectRoot, humanHead, baseTip)) {
			// Fall through to sync without batch-scoped inspection.
		} else if (!onBaseBranch && gitIsAncestor(projectRoot, humanHead, baseTip)) {
			// Fall through for feature-branch ff-only.
		} else {
			return {
				ok: false,
				exitCode: 1,
				headline: `Cannot sync ${baseBranch} — no batch snapshot and checkout diverged`,
				suggestedCommand: "spine status --diagnose",
			};
		}
	}

	if (inspection?.diagnosis === "human_base_diverged") {
		const overlap = inspection.overlapPaths?.slice(0, 8).join(", ") ?? "unknown paths";
		return {
			ok: false,
			exitCode: 1,
			headline: inspection.headline,
			error: `Overlapping paths: ${overlap}`,
			suggestedCommand: "spine status --diagnose",
			alternatives: [
				"See operator-runbook §4.1 orch-first recovery",
				`git checkout ${inspection.orchBranch ?? "orch/spine-<batchId>"}`,
			],
			overlapPaths: inspection.overlapPaths ?? [],
		};
	}

	const humanHeadForSync = inspection?.humanHead ?? humanHead;
	const branchForSync = resolveCurrentGitBranch(projectRoot);
	const onBaseForSync = branchForSync.branch === baseBranch;

	if (dryRun) {
		return {
			ok: true,
			exitCode: 0,
			headline: `Would sync checkout with ${baseBranch} (${baseTip.slice(0, 8)})`,
			suggestedCommand: "spine sync-base",
			dryRun: true,
			baseBranch,
			baseTip,
			humanHead: humanHeadForSync,
			onBaseBranch: onBaseForSync,
		};
	}

	if (onBaseForSync && humanHeadForSync === baseTip) {
		const snapshot = readBaseBranchHeadAtStart(
			loadBatchStateFile(projectRoot).raw ?? {},
		);
		const syncResult = syncPlumbingMergePathsToWorktree(
			projectRoot,
			snapshot || humanHeadForSync,
			baseTip,
		);
		if (syncResult.ok && (syncResult.processedPaths ?? 0) > 0) {
			return {
				ok: true,
				exitCode: 0,
				headline: `Synced ${syncResult.processedPaths ?? 0} path(s) from landed ${baseBranch}`,
				suggestedCommand: "spine status --diagnose",
				synced: true,
				mode: "plumbing-paths",
				baseTip,
				processedPaths: syncResult.processedPaths,
			};
		}
		if (syncResult.ok) {
			return {
				ok: true,
				exitCode: 0,
				headline: `Checkout already matches ${baseBranch}`,
				suggestedCommand: "spine status --diagnose",
				synced: false,
			};
		}
	}

	if (onBaseForSync && gitIsAncestor(projectRoot, humanHeadForSync, baseTip) && humanHeadForSync !== baseTip) {
		try {
			git(projectRoot, ["merge", "--ff-only", baseBranch]);
			return {
				ok: true,
				exitCode: 0,
				headline: `Fast-forwarded ${baseBranch} checkout to landed tip`,
				suggestedCommand: "spine status --diagnose",
				synced: true,
				mode: "fast-forward",
				baseTip,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const syncResult = syncPlumbingMergePathsToWorktree(projectRoot, humanHeadForSync, baseTip);
			if (syncResult.ok) {
				try {
					git(projectRoot, ["merge", "--ff-only", baseBranch]);
				} catch {
					// Path sync may be enough when ff-only is blocked by unrelated state.
				}
				return {
					ok: true,
					exitCode: 0,
					headline: `Synced ${syncResult.processedPaths ?? 0} path(s) from landed ${baseBranch}`,
					suggestedCommand: "spine status --diagnose",
					synced: true,
					mode: "plumbing-paths",
					baseTip,
					processedPaths: syncResult.processedPaths,
				};
			}
			return {
				ok: false,
				exitCode: 1,
				headline: `Cannot fast-forward ${baseBranch} checkout`,
				error: message,
				suggestedCommand: "spine status --diagnose",
			};
		}
	}

	if (!onBaseForSync) {
		try {
			git(projectRoot, ["merge", "--ff-only", baseBranch]);
			return {
				ok: true,
				exitCode: 0,
				headline: `Fast-forwarded ${branchForSync.branch ?? "current branch"} with ${baseBranch}`,
				suggestedCommand: "spine status --diagnose",
				synced: true,
				mode: "feature-ff-only",
				baseTip,
			};
		} catch {
			try {
				git(projectRoot, ["merge", "--no-edit", baseBranch]);
				return {
					ok: true,
					exitCode: 0,
					headline: `Merged ${baseBranch} into ${branchForSync.branch ?? "current branch"}`,
					suggestedCommand: "spine status --diagnose",
					synced: true,
					mode: "feature-merge",
					baseTip,
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					ok: false,
					exitCode: 1,
					headline: `Cannot merge ${baseBranch} into ${branchForSync.branch ?? "current branch"}`,
					error: message,
					suggestedCommand: "spine status --diagnose",
					alternatives: [`git merge ${baseBranch}`, "See operator-runbook §4.1"],
				};
			}
		}
	}

	const syncResult = syncPlumbingMergePathsToWorktree(projectRoot, humanHeadForSync, baseTip);
	if (!syncResult.ok) {
		return {
			ok: false,
			exitCode: 1,
			headline: syncResult.timedOut
				? `Sync timed out updating checkout from ${baseBranch}`
				: `Sync failed updating checkout from ${baseBranch}`,
			error: syncResult.error ?? "sync failed",
			suggestedCommand: "spine status --diagnose",
		};
	}

	return {
		ok: true,
		exitCode: 0,
		headline: `Synced ${syncResult.processedPaths ?? 0} path(s) from landed ${baseBranch}`,
		suggestedCommand: "spine status --diagnose",
		synced: true,
		mode: "plumbing-paths",
		baseTip,
		processedPaths: syncResult.processedPaths,
	};
}

/**
 * @param {object} result
 * @param {boolean} [json]
 */
export function formatSyncBaseHuman(result, json = false) {
	if (json) return `${JSON.stringify(result, null, 2)}\n`;

	const lines = ["", result.ok ? "Sync base" : "Sync base failed", "", `  ${result.headline}`];
	if (result.error) {
		lines.push("", `  Error: ${result.error}`);
	}
	if (result.overlapPaths?.length) {
		lines.push("", `  Overlap paths: ${result.overlapPaths.slice(0, 8).join(", ")}`);
	}
	if (result.mode) {
		lines.push(`  Mode: ${result.mode}`);
	}
	if (result.baseTip) {
		lines.push(`  Base tip: ${result.baseTip}`);
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
 * @param {string[]} [options.args]
 */
export function runSpineSyncBase(options) {
	const { projectRoot, args = [] } = options;
	const flags = new Set(args.filter((arg) => arg.startsWith("--")));
	const result = syncHumanCheckoutWithBase({
		projectRoot,
		dryRun: flags.has("--dry-run"),
	});
	return {
		exitCode: result.exitCode ?? (result.ok ? 0 : 1),
		output: formatSyncBaseHuman(result, flags.has("--json")),
		result,
	};
}
