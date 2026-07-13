/**
 * Safe argv execution for config-derived integrate-gate evidence commands.
 * Allowlisted executables only; rejects shell metacharacters (no shell: true).
 */

import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateWorkerLaunchScriptPath } from "../config/worker-launch-script.mjs";

/**
 * Allowed first-token executables for evidence commands.
 * Extend this set deliberately when adding new package-manager or runtime support.
 * @type {Set<string>}
 */
export const ALLOWED_EVIDENCE_EXECUTABLES = new Set(["npm", "node", "pnpm", "yarn", "npx"]);

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

const SHELL_METACHAR_PATTERN = /[;|&`<>]|>>|\$\(|\$\{/;

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
	if (SHELL_METACHAR_PATTERN.test(trimmed)) {
		throw new EvidenceCommandError("evidence command contains shell metacharacters");
	}
	if (/\$/.test(trimmed)) {
		throw new EvidenceCommandError("evidence command contains shell variable expansion");
	}
}

/**
 * Parse a config testing command into argv without invoking a shell.
 * @param {string} command
 * @returns {string[]}
 */
export function parseEvidenceCommandArgv(command) {
	assertSafeEvidenceCommand(command);
	const argv = tokenizeCommandLine(command.trim());
	if (argv.length === 0) {
		throw new EvidenceCommandError("empty evidence command");
	}

	const executable = path.basename(argv[0]);
	if (ALLOWED_EVIDENCE_EXECUTABLES.has(executable)) {
		return argv;
	}
	if (isAllowedProjectLocalInterpreter(argv[0])) {
		return argv;
	}
	if (isAllowedEvidenceScriptsPath(argv[0])) {
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
 * @param {string} projectRoot
 * @param {string} command
 * @param {number} [maxBytes]
 */
export function runEvidenceCommand(projectRoot, command, maxBytes = 256 * 1024) {
	if (!command) return { ok: false, skipped: true, output: "" };

	try {
		const argv = parseEvidenceCommandArgv(command);
		const execArgv = resolveEvidenceScriptsArgv(projectRoot, argv);
		const output = execFileSync(execArgv[0], execArgv.slice(1), {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10 * 60 * 1000,
			maxBuffer: maxBytes,
		});
		return { ok: true, skipped: false, output: String(output ?? "") };
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
