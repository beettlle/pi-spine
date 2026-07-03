/**
 * Doctor check orchestration — library surface for preflight and CLI.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { commandExists } from "../util/command-exists.mjs";
import { loadSpineConfig } from "../config/spine-config-load.mjs";
import { PACKAGE_ROOT, SPINE_GITIGNORE_ENTRIES } from "../config/spine-init-constants.mjs";
import {
	buildMaxParallelDoctorCheck,
	detectCpuCount,
} from "./suggest-max-parallel.mjs";
import { buildStalePathDoctorCheck } from "./stale-path.mjs";
import { buildCoexistenceDoctorCheck } from "./coexistence.mjs";
import { buildTaskPacketSizeDoctorCheck } from "./task-packet-size.mjs";
import {
	buildPiWorkerTimeoutDoctorCheck,
	buildStallConfigDoctorCheck,
} from "./stall-config.mjs";
import { buildRulesManifestDoctorCheck } from "./rules-manifest.mjs";
import { buildWorktreeHealthDoctorCheck } from "./worktree-health.mjs";
import { buildStaleWorktreesDoctorCheck } from "./stale-worktrees.mjs";
import { buildWorkerBackendDoctorCheck } from "../config/worker-backend.mjs";
import { buildAgentModelInheritDoctorCheck, buildReviewerPerTypePinsDoctorCheck } from "./agent-model-inherit.mjs";
import { buildPiExtensionConflictDoctorCheck } from "./pi-extension-conflict.mjs";
import { CURSOR_RULES_ROOT_REL } from "../config/cursor-rules/discover.mjs";
import { RULES_PROFILE_REL_PATH } from "../config/cursor-rules/profile.mjs";
import {
	formatConfigSourceDetail,
	resolveTasksRootPath,
} from "../config/env-overrides.mjs";

const MIN_NODE_MAJOR = 22;
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);

const SPINE_CLI_ENTRY = path.join(PACKAGE_ROOT, "bin", "spine.mjs");

const REQUIRED_AGENT_FILES = ["worker.md", "reviewer.md", "supervisor.md"];

function getVersion(cmd, flag = "--version") {
	let result;
	try {
		result = spawnSync(cmd, [flag], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		return null;
	}

	if (!result || result.error || result.status !== 0) return null;

	const stdout = (result.stdout ?? "").toString().trim();
	const stderr = (result.stderr ?? "").toString().trim();
	if (stdout) return stdout;
	if (stderr) return stderr;
	return null;
}

function getPackageVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
		return pkg.version || "unknown";
	} catch {
		return "unknown";
	}
}

function getMinPiVersion() {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf-8"));
		return pkg.pi?.minPiVersion ?? null;
	} catch {
		return null;
	}
}

function parseSemver(versionText) {
	const match = String(versionText ?? "")
		.trim()
		.match(/(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

function compareSemver(a, b) {
	if (!a || !b) return null;
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	return a.patch - b.patch;
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

function gitSupportsWorktrees() {
	try {
		execFileSync("git", ["worktree", "--help"], {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

function parsePiListModelsOutput(output) {
	const lines = output.split(/\r?\n/).filter(Boolean);
	let providerCol = 0;
	let modelCol = 1;
	let headerSeen = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!headerSeen && /^provider\b/i.test(trimmed)) {
			headerSeen = true;
			const lowerHeader = trimmed.toLowerCase().split(/\s+/);
			const providerIdx = lowerHeader.indexOf("provider");
			const modelIdx = lowerHeader.indexOf("model");
			if (providerIdx >= 0) providerCol = providerIdx;
			if (modelIdx >= 0) modelCol = modelIdx;
			continue;
		}

		const parts = trimmed.split(/\s+/);
		const provider = String(parts[providerCol] ?? parts[0] ?? "").trim();
		const id = String(parts[modelCol] ?? parts[1] ?? "").trim();
		if (!provider || !id) continue;
		if (!/^[a-z0-9][a-z0-9._-]*$/i.test(provider)) continue;
		if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) continue;
		return { provider, id };
	}

	return null;
}

function checkModelProvider() {
	if (!commandExists("pi")) {
		return { ok: false, detail: "pi not installed", suggestedCommand: "https://pi.dev" };
	}

	try {
		const result = spawnSync("pi", ["--list-models"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		});
		if (result.error) throw result.error;
		const output = `${result.stdout ?? ""}
${result.stderr ?? ""}`.trim();
		const model = parsePiListModelsOutput(output);
		if (!model) {
			return {
				ok: false,
				detail: "no models available",
				suggestedCommand: "pi login",
			};
		}
		return {
			ok: true,
			detail: `${model.provider}/${model.id}`,
		};
	} catch (err) {
		return {
			ok: false,
			detail: err.message,
			suggestedCommand: "pi login",
		};
	}
}

function resolveTasksRoot(projectRoot, configResult) {
	if (!configResult.config) {
		return null;
	}
	return resolveTasksRootPath(projectRoot, configResult.config);
}

function isTestingCommandEmpty(command) {
	return !command || String(command).trim() === "";
}

/**
 * Warn when evidence gates expect commands that are missing (SP-112).
 *
 * @param {object} [config]
 * @returns {Array<{ label: string, ok: boolean, warning?: boolean, detail: string, suggestedCommand?: string }>}
 */
export function buildTestingEvidenceDoctorChecks(config = {}) {
	const gates = config.gates ?? {};
	const testing = config.testing ?? {};
	const checks = [];

	if (gates.collectBuildEvidence === true && isTestingCommandEmpty(testing.build)) {
		checks.push({
			label: "testing.build (evidence gate)",
			ok: true,
			warning: true,
			detail: "collectBuildEvidence enabled but testing.build is empty — integrate evidence will skip build proof",
			suggestedCommand: "spine settings set testing.build \"npm run typecheck\"",
		});
	}

	if (gates.collectTestEvidence !== false && isTestingCommandEmpty(testing.test)) {
		checks.push({
			label: "testing.test (evidence gate)",
			ok: true,
			warning: true,
			detail: "collectTestEvidence enabled but testing.test is empty — integrate evidence will skip test proof",
			suggestedCommand: "spine settings set testing.test \"npm test\"",
		});
	}

	return checks;
}

export function runDoctorChecks(projectRoot = process.cwd()) {
	const checks = [];
	let issueCount = 0;

	const record = (label, ok, extra = {}) => {
		checks.push({ label, ok, ...extra });
		if (!ok) issueCount++;
	};

	record("Node.js >= 22.0.0", nodeMajor >= MIN_NODE_MAJOR, {
		detail: `v${process.versions.node}`,
	});
	record("git installed", commandExists("git"), { detail: getVersion("git") });
	record("git worktree support", gitSupportsWorktrees(), { detail: getVersion("git") });
	record("pi installed", commandExists("pi"), { detail: getVersion("pi") });
	checks.push(buildPiExtensionConflictDoctorCheck({ projectRoot }));

	const piVersionText = getVersion("pi");
	const minPiVersion = getMinPiVersion();
	if (piVersionText && minPiVersion) {
		const current = parseSemver(piVersionText);
		const minimum = parseSemver(minPiVersion);
		const cmp = compareSemver(current, minimum);
		if (cmp === null) {
			checks.push({
				label: "pi version supported",
				ok: true,
				warning: true,
				detail: `could not parse pi version (${piVersionText})`,
			});
		} else if (cmp < 0) {
			checks.push({
				label: "pi version supported",
				ok: true,
				warning: true,
				detail: `${piVersionText} is below supported minimum ${minPiVersion}`,
			});
		} else {
			checks.push({
				label: "pi version supported",
				ok: true,
				detail: `>= ${minPiVersion}`,
			});
		}
	}

	const pkgVersion = getPackageVersion();
	const isProjectLocal = PACKAGE_ROOT.includes(".pi");
	const installType = isProjectLocal ? "project-local" : "development";
	checks.push({
		label: "pi-spine package",
		ok: true,
		detail: `v${pkgVersion}, ${installType}`,
	});

	checks.push(
		buildStalePathDoctorCheck({
			packageRoot: PACKAGE_ROOT,
			runningSpinePath: SPINE_CLI_ENTRY,
		}),
	);

	const coexistenceCheck = buildCoexistenceDoctorCheck({ projectRoot });
	checks.push(coexistenceCheck);
	if (!coexistenceCheck.ok) issueCount++;

	record("git repository detected", isInsideGitRepo(projectRoot));

	const modelCheck = checkModelProvider();
	record("model provider configured", modelCheck.ok, {
		detail: modelCheck.detail,
		suggestedCommand: modelCheck.suggestedCommand,
	});

	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		record(".spine/spine-config.json valid", false, {
			detail: configResult.error.message,
			code: configResult.error.code,
			suggestedCommand: configResult.error.suggestedCommand,
		});
	} else {
		const tasksRootDetail = formatConfigSourceDetail(
			configResult.sources,
			configResult.envVars,
			"paths.tasksRoot",
			configResult.config.paths?.tasksRoot,
		);
		const maxParallelDetail = formatConfigSourceDetail(
			configResult.sources,
			configResult.envVars,
			"lanes.maxParallel",
			configResult.config.lanes?.maxParallel,
		);
		record(".spine/spine-config.json valid", true, {
			detail: `project: ${configResult.config.project.name}`,
		});
		checks.push({
			label: "paths.tasksRoot (effective)",
			ok: true,
			detail: tasksRootDetail,
		});
		checks.push({
			label: "lanes.maxParallel (effective)",
			ok: true,
			detail: maxParallelDetail,
		});

		const configuredMaxParallel = configResult.config.lanes?.maxParallel ?? 3;
		checks.push(
			buildMaxParallelDoctorCheck({
				configured: configuredMaxParallel,
				cpuCount: detectCpuCount(),
			}),
		);
		checks.push(buildStallConfigDoctorCheck({ config: configResult.config }));
		checks.push(buildPiWorkerTimeoutDoctorCheck({ config: configResult.config }));
		checks.push(buildReviewerPerTypePinsDoctorCheck({ config: configResult.config }));
		checks.push(buildAgentModelInheritDoctorCheck({
			config: configResult.config,
			projectRoot,
		}));
		const worktreeHealthCheck = buildWorktreeHealthDoctorCheck({
			projectRoot,
			config: configResult.config,
		});
		checks.push(worktreeHealthCheck);
		if (!worktreeHealthCheck.ok) issueCount++;
		const workerBackendCheck = buildWorkerBackendDoctorCheck(configResult.config);
		checks.push(workerBackendCheck);
		if (!workerBackendCheck.ok) issueCount++;
		for (const testingCheck of buildTestingEvidenceDoctorChecks(configResult.config)) {
			checks.push(testingCheck);
		}
	}

	for (const agentFile of REQUIRED_AGENT_FILES) {
		const relPath = `.spine/agents/${agentFile}`;
		record(`${relPath} exists`, fs.existsSync(path.join(projectRoot, relPath)), {
			suggestedCommand: "spine init",
		});
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	const metricsPath = path.join(
		projectRoot,
		configResult.config?.metrics?.path ?? ".spine/run-metrics.jsonl",
	);
	if (fs.existsSync(metricsPath)) {
		try {
			const lines = fs
				.readFileSync(metricsPath, "utf-8")
				.trim()
				.split("\n")
				.filter(Boolean);
			checks.push({
				label: "run metrics available",
				ok: true,
				detail: `${lines.length} record(s) in ${path.relative(projectRoot, metricsPath)}`,
				suggestedCommand: "spine metrics show",
			});
		} catch {
			checks.push({
				label: "run metrics available",
				ok: true,
				warning: true,
				detail: `present but unreadable: ${path.relative(projectRoot, metricsPath)}`,
				suggestedCommand: "spine metrics show",
			});
		}
	}

	if (tasksRootPath) {
		record("tasks root exists", fs.existsSync(tasksRootPath), {
			detail: path.relative(projectRoot, tasksRootPath),
			suggestedCommand: `mkdir -p ${path.relative(projectRoot, tasksRootPath)}`,
		});

		const contextPath = path.join(tasksRootPath, "CONTEXT.md");
		checks.push({
			label: "CONTEXT.md exists",
			ok: true,
			warning: !fs.existsSync(contextPath),
			optional: true,
			detail: fs.existsSync(contextPath) ? "present" : "missing (optional)",
		});
		checks.push(buildTaskPacketSizeDoctorCheck({ tasksRoot: tasksRootPath }));
	}

	if (isInsideGitRepo(projectRoot)) {
		checks.push(buildStaleWorktreesDoctorCheck({ projectRoot }));

		const gitignorePath = path.join(projectRoot, ".gitignore");
		if (!fs.existsSync(gitignorePath)) {
			checks.push({
				label: ".gitignore has spine runtime entries",
				ok: true,
				warning: true,
				detail: ".gitignore missing",
				suggestedCommand: "spine init",
			});
		} else {
			const content = fs.readFileSync(gitignorePath, "utf-8");
			const existingLines = new Set(content.split(/\r?\n/).map((line) => line.trim()));
			const missing = SPINE_GITIGNORE_ENTRIES.filter((entry) => !existingLines.has(entry));
			checks.push({
				label: ".gitignore has spine runtime entries",
				ok: true,
				warning: missing.length > 0,
				detail:
					missing.length === 0
						? "complete"
						: `missing ${missing.length} entr${missing.length === 1 ? "y" : "ies"}`,
				suggestedCommand: missing.length > 0 ? "spine init" : undefined,
			});
		}

		const metricsRelPath = configResult.config?.metrics?.path ?? ".spine/run-metrics.jsonl";
		try {
			const tracked = execFileSync("git", ["ls-files", "--", metricsRelPath], {
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 5000,
			}).trim();
			if (tracked) {
				checks.push({
					label: "run-metrics.jsonl not git-tracked",
					ok: true,
					warning: true,
					detail: `${metricsRelPath} is tracked by git — runtime appends break preflight until untracked`,
					suggestedCommand: `git rm --cached -- ${metricsRelPath}`,
				});
			}
		} catch {
			// Git ls-files unavailable; skip tracked-metrics advisory.
		}
	}

	const rulesRootPath = path.join(projectRoot, CURSOR_RULES_ROOT_REL);
	const rulesProfilePath = path.join(projectRoot, RULES_PROFILE_REL_PATH);
	if (fs.existsSync(rulesRootPath) || fs.existsSync(rulesProfilePath)) {
		checks.push(buildRulesManifestDoctorCheck(projectRoot));
	}

	return {
		ok: issueCount === 0,
		issueCount,
		checks,
	};
}
