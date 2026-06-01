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

function cmdDoctor() {
	const projectRoot = process.cwd();
	let issues = 0;

	console.log(`\n${c.bold}pi-spine Doctor${c.reset}\n`);

	const checks = [
		{
			label: "Node.js >= 22.0.0",
			check: () => nodeMajor >= MIN_NODE_MAJOR,
			detail: () => `v${process.versions.node}`,
		},
		{
			label: "git installed",
			check: () => commandExists("git"),
			detail: () => getVersion("git"),
		},
		{
			label: "git worktree support",
			check: () => gitSupportsWorktrees(),
			detail: () => getVersion("git"),
		},
		{
			label: "pi installed",
			check: () => commandExists("pi"),
			detail: () => getVersion("pi"),
		},
	];

	for (const { label, check, detail } of checks) {
		const ok = check();
		const info = ok && detail?.() ? ` ${c.dim}(${detail()})${c.reset}` : "";
		console.log(`  ${ok ? OK : FAIL} ${label}${info}`);
		if (!ok) issues++;
	}

	const piVersionText = getVersion("pi");
	const minPiVersion = getMinPiVersion();
	if (piVersionText && minPiVersion) {
		const current = parseSemver(piVersionText);
		const minimum = parseSemver(minPiVersion);
		const cmp = compareSemver(current, minimum);
		if (cmp === null) {
			console.log(`  ${WARN} could not parse pi version ${c.dim}(${piVersionText})${c.reset}`);
		} else if (cmp < 0) {
			console.log(
				`  ${WARN} pi ${piVersionText} is below supported minimum ${minPiVersion} ${c.dim}[PI_VERSION_UNSUPPORTED]${c.reset}`,
			);
			console.log(`     ${c.dim}→ Upgrade pi: https://pi.dev${c.reset}`);
		} else {
			console.log(`  ${OK} pi version supported ${c.dim}(>= ${minPiVersion})${c.reset}`);
		}
	}

	const pkgVersion = getPackageVersion();
	const isProjectLocal = PACKAGE_ROOT.includes(".pi");
	const installType = isProjectLocal ? "project-local" : "development";
	console.log(
		`  ${OK} pi-spine package ${c.dim}(v${pkgVersion}, ${installType})${c.reset}`,
	);

	console.log();
	if (isInsideGitRepo(projectRoot)) {
		console.log(`  ${OK} git repository detected`);
	} else {
		console.log(`  ${FAIL} not inside a git repository`);
		console.log(`     ${c.dim}→ Run: git init${c.reset}`);
		issues++;
	}

	const modelCheck = checkModelProvider();
	if (modelCheck.ok) {
		console.log(`  ${OK} model provider configured ${c.dim}(${modelCheck.detail})${c.reset}`);
	} else {
		console.log(`  ${FAIL} model provider not configured ${c.dim}(${modelCheck.detail})${c.reset}`);
		console.log(`     ${c.dim}→ Run: ${modelCheck.suggestedCommand}${c.reset}`);
		issues++;
	}

	console.log();
	const configResult = loadSpineConfig(projectRoot);
	if (configResult.error) {
		const codeHint = configResult.error.code ? ` [${configResult.error.code}]` : "";
		console.log(`  ${FAIL} .spine/spine-config.json${codeHint}`);
		console.log(`     ${c.dim}${configResult.error.message}${c.reset}`);
		if (configResult.error.suggestedCommand) {
			console.log(`     ${c.dim}→ Run: ${c.cyan}${configResult.error.suggestedCommand}${c.reset}`);
		}
		issues++;
	} else {
		console.log(`  ${OK} .spine/spine-config.json valid`);
		console.log(
			`     ${c.dim}project: ${configResult.config.project.name}, tasks: ${configResult.config.paths.tasksRoot}${c.reset}`,
		);
	}

	for (const agentFile of REQUIRED_AGENT_FILES) {
		const relPath = `.spine/agents/${agentFile}`;
		const fullPath = path.join(projectRoot, relPath);
		if (fs.existsSync(fullPath)) {
			console.log(`  ${OK} ${relPath} exists`);
		} else {
			console.log(`  ${FAIL} ${relPath} missing`);
			console.log(`     ${c.dim}→ Run: ${c.cyan}spine init${c.reset}`);
			issues++;
		}
	}

	const tasksRootPath = resolveTasksRoot(projectRoot, configResult);
	if (tasksRootPath) {
		console.log();
		if (fs.existsSync(tasksRootPath)) {
			console.log(`  ${OK} tasks root: ${path.relative(projectRoot, tasksRootPath) || "."}`);
		} else {
			console.log(`  ${FAIL} tasks root missing: ${path.relative(projectRoot, tasksRootPath)}`);
			console.log(`     ${c.dim}→ Run: mkdir -p ${path.relative(projectRoot, tasksRootPath)}${c.reset}`);
			issues++;
		}

		const contextPath = path.join(tasksRootPath, "CONTEXT.md");
		if (fs.existsSync(contextPath)) {
			console.log(`  ${OK} CONTEXT.md exists`);
		} else {
			console.log(`  ${WARN} CONTEXT.md missing ${c.dim}(optional)${c.reset}`);
		}
	}

	if (isInsideGitRepo(projectRoot)) {
		console.log();
		const gitignorePath = path.join(projectRoot, ".gitignore");
		if (!fs.existsSync(gitignorePath)) {
			console.log(`  ${WARN} .gitignore missing — spine runtime entries not protected`);
			console.log(`     ${c.dim}→ Run: ${c.cyan}spine init${c.dim} to add them${c.reset}`);
		} else {
			const content = fs.readFileSync(gitignorePath, "utf-8");
			const existingLines = new Set(content.split(/\r?\n/).map((line) => line.trim()));
			const missing = SPINE_GITIGNORE_ENTRIES.filter((entry) => !existingLines.has(entry));
			if (missing.length === 0) {
				console.log(`  ${OK} .gitignore has spine runtime entries`);
			} else {
				console.log(
					`  ${WARN} .gitignore missing ${missing.length} spine runtime entr${missing.length === 1 ? "y" : "ies"}`,
				);
				console.log(`     ${c.dim}→ Run: ${c.cyan}spine init${c.dim} to add them${c.reset}`);
			}
		}
	}

	console.log();
	if (issues === 0) {
		console.log(`${OK} ${c.green}All checks passed!${c.reset}\n`);
		return;
	}

	console.log(
		`${FAIL} ${issues} issue(s) found. Run ${c.cyan}spine init${c.reset} to fix config issues.\n`,
	);
	process.exit(1);
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
  spine version                                 # show package and environment info
`);
}

const [command = "help", ...args] = process.argv.slice(2);

switch (command) {
	case "init":
		cmdInit(args);
		break;
	case "doctor":
		cmdDoctor();
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
