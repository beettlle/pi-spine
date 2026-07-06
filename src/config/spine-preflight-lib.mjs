// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { loadSpineConfig } from "./spine-config-load.mjs";
import { resolveTasksRootPath } from "./env-overrides.mjs";
import { runDoctorChecks } from "../doctor/run-doctor-checks.mjs";
import { buildStalePathDoctorCheck, isStalePathSpinePreflightBlocking } from "../doctor/stale-path.mjs";
import { PACKAGE_ROOT } from "./spine-init-constants.mjs";
import { runReconciliationCheck } from "../batch/reconcile.mjs";
import { buildPlan } from "../planner/index.mjs";
import { formatPlanHuman } from "../planner/format-plan.mjs";
import { buildCoexistencePreflightCheck, assessOrchestratorCoexistence } from "../doctor/coexistence.mjs";
import { validatePiSpineRootConfig } from "./pi-spine-root.mjs";
import { resolveSafeWorkerLaunchScript } from "./worker-launch-script.mjs";
import { validateWorktreeSetupHookConfig } from "./worktree-setup-hook.mjs";
import {
	isRulesManifestGeneratedAtOnlyDrift,
	RULES_MANIFEST_REL_PATH,
} from "./cursor-rules/discover.mjs";
import { discoverTasks } from "../tasks/packet/discover.mjs";
import { NO_PENDING_TASKS_ERROR } from "../planner/scope.mjs";
import { summarizePendingScope } from "../planner/pending.mjs";
import { validatePrompt, collectStaleFileScopeMustChangeWarnings } from "../tasks/packet/validate-prompt.mjs";
import { isRunMetricsAppendOnlyDrift } from "../batch/metrics.mjs";
import { METRICS_DEFAULTS, INTEGRATE_DEFAULTS } from "./defaults.mjs";
import { parseContract, parsePrompt } from "../tasks/packet/parse-prompt.mjs";
import { hasReleaseCriticalContract, isStubWorkerMode } from "../batch/contract-verify.mjs";

const HEALTHY_ACTIVE_PHASES = new Set(["planning", "running", "paused"]);
/** High-risk paths that together block lane→orch auto-resolution (issue #37). */
export const PRD_REL_PATH = "docs/PRD.md";
export const ORCH_MULTI_FILE_MERGE_RISK_PATHS = Object.freeze([
	PRD_REL_PATH,
	RULES_MANIFEST_REL_PATH,
]);
const LIMBO_DIAGNOSES = new Set(["limbo_stale", "completed_manual"]);
const DEPENDENCIES_SCHEMA_VERSION = 1;
const TASK_ID_PATTERN = /^[A-Z]{2,}-\d{3,}$/;
const PI_SESSION_METADATA_PREFIX = ".pi/";

/**
 * Pi session metadata under `.pi/` is not project source (issue #81).
 *
 * @param {string} relPath
 */
export function isPiSessionMetadataPath(relPath) {
	const normalized = String(relPath).replace(/\\/g, "/").replace(/^\.\/+/, "");
	return normalized === ".pi" || normalized.startsWith(PI_SESSION_METADATA_PREFIX);
}

/**
 * @param {string[]} dirtyPaths
 */
export function filterPiSessionDirtyPaths(dirtyPaths) {
	return dirtyPaths.filter((relPath) => !isPiSessionMetadataPath(relPath));
}

/**
 * List uncommitted paths in projectRoot, excluding pi session metadata (issue #81).
 *
 * @param {string} projectRoot
 * @returns {{ dirtyPaths: string[]; error: string | null }}
 */
export function listHumanDirtyPaths(projectRoot) {
	try {
		const output = execFileSync("git", ["status", "--porcelain"], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		});
		const allDirtyPaths = output
			.split(/\r?\n/)
			.filter(Boolean)
			.map((line) => line.slice(3).trim() || line.trim());
		return { dirtyPaths: filterPiSessionDirtyPaths(allDirtyPaths), error: null };
	} catch (err) {
		return {
			dirtyPaths: [],
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

/**
 * Resolve current git branch in projectRoot.
 *
 * @param {string} projectRoot
 * @returns {{ branch: string | null; error: string | null }}
 */
export function resolveCurrentGitBranch(projectRoot) {
	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 5000,
		}).trim();
		return { branch: branch || null, error: null };
	} catch (err) {
		return {
			branch: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

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

	const allDirtyPaths = output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => line.slice(3).trim() || line.trim());
	const dirtyPaths = filterPiSessionDirtyPaths(allDirtyPaths);

	if (dirtyPaths.length === 0) {
		if (allDirtyPaths.length > 0) {
			return makeCheck("git-clean", true, "working tree clean (.pi/ session metadata ignored)");
		}
		return makeCheck("git-clean", true, "working tree clean");
	}

	const manifestDrift = isRulesManifestGeneratedAtOnlyDrift(ctx.projectRoot, dirtyPaths);
	if (manifestDrift.ok) {
		return makeCheck(
			"git-clean",
			true,
			`working tree clean (${RULES_MANIFEST_REL_PATH} generatedAt-only drift ignored)`,
			{
				details: {
					manifestGeneratedAtDrift: true,
					manifestPath: manifestDrift.manifestPath,
				},
			},
		);
	}

	const configResult = loadSpineConfig(ctx.projectRoot);
	const metricsRelPath = configResult?.config?.metrics?.path ?? METRICS_DEFAULTS.path;
	const metricsDrift = isRunMetricsAppendOnlyDrift(ctx.projectRoot, dirtyPaths, metricsRelPath);
	if (metricsDrift.ok) {
		return makeCheck(
			"git-clean",
			true,
			`working tree clean (${metricsRelPath} append-only drift ignored)`,
			{
				details: {
					metricsAppendOnlyDrift: true,
					metricsPath: metricsDrift.metricsPath,
				},
			},
		);
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
 * Read multiple UTF-8 text files concurrently in a child process (sync parent API).
 *
 * @param {string[]} filePaths
 * @returns {Map<string, string>}
 */
function readUtf8FilesBatchSync(filePaths) {
	const uniquePaths = [...new Set(filePaths)];
	if (uniquePaths.length === 0) {
		return new Map();
	}

	const child = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`const paths = JSON.parse(process.argv[1]);
const fs = await import("node:fs/promises");
const entries = await Promise.all(
	paths.map(async (filePath) => [filePath, await fs.readFile(filePath, "utf-8")]),
);
process.stdout.write(JSON.stringify(entries));`,
			JSON.stringify(uniquePaths),
		],
		{
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		},
	);

	if (child.error) {
		throw child.error;
	}
	if (child.status !== 0) {
		throw new Error(child.stderr?.trim() || `batch read failed with status ${child.status}`);
	}

	/** @type {[string, string][]} */
	const entries = JSON.parse(child.stdout);
	return new Map(entries);
}

/**
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkTasksValidate(ctx) {
	const { projectRoot, configResult } = ctx;
	const config = configResult?.config;

	if (!config || configResult?.error) {
		return makeCheck("tasks-validate", false, "cannot validate tasks without spine config", {
			suggestedCommand: "spine init",
		});
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (!tasksRootPath) {
		return makeCheck("tasks-validate", false, "tasks root not configured", {
			suggestedCommand: "spine init",
		});
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
		if (pendingIds.length === 0) {
			return makeCheck(
				"tasks-validate",
				true,
				"no pending tasks (all discovered tasks have .DONE)",
			);
		}

		const selectedTaskIds = new Set(pendingIds);
		/** @type {string[]} */
		const failures = [];
		/** @type {Array<{ discoveredTask: (typeof discovered)[number], promptPath: string }>} */
		const pendingPrompts = [];

		for (const discoveredTask of discovered) {
			if (!selectedTaskIds.has(discoveredTask.taskId)) continue;
			pendingPrompts.push({
				discoveredTask,
				promptPath: path.join(discoveredTask.folderPath, "PROMPT.md"),
			});
		}

		const promptContents = readUtf8FilesBatchSync(
			pendingPrompts.map((entry) => entry.promptPath),
		);

		for (const { discoveredTask, promptPath } of pendingPrompts) {
			const promptMarkdown = promptContents.get(promptPath);
			const validation = validatePrompt(promptMarkdown, {
				taskId: discoveredTask.taskId,
				contract: config.contract,
			});
			if (!validation.ok) {
				failures.push(
					`${discoveredTask.taskId}: ${validation.errors[0] ?? "invalid PROMPT packet"}`,
				);
			}
		}

		if (failures.length === 0) {
			return makeCheck("tasks-validate", true, "pending task PROMPT packets valid");
		}

		return makeCheck("tasks-validate", false, failures[0], {
			suggestedCommand: "spine tasks validate pending",
			details: { failures },
		});
	} catch (err) {
		const message = err?.message ?? String(err);
		if (message === NO_PENDING_TASKS_ERROR) {
			return makeCheck(
				"tasks-validate",
				true,
				"no pending tasks (all discovered tasks have .DONE)",
			);
		}
		return makeCheck("tasks-validate", false, `tasks validate failed: ${message}`, {
			suggestedCommand: "spine tasks validate pending",
		});
	}
}

/**
 * Warn when stub workers are about to run tasks with release-critical `fileScopeMustChange` contracts.
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
 * @param {{ title?: string | null, missionText?: string, folderName?: string }} task
 */
export function isMergeOriginMainTask(task) {
	const haystack = `${task.title ?? ""}\n${task.missionText ?? ""}\n${task.folderName ?? ""}`.toLowerCase();
	if (/merge[-_\s]+origin[-_\s]+main/.test(haystack)) {
		return true;
	}
	return haystack.includes("origin/main") && /\bmerge\b/.test(haystack);
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 */
function gitRefExists(projectRoot, ref) {
	try {
		execFileSync("git", ["rev-parse", "--verify", ref], {
			cwd: projectRoot,
			stdio: ["ignore", "ignore", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 */
function resolveOriginMainRef(projectRoot) {
	for (const ref of ["origin/main", "refs/remotes/origin/main"]) {
		if (gitRefExists(projectRoot, ref)) {
			return ref;
		}
	}
	return null;
}

/**
 * @param {string} projectRoot
 * @param {string} ref
 * @param {string} filePath
 */
function pathExistsAtRef(projectRoot, ref, filePath) {
	try {
		execFileSync("git", ["cat-file", "-e", `${ref}:${filePath}`], {
			cwd: projectRoot,
			stdio: "ignore",
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} refA
 * @param {string} refB
 * @param {string} filePath
 */
function refsDifferOnPath(projectRoot, refA, refB, filePath) {
	const aExists = pathExistsAtRef(projectRoot, refA, filePath);
	const bExists = pathExistsAtRef(projectRoot, refB, filePath);
	if (!aExists && !bExists) {
		return false;
	}
	if (aExists !== bExists) {
		return true;
	}
	try {
		execFileSync("git", ["diff", "--quiet", refA, refB, "--", filePath], {
			cwd: projectRoot,
			stdio: "ignore",
			timeout: 5000,
		});
		return false;
	} catch {
		return true;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} headRef
 * @param {string} originMainRef
 */
export function listDivergentOrchMergeRiskPaths(projectRoot, headRef, originMainRef) {
	return ORCH_MULTI_FILE_MERGE_RISK_PATHS.filter((filePath) =>
		refsDifferOnPath(projectRoot, headRef, originMainRef, filePath),
	);
}

/**
 * Predict multi-file lane→orch merge conflicts when a pending task merges origin/main.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function predictOrchMergeConflictRisk(ctx) {
	const { projectRoot, configResult } = ctx;
	const loaded = configResult ?? loadSpineConfig(projectRoot);
	const tasksRootPath = resolveTasksRoot(projectRoot, loaded);
	if (!tasksRootPath) {
		return { risky: false, reason: "no_tasks_root" };
	}

	const originMainRef = resolveOriginMainRef(projectRoot);
	if (!originMainRef) {
		return { risky: false, reason: "no_origin_main" };
	}

	const headRef = "HEAD";
	if (!gitRefExists(projectRoot, headRef)) {
		return { risky: false, reason: "no_head" };
	}

	const divergentPaths = listDivergentOrchMergeRiskPaths(projectRoot, headRef, originMainRef);
	const hasPrdDivergence = divergentPaths.includes(PRD_REL_PATH);
	const hasManifestDivergence = divergentPaths.includes(RULES_MANIFEST_REL_PATH);
	if (!hasPrdDivergence || !hasManifestDivergence) {
		return {
			risky: false,
			reason: "paths_not_divergent",
			divergentPaths,
			originMainRef,
			headRef,
		};
	}

	try {
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
		/** @type {string[]} */
		const mergeOriginTaskIds = [];

		for (const discoveredTask of discovered) {
			if (!pendingIds.includes(discoveredTask.taskId)) continue;
			const promptMarkdown = fs.readFileSync(
				path.join(discoveredTask.folderPath, "PROMPT.md"),
				"utf-8",
			);
			const parsed = parsePrompt(promptMarkdown);
			if (
				isMergeOriginMainTask({
					title: parsed.title,
					missionText: parsed.sections.Mission ?? "",
					folderName: path.basename(discoveredTask.folderPath),
				})
			) {
				mergeOriginTaskIds.push(discoveredTask.taskId);
			}
		}

		if (mergeOriginTaskIds.length === 0) {
			return {
				risky: false,
				reason: "no_merge_origin_main_task",
				divergentPaths,
				originMainRef,
				headRef,
			};
		}

		return {
			risky: true,
			mergeOriginTaskIds,
			divergentPaths,
			originMainRef,
			headRef,
		};
	} catch (err) {
		return {
			risky: false,
			reason: "error",
			message: err?.message ?? String(err),
		};
	}
}

/**
 * Warn when pending merge-origin-main tasks predict PRD + rules-manifest orch merge conflicts.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkOrchMergeConflictWarn(ctx) {
	const risk = predictOrchMergeConflictRisk(ctx);
	if (!risk.risky) {
		const skipMessage =
			risk.reason === "no_merge_origin_main_task"
				? "no pending merge-origin-main tasks"
				: risk.reason === "no_origin_main"
					? "orch merge conflict check skipped (origin/main unavailable)"
					: "no predictable multi-file orch merge conflicts";
		return makeCheck("orch-merge-conflict", true, skipMessage);
	}

	const taskPreview = risk.mergeOriginTaskIds.slice(0, 5).join(", ");
	const pathList = risk.divergentPaths.join(", ");
	return makeCheck(
		"orch-merge-conflict",
		true,
		`pending merge-origin-main task(s) (${taskPreview}) with ${pathList} divergent between HEAD and ${risk.originMainRef} — wave merge may fail on multi-file conflicts`,
		{
			warning: true,
			details: risk,
			suggestedCommand:
				"merge origin/main into main before batch or resolve docs/PRD.md + rules-manifest drift manually",
		},
	);
}

function formatOrchMergeConflictPlanWarning(risk) {
	const taskPreview = risk.mergeOriginTaskIds.slice(0, 5).join(", ");
	const pathList = risk.divergentPaths.join(", ");
	return [
		"⚠️ Orch merge risk: pending merge-origin-main task(s)",
		`(${taskPreview}) with ${pathList} divergent between HEAD and ${risk.originMainRef}.`,
		"Wave merge may fail when automatic resolution cannot handle PRD + manifest together.",
	].join(" ");
}

/**
 * List pending tasks whose fileScopeMustChange paths already changed on main since PROMPT intro.
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function listPrelandedFileScopeStaleTasks(ctx) {
	const configResult = ctx.configResult ?? loadSpineConfig(ctx.projectRoot);
	const tasksRootPath = resolveTasksRoot(ctx.projectRoot, configResult);
	if (!tasksRootPath) {
		return [];
	}

	const discovered = discoverTasks(tasksRootPath);
	const { pendingIds } = summarizePendingScope(discovered, tasksRootPath);
	/** @type {Array<{ taskId: string, warnings: string[] }>} */
	const staleTasks = [];
	/** @type {Array<{ discoveredTask: (typeof discovered)[number], promptPath: string }>} */
	const pendingPrompts = [];

	for (const discoveredTask of discovered) {
		if (!pendingIds.includes(discoveredTask.taskId)) continue;
		pendingPrompts.push({
			discoveredTask,
			promptPath: path.join(discoveredTask.folderPath, "PROMPT.md"),
		});
	}

	const promptContents = readUtf8FilesBatchSync(
		pendingPrompts.map((entry) => entry.promptPath),
	);

	for (const { discoveredTask, promptPath } of pendingPrompts) {
		const promptMarkdown = promptContents.get(promptPath);
		const parsedContract = parseContract(promptMarkdown);
		const promptRelPath = path.relative(ctx.projectRoot, promptPath);
		const warnings = collectStaleFileScopeMustChangeWarnings(
			ctx.projectRoot,
			parsedContract,
			promptRelPath,
		);
		if (warnings.length > 0) {
			staleTasks.push({ taskId: discoveredTask.taskId, warnings });
		}
	}

	return staleTasks;
}

/**
 * Warn when pending tasks have fileScopeMustChange paths already changed on main (issue #56).
 *
 * @param {object} ctx
 * @param {string} ctx.projectRoot
 * @param {ReturnType<typeof loadSpineConfig>} [ctx.configResult]
 */
export function checkPrelandedFileScopeWarn(ctx) {
	try {
		const staleTasks = listPrelandedFileScopeStaleTasks(ctx);
		if (staleTasks.length === 0) {
			return makeCheck(
				"prelanded-file-scope",
				true,
				"no pending tasks with stale fileScopeMustChange vs main",
			);
		}

		const preview = staleTasks.map((entry) => entry.taskId).slice(0, 5).join(", ");
		const suffix = staleTasks.length > 5 ? ` (+${staleTasks.length - 5} more)` : "";
		return makeCheck(
			"prelanded-file-scope",
			true,
			`${staleTasks.length} pending task(s) with fileScopeMustChange already changed on main (${preview}${suffix})`,
			{
				warning: true,
				details: { staleTasks },
				suggestedCommand:
					"spine tasks validate pending --warnings-only; amend PROMPT ## Contract before batch start",
			},
		);
	} catch (err) {
		const message = err?.message ?? String(err);
		return makeCheck(
			"prelanded-file-scope",
			true,
			`prelanded file-scope check skipped: ${message}`,
		);
	}
}

function formatPrelandedFileScopePlanWarning(staleTasks) {
	const preview = staleTasks.map((entry) => entry.taskId).slice(0, 5).join(", ");
	return [
		"⚠️ Pre-landed contract risk: pending task(s)",
		`(${preview}) have fileScopeMustChange paths already changed on main.`,
		"Amend PROMPT ## Contract before batch start or expect contract rework loops.",
	].join(" ");
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
		const discovered = discoverTasks(tasksRootPath);
		const { pendingIds, excludedCount } = summarizePendingScope(discovered, tasksRootPath);
		const orchMergeRisk = predictOrchMergeConflictRisk(ctx);
		const prelandedFileScopeTasks = listPrelandedFileScopeStaleTasks(ctx);
		if (pendingIds.length === 0) {
			const maxParallel = config.lanes?.maxParallel ?? 1;
			const lines = [
				"Spine plan — pending",
				`0 task(s) · 0 wave(s) · maxParallel ${maxParallel}`,
				`${excludedCount} excluded (.DONE on disk)`,
			];
			if (orchMergeRisk.risky) {
				lines.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
			}
			if (prelandedFileScopeTasks.length > 0) {
				lines.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
			}
			return {
				status: "ok",
				message: lines.join("\n"),
				details: {
					waves: 0,
					pendingCount: 0,
					excludedCount,
					orchMergeConflictRisk: orchMergeRisk,
					prelandedFileScopeTasks,
				},
			};
		}

		const plan = buildPlan({ scope: "pending", config, tasksRoot: tasksRootPath });
		const waveCount = plan.waves?.length ?? 0;
		const planText = formatPlanHuman(plan).trimEnd();
		const planWarnings = [];
		if (orchMergeRisk.risky) {
			planWarnings.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
		}
		if (prelandedFileScopeTasks.length > 0) {
			planWarnings.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
		}
		return {
			status: "ok",
			message:
				planWarnings.length > 0
					? `${planText}\n\n${planWarnings.join("\n\n")}`
					: planText,
			details: { waves: waveCount, orchMergeConflictRisk: orchMergeRisk, prelandedFileScopeTasks },
		};
	} catch (err) {
		const msg = err?.message ?? String(err);
		if (msg === NO_PENDING_TASKS_ERROR) {
			const maxParallel = config.lanes?.maxParallel ?? 1;
			const orchMergeRisk = predictOrchMergeConflictRisk(ctx);
			const prelandedFileScopeTasks = listPrelandedFileScopeStaleTasks(ctx);
			const lines = [
				"Spine plan — pending",
				`0 task(s) · 0 wave(s) · maxParallel ${maxParallel}`,
				"All discovered tasks have .DONE on disk",
			];
			if (orchMergeRisk.risky) {
				lines.push(formatOrchMergeConflictPlanWarning(orchMergeRisk));
			}
			if (prelandedFileScopeTasks.length > 0) {
				lines.push(formatPrelandedFileScopePlanWarning(prelandedFileScopeTasks));
			}
			return {
				status: "ok",
				message: lines.join("\n"),
				details: {
					waves: 0,
					pendingCount: 0,
					orchMergeConflictRisk: orchMergeRisk,
					prelandedFileScopeTasks,
				},
			};
		}
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
