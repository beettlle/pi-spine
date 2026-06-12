/**
 * Orch → base integration (FR-INT-01–05, TP-016).
 */

import { execFileSync } from "node:child_process";
import { gitExec } from "./git-exec.mjs";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import {
	resolveRulesManifestIntegrateDrift,
	tryAutoResolveRulesManifestMergeConflict,
} from "./engine-lanes.mjs";
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
 * Validates orch branch state before `spine batch complete` (FR-BATCH-16).
 *
 * @param {string} projectRoot
 * @param {object} ctx
 * @param {string} ctx.baseBranch
 * @param {string|null} ctx.orchBranch
 * @param {boolean} ctx.mergeResultsEmpty
 * @param {boolean} ctx.orchMergedToBase
 */
export function assertOrchIntegratable(projectRoot, ctx) {
	const { baseBranch, orchBranch, mergeResultsEmpty, orchMergedToBase } = ctx;

	if (orchMergedToBase) {
		return { ok: true, reason: "orch_merged_to_base" };
	}

	if (mergeResultsEmpty) {
		return { ok: true, reason: "no_merge_claimed" };
	}

	if (!orchBranch) {
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error: "Batch mergeResults claim success but no orch branch is recorded",
			suggestedCommand: "spine status --diagnose",
		};
	}

	let commitsAhead = 0;
	try {
		commitsAhead = countCommitsAhead(projectRoot, baseBranch, orchBranch);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error: `Cannot compare ${orchBranch} to ${baseBranch}: ${message}`,
			suggestedCommand: "spine status --diagnose",
		};
	}

	if (commitsAhead === 0) {
		return {
			ok: false,
			failureClass: "EmptyMerge",
			error:
				`Orch branch ${orchBranch} has no commits ahead of ${baseBranch} but mergeResults claim success. ` +
				`Re-run the batch or land lane work on the orch branch before completing.`,
			suggestedCommand: "spine status --diagnose",
		};
	}

	return {
		ok: false,
		failureClass: "NeedsIntegrate",
		error:
			`Orch branch ${orchBranch} is ${commitsAhead} commit(s) ahead of ${baseBranch} — run integrate before completing the batch record.`,
		suggestedCommand: "spine integrate",
		commitsAhead,
	};
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
			mergePlan: `git checkout ${baseBranch} && git merge --no-ff ${orchBranch}`,
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
	try {
		const drift = resolveRulesManifestIntegrateDrift({ projectRoot, baseBranch, orchBranch });
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

		git(projectRoot, ["checkout", baseBranch]);
		let mergeInProgress = false;
		try {
			git(projectRoot, [
				"merge",
				"--no-ff",
				orchBranch,
				"-m",
				`integrate ${orchBranch} into ${baseBranch}`,
			]);
		} catch {
			mergeInProgress = true;
			const autoResolved = tryAutoResolveRulesManifestMergeConflict(projectRoot);
			if (!autoResolved.ok) {
				try {
					execFileSync("git", ["merge", "--abort"], {
						cwd: projectRoot,
						stdio: ["ignore", "pipe", "pipe"],
					});
				} catch {
					// best-effort abort
				}
				const message = autoResolved.error ?? "merge conflict";
				appendJournalEvent(projectRoot, batchId, "integrate.failed", {
					baseBranch,
					orchBranch,
					error: message.slice(0, 500),
					conflict: true,
				});
				try {
					git(projectRoot, ["checkout", previous || baseBranch]);
				} catch {
					// leave operator on base for manual recovery
				}
				return {
					ok: false,
					exitCode: 1,
					error: message,
					failureClass: autoResolved.failureClass ?? "MergeConflict",
					headline: `Merge conflict integrating ${orchBranch} into ${baseBranch} — resolve manually`,
					suggestedCommand: "spine status --diagnose",
					batchId,
					alternatives: ["/spine-gate"],
				};
			}
			git(projectRoot, ["commit", "--no-edit"]);
		}
		const mergeCommit = git(projectRoot, ["rev-parse", "HEAD"]);

		appendJournalEvent(projectRoot, batchId, "integrate.completed", {
			baseBranch,
			orchBranch,
			mergeCommit,
			commitsAhead,
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

		try {
			execFileSync("git", ["merge", "--abort"], {
				cwd: projectRoot,
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch {
			// best-effort abort
		}

		try {
			git(projectRoot, ["checkout", previous || baseBranch]);
		} catch {
			// leave operator on base for manual recovery
		}

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
