// @ts-nocheck
/**
 * Orch → base integration (FR-INT-01–05, TP-016).
 */

import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { mergeOrchIntoBaseIsolated, isBranchCheckedOutInWorktree, syncPlumbingMergePathsToWorktree } from "./integrate-worktree.mjs";
import {
	isFastForwardCapableIntegrate,
	resolveRulesManifestIntegrateDrift,
} from "./rules-manifest-drift.mjs";
import { assertOrchIntegratable } from "./integrate-assert.mjs";
export { assertOrchIntegratable } from "./integrate-assert.mjs";
import { tryRestoreBranch } from "./integrate-git.mjs";
export { tryRestoreBranch } from "./integrate-git.mjs";
import { checkIntegrateGate } from "./gate.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { inspectGitState, loadBatchStateFile, parseBatchState } from "./reconcile.mjs";

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return gitExec(projectRoot, args, { projectRoot });
}

/**
 * @param {string} output
 */
function mergeTreeOutputHasConflict(output) {
	return /CONFLICT/i.test(output);
}

/**
 * Ref-only merge when base is not checked out in projectRoot (avoids worktree git merge).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.mergeMessage
 */
function mergeOrchIntoBaseViaRefs({ projectRoot, baseBranch, orchBranch, mergeMessage }) {
	const baseSha = git(projectRoot, ["rev-parse", baseBranch]);
	const orchSha = git(projectRoot, ["rev-parse", orchBranch]);

	let mergeTreeOutput = "";
	let treeSha = "";
	try {
		mergeTreeOutput = execFileSync(
			"git",
			["merge-tree", "--write-tree", baseBranch, orchBranch],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			},
		).trim();
		treeSha = mergeTreeOutput.split("\n").pop()?.trim() ?? "";
	} catch (err) {
		const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout ?? "") : "";
		const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "";
		mergeTreeOutput = `${stdout}\n${stderr}`.trim();
		if (mergeTreeOutputHasConflict(mergeTreeOutput)) {
			return {
				ok: false,
				failureClass: "MergeConflict",
				error: mergeTreeOutput.split("\n").slice(-3).join(" ") || "merge conflict",
			};
		}
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			failureClass: "IntegrateFailed",
			error: message,
		};
	}

	if (!treeSha || mergeTreeOutputHasConflict(mergeTreeOutput)) {
		return {
			ok: false,
			failureClass: "MergeConflict",
			error: mergeTreeOutput || `merge conflict integrating ${orchBranch} into ${baseBranch}`,
		};
	}

	const mergeCommit = git(
		projectRoot,
		["commit-tree", treeSha, "-p", baseSha, "-p", orchSha, "-m", mergeMessage],
	);
	git(projectRoot, ["update-ref", `refs/heads/${baseBranch}`, mergeCommit]);

	return { ok: true, mergeCommit, mode: "plumbing" };
}

/**
 * Fast-forward base to orch tip without checking out base in projectRoot.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 */
function fastForwardOrchIntoBase({ projectRoot, baseBranch, orchBranch }) {
	const baseShaBefore = git(projectRoot, ["rev-parse", baseBranch]);
	const orchSha = git(projectRoot, ["rev-parse", orchBranch]);
	git(projectRoot, ["update-ref", `refs/heads/${baseBranch}`, orchSha]);
	return {
		ok: true,
		mergeCommit: orchSha,
		mode: "fast-forward",
		baseShaBefore,
	};
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.baseBranch
 * @param {string} params.orchBranch
 * @param {string} params.batchId
 */
function runIntegrateMerge({ projectRoot, baseBranch, orchBranch, batchId }) {
	const mergeMessage = `integrate ${orchBranch} into ${baseBranch}`;
	if (isFastForwardCapableIntegrate({ projectRoot, baseBranch, orchBranch })) {
		return fastForwardOrchIntoBase({ projectRoot, baseBranch, orchBranch });
	}
	if (isBranchCheckedOutInWorktree(projectRoot, baseBranch)) {
		return mergeOrchIntoBaseIsolated({ projectRoot, baseBranch, orchBranch, batchId });
	}
	return mergeOrchIntoBaseViaRefs({ projectRoot, baseBranch, orchBranch, mergeMessage });
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {boolean} [ctx.dryRun]
 * @param {string|null} [ctx.batchId]
 * @param {string|null} [ctx.batchStatePath]
 */
export function integrateOrchToBase(ctx) {
	const { projectRoot, dryRun = false } = ctx;
	const loaded = loadBatchStateFile(projectRoot, ctx.batchStatePath ?? null);

	if (!loaded.path || !loaded.raw) {
		return {
			ok: false,
			exitCode: 1,
			headline: "No active batch to integrate",
			suggestedCommand: "spine preflight",
			diagnosis: null,
			batchId: null,
		};
	}

	if (loaded.parseError) {
		return {
			ok: false,
			exitCode: 1,
			error: loaded.parseError,
			headline: `Cannot parse batch state: ${loaded.parseError}`,
			suggestedCommand: "spine status --diagnose",
			diagnosis: "failed",
			batchId: null,
		};
	}

	const batch = parseBatchState(loaded.raw, loaded.path ?? "");
	if (!batch) {
		return {
			ok: false,
			exitCode: 1,
			headline: "Batch state is unreadable",
			suggestedCommand: "spine status --diagnose",
			batchId: null,
		};
	}

	const batchId = batch.batchId;
	if (ctx.batchId && batchId && ctx.batchId !== batchId) {
		return {
			ok: false,
			exitCode: 1,
			error: `Active batch is ${batchId}, not ${ctx.batchId}`,
			headline: `Batch ID mismatch — active batch is ${batchId}`,
			suggestedCommand: "spine status --diagnose",
			batchId,
		};
	}

	const baseBranch = batch.baseBranch;
	const orchBranch = batch.orchBranch;
	if (!orchBranch) {
		return {
			ok: false,
			exitCode: 1,
			error: "Batch state has no orch branch",
			headline: "Cannot integrate — orch branch missing from batch state",
			suggestedCommand: "spine status --diagnose",
			batchId,
		};
	}

	const gitState = inspectGitState({
		projectRoot,
		batchId,
		baseBranch,
		orchBranch,
	});

	if (gitState.orchMergedToBase) {
		return {
			ok: true,
			exitCode: 0,
			batchId,
			baseBranch,
			orchBranch,
			headline: `Orch branch already merged into ${baseBranch}`,
			suggestedCommand: "spine batch complete",
			alreadyMerged: true,
		};
	}

	const mergeResultsEmpty = batch.mergeResults.length === 0;
	const integratable = assertOrchIntegratable(projectRoot, {
		baseBranch,
		orchBranch,
		mergeResultsEmpty,
		orchMergedToBase: false,
	});

	let commitsAhead = integratable.commitsAhead ?? null;
	if (commitsAhead == null) {
		try {
			commitsAhead = countCommitsAhead(projectRoot, baseBranch, orchBranch);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				ok: false,
				exitCode: 1,
				error: message,
				failureClass: "EmptyMerge",
				headline: `Cannot integrate — ${message}`,
				suggestedCommand: "spine status --diagnose",
				batchId,
			};
		}
	}

	if (commitsAhead === 0) {
		return {
			ok: false,
			exitCode: 1,
			failureClass: "EmptyMerge",
			error: `Orch branch ${orchBranch} has no commits ahead of ${baseBranch}`,
			headline: `Nothing to integrate — ${orchBranch} is not ahead of ${baseBranch}`,
			suggestedCommand: "spine status --diagnose",
			batchId,
		};
	}

	if (!integratable.ok && integratable.failureClass !== "NeedsIntegrate") {
		return {
			ok: false,
			exitCode: 1,
			error: integratable.error,
			failureClass: integratable.failureClass,
			headline: integratable.error ?? "Integrate refused",
			suggestedCommand: integratable.suggestedCommand ?? "spine status --diagnose",
			batchId,
			diagnosis: null,
		};
	}

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? null;
	const gateCheck = checkIntegrateGate({
		projectRoot,
		batchId,
		config,
		forceIntegrate: Boolean(ctx.forceIntegrate),
		dryRun,
	});

	if (!gateCheck.ok && !dryRun) {
		appendJournalEvent(projectRoot, batchId, "integrate.failed", {
			baseBranch,
			orchBranch,
			gateBlocked: true,
			gateStatus: gateCheck.gate?.status ?? "missing",
			error: gateCheck.error ?? gateCheck.headline,
		});

		return {
			ok: false,
			exitCode: gateCheck.exitCode ?? 2,
			failureClass: gateCheck.failureClass ?? "GateBlocked",
			error: gateCheck.error,
			headline: gateCheck.headline ?? "Integrate blocked by gate",
			suggestedCommand: gateCheck.suggestedCommand ?? "spine gate approve",
			alternatives: gateCheck.alternatives ?? ["/spine-gate approve"],
			batchId,
			gate: gateCheck.gate ?? null,
			diagnosis: "needs_integrate",
		};
	}

	if (dryRun) {
		const gatePending = gateCheck.required && !gateCheck.ok;
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			batchId,
			baseBranch,
			orchBranch,
			commitsAhead,
			gateRequired: gateCheck.required ?? false,
			gatePending,
			headline: gatePending
				? `Would merge ${orchBranch} → ${baseBranch} after gate approval (${commitsAhead ?? "?"} commit(s))`
				: `Would merge ${orchBranch} → ${baseBranch} (${commitsAhead ?? "?"} commit(s))`,
			suggestedCommand: gatePending ? "spine gate approve" : "spine integrate",
			mergePlan: isFastForwardCapableIntegrate({ projectRoot, baseBranch, orchBranch })
				? `isolated fast-forward ${orchBranch} → ${baseBranch} (ref update, no checkout in projectRoot)`
				: isBranchCheckedOutInWorktree(projectRoot, baseBranch)
					? `isolated plumbing merge ${orchBranch} → ${baseBranch} (no checkout in projectRoot)`
					: `isolated ref merge ${orchBranch} → ${baseBranch} (merge-tree, no checkout in projectRoot)`,
		};
	}

	appendJournalEvent(projectRoot, batchId, "integrate.started", {
		baseBranch,
		orchBranch,
		commitsAhead,
		gateRequired: gateCheck.required ?? false,
		gateForced: gateCheck.forced ?? false,
	});

	const previous = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	const baseCheckedOutAtStart = isBranchCheckedOutInWorktree(projectRoot, baseBranch);
	try {
		const drift = resolveRulesManifestIntegrateDrift({
			projectRoot,
			baseBranch,
			orchBranch,
			isolatedMerge: true,
		});
		if (!drift.ok) {
			return {
				ok: false,
				exitCode: 1,
				error: drift.error,
				failureClass: drift.failureClass ?? "DirtyWorktree",
				headline: drift.error ?? "Integrate refused — dirty rules-manifest",
				suggestedCommand: "spine status --diagnose",
				batchId,
			};
		}
		if (drift.resolved) {
			appendJournalEvent(projectRoot, batchId, "integrate.drift_resolved", {
				baseBranch,
				orchBranch,
				action: drift.action ?? "restored_head",
			});
		}

		const mergeResult = runIntegrateMerge({ projectRoot, baseBranch, orchBranch, batchId });

		if (!mergeResult.ok) {
			const message = mergeResult.error ?? "merge conflict";
			const conflict = mergeResult.failureClass === "MergeConflict";
			appendJournalEvent(projectRoot, batchId, "integrate.failed", {
				baseBranch,
				orchBranch,
				error: message.slice(0, 500),
				conflict,
			});
			tryRestoreBranch(projectRoot, previous || baseBranch);
			return {
				ok: false,
				exitCode: 1,
				error: message,
				failureClass: mergeResult.failureClass ?? (conflict ? "MergeConflict" : "IntegrateFailed"),
				headline: conflict
					? `Merge conflict integrating ${orchBranch} into ${baseBranch} — resolve manually`
					: `Integrate failed: ${message}`,
				suggestedCommand: "spine status --diagnose",
				batchId,
				alternatives: ["/spine-gate"],
			};
		}

		const mergeCommit = mergeResult.mergeCommit;

		/** @type {{ ok: boolean, timedOut?: boolean, error?: string } | null} */
		let syncResult = null;
		if (mergeResult.mode === "fast-forward") {
			syncResult = syncPlumbingMergePathsToWorktree(
				projectRoot,
				mergeResult.baseShaBefore,
				mergeCommit,
			);
		} else if (mergeResult.mode === "plumbing") {
			const baseSha = git(projectRoot, ["rev-parse", `${mergeCommit}^1`]);
			syncResult = syncPlumbingMergePathsToWorktree(projectRoot, baseSha, mergeCommit);
		} else if (!baseCheckedOutAtStart) {
			try {
				git(projectRoot, ["checkout", baseBranch]);
				git(projectRoot, ["reset", "--hard", "HEAD"]);
			} catch {
				// Dirty tree may block checkout after isolated land — operator syncs manually.
			}
		}

		if (syncResult && !syncResult.ok) {
			appendJournalEvent(projectRoot, batchId, "integrate.failed", {
				baseBranch,
				orchBranch,
				timeout: Boolean(syncResult.timedOut),
				error: (syncResult.error ?? "sync failed").slice(0, 500),
				mergeCommitLanded: true,
				mergeCommit,
			});

			tryRestoreBranch(projectRoot, previous || baseBranch);

			return {
				ok: false,
				exitCode: 1,
				error: syncResult.error ?? "post-merge sync failed",
				failureClass: syncResult.timedOut ? "IntegrateTimeout" : "IntegrateFailed",
				headline: syncResult.timedOut
					? `Integrate sync timed out after merge landed — ${orchBranch} into ${baseBranch}`
					: `Integrate post-merge sync failed — ${syncResult.error}`,
				suggestedCommand: "spine status --diagnose",
				batchId,
				mergeCommitLanded: true,
				alternatives: ["spine integrate"],
			};
		}

		appendJournalEvent(projectRoot, batchId, "integrate.completed", {
			baseBranch,
			orchBranch,
			mergeCommit,
			commitsAhead,
			isolated: true,
			baseCheckedOutAtStart,
		});

		return {
			ok: true,
			exitCode: 0,
			batchId,
			baseBranch,
			orchBranch,
			mergeCommit,
			commitsAhead,
			gateRequired: gateCheck.required ?? false,
			headline: `Integrated ${orchBranch} into ${baseBranch}`,
			suggestedCommand: "spine batch complete",
			alternatives: ["spine status --diagnose"],
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const conflict = /conflict|CONFLICT/i.test(message);

		appendJournalEvent(projectRoot, batchId, "integrate.failed", {
			baseBranch,
			orchBranch,
			error: message.slice(0, 500),
			conflict,
		});

		tryRestoreBranch(projectRoot, previous || baseBranch);

		return {
			ok: false,
			exitCode: 1,
			error: message,
			failureClass: conflict ? "MergeConflict" : "IntegrateFailed",
			headline: conflict
				? `Merge conflict integrating ${orchBranch} into ${baseBranch} — resolve manually`
				: `Integrate failed: ${message}`,
			suggestedCommand: "spine status --diagnose",
			batchId,
			alternatives: ["/spine-gate"],
		};
	}
}
