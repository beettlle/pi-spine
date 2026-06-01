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
import { getVersion } from "./get-version.mjs";
import { loadSpineConfig } from "./spine-config.mjs";
import { cmdInit, SPINE_GITIGNORE_ENTRIES } from "./spine-init.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
};

const OK = `${c.green}✅${c.reset}`;
const WARN = `${c.yellow}⚠️${c.reset}`;
const FAIL = `${c.red}❌${c.reset}`;

const REQUIRED_AGENT_FILES = ["worker.md", "reviewer.md", "supervisor.md"];

function die(msg) {
	console.error(`${FAIL} ${msg}`);
	process.exit(1);
}

function commandExists(cmd) {
	try {
		execFileSync("which", [cmd], { stdio: ["ignore", "pipe", "pipe"] });
		return true;
	} catch {
		return false;
	}
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
			timeout: 15000,
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
	if (configResult.config?.paths?.tasksRoot) {
		return path.join(projectRoot, configResult.config.paths.tasksRoot);
	}

	const envRoot = process.env.SPINE_TASKS_ROOT;
	if (envRoot) return path.resolve(projectRoot, envRoot);

	return null;
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
		record(".spine/spine-config.json valid", true, {
			detail: `project: ${configResult.config.project.name}, tasks: ${configResult.config.paths.tasksRoot}`,
		});
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

async function cmdStatus(args) {
	const json = args.includes("--json");
	const diagnose = args.includes("--diagnose");
	const verbose = args.includes("--verbose");
	const { runSpineStatus } = await import("./spine-status.mjs");
	const result = runSpineStatus({
		projectRoot: process.cwd(),
		json,
		diagnose,
		verbose,
	});
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdBatch(args) {
	const { runSpineBatch } = await import("./spine-batch.mjs");
	const result = runSpineBatch({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdNext(args) {
	const { runSpineNext } = await import("./spine-batch.mjs");
	const result = runSpineNext({ projectRoot: process.cwd(), args });
	process.stdout.write(result.output);
	if (result.exitCode !== 0) process.exit(result.exitCode);
}

async function cmdPlan(args) {
	const json = args.includes("--json");
	const scope = args.find((a) => !a.startsWith("--")) ?? "all";
	const { runSpinePlan } = await import("./spine-plan.mjs");
	const result = await runSpinePlan({ projectRoot: process.cwd(), scope, json });
	process.stdout.write(result.output);
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
  ${c.cyan}doctor${c.reset}         Validate installation and project configuration
  ${c.cyan}preflight${c.reset}      Run batch preflight checks (FR-BATCH-11)
  ${c.cyan}plan${c.reset}            Preview waves and lanes (FR-SCHED-05)
  ${c.cyan}status${c.reset}          Reconciled batch diagnosis and lane health (FR-BATCH-14)
  ${c.cyan}batch${c.reset}           Start, dismiss, or complete batch (Phase 2 start)
  ${c.cyan}next${c.reset}            Print or execute suggested next command (dry-run default)
  ${c.cyan}version${c.reset}        Show version information
  ${c.cyan}help${c.reset}           Show this help message

${c.bold}Init options:${c.reset}
  --tasks-root PATH   Tasks root relative to project (default: spine-tasks)
  --dry-run           Preview files without writing
  --force             Overwrite existing .spine/spine-config.json and agent stubs

${c.bold}Examples:${c.reset}
  spine init                                    # scaffold defaults
  spine init --tasks-root taskplane-tasks       # use existing task folder
  spine init --dry-run                          # preview changes
  spine doctor                                  # check installation health
  spine preflight                               # verify batch readiness
  spine status --diagnose                       # reconciled batch diagnosis
  spine batch start TP-012                      # single-task batch (Phase 2)
 spine batch dismiss --reason limbo-recovery   # archive and clear stale batch
  spine batch complete --detect-manual-merge    # complete after manual git merge
  spine next                                    # suggested next command (dry-run)
  spine next --execute                          # run suggested spine command
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
			case "doctor":
				cmdDoctor();
				break;
			case "preflight":
				await cmdPreflight(args);
				break;
			case "plan":
				await cmdPlan(args);
				break;
			case "status":
				await cmdStatus(args);
				break;
			case "batch":
				await cmdBatch(args);
				break;
			case "next":
				await cmdNext(args);
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
