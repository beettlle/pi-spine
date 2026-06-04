#!/usr/bin/env node

/**
 * pi-spine CLI — project scaffolding, diagnostics, and batch utilities.
 */

const MIN_NODE_MAJOR = 22;
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < MIN_NODE_MAJOR) {
	console.error(
		`\x1b[31m❌ pi-spine requires Node.js >= ${MIN_NODE_MAJOR}.0.0 (found ${process.versions.node}).\x1b[0m\n` +
			`   Upgrade: https://nodejs.org/\n`,
	);
	process.exit(1);
}

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commandExists, getVersion } from "./get-version.mjs";
import { handleBatch, handleNext, handleRun } from "./spine-cli/batch.mjs";
import { handleGate } from "./spine-cli/gate.mjs";
import { handleIntegrate } from "./spine-cli/integrate.mjs";
import { handlePlan } from "./spine-cli/plan.mjs";
import {
	c,
	die,
	FAIL,
	getMinPiVersion,
	getPackageVersion,
	OK,
	PACKAGE_ROOT,
	WARN,
} from "./spine-cli/shared.mjs";
import { handleStatus } from "./spine-cli/status.mjs";
import { loadSpineConfig } from "./spine-config.mjs";
import { cmdInit, SPINE_GITIGNORE_ENTRIES } from "./spine-init.mjs";
import { cmdMigrateFromTaskplane } from "./spine-migrate-from-taskplane.mjs";
import {
	buildMaxParallelDoctorCheck,
	detectCpuCount,
} from "../src/doctor/suggest-max-parallel.mjs";
import { buildStalePathDoctorCheck } from "../src/doctor/stale-path.mjs";
import { buildCoexistenceDoctorCheck } from "../src/doctor/coexistence.mjs";
import { buildTaskPacketSizeDoctorCheck } from "../src/doctor/task-packet-size.mjs";
import { buildStallConfigDoctorCheck } from "../src/doctor/stall-config.mjs";
import {
	formatConfigSourceDetail,
	resolveTasksRootPath,
} from "../src/config/env-overrides.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_AGENT_FILES = ["worker.md", "reviewer.md", "supervisor.md"];

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
			runningSpinePath: __filename,
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
	}

	for (const agentFile of REQUIRED_AGENT_FILES) {
		const relPath = `.spine/agents/${agentFile}`;
		record(`${relPath} exists`, fs.existsSync(path.join(projectRoot, relPath)), {
			suggestedCommand: "spine init",
		});
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (tasksRootPath) {
		record(
			"tasks root exists",
			fs.existsSync(tasksRootPath),
			{
				detail: path.relative(projectRoot, tasksRootPath),
				suggestedCommand: `mkdir -p ${path.relative(projectRoot, tasksRootPath)}`,
			},
		);

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
	}

	return {
		ok: issueCount === 0,
		issueCount,
		checks,
	};
}

function cmdDoctor() {
	const projectRoot = process.cwd();
	const result = runDoctorChecks(projectRoot);

	console.log(`\n${c.bold}pi-spine Doctor${c.reset}\n`);

	for (const check of result.checks) {
		if (check.warning) {
			console.log(`  ${WARN} ${check.label} ${c.dim}(${check.detail})${c.reset}`);
			if (check.suggestedCommand) {
				console.log(`     ${c.dim}→ Run: ${check.suggestedCommand}${c.reset}`);
			}
			continue;
		}

		const info = check.detail ? ` ${c.dim}(${check.detail})${c.reset}` : "";
		console.log(`  ${check.ok ? OK : FAIL} ${check.label}${info}`);
		if (!check.ok && check.suggestedCommand) {
			console.log(`     ${c.dim}→ Run: ${c.cyan}${check.suggestedCommand}${c.reset}`);
		}
	}

	console.log();
	if (result.ok) {
		console.log(`${OK} ${c.green}All checks passed!${c.reset}\n`);
		return;
	}

	console.log(
		`${FAIL} ${result.issueCount} issue(s) found. Run ${c.cyan}spine init${c.reset} to fix config issues.\n`,
	);
	process.exit(1);
}

async function cmdPreflight(args) {
	const json = args.includes("--json");
	const { runBatchPreflight, formatPreflightHuman } = await import("./spine-preflight.mjs");
	const result = runBatchPreflight({ projectRoot: process.cwd() });

	if (json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(formatPreflightHuman(result));
	}

	if (!result.ok) process.exit(result.exitCode);
}

async function cmdJournal(args) {
	const { runSpineJournal } = await import("./spine-journal.mjs");
	const result = runSpineJournal({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdState(args) {
	const { runSpineState } = await import("./spine-state.mjs");
	const result = runSpineState({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdDashboard(args) {
	const { runSpineDashboard } = await import("./spine-dashboard.mjs");
	const result = await runSpineDashboard({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdReview(args) {
	const sub = args[0];
	if (sub !== "step") {
		die(`Unknown review subcommand: ${sub ?? "(none)"}\nRun ${c.cyan}spine review step --step N${c.reset} for usage.`);
	}
	const { runSpineReviewStep } = await import("./spine-review-step.mjs");
	const result = runSpineReviewStep({ projectRoot: process.cwd(), args: args.slice(1) });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdDeps(args) {
	const json = args.includes("--json");
	const scope = args.filter((a) => !a.startsWith("--")).join(" ") || "all";
	const { runSpineDeps } = await import("./spine-deps.mjs");
	const result = await runSpineDeps({ projectRoot: process.cwd(), scope, json });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdSettings(args) {
	const { runSpineSettings } = await import("./spine-settings.mjs");
	const result = runSpineSettings({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdRules(args) {
	const { runSpineRules } = await import("./spine-rules.mjs");
	const result = runSpineRules({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdReport(args) {
	const sub = args[0];
	if (sub !== "progress") {
		die(
			`Unknown report subcommand: ${sub ?? "(none)"}\nRun ${c.cyan}spine report progress --step N${c.reset} for usage.`,
		);
	}
	const { runSpineReportProgress } = await import("./spine-report-progress.mjs");
	const result = runSpineReportProgress({ projectRoot: process.cwd(), args: args.slice(1) });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

function cmdVersion() {
	const pkgVersion = getPackageVersion();
	const isProjectLocal = PACKAGE_ROOT.includes(".pi");
	const installType = isProjectLocal ? `project-local: ${PACKAGE_ROOT}` : `development: ${PACKAGE_ROOT}`;

	console.log(`\npi-spine ${c.bold}v${pkgVersion}${c.reset}`);
	console.log(`  Package:  ${installType}`);

	const projectRoot = process.cwd();
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		console.log(`  Config:   ${c.dim}not initialized (run spine init)${c.reset}`);
	} else {
		console.log(
			`  Config:   .spine/spine-config.json (${configResult.config.project.name})`,
		);
	}

	const piVersion = getVersion("pi");
	if (piVersion) console.log(`  Pi:       ${piVersion}`);
	console.log(`  Node:     v${process.versions.node}`);
	console.log();
}

function printHelp() {
	console.log(`
${c.bold}pi-spine${c.reset} — orchestration spine for long-running pi development

${c.bold}Usage:${c.reset}
  spine <command> [options]

${c.bold}Commands:${c.reset}
  ${c.cyan}init${c.reset}           Scaffold .spine/ config and agent stubs
  ${c.cyan}migrate-from-taskplane${c.reset}  Migrate .pi/taskplane-config.json to spine-config.json
  ${c.cyan}doctor${c.reset}         Validate installation and project configuration
  ${c.cyan}preflight${c.reset}      Run batch preflight checks (FR-BATCH-11)
  ${c.cyan}plan${c.reset}            Preview waves and lanes (FR-SCHED-05)
  ${c.cyan}deps${c.reset}            Show task dependency graph (FR-SCHED-01)
  ${c.cyan}settings${c.reset}        Show or set editable spine-config fields (FR-CFG-03)
  ${c.cyan}rules${c.reset}           Discover, select, and sync Cursor rules manifest
  ${c.cyan}status${c.reset}          Reconciled batch diagnosis and lane health (FR-BATCH-14)
 ${c.cyan}batch${c.reset}           Start, dismiss, or complete batch (Phase 2 start)
 ${c.cyan}run${c.reset}             Start batch (alias for batch start; PRD §15.2)
 ${c.cyan}review step${c.reset}    Spawn reviewer for a task step (FR-REV)
 ${c.cyan}report progress${c.reset}  Emit task.step_completed to batch journal (FR-WORK-09)
 ${c.cyan}gate${c.reset}            Inspect or resolve integrate gate (FR-GATE)
 ${c.cyan}integrate${c.reset}      Merge orch branch into base (FR-INT-01)
  ${c.cyan}journal${c.reset}         Replay orchestration journal timeline
  ${c.cyan}state${c.reset}           Validate batch-state cache schema
  ${c.cyan}next${c.reset}            Print or execute suggested next command (dry-run default)
 ${c.cyan}dashboard${c.reset}       Local SSE dashboard (default http://127.0.0.1:8109)
  ${c.cyan}version${c.reset}        Show version information
  ${c.cyan}help${c.reset}           Show this help message

${c.bold}Init options:${c.reset}
  --tasks-root PATH   Tasks root relative to project (default: spine-tasks)
  --preset NAME       Deprecated: taskplane-compat (migrants — prefer migrate-from-taskplane)
  --dry-run           Preview files without writing
  --force             Overwrite existing .spine/spine-config.json and agent stubs

${c.bold}Migrate options:${c.reset}
  --source PATH       Taskplane config path (default: .pi/taskplane-config.json)
  --dry-run           Print mapped spine-config.json without writing
  --force             Overwrite existing .spine/spine-config.json
  --json              Emit machine-readable result JSON

${c.bold}Examples:${c.reset}
  spine init                                    # greenfield: spine-tasks/ + defaults
  spine init --tasks-root taskplane-tasks       # existing Taskplane task folder
  spine init --preset taskplane-compat          # deprecated alias (defaults taskplane-tasks/)
  spine migrate-from-taskplane --dry-run --source .pi/taskplane-config.json
  spine init --dry-run                          # preview changes
  spine doctor                                  # check installation health
  spine preflight                               # verify batch readiness
  spine status --diagnose                       # reconciled batch diagnosis
  spine deps all                                # show dependency graph
  spine deps TP-031 --json                      # JSON graph for one task scope
  spine settings show                           # list editable config fields
  spine settings show lanes.maxParallel --json  # single setting as JSON
  spine settings set lanes.maxParallel 2        # update one registered field
  spine settings set dashboard.port 8110 --dry-run  # preview without writing
  spine rules discover                          # scan .cursor/rules → manifest
  spine rules select --task SP-093              # preview worker rule selection
  spine rules sync                              # refresh .spine/rules-manifest.json
  spine batch start TP-012                      # detached batch engine (default)
  spine batch start TP-012 --attached           # foreground batch engine
  spine run pending --dry-run                   # run unfinished tasks (alias for batch start)
  spine batch dismiss --reason limbo-recovery   # archive and clear stale batch
  spine batch complete --detect-manual-merge    # complete after manual git merge
  spine review step --step N [--type plan|code] # cross-model step review
  spine report progress --step N               # journal step progress (worker shell-out)
 spine gate [approve|reject|status]            # integrate gate FSM
 spine integrate [--dry-run] [--force-integrate]  # merge orch branch into main
  spine journal replay --batch 20260601T120000  # audit timeline for a batch
  spine state validate                          # validate active batch-state.json
  spine next                                    # suggested next command (dry-run)
  spine next --execute                          # run suggested spine command
  spine dashboard                               # local status dashboard (loopback only)
  spine dashboard --json                        # one-shot snapshot JSON
  spine version                                 # show package and environment info
`);
}

const isMainModule =
	process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
	const [command = "help", ...args] = process.argv.slice(2);

	const runCli = async () => {
		switch (command) {
			case "init":
				cmdInit(args);
				break;
			case "migrate-from-taskplane":
				cmdMigrateFromTaskplane(args);
				break;
			case "doctor":
				cmdDoctor();
				break;
			case "preflight":
				await cmdPreflight(args);
				break;
			case "plan":
				await handlePlan(args);
				break;
			case "deps":
				await cmdDeps(args);
				break;
			case "settings":
				await cmdSettings(args);
				break;
			case "rules":
				await cmdRules(args);
				break;
			case "status":
				await handleStatus(args);
				break;
			case "batch":
				await handleBatch(args);
				break;
			case "run":
				await handleRun(args);
				break;
			case "journal":
				await cmdJournal(args);
				break;
			case "state":
				await cmdState(args);
				break;
			case "next":
				await handleNext(args);
				break;
			case "review":
				await cmdReview(args);
				break;
			case "report":
				await cmdReport(args);
				break;
			case "gate":
				await handleGate(args);
				break;
			case "integrate":
				await handleIntegrate(args);
				break;
			case "dashboard":
				await cmdDashboard(args);
				break;
			case "version":
			case "--version":
			case "-v":
				cmdVersion();
				break;
			case "help":
			case "--help":
			case "-h":
				printHelp();
				break;
			default:
				die(`Unknown command: ${command}\nRun ${c.cyan}spine help${c.reset} for usage.`);
		}
	};

	runCli().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
