#!/usr/bin/env node
/**
 * Best-of-N for pi + Cursor backend: same prompt, multiple models, isolated worktrees.
 *
 * Models are resolved with `pi --list-models` (same catalog as pi /model cycling).
 *
 * Usage:
 *   node scripts/best-of-n.mjs --list-models [search]
 *   node scripts/best-of-n.mjs sonnet,composer-2.5,codex-5.3 "Fix the flaky logout test"
 *   node scripts/best-of-n.mjs -m sonnet -m composer-2.5 @spine-tasks/SP-001/PROMPT.md
 *   node scripts/best-of-n.mjs --dry-run sonnet,composer-2.5 "prompt"
 *
 * Options:
 *   -m, --models <pattern>   Model pattern (repeatable; also accepts comma-separated)
 *   --list-models [search]   Print pi model catalog (delegates to pi --list-models)
 *   --base-branch <ref>      Base ref for worktrees (default: current HEAD)
 *   --thinking <level>       Pass through to pi --thinking (default: off)
 *   --keep                   Do not remove worktrees on exit (default: keep)
 *   --cleanup                Remove worktrees after runs finish
 *   --cleanup-run <runId>    Remove worktrees from a previous bon-<runId> run
 *   --dry-run                Provision worktrees and print pi argv; do not run pi
 *   -h, --help               Show help
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HELP = `Best-of-N — parallel pi runs across models in git worktrees

Usage:
  node scripts/best-of-n.mjs --list-models [search]
  node scripts/best-of-n.mjs <models> <prompt...>
  node scripts/best-of-n.mjs -m <model> [-m <model>...] <prompt...>

Models:
  Patterns match \`pi --list-models\` (same list as /model in pi). Examples:
    sonnet, composer-2.5, codex-5.3, cursor/auto, claude-opus-4-6@200k:fast

  Comma-separated in one arg:  sonnet,composer-2.5,codex-5.3
  Repeatable flag:             -m sonnet -m composer-2.5

Prompt:
  Remaining arguments are passed to \`pi -p\` unchanged (@files supported).

Worktrees:
  Created under .worktrees/bon-<runId>/<model-slug>/ on branch bon/<runId>/<slug>.
  Runs .cursor/worktrees.json setup when present (ROOT_WORKTREE_PATH = project root).

Examples:
  node scripts/best-of-n.mjs sonnet,composer-2.5 "Fix the flaky logout test"
  node scripts/best-of-n.mjs --list-models composer
  node scripts/best-of-n.mjs --dry-run sonnet,codex-5.3 @task/PROMPT.md
`;

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
	/** @type {{ models: string[], prompt: string[], listModelsSearch: string|null, baseBranch: string|null, thinking: string, keep: boolean, cleanup: boolean, cleanupRunId: string|null, dryRun: boolean, help: boolean }} */
	const opts = {
		models: [],
		prompt: [],
		listModelsSearch: null,
		baseBranch: null,
		thinking: "off",
		keep: true,
		cleanup: false,
		cleanupRunId: null,
		dryRun: false,
		help: false,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "-h":
			case "--help":
				opts.help = true;
				break;
			case "-m":
			case "--models": {
				const value = argv[++i];
				if (!value) throw new Error("Missing value for --models");
				opts.models.push(...splitModelPatterns(value));
				break;
			}
			case "--list-models":
				opts.listModelsSearch = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : "";
				break;
			case "--base-branch":
				opts.baseBranch = argv[++i] ?? null;
				if (!opts.baseBranch) throw new Error("Missing value for --base-branch");
				break;
			case "--thinking":
				opts.thinking = argv[++i] ?? "off";
				break;
			case "--keep":
				opts.keep = true;
				opts.cleanup = false;
				break;
			case "--cleanup":
				opts.cleanup = true;
				opts.keep = false;
				break;
			case "--cleanup-run":
				opts.cleanupRunId = argv[++i] ?? null;
				if (!opts.cleanupRunId) throw new Error("Missing value for --cleanup-run");
				break;
			case "--dry-run":
				opts.dryRun = true;
				break;
			default:
				if (arg.startsWith("-")) {
					throw new Error(`Unknown option: ${arg}`);
				}
				if (opts.models.length === 0 && arg.includes(",")) {
					opts.models.push(...splitModelPatterns(arg));
				} else if (opts.models.length === 0) {
					opts.models.push(arg);
				} else {
					opts.prompt.push(arg);
				}
				break;
		}
	}

	return opts;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function splitModelPatterns(raw) {
	return raw
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * @param {string} projectRoot
 * @param {string} [search]
 */
function runPiListModels(projectRoot, search = "") {
	const result = spawnSync("pi", ["--list-models", search], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.error) {
		throw new Error(`Failed to run pi --list-models: ${result.error.message}`);
	}
	if (result.status !== 0) {
		const stderr = (result.stderr ?? "").trim();
		throw new Error(stderr || `pi --list-models exited with code ${result.status}`);
	}
	process.stdout.write(result.stdout ?? "");
}

/**
 * @param {string} output
 * @returns {{ provider: string, model: string }[]}
 */
function parseModelsTable(output) {
	const lines = output.split(/\r?\n/).filter(Boolean);
	const rows = [];
	for (const line of lines) {
		if (line.startsWith("provider")) continue;
		const parts = line.trim().split(/\s+/);
		if (parts.length < 2) continue;
		rows.push({ provider: parts[0], model: parts[1] });
	}
	return rows;
}

/**
 * Resolve a user pattern to exactly one pi model id (provider/model for --model).
 *
 * @param {string} projectRoot
 * @param {string} pattern
 */
function resolveModelPattern(projectRoot, pattern) {
	const trimmed = pattern.trim();
	if (!trimmed) throw new Error("Empty model pattern");

	if (trimmed.includes("/")) {
		return trimmed;
	}

	const result = spawnSync("pi", ["--list-models", trimmed], {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const stderr = (result.stderr ?? "").trim();
		throw new Error(stderr || `pi --list-models failed for pattern "${trimmed}"`);
	}

	const matches = parseModelsTable(result.stdout ?? "");
	if (matches.length === 0) {
		throw new Error(
			`No models match "${trimmed}". Run: node scripts/best-of-n.mjs --list-models ${trimmed}`,
		);
	}

	const normalized = trimmed.replace(/^cursor\//, "");
	const exact = matches.filter((m) => m.model === normalized);
	if (exact.length === 1) {
		return `${exact[0].provider}/${exact[0].model}`;
	}

	if (matches.length > 1) {
		const names = matches.map((m) => `${m.provider}/${m.model}`).join(", ");
		throw new Error(
			`Ambiguous model pattern "${trimmed}" (${matches.length} matches): ${names}\n` +
				"Pick a more specific id (e.g. composer-2.5, sonnet-4.6@200k:fast).",
		);
	}

	const { provider, model } = matches[0];
	return `${provider}/${model}`;
}

/**
 * @param {string} modelId
 */
function modelSlug(modelId) {
	return modelId.replace(/^[^/]+\//, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * @param {string} projectRoot
 * @param {string[]} args
 */
function git(projectRoot, args) {
	const result = spawnSync("git", args, {
		cwd: projectRoot,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		const stderr = (result.stderr ?? "").trim();
		const stdout = (result.stdout ?? "").trim();
		throw new Error(
			`git ${args.join(" ")} failed: ${stderr || stdout || `exit ${result.status}`}`,
		);
	}
	return (result.stdout ?? "").trim();
}

/**
 * @param {string} projectRoot
 */
function resolveBaseBranch(projectRoot, override) {
	if (override) {
		git(projectRoot, ["rev-parse", "--verify", override]);
		return override;
	}
	return git(projectRoot, ["rev-parse", "HEAD"]);
}

/**
 * @param {string} projectRoot
 * @returns {string[]|string|null}
 */
function loadWorktreeSetupSpec(projectRoot) {
	const configPath = path.join(projectRoot, ".cursor", "worktrees.json");
	if (!fs.existsSync(configPath)) return null;

	let config;
	try {
		config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Invalid .cursor/worktrees.json: ${message}`);
	}

	const isWindows = process.platform === "win32";
	if (isWindows && config["setup-worktree-windows"]) {
		return config["setup-worktree-windows"];
	}
	if (!isWindows && config["setup-worktree-unix"]) {
		return config["setup-worktree-unix"];
	}
	return config["setup-worktree"] ?? null;
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} params.worktreePath
 */
function runWorktreeSetup({ projectRoot, worktreePath }) {
	const spec = loadWorktreeSetupSpec(projectRoot);
	if (!spec) return;

	const env = {
		...process.env,
		ROOT_WORKTREE_PATH: projectRoot,
	};

	if (typeof spec === "string") {
		const scriptPath = path.resolve(projectRoot, ".cursor", spec);
		if (!fs.existsSync(scriptPath)) {
			throw new Error(`Worktree setup script not found: ${scriptPath}`);
		}
		const result = spawnSync(scriptPath, {
			cwd: worktreePath,
			env,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			shell: true,
		});
		if (result.status !== 0) {
			throw new Error(
				`Worktree setup script failed (${scriptPath}): ${(result.stderr ?? result.stdout ?? "").trim()}`,
			);
		}
		return;
	}

	if (!Array.isArray(spec)) {
		throw new Error(".cursor/worktrees.json setup must be a command array or script path string");
	}

	for (const command of spec) {
		if (typeof command !== "string" || !command.trim()) continue;
		const result = spawnSync(command, {
			cwd: worktreePath,
			env,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			shell: true,
		});
		if (result.status !== 0) {
			throw new Error(
				`Worktree setup command failed: ${command}\n${(result.stderr ?? result.stdout ?? "").trim()}`,
			);
		}
	}
}

/**
 * @param {object} params
 */
function provisionWorktree({ projectRoot, runId, baseBranch, modelSpec }) {
	const slug = modelSlug(modelSpec);
	const worktreePath = path.join(projectRoot, ".worktrees", `bon-${runId}`, slug);
	const branch = `bon/${runId}/${slug}`;

	if (fs.existsSync(worktreePath)) {
		throw new Error(`Worktree already exists: ${worktreePath}`);
	}

	fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
	git(projectRoot, ["worktree", "add", "-b", branch, worktreePath, baseBranch]);
	runWorktreeSetup({ projectRoot, worktreePath });

	return { worktreePath, branch, slug, modelSpec };
}

/**
 * @param {string} worktreePath
 * @param {string} branch
 */
function removeWorktree(projectRoot, worktreePath, branch) {
	try {
		git(projectRoot, ["worktree", "remove", "--force", worktreePath]);
	} catch {
		fs.rmSync(worktreePath, { recursive: true, force: true, maxRetries: 3 });
	}
	try {
		git(projectRoot, ["branch", "-D", branch]);
	} catch {
		/* branch may already be gone */
	}
}

/**
 * @param {object} params
 * @returns {Promise<{ exitCode: number, logPath: string, durationMs: number }>}
 */
function runPiInWorktree({ worktreePath, modelSpec, thinking, prompt, dryRun, logPath }) {
	const piArgs = ["-p", "--no-session", "--model", modelSpec, "--thinking", thinking, ...prompt];

	if (dryRun) {
		const line = `cwd=${worktreePath}\npi ${piArgs.map(shellQuote).join(" ")}\n`;
		fs.writeFileSync(logPath, line, "utf-8");
		return Promise.resolve({ exitCode: 0, logPath, durationMs: 0 });
	}

	return new Promise((resolve) => {
		const startedAt = Date.now();
		const logStream = fs.createWriteStream(logPath, { flags: "w" });
		logStream.write(`$ pi ${piArgs.map(shellQuote).join(" ")}\n\n`);

		const child = spawn("pi", piArgs, {
			cwd: worktreePath,
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		child.stdout?.on("data", (chunk) => logStream.write(chunk));
		child.stderr?.on("data", (chunk) => logStream.write(chunk));

		child.on("close", (code) => {
			logStream.end();
			resolve({
				exitCode: code ?? 1,
				logPath,
				durationMs: Date.now() - startedAt,
			});
		});

		child.on("error", (err) => {
			logStream.write(`\n[spawn error] ${err.message}\n`);
			logStream.end();
			resolve({
				exitCode: 1,
				logPath,
				durationMs: Date.now() - startedAt,
			});
		});
	});
}

/**
 * @param {string} value
 */
function shellQuote(value) {
	if (/^[A-Za-z0-9_@%./:=+-]+$/.test(value)) return value;
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * @param {string} worktreePath
 */
function diffStat(worktreePath) {
	const result = spawnSync("git", ["diff", "--stat", "HEAD"], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return (result.stdout ?? "").trim() || "(no changes)";
}

function makeRunId() {
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
	return stamp;
}

/**
 * @param {string} projectRoot
 * @param {string} runId
 */
function cleanupRun(projectRoot, runId) {
	const runRoot = path.join(projectRoot, ".worktrees", `bon-${runId}`);
	const manifestPath = path.join(runRoot, "manifest.json");
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`No manifest for run ${runId}: ${manifestPath}`);
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
	const candidates = Array.isArray(manifest.candidates) ? manifest.candidates : [];

	for (const candidate of candidates) {
		if (!candidate?.worktreePath || !candidate?.branch) continue;
		removeWorktree(projectRoot, candidate.worktreePath, candidate.branch);
		console.log(`  removed ${candidate.worktreePath}`);
	}

	fs.rmSync(runRoot, { recursive: true, force: true });
	console.log(`Cleaned up bon-${runId}`);
}

async function main() {
	const projectRoot = path.resolve(__dirname, "..");
	const opts = parseArgs(process.argv.slice(2));

	if (opts.help) {
		process.stdout.write(HELP);
		return;
	}

	if (opts.listModelsSearch !== null) {
		runPiListModels(projectRoot, opts.listModelsSearch);
		return;
	}

	if (opts.cleanupRunId) {
		cleanupRun(projectRoot, opts.cleanupRunId);
		return;
	}

	if (opts.models.length === 0) {
		process.stderr.write("Error: at least one model pattern is required.\n\n");
		process.stderr.write(HELP);
		process.exit(2);
	}

	if (opts.prompt.length === 0) {
		process.stderr.write("Error: prompt is required (remaining args after models).\n");
		process.exit(2);
	}

	const baseBranch = resolveBaseBranch(projectRoot, opts.baseBranch);
	const runId = makeRunId();
	const runRoot = path.join(projectRoot, ".worktrees", `bon-${runId}`);
	fs.mkdirSync(runRoot, { recursive: true });

	/** @type {{ pattern: string, modelSpec: string }[]} */
	const resolved = [];
	for (const pattern of opts.models) {
		resolved.push({ pattern, modelSpec: resolveModelPattern(projectRoot, pattern) });
	}

	const manifest = {
		runId,
		startedAt: new Date().toISOString(),
		baseBranch,
		thinking: opts.thinking,
		prompt: opts.prompt,
		models: resolved,
		dryRun: opts.dryRun,
		candidates: [],
	};
	fs.writeFileSync(path.join(runRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

	console.log(`Best-of-N run ${runId}`);
	console.log(`  base: ${baseBranch}`);
	console.log(`  models: ${resolved.map((r) => r.modelSpec).join(", ")}`);
	console.log(`  worktrees: ${runRoot}`);
	console.log("");

	/** @type {{ worktreePath: string, branch: string, slug: string, modelSpec: string, pattern: string }[]} */
	const lanes = [];
	for (const { pattern, modelSpec } of resolved) {
		const lane = provisionWorktree({ projectRoot, runId, baseBranch, modelSpec });
		lanes.push({ ...lane, pattern });
		console.log(`  + ${lane.modelSpec} → ${lane.worktreePath}`);
	}

	console.log("");

	const results = await Promise.all(
		lanes.map(async (lane) => {
			const logPath = path.join(lane.worktreePath, "bon-run.log");
			console.log(`→ running ${lane.modelSpec} …`);
			const outcome = await runPiInWorktree({
				worktreePath: lane.worktreePath,
				modelSpec: lane.modelSpec,
				thinking: opts.thinking,
				prompt: opts.prompt,
				dryRun: opts.dryRun,
				logPath,
			});
			return { ...lane, ...outcome, diff: diffStat(lane.worktreePath) };
		}),
	);

	manifest.candidates = results.map((r) => ({
		pattern: r.pattern,
		modelSpec: r.modelSpec,
		worktreePath: r.worktreePath,
		branch: r.branch,
		exitCode: r.exitCode,
		durationMs: r.durationMs,
		logPath: r.logPath,
		diffStat: r.diff,
	}));
	manifest.finishedAt = new Date().toISOString();
	fs.writeFileSync(path.join(runRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

	console.log("\nResults:");
	for (const r of results) {
		const status = r.exitCode === 0 ? "ok" : `exit ${r.exitCode}`;
		console.log(`  [${status}] ${r.modelSpec}`);
		console.log(`         ${r.worktreePath}`);
		console.log(`         log: ${r.logPath}`);
		console.log(`         diff: ${r.diff.split("\n")[0]}`);
	}

	if (opts.cleanup) {
		console.log("\nCleaning up worktrees…");
		for (const lane of lanes) {
			removeWorktree(projectRoot, lane.worktreePath, lane.branch);
		}
		try {
			fs.rmSync(runRoot, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	} else {
		console.log("\nWorktrees kept. Compare with:");
		console.log(`  git -C ${runRoot}/<model-slug> diff HEAD`);
		console.log("Remove when done:");
		console.log(`  node scripts/best-of-n.mjs --cleanup-run ${runId}`);
	}

	const failed = results.some((r) => r.exitCode !== 0);
	process.exit(failed ? 1 : 0);
}

main().catch((err) => {
	const message = err instanceof Error ? err.message : String(err);
	process.stderr.write(`best-of-n: ${message}\n`);
	process.exit(1);
});
