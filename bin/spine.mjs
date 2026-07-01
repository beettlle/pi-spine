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
import { fileURLToPath } from "node:url";
import { getVersion } from "./get-version.mjs";
import { handleBatch, handleNext, handleRun } from "./spine-cli/batch.mjs";
import { handleGate } from "./spine-cli/gate.mjs";
import { handleIntegrate } from "./spine-cli/integrate.mjs";
import { handlePlan } from "./spine-cli/plan.mjs";
import {
	c,
	die,
	FAIL,
	getPackageVersion,
	isCliEntrypoint,
	OK,
	PACKAGE_ROOT,
	WARN,
} from "./spine-cli/shared.mjs";
import { handleStatus } from "./spine-cli/status.mjs";
import { handleLane } from "./spine-cli/lane-logs.mjs";
import { handleWatch } from "./spine-cli/watch.mjs";
import { handleWait } from "./spine-cli/wait.mjs";
import { handleScenarios } from "./spine-cli/scenarios.mjs";
import { loadSpineConfig } from "./spine-config.mjs";
import { cmdInit, SPINE_GITIGNORE_ENTRIES } from "./spine-init.mjs";
import { cmdMigrateFromTaskplane } from "./spine-migrate-from-taskplane.mjs";
import { runDoctorChecks, cmdDoctor } from "./spine-doctor.mjs";

export { runDoctorChecks } from "./spine-doctor.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
	const subcommand = args[0];
	if (subcommand === "follow") {
		const { runJournalFollow } = await import("../src/cli/journal-follow.mjs");
		const result = await runJournalFollow({ projectRoot: process.cwd(), args: args.slice(1) });
		process.stdout.write(result.output);
		if (result.exitCode !== 0) process.exit(result.exitCode);
		return;
	}

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

async function cmdVerify(args) {
	const { runSpineVerify } = await import("./spine-cli/verify.mjs");
	const result = runSpineVerify({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdReview(args) {
	const sub = args[0];
	if (sub !== "step") {
		die(`Unknown review subcommand: ${sub ?? "(none)"}\nRun ${c.cyan}spine review step --step N${c.reset} for usage.`);
	}
	const { runSpineReviewStep } = await import("./spine-review-step.mjs");
	const result = await runSpineReviewStep({ projectRoot: process.cwd(), args: args.slice(1) });
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

async function cmdTasks(args) {
	const { handleTasks } = await import("./spine-tasks.mjs");
	await handleTasks(args);
}

async function cmdHandoff(args) {
	const { runSpineHandoff } = await import("../src/cli/handoff.mjs");
	const result = runSpineHandoff({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdIssue(args) {
	const { runSpineIssue } = await import("./spine-issue.mjs");
	const result = runSpineIssue({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output ?? "");
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdMetrics(args) {
	const sub = args[0];
	if (sub !== "show") {
		die(`Unknown metrics subcommand: ${sub ?? "(none)"}\nRun ${c.cyan}spine metrics show${c.reset} for usage.`);
	}

	const projectRoot = process.cwd();
	const json = args.includes("--json");
	let batchId = null;
	let last = null;
	for (let i = 1; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--batch") batchId = args[++i] ?? null;
		else if (arg === "--last") last = Number(args[++i]);
	}

	const configResult = loadSpineConfig(projectRoot);
	const config = configResult.config ?? {};
	const {
		filterMetricsLines,
		formatMetricsTable,
		metricsFilePath,
		readMetricsLines,
	} = await import("../src/batch/metrics.mjs");
	const filePath = metricsFilePath(projectRoot, config);

	if (!fs.existsSync(filePath)) {
		if (json) {
			process.stdout.write(`${JSON.stringify({ lines: [] }, null, 2)}\n`);
			process.exit(1);
		}
		die(`Metrics file not found: ${path.relative(projectRoot, filePath)}\n`);
	}

	const lines = filterMetricsLines(readMetricsLines(filePath), {
		batchId: batchId ?? undefined,
		last: last ?? undefined,
	});

	if (json) {
		process.stdout.write(`${JSON.stringify({ lines }, null, 2)}\n`);
		return;
	}

	process.stdout.write(formatMetricsTable(lines));
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
  ${c.cyan}watch${c.reset}           Poll reconcile loop for live batch monitoring (#44)
  ${c.cyan}wait${c.reset}            Block until diagnosis reaches target set (#46)
 ${c.cyan}batch${c.reset}           Start, dismiss, or complete batch (Phase 2 start)
 ${c.cyan}run${c.reset}             Start batch (alias for batch start; PRD §15.2)
 ${c.cyan}handoff${c.reset}          Write operator handoff note (FR-UXB-05)
 ${c.cyan}issue draft${c.reset}     Build GitHub issue draft from project state (#60)
 ${c.cyan}metrics${c.reset}         Show run metrics JSONL (FR-UXB-06)
 ${c.cyan}review step${c.reset}    Spawn reviewer for a task step (FR-REV)
 ${c.cyan}report progress${c.reset}  Emit task.step_completed to batch journal (FR-WORK-09)
 ${c.cyan}gate${c.reset}            Inspect or resolve integrate gate (FR-GATE)
 ${c.cyan}integrate${c.reset}      Merge orch branch into base (FR-INT-01)
  ${c.cyan}verify${c.reset}          Phase exit verification checklists
  ${c.cyan}journal${c.reset}         Replay orchestration journal timeline
  ${c.cyan}state${c.reset}           Validate batch-state cache schema
  ${c.cyan}next${c.reset}            Print or execute suggested next command (dry-run default)
 ${c.cyan}dashboard${c.reset}       Local SSE dashboard (default http://127.0.0.1:8109)
  ${c.cyan}tasks${c.reset}           Validate task PROMPT packets (FR-UXB-02)
  ${c.cyan}scenarios${c.reset}       List, show, and materialize scenario fixtures
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
  spine watch                                   # compact live reconcile poll (5s default)
  spine watch --json --once                     # one NDJSON snapshot for scripts
  spine wait --until completed,failed --timeout 2h  # CI: block until terminal diagnosis
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
  spine handoff [--batch ID] [--json]          # operator handoff note
  spine issue draft [--type bug] [--json]      # GitHub issue draft from diagnose state
  spine metrics show [--batch ID] [--last N]   # read run-metrics.jsonl
  spine review step --step N [--type plan|code|final] # step or final review
  spine report progress --step N               # journal step progress (worker shell-out)
 spine gate [approve|reject|status]            # integrate gate FSM
 spine integrate [--dry-run] [--force-integrate]  # merge orch branch into main
  spine journal replay --batch 20260601T120000  # audit timeline for a batch
  spine state validate                          # validate active batch-state.json
  spine next                                    # suggested next command (dry-run)
  spine next --execute                          # run suggested spine command
  spine dashboard                               # local status dashboard (loopback only)
  spine dashboard --json                        # one-shot snapshot JSON
  spine tasks validate pending                  # validate pending task PROMPTs
  spine tasks validate all --json               # structured TasksValidateResult
  spine tasks analyze pending                   # structural checks (overlap, cycles, warnings)
  spine tasks analyze pending --json            # structured AnalyzeTasksResult
  spine help tasks                              # tasks subcommand usage
  spine scenarios list                          # list registered scenario fixtures
  spine scenarios show orphan-running-resume    # show one scenario entry
  spine scenarios materialize orphan-running-resume --target .  # write batch-state + journal
  spine version                                 # show package and environment info
`);
}

if (isCliEntrypoint(import.meta.url)) {
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
			case "tasks":
				await cmdTasks(args);
				break;
			case "scenarios":
				await handleScenarios(args);
				break;
			case "status":
				await handleStatus(args);
				break;
			case "watch":
				await handleWatch(args);
				break;
			case "wait":
				await handleWait(args);
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
			case "lane":
				await handleLane(args);
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
			case "handoff":
				await cmdHandoff(args);
				break;
			case "issue":
				await cmdIssue(args);
				break;
			case "metrics":
				await cmdMetrics(args);
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
			case "verify":
				await cmdVerify(args);
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
				if (args[0] === "tasks") {
					const { printTasksHelp } = await import("./spine-tasks.mjs");
					printTasksHelp();
				} else {
					printHelp();
				}
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
