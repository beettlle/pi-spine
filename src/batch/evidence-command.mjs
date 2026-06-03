/**
 * Safe argv execution for config-derived integrate-gate evidence commands.
 * Allowlisted executables only; rejects shell metacharacters (no shell: true).
 */

import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Allowed first-token executables for evidence commands.
 * Extend this set deliberately when adding new package-manager or runtime support.
 * @type {Set<string>}
 */
export const ALLOWED_EVIDENCE_EXECUTABLES = new Set(["npm", "node", "pnpm", "yarn", "npx"]);

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
	if (!ALLOWED_EVIDENCE_EXECUTABLES.has(executable)) {
		throw new EvidenceCommandError(`evidence executable not allowed: ${executable}`);
	}

	return argv;
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
		const output = execFileSync(argv[0], argv.slice(1), {
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
