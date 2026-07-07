// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { loadSpineConfig } from "./spine-config-load.mjs";
import { runDoctorChecks } from "../doctor/run-doctor-checks.mjs";
import { buildStalePathDoctorCheck, isStalePathSpinePreflightBlocking } from "../doctor/stale-path.mjs";
import { PACKAGE_ROOT } from "./spine-init-constants.mjs";
import { runReconciliationCheck } from "../batch/reconcile.mjs";
import { buildCoexistencePreflightCheck, assessOrchestratorCoexistence } from "../doctor/coexistence.mjs";
import { validatePiSpineRootConfig } from "./pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "./worker-launch-script.mjs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { summarizePendingScope } from "../planner/pending.mjs";
import {
	checkDependenciesJson,
	checkTasksRoot,
	checkTasksValidate,
	checkWorktreeSetupHook,
	resolveTasksRoot,
} from "./preflight/discovery.mjs";
import {
	checkGitClean,
	checkNoActiveBatch,
	listHumanDirtyPaths,
	resolveCurrentGitBranch,
} from "./preflight/git-batch.mjs";
import {
	checkOrchMergeConflictWarn,
	checkPrelandedFileScopeWarn,
	runPreflightPlanCheck,
} from "./preflight/integrate-plan.mjs";
import { INTEGRATE_DEFAULTS } from "./defaults.mjs";
import { parseContract } from "../tasks/packet/parse-prompt.mjs";
import { hasReleaseCriticalContract, isStubWorkerMode } from "../batch/contract-verify.mjs";

export {
	checkDependenciesJson,
	checkTasksRoot,
	checkTasksValidate,
	checkWorktreeSetupHook,
	discoverTaskFolders,
	discoverTaskIds,
	resolveTasksRoot,
	taskIdFromFolder,
} from "./preflight/discovery.mjs";

export {
	checkGitClean,
	checkNoActiveBatch,
	filterPiSessionDirtyPaths,
	isPiSessionMetadataPath,
	listHumanDirtyPaths,
	resolveCurrentGitBranch,
} from "./preflight/git-batch.mjs";

export {
	checkOrchMergeConflictWarn,
	checkPrelandedFileScopeWarn,
	isMergeOriginMainTask,
	listDivergentOrchMergeRiskPaths,
	listPrelandedFileScopeStaleTasks,
	ORCH_MULTI_FILE_MERGE_RISK_PATHS,
	PRD_REL_PATH,
	predictOrchMergeConflictRisk,
	runPreflightPlanCheck,
} from "./preflight/integrate-plan.mjs";

const CONCURRENT_DEV_LABEL = "concurrent development on base branch";

/**
 * Doctor/preflight advisory when a human stays on baseBranch during an active batch (FR-WT-08 / #91).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>["config"]} [ctx.config]
 * @param {typeof runReconciliationCheck} [ctx.runReconciliation]
 */
export function buildConcurrentDevDoctorCheck(ctx) {
	const { projectRoot, config } = ctx;
	const allowMode =
		config?.integrate?.allowHumanOnBaseBranch ?? INTEGRATE_DEFAULTS.allowHumanOnBaseBranch;

	if (allowMode === "allow") {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: "integrate.allowHumanOnBaseBranch=allow — concurrent base-branch edits permitted",
		};
	}

	const assessment = assessOrchestratorCoexistence({
		projectRoot,
		runReconciliation: ctx.runReconciliation,
	});
	if (assessment.kind !== "spine_active") {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: "no active pi-spine batch",
		};
	}

	const baseBranch = String(config?.baseBranch ?? "main").trim() || "main";
	const branchResult = resolveCurrentGitBranch(projectRoot);
	if (branchResult.error) {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: `branch check skipped: ${branchResult.error}`,
		};
	}
	if (branchResult.branch !== baseBranch) {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: `checked out on ${branchResult.branch ?? "detached HEAD"}, not ${baseBranch}`,
		};
	}

	const dirtyResult = listHumanDirtyPaths(projectRoot);
	if (dirtyResult.error) {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: `dirty-tree check skipped: ${dirtyResult.error}`,
		};
	}
	if (dirtyResult.dirtyPaths.length === 0) {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: true,
			detail: `active batch with human on ${baseBranch} — working tree clean`,
		};
	}

	const batchId = assessment.spine?.batchId ?? "unknown";
	const preview = dirtyResult.dirtyPaths.slice(0, 3).join(", ");
	const suffix =
		dirtyResult.dirtyPaths.length > 3
			? ` (+${dirtyResult.dirtyPaths.length - 3} more)`
			: "";
	const detail =
		`active batch ${batchId} with uncommitted edits on ${baseBranch} (${preview}${suffix}) — ` +
		"isolated integrate leaves your checkout untouched; commit or stash to reduce overlap risk";

	if (allowMode === "block") {
		return {
			label: CONCURRENT_DEV_LABEL,
			ok: false,
			detail,
			suggestedCommand: "git stash push -m 'spine-batch' || git switch -c wip/spine-batch",
		};
	}

	return {
		label: CONCURRENT_DEV_LABEL,
		ok: true,
		warning: true,
		detail,
		suggestedCommand: "git status",
	};
}

function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {() => ReturnType<typeof runDoctorChecks>} [ctx.runDoctor]
 */
export function checkDoctor(ctx) {
	const runDoctor = ctx.runDoctor ?? (() => runDoctorChecks(ctx.projectRoot));
	const doctor = runDoctor();
	if (doctor.ok) {
		return makeCheck("doctor", true, "spine doctor passed");
	}

	const failed = doctor.checks.filter((entry) => !entry.ok).map((entry) => entry.label);
	return makeCheck("doctor", false, `spine doctor failed (${doctor.issueCount} issue(s))`, {
		details: { failedChecks: failed, checks: doctor.checks },
		suggestedCommand: "spine doctor",
	});
}

/**
 * Fail preflight when PATH `spine` is an older global build (batch 20260619T020951 / SP-308).
 *
 * @param {object} [_ctx]
 * @param {{ stalePathCheckArgs?: object }} [options]
 */
export function checkStalePathSpine(_ctx = {}, options = {}) {
	const check = buildStalePathDoctorCheck({
		packageRoot: PACKAGE_ROOT,
		runningSpinePath: path.join(PACKAGE_ROOT, "bin", "spine.mjs"),
		...options.stalePathCheckArgs,
	});
	if (isStalePathSpinePreflightBlocking(check)) {
		return makeCheck("stale-path-spine", false, check.detail, {
			suggestedCommand:
				check.suggestedCommand ?? `cd ${PACKAGE_ROOT} && npm link`,
		});
	}
	return makeCheck("stale-path-spine", true, check.detail, check.warning ? { warning: true } : {});
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkPiSpineRoot(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const config = configResult?.config;

	if (!config || configResult?.error) {
		return makeCheck("pi-spine-root", true, "pi-spine root check skipped (config unavailable)");
	}

	const launchScript = resolveSafeWorkerLaunchScript(ctx.projectRoot, config);
	const overrideConfigured = Boolean(config?.development?.piSpineRoot);
	if (!launchScript && !overrideConfigured) {
		return makeCheck("pi-spine-root", true, "pi-spine root not required (no custom worker launch script)");
	}

	const validationError = validatePiSpineRootConfig(config, ctx.projectRoot);
	if (validationError) {
		return makeCheck("pi-spine-root", false, validationError.message, {
			suggestedCommand: validationError.suggestedCommand,
		});
	}

	return makeCheck(
		"pi-spine-root",
		true,
		launchScript
			? "pi-spine root valid for custom worker launch script"
			: "development.piSpineRoot override valid",
	);
}

/**
 * Fail preflight when PATH `spine` is an older global build (batch 20260619T020951 / SP-308).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkStubReleaseCritical(ctx) {
	if (!isStubWorkerMode()) {
		return makeCheck("stub-release-critical", true, "stub worker mode not active");
	}

	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);
	if (!tasksRootPath) {
		return makeCheck("stub-release-critical", true, "stub release-critical check skipped (no tasks root)");
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
		/** @type {string[]} */
		const criticalTaskIds = [];

		for (const discoveredTask of discovered) {
			if (!pendingIds.includes(discoveredTask.taskId)) continue;
			const promptMarkdown = fs.readFileSync(
				path.join(discoveredTask.folderPath, "PROMPT.md"),
				"utf-8",
			);
			const parsedContract = parseContract(promptMarkdown);
			if (hasReleaseCriticalContract(parsedContract)) {
				criticalTaskIds.push(discoveredTask.taskId);
			}
		}

		if (criticalTaskIds.length === 0) {
			return makeCheck(
				"stub-release-critical",
				true,
				"no pending tasks with fileScopeMustChange contracts",
			);
		}

		const preview = criticalTaskIds.slice(0, 8).join(", ");
		const suffix =
			criticalTaskIds.length > 8 ? ` (+${criticalTaskIds.length - 8} more)` : "";
		return makeCheck(
			"stub-release-critical",
			true,
			`SPINE_WORKER_STUB=1 with ${criticalTaskIds.length} pending task(s) requiring file-scope changes (${preview}${suffix})`,
			{
				warning: true,
				details: { taskIds: criticalTaskIds },
				suggestedCommand: "unset SPINE_WORKER_STUB",
			},
		);
	} catch (err) {
		const message = err?.message ?? String(err);
		return makeCheck(
			"stub-release-critical",
			true,
			`stub release-critical check skipped: ${message}`,
		);
	}
}

/**
 * @param {object} options
 * @param {string} options.projectRoot
 * @param {boolean} [options.skipDoctor]
 * @param {() => ReturnType<typeof runDoctorChecks>} [options.runDoctor]
 * @param {typeof runReconciliationCheck} [options.runReconciliation]
 */
export function runBatchPreflight(options) {
	const { projectRoot, skipDoctor = false } = options;
	const ctx = { projectRoot, configResult: loadSpineConfig(projectRoot) };
	const checks = [];

	if (!skipDoctor) {
		checks.push(
			checkDoctor({
				projectRoot,
				runDoctor: options.runDoctor,
			}),
		);
	}

	checks.push(checkStalePathSpine(ctx));

	checks.push(checkGitClean(ctx));
	checks.push(
		buildCoexistencePreflightCheck({
			projectRoot,
			runReconciliation: options.runReconciliation,
		}),
	);
	checks.push(
		checkNoActiveBatch({
			projectRoot,
			runReconciliation: options.runReconciliation,
		}),
	);
	checks.push(checkTasksRoot(ctx));
	checks.push(checkPiSpineRoot(ctx));
	checks.push(checkDependenciesJson(ctx));
	checks.push(checkWorktreeSetupHook(ctx));
	checks.push(checkTasksValidate(ctx));
	checks.push(checkStubReleaseCritical(ctx));
	checks.push(checkOrchMergeConflictWarn(ctx));
	checks.push(checkPrelandedFileScopeWarn(ctx));

	const plan = runPreflightPlanCheck(ctx);
	checks.push(
		makeCheck("plan", plan.status === "ok", plan.message, {
			details: plan,
		}),
	);

	const ok = checks.every((check) => check.ok);
	return {
		ok,
		exitCode: ok ? 0 : 1,
		checks,
	};
}

export function formatPreflightHuman(result) {
	const lines = ["\nBatch preflight\n"];
	for (const check of result.checks) {
		const icon = !check.ok ? "❌" : check.warning ? "⚠️" : "✅";
		lines.push(`  ${icon} ${check.id}: ${check.message}`);
		if (!check.ok && check.suggestedCommand) {
			lines.push(`     → ${check.suggestedCommand}`);
		} else if (check.warning && check.suggestedCommand) {
			lines.push(`     → ${check.suggestedCommand}`);
		}
	}
	lines.push("");
	lines.push(
		result.ok
			? "✅ Preflight passed — ready to plan or start a batch.\n"
			: "❌ Preflight failed.\n",
	);
	return lines.join("\n");
}
