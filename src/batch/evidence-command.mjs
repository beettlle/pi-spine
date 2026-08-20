/**
 * Safe argv execution for config-derived integrate-gate evidence commands.
 * Allowlisted executables only; rejects shell metacharacters (no shell: true).
 * Phase B: allowlisted package-manager segments may be joined with `&&` only.
 */

import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateWorkerLaunchScriptPath } from "../config/worker-launch-script.mjs";

/**
 * Allowed first-token executables for evidence commands.
 * Extend this set deliberately when adding new package-manager or runtime support.
 * @type {Set<string>}
 */
export const ALLOWED_EVIDENCE_EXECUTABLES = new Set([
	"npm",
	"node",
	"pnpm",
	"yarn",
	"npx",
	"cargo",
	"task",
]);

/**
 * Interpreter basenames allowed only as project-local relative paths under
 * `.venv/` or `venv/` (see {@link isAllowedProjectLocalInterpreter}).
 * Bare names (PATH lookup) and absolute/outside-project paths stay rejected.
 * @type {Set<string>}
 */
export const ALLOWED_PROJECT_LOCAL_INTERPRETERS = new Set(["python", "python3"]);

/** Relative venv roots that may host an allowed interpreter (posix-normalized). */
const PROJECT_LOCAL_VENV_PREFIXES = [".venv/", "venv/"];

/** Relative prefix for validated gate-evidence scripts (posix-normalized). */
const EVIDENCE_SCRIPTS_PREFIX = "scripts/";

/**
 * Forbidden shell metacharacters. Checked after stripping allowlisted `&&`
 * chain separators so a lone `&` still fails closed.
 */
const SHELL_METACHAR_PATTERN = /[;|&`<>]|>>|\$\(|\$\{/;

/**
 * Documented `PATH="…"` segment prefix (SP-710, #254). Only the double-quoted
 * assignment form at the start of a segment is recognized; every colon-separated
 * entry must pass {@link isAllowedEvidencePathEntry}.
 */
const PATH_PREFIX_PATTERN = /^PATH="([^"]*)"(\s+|$)/;

/** Charset for a safe PATH entry (no whitespace, shell metacharacters, or `~`). */
const SAFE_PATH_ENTRY_PATTERN = /^[A-Za-z0-9._/-]+$/;

/**
 * Bounded allowlist for `PATH="…"` prefix entries:
 * - literal `$PATH` (preserve the inherited lookup path),
 * - `$HOME/<relative>` toolchain dirs such as `$HOME/.cargo/bin`,
 * - project-relative paths such as `node_modules/.bin` (resolved against the
 *   evidence cwd, never absolute and never traversing `..`).
 * Any other `$` expansion, absolute path, or parent traversal is rejected so the
 * prefix cannot widen into general shell variable expansion.
 *
 * @param {string} entry
 * @returns {boolean}
 */
export function isAllowedEvidencePathEntry(entry) {
	if (entry === "$PATH") {
		return true;
	}
	if (entry.startsWith("$HOME/")) {
		return isSafeRelativePathEntry(entry.slice("$HOME/".length));
	}
	if (entry.includes("$")) {
		return false;
	}
	return isSafeRelativePathEntry(entry);
}

/**
 * @param {string} relativePath
 * @returns {boolean}
 */
function isSafeRelativePathEntry(relativePath) {
	if (!relativePath || !SAFE_PATH_ENTRY_PATTERN.test(relativePath)) {
		return false;
	}
	if (path.posix.isAbsolute(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
		return false;
	}
	return !relativePath.split("/").some((segment) => segment === "..");
}

/**
 * Split a validated `PATH="…"` prefix off the start of a chain segment.
 * Returns the raw colon-separated entries plus the remaining command text.
 *
 * @param {string} segment
 * @returns {{ pathEntries: string[], rest: string }}
 */
function splitEvidencePathPrefix(segment) {
	const match = segment.match(PATH_PREFIX_PATTERN);
	if (!match) {
		return { pathEntries: [], rest: segment };
	}
	const pathEntries = match[1].split(":");
	for (const entry of pathEntries) {
		if (!isAllowedEvidencePathEntry(entry)) {
			throw new EvidenceCommandError(
				`evidence PATH prefix entry not allowed: ${entry}`,
			);
		}
	}
	const rest = segment.slice(match[0].length).trim();
	if (!rest) {
		throw new EvidenceCommandError("evidence PATH prefix without a command");
	}
	return { pathEntries, rest };
}

export class EvidenceCommandError extends Error {
	/**
	 * @param {string} message
	 */
	constructor(message) {
		super(message);
		this.name = "EvidenceCommandError";
	}
}

/**
 * @param {string} command
 */
export function assertSafeEvidenceCommand(command) {
	if (typeof command !== "string" || !command.trim()) {
		throw new EvidenceCommandError("empty evidence command");
	}

	const trimmed = command.trim();
	if (/[\r\n]/.test(trimmed)) {
		throw new EvidenceCommandError("evidence command contains newlines");
	}

	// Strip documented `PATH="…"` prefixes per `&&` segment first; the bounded
	// entry allowlist above keeps `$HOME` / `$PATH` / project-relative dirs only.
	// Any `$` surviving the strip is still rejected below (fail-closed).
	const segments = splitEvidenceChainSegments(trimmed);
	const stripped = segments.map((segment) => splitEvidencePathPrefix(segment).rest);

	// Allow `&&` as the only chain operator; strip it before metachar / `$` scans.
	const withoutChains = stripped.join(" ").replaceAll("&&", " ");
	if (SHELL_METACHAR_PATTERN.test(withoutChains)) {
		throw new EvidenceCommandError("evidence command contains shell metacharacters");
	}
	if (/\$/.test(withoutChains)) {
		throw new EvidenceCommandError("evidence command contains shell variable expansion");
	}
}

/**
 * Split an evidence command on `&&` outside quotes (Phase B chain grammar).
 * @param {string} line
 * @returns {string[]}
 */
function splitEvidenceChainSegments(line) {
	/** @type {string[]} */
	const segments = [];
	let current = "";
	/** @type {"'" | '"' | null} */
	let quote = null;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (quote) {
			// Preserve escapes so tokenizeCommandLine can re-parse the segment.
			if (ch === "\\" && quote === '"' && i + 1 < line.length) {
				current += ch;
				i += 1;
				current += line[i];
				continue;
			}
			current += ch;
			if (ch === quote) {
				quote = null;
			}
			continue;
		}

		if (ch === "'" || ch === '"') {
			quote = ch;
			current += ch;
			continue;
		}

		if (ch === "&" && line[i + 1] === "&") {
			segments.push(current.trim());
			current = "";
			i += 1;
			continue;
		}

		current += ch;
	}

	if (quote) {
		throw new EvidenceCommandError("unclosed quote in evidence command");
	}

	segments.push(current.trim());
	return segments;
}

/**
 * Parse a config testing command into one or more argv arrays without a shell.
 * Multi-segment results are allowlisted `&&` chains (Phase B).
 * @param {string} command
 * @returns {string[][]}
 */
export function parseEvidenceCommandChain(command) {
	assertSafeEvidenceCommand(command);
	const segments = splitEvidenceChainSegments(command.trim());
	if (segments.length === 0) {
		throw new EvidenceCommandError("empty evidence command");
	}
	if (segments.some((segment) => !segment)) {
		throw new EvidenceCommandError("empty evidence command chain segment");
	}

	const chainMode = segments.length > 1;
	return segments.map((segment) => parseEvidenceSegmentArgv(segment, chainMode));
}

/**
 * Parse a config testing command into argv without invoking a shell.
 * Single-segment only; use {@link parseEvidenceCommandChain} for `&&` chains.
 * @param {string} command
 * @returns {string[]}
 */
export function parseEvidenceCommandArgv(command) {
	const chain = parseEvidenceCommandChain(command);
	if (chain.length !== 1) {
		throw new EvidenceCommandError(
			"evidence command && chains must use parseEvidenceCommandChain or runEvidenceCommand",
		);
	}
	return chain[0];
}

/**
 * @param {string} segment
 * @param {boolean} chainMode
 * @returns {string[]}
 */
function parseEvidenceSegmentArgv(segment, chainMode) {
	const { rest } = splitEvidencePathPrefix(segment);
	const argv = tokenizeCommandLine(rest);
	if (argv.length === 0) {
		throw new EvidenceCommandError("empty evidence command");
	}

	const executable = path.basename(argv[0]);
	if (ALLOWED_EVIDENCE_EXECUTABLES.has(executable)) {
		return argv;
	}

	// Phase A single-segment paths stay available; multi-segment chains are
	// package-manager / node allowlist only (FR-REL270-05).
	if (!chainMode && isAllowedProjectLocalInterpreter(argv[0])) {
		return argv;
	}
	if (!chainMode && isAllowedEvidenceScriptsPath(argv[0])) {
		return argv;
	}

	throw new EvidenceCommandError(`evidence executable not allowed: ${executable}`);
}

/**
 * Allow project-local interpreters for gate evidence (e.g. `.venv/bin/python`).
 *
 * Exact rule: first token must be a relative path (not absolute), with no `..`
 * segments after posix normalization, whose normalized form starts with
 * `.venv/` or `venv/`, and whose basename is in
 * {@link ALLOWED_PROJECT_LOCAL_INTERPRETERS} (`python` or `python3`).
 * Rejects bare interpreter names and absolute/outside-project paths.
 *
 * @param {string} firstToken
 * @returns {boolean}
 */
export function isAllowedProjectLocalInterpreter(firstToken) {
	if (typeof firstToken !== "string" || !firstToken) {
		return false;
	}
	if (path.isAbsolute(firstToken)) {
		return false;
	}

	const posixToken = firstToken.replaceAll("\\", "/");
	const segments = posixToken.split("/");
	if (segments.some((segment) => segment === "..")) {
		return false;
	}

	const normalized = path.posix.normalize(posixToken);
	if (normalized.startsWith("../") || normalized === "..") {
		return false;
	}
	if (path.posix.isAbsolute(normalized)) {
		return false;
	}

	const underVenv = PROJECT_LOCAL_VENV_PREFIXES.some((prefix) => normalized.startsWith(prefix));
	if (!underVenv) {
		return false;
	}

	const basename = path.posix.basename(normalized);
	return ALLOWED_PROJECT_LOCAL_INTERPRETERS.has(basename);
}

/**
 * Lightweight parse-time check: first token is a relative path under `scripts/`
 * with no parent traversal. Full symlink/root validation runs at execution via
 * {@link validateWorkerLaunchScriptPath} (same sandbox as workerLaunchScript).
 *
 * @param {string} firstToken
 * @returns {boolean}
 */
export function isAllowedEvidenceScriptsPath(firstToken) {
	if (typeof firstToken !== "string" || !firstToken) {
		return false;
	}
	if (path.isAbsolute(firstToken)) {
		return false;
	}

	const posixToken = firstToken.replaceAll("\\", "/");
	const segments = posixToken.split("/");
	if (segments.some((segment) => segment === "..")) {
		return false;
	}

	const normalized = path.posix.normalize(posixToken);
	if (normalized.startsWith("../") || normalized === "..") {
		return false;
	}
	if (path.posix.isAbsolute(normalized)) {
		return false;
	}

	return normalized.startsWith(EVIDENCE_SCRIPTS_PREFIX);
}

/**
 * Resolve and validate a scripts/ evidence argv for execFile (no shell).
 *
 * @param {string} projectRoot
 * @param {string[]} argv
 * @returns {string[]}
 */
export function resolveEvidenceScriptsArgv(projectRoot, argv) {
	if (!isAllowedEvidenceScriptsPath(argv[0])) {
		return argv;
	}

	const validated = validateWorkerLaunchScriptPath(projectRoot, argv[0]);
	if (!validated.ok) {
		throw new EvidenceCommandError(validated.message ?? "evidence script path invalid");
	}
	if (!validated.scriptPath) {
		throw new EvidenceCommandError("evidence script path invalid");
	}

	return [validated.scriptPath, ...argv.slice(1)];
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function tokenizeCommandLine(line) {
	/** @type {string[]} */
	const tokens = [];
	let current = "";
	/** @type {"'" | '"' | null} */
	let quote = null;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (quote) {
			if (ch === quote) {
				quote = null;
				continue;
			}
			if (ch === "\\" && quote === '"' && i + 1 < line.length) {
				i += 1;
				current += line[i];
				continue;
			}
			current += ch;
			continue;
		}

		if (ch === "'" || ch === '"') {
			quote = ch;
			continue;
		}

		if (/\s/.test(ch)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += ch;
	}

	if (quote) {
		throw new EvidenceCommandError("unclosed quote in evidence command");
	}
	if (current) {
		tokens.push(current);
	}

	return tokens;
}

/**
 * Expand validated PATH prefix entries into concrete directories (no shell).
 * `$HOME` maps to `os.homedir()`, `$PATH` splices the inherited lookup path,
 * and project-relative entries stay relative to the evidence cwd.
 *
 * @param {string[]} entries
 * @returns {string[]}
 */
function expandEvidencePathEntries(entries) {
	/** @type {string[]} */
	const expanded = [];
	for (const entry of entries) {
		if (entry === "$PATH") {
			if (process.env.PATH) {
				expanded.push(...process.env.PATH.split(path.delimiter).filter(Boolean));
			}
			continue;
		}
		if (entry.startsWith("$HOME/")) {
			expanded.push(path.join(os.homedir(), entry.slice("$HOME/".length)));
			continue;
		}
		expanded.push(entry);
	}
	return expanded;
}

/**
 * Collect validated `PATH="…"` prefix entries across all `&&` segments.
 * Assumes {@link assertSafeEvidenceCommand} already ran for the command.
 *
 * @param {string} command
 * @returns {string[]}
 */
function collectEvidencePathPrefixEntries(command) {
	const segments = splitEvidenceChainSegments(command.trim());
	/** @type {string[]} */
	const entries = [];
	for (const segment of segments) {
		entries.push(...splitEvidencePathPrefix(segment).pathEntries);
	}
	return entries;
}

/**
 * @param {string} projectRoot
 * @param {string} command
 * @param {number} [maxBytes]
 */
export function runEvidenceCommand(projectRoot, command, maxBytes = 256 * 1024) {
	if (!command) return { ok: false, skipped: true, output: "" };

	try {
		const chain = parseEvidenceCommandChain(command);
		const pathEntries = collectEvidencePathPrefixEntries(command);
		/** @type {NodeJS.ProcessEnv | undefined} */
		let env;
		if (pathEntries.length > 0) {
			const expanded = expandEvidencePathEntries(pathEntries);
			if (process.env.PATH) {
				expanded.push(process.env.PATH);
			}
			env = { ...process.env, PATH: expanded.join(path.delimiter) };
		}
		/** @type {string[]} */
		const outputs = [];
		for (const argv of chain) {
			const execArgv = resolveEvidenceScriptsArgv(projectRoot, argv);
			const output = execFileSync(execArgv[0], execArgv.slice(1), {
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 10 * 60 * 1000,
				maxBuffer: maxBytes,
				...(env ? { env } : {}),
			});
			outputs.push(String(output ?? ""));
		}
		return { ok: true, skipped: false, output: outputs.join("") };
	} catch (err) {
		if (err instanceof EvidenceCommandError) {
			return {
				ok: false,
				skipped: false,
				output: `[rejected] ${err.message}`,
			};
		}

		const stdout = err && typeof err === "object" && "stdout" in err ? String(err.stdout ?? "") : "";
		const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr ?? "") : "";
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			skipped: false,
			output: `${stdout}${stderr}\n[exit] ${message}`.trim(),
		};
	}
}
