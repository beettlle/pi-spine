/**
 * Orch → base integration (FR-INT-01–05, TP-016).
 */

import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../../bin/spine-config.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { countCommitsAhead } from "./lane-commit.mjs";
import { inspectGitState, loadBatchStateFile, parseBatchState } from "./reconcile.mjs";

/**
 * Phase 3 gate stub — full gate FSM is Phase 4.
 *
 * @param {import("../../bin/spine-config.mjs").SpineConfig|null} config
 */
export function checkIntegrateGateStub(config) {
	if (config?.gates?.requireBeforeIntegrate) {
		return {
			ok: true,
			warning:
				"gates.requireBeforeIntegrate is set but gate approval is not enforced until Phase 4 — review changes before pushing",
		};
	}
	return { ok: true };
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	return execFileSync("git", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
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
	const gate = checkIntegrateGateStub(configResult.config ?? null);

	if (dryRun) {
		return {
			ok: true,
			exitCode: 0,
			dryRun: true,
			batchId,
			baseBranch,
			orchBranch,
			commitsAhead,
			gateWarning: gate.warning ?? null,
			headline: `Would merge ${orchBranch} → ${baseBranch} (${commitsAhead ?? "?"} commit(s))`,
			suggestedCommand: "spine integrate",
			mergePlan: `git checkout ${baseBranch} && git merge --no-ff ${orchBranch}`,
		};
	}

	appendJournalEvent(projectRoot, batchId, "integrate.started", {
		baseBranch,
		orchBranch,
		commitsAhead,
		gateWarning: gate.warning ?? null,
	});

	const previous = git(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	try {
		git(projectRoot, ["checkout", baseBranch]);
		git(projectRoot, ["merge", "--no-ff", orchBranch, "-m", `integrate ${orchBranch} into ${baseBranch}`]);
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
			gateWarning: gate.warning ?? null,
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
