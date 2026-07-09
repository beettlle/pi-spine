// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadSpineConfig } from "../spine-config-load.mjs";
import { runReconciliationCheck } from "../../batch/reconcile.mjs";
import {
	isRulesManifestGeneratedAtOnlyDrift,
	RULES_MANIFEST_REL_PATH,
} from "../cursor-rules/discover.mjs";
import { isRunMetricsAppendOnlyDrift } from "../../batch/metrics.mjs";
import { METRICS_DEFAULTS } from "../defaults.mjs";

const HEALTHY_ACTIVE_PHASES = new Set(["planning", "running", "paused"]);
const LIMBO_DIAGNOSES = new Set(["limbo_stale", "completed_manual"]);
const PI_SESSION_METADATA_PREFIX = ".pi/";
const PI_SMART_ROUTER_PREFIX = ".pi-smart-router/";

function makeCheck(id, ok, message, extra = {}) {
	return { id, ok, message, ...extra };
}

/**
 * Pi session metadata under `.pi/` and ephemeral `.pi-smart-router/` WAL dirs
 * are not project source (issues #81, v1.10.1 preflight git-clean).
 *
 * @param {string} relPath
 */
export function isPiSessionMetadataPath(relPath) {
	const normalized = String(relPath).replace(/\\/g, "/").replace(/^\.\/+/, "");
	return (
		normalized === ".pi" ||
		normalized.startsWith(PI_SESSION_METADATA_PREFIX) ||
		normalized === ".pi-smart-router" ||
		normalized.startsWith(PI_SMART_ROUTER_PREFIX)
	);
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
			return makeCheck(
				"git-clean",
				true,
				"working tree clean (pi session metadata ignored)",
			);
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
