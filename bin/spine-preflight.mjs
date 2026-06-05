import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "./spine-config.mjs";
import { resolveTasksRootPath } from "../src/config/env-overrides.mjs";
import { runDoctorChecks } from "./spine.mjs";
import { runReconciliationCheck } from "../src/batch/reconcile.mjs";
import { buildPlan } from "../src/planner/index.mjs";
import { formatPlanHuman } from "./spine-plan.mjs";
import { buildCoexistencePreflightCheck } from "../src/doctor/coexistence.mjs";
import { validatePiSpineRootConfig } from "../src/config/pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "../src/config/worker-launch-script.mjs";
import { validateWorktreeSetupHookConfig } from "../src/config/worktree-setup-hook.mjs";

const HEALTHY_ACTIVE_PHASES = new Set(["planning", "running", "paused"]);
const LIMBO_DIAGNOSES = new Set(["limbo_stale", "completed_manual"]);
const DEPENDENCIES_SCHEMA_VERSION = 1;
const TASK_ID_PATTERN = /^[A-Z]{2,}-\d{3,}$/;

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function resolveTasksRoot(projectRoot, configResult) {
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	if (!loaded.config) {
		return null;
	}
	return resolveTasksRootPath(projectRoot, loaded.config);
}

function isInsideGitRepo(dir) {
	try {
		execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
			cwd: dir,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

export function taskIdFromFolder(folderName) {
	const match = String(folderName).match(/^([A-Z]{2,}-\d{3,})/);
	return match?.[1] ?? null;
}

export function discoverTaskFolders(tasksRootPath) {
	if (!tasksRootPath || !fs.existsSync(tasksRootPath)) return [];

	return fs
		.readdirSync(tasksRootPath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => fs.existsSync(path.join(tasksRootPath, name, "PROMPT.md")))
		.sort();
}

export function discoverTaskIds(tasksRootPath) {
	return [...new Set(discoverTaskFolders(tasksRootPath).map(taskIdFromFolder).filter(Boolean))].sort();
}

function resolveBatchStatePath(projectRoot) {
	const spinePath = path.join(projectRoot, ".spine", "batch-state.json");
	if (fs.existsSync(spinePath)) return spinePath;

	const piPath = path.join(projectRoot, ".pi", "batch-state.json");
	if (fs.existsSync(piPath)) return piPath;

	return null;
}

function loadBatchState(batchStatePath) {
	try {
		return JSON.parse(fs.readFileSync(batchStatePath, "utf-8"));
	} catch (err) {
		return { parseError: err.message };
	}
}

function isHealthyActiveBatch(batchState) {
	if (!batchState || batchState.parseError) return false;
	const phase = batchState.phase ?? batchState.status;
	if (phase && HEALTHY_ACTIVE_PHASES.has(String(phase))) return true;
	if (batchState.endedAt == null && batchState.batchId) return true;
	return false;
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
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 */
export function checkGitClean(ctx) {
	if (!isInsideGitRepo(ctx.projectRoot)) {
		return makeCheck("git-clean", false, "not inside a git repository", {
			suggestedCommand: "git init",
		});
	}

	let output = "";
	try {
		output = execFileSync("git", ["status", "--porcelain"], {
			cwd: ctx.projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		});
	} catch (err) {
		return makeCheck("git-clean", false, `git status failed: ${err.message}`, {
			suggestedCommand: "git status",
		});
	}

	const dirtyPaths = output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => line.slice(3).trim() || line.trim());

	if (dirtyPaths.length === 0) {
		return makeCheck("git-clean", true, "working tree clean");
	}

	const listed = dirtyPaths.slice(0, 20);
	const suffix =
		dirtyPaths.length > listed.length ? ` (+${dirtyPaths.length - listed.length} more)` : "";

	return makeCheck(
		"git-clean",
		false,
		`working tree has ${dirtyPaths.length} uncommitted change(s)${suffix}`,
		{
			details: { dirtyPaths: listed, totalDirty: dirtyPaths.length },
			suggestedCommand: "git status",
		},
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {typeof runReconciliationCheck} [ctx.runReconciliation]
 */
export function checkNoActiveBatch(ctx) {
	const batchStatePath = resolveBatchStatePath(ctx.projectRoot);
	if (!batchStatePath) {
		return makeCheck("no-active-batch", true, "no active batch state file");
	}

	const batchState = loadBatchState(batchStatePath);
	if (batchState.parseError) {
		return makeCheck("no-active-batch", false, `cannot parse batch state: ${batchState.parseError}`, {
			details: { batchStatePath: path.relative(ctx.projectRoot, batchStatePath) },
			suggestedCommand: "spine status --diagnose",
		});
	}

	const reconcile = ctx.runReconciliation ?? runReconciliationCheck;
	const reconciliation = reconcile({
		projectRoot: ctx.projectRoot,
		batchState,
		batchStatePath,
	});

	if (LIMBO_DIAGNOSES.has(reconciliation.diagnosis)) {
		return makeCheck(
			"no-active-batch",
			false,
			reconciliation.headline ?? "stale batch requires dismissal",
			{
				details: {
					batchStatePath: path.relative(ctx.projectRoot, batchStatePath),
					diagnosis: reconciliation.diagnosis,
					batchId: batchState.batchId ?? batchState.id ?? null,
					headline: reconciliation.headline,
				},
				suggestedCommand: reconciliation.suggestedCommand ?? "spine batch dismiss",
			},
		);
	}

	if (reconciliation.diagnosis === "running") {
		const batchId = batchState.batchId ?? batchState.id ?? "unknown";
		return makeCheck(
			"no-active-batch",
			false,
			reconciliation.headline ?? `batch ${batchId} is running`,
			{
				details: {
					batchStatePath: path.relative(ctx.projectRoot, batchStatePath),
					diagnosis: reconciliation.diagnosis,
					batchId,
					headline: reconciliation.headline,
				},
				suggestedCommand: reconciliation.suggestedCommand ?? "/spine-status --diagnose",
			},
		);
	}

	if (reconciliation.diagnosis === "paused") {
		const batchId = batchState.batchId ?? batchState.id ?? "unknown";
		return makeCheck(
			"no-active-batch",
			false,
			reconciliation.headline ?? `batch ${batchId} is paused`,
			{
				details: {
					batchStatePath: path.relative(ctx.projectRoot, batchStatePath),
					diagnosis: reconciliation.diagnosis,
					batchId,
					headline: reconciliation.headline,
				},
				suggestedCommand: reconciliation.suggestedCommand ?? "/spine-resume --force",
			},
		);
	}

	if (isHealthyActiveBatch(batchState)) {
		const batchId = batchState.batchId ?? batchState.id ?? "unknown";
		const phase = batchState.phase ?? batchState.status ?? "unknown";
		return makeCheck(
			"no-active-batch",
			false,
			`healthy active batch ${batchId} (phase: ${phase})`,
			{
				details: {
					batchStatePath: path.relative(ctx.projectRoot, batchStatePath),
					batchId,
					phase,
				},
				suggestedCommand: reconciliation.suggestedCommand ?? "spine status --diagnose",
			},
		);
	}

	return makeCheck(
		"no-active-batch",
		false,
		reconciliation.headline ?? "batch state file present",
		{
			details: {
				batchStatePath: path.relative(ctx.projectRoot, batchStatePath),
				diagnosis: reconciliation.diagnosis,
				batchId: batchState.batchId ?? batchState.id ?? null,
			},
			suggestedCommand: reconciliation.suggestedCommand ?? "spine status --diagnose",
		},
	);
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
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkTasksRoot(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);

	if (!tasksRootPath) {
		return makeCheck("tasks-root", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	if (!fs.existsSync(tasksRootPath)) {
		return makeCheck(
			"tasks-root",
			false,
			`tasks root missing: ${path.relative(ctx.projectRoot, tasksRootPath)}`,
			{
				suggestedCommand: `mkdir -p ${path.relative(ctx.projectRoot, tasksRootPath)}`,
			},
		);
	}

	const taskFolders = discoverTaskFolders(tasksRootPath);
	if (taskFolders.length === 0) {
		return makeCheck("tasks-root", false, "no discoverable task folders (PROMPT.md)", {
			details: { tasksRootPath: path.relative(ctx.projectRoot, tasksRootPath) },
			suggestedCommand: "spine init",
		});
	}

	return makeCheck(
		"tasks-root",
		true,
		`tasks root valid (${taskFolders.length} task folder(s))`,
		{
			details: {
				tasksRootPath: path.relative(ctx.projectRoot, tasksRootPath),
				taskFolders,
			},
		},
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkDependenciesJson(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);

	if (!tasksRootPath) {
		return makeCheck("dependencies-json", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	const depsPath = path.join(tasksRootPath, "dependencies.json");
	if (!fs.existsSync(depsPath)) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json missing: ${path.relative(ctx.projectRoot, depsPath)}`,
			{ suggestedCommand: "spine init" },
		);
	}

	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
	} catch (err) {
		return makeCheck("dependencies-json", false, `cannot parse dependencies.json: ${err.message}`, {
			suggestedCommand: "spine init",
		});
	}

	if (parsed.version !== DEPENDENCIES_SCHEMA_VERSION) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json version must be ${DEPENDENCIES_SCHEMA_VERSION} (found ${parsed.version ?? "missing"})`,
			{ suggestedCommand: "spine init" },
		);
	}

	if (typeof parsed.tasks !== "object" || parsed.tasks === null || Array.isArray(parsed.tasks)) {
		return makeCheck("dependencies-json", false, "dependencies.json tasks must be an object", {
			suggestedCommand: "spine init",
		});
	}

	const taskIds = Object.keys(parsed.tasks);
	const invalidIds = taskIds.filter((id) => !TASK_ID_PATTERN.test(id));
	if (invalidIds.length > 0) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json has invalid task IDs: ${invalidIds.slice(0, 5).join(", ")}`,
			{ details: { invalidIds }, suggestedCommand: "spine init --tasks-root taskplane-tasks" },
		);
	}

	const discovered = new Set(discoverTaskIds(tasksRootPath));
	const unknownIds = taskIds.filter((id) => !discovered.has(id));
	if (unknownIds.length > 0) {
		return makeCheck(
			"dependencies-json",
			false,
			`dependencies.json references unknown task folders: ${unknownIds.slice(0, 5).join(", ")}`,
			{ details: { unknownIds }, suggestedCommand: "spine init --tasks-root taskplane-tasks" },
		);
	}

	return makeCheck(
		"dependencies-json",
		true,
		`dependencies.json valid (${taskIds.length} task(s))`,
		{ details: { path: path.relative(ctx.projectRoot, depsPath), taskIds } },
	);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkWorktreeSetupHook(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const config = configResult?.config;
	if (!config || configResult?.error) {
		return makeCheck("worktree-setup-hook", true, "worktree setup hook not configured");
	}

	const hookError = validateWorktreeSetupHookConfig(config, ctx.projectRoot);
	if (hookError) {
		return makeCheck("worktree-setup-hook", false, hookError.message, {
			suggestedCommand: hookError.suggestedCommand,
		});
	}

	if (!config.worktreeSetupHook) {
		return makeCheck("worktree-setup-hook", true, "worktree setup hook not configured");
	}

	return makeCheck("worktree-setup-hook", true, "worktree setup hook path valid");
}

/**
 * @param {object} ctx
 */
export function runPreflightPlanCheck(ctx) {
	const { projectRoot, configResult } = ctx;
	const config = configResult?.config;

	if (!config || configResult?.error) {
		const msg = configResult?.error?.message ?? 'spine-config.json not initialized';
		return {
			status: "error",
			message: `Cannot build plan: ${msg}`,
		};
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRootPath) {
		return {
			status: "error",
			message: "Cannot build plan: tasksRoot not configured",
		};
	}

	try {
		const plan = buildPlan({ scope: "all", config, tasksRoot: tasksRootPath });
		const waveCount = plan.waves?.length ?? 0;
		return {
			status: "ok",
			message: `${formatPlanHuman(plan).trimEnd()}`,
			details: { waves: waveCount },
		};
	} catch (err) {
		const msg = err?.message ?? String(err);
		return {
			status: "error",
			message: `Failed to build plan: ${msg}`,
		};
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
		const icon = check.ok ? "✅" : "❌";
		lines.push(`  ${icon} ${check.id}: ${check.message}`);
		if (!check.ok && check.suggestedCommand) {
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
