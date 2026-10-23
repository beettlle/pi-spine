/**
 * Shared CLI argument guards (#368): `--help` must never run a mutating
 * subcommand, and mutating subcommands reject flags they do not know.
 */

const HELP_FLAGS = new Set(["--help", "-h"]);

/** Commands whose runners parse `--help` / `-h` themselves and print richer usage. */
const SELF_HELP_COMMANDS = new Set(["batch", "gate", "integrate", "issue", "rules", "settings"]);

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * @param {string[]} args
 */
export function hasHelpFlag(args) {
	return args.some((arg) => HELP_FLAGS.has(arg));
}

/**
 * True when the top-level dispatcher must print help instead of running `command`.
 *
 * @param {string} command
 * @param {string[]} args
 */
export function shouldInterceptSubcommandHelp(command, args) {
	if (SELF_HELP_COMMANDS.has(command)) return false;
	return hasHelpFlag(args);
}

/**
 * Build per-command help from the top-level help text: the command's summary
 * row plus every `spine <command> …` example line.
 *
 * @param {string} command
 * @param {string} helpText Top-level `spine help` output (may contain ANSI codes).
 */
export function formatSubcommandHelp(command, helpText) {
	const plain = helpText.replace(ANSI_PATTERN, "").split("\n");
	const prefix = `spine ${command}`;
	const summaryPattern = new RegExp(`^\\s+${command.replace(/[-]/g, "\\-")}\\s{2,}(\\S.*)$`);
	const summaryLine = plain.find((line) => summaryPattern.test(line));
	const summary = summaryLine ? summaryLine.replace(summaryPattern, "$1").trim() : null;
	const examples = plain.filter((line) => {
		const trimmed = line.trim();
		return trimmed === prefix || trimmed.startsWith(`${prefix} `);
	});

	const lines = ["", summary ? `${prefix} — ${summary}` : prefix];
	if (examples.length > 0) {
		lines.push("", "Usage:", ...examples.map((line) => `  ${line.trim()}`));
	}
	lines.push("", "Run `spine help` for all commands.", "");
	return lines.join("\n");
}

/**
 * Strict flag parser for mutating subcommands. Valued flags consume the next
 * token, so their values never leak into positionals.
 *
 * @param {string[]} args
 * @param {{ valued?: string[], boolean?: string[] }} spec
 * @returns {{ help: boolean, positional: string[], values: Map<string, string>, flags: Set<string>, unknown: string[], missingValue: string[] }}
 */
export function parseStrictArgs(args, spec) {
	const valued = new Set(spec.valued ?? []);
	const booleans = new Set(spec.boolean ?? []);
	/** @type {string[]} */
	const positional = [];
	/** @type {Map<string, string>} */
	const values = new Map();
	/** @type {Set<string>} */
	const flags = new Set();
	/** @type {string[]} */
	const unknown = [];
	/** @type {string[]} */
	const missingValue = [];
	let help = false;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (HELP_FLAGS.has(arg)) {
			help = true;
		} else if (valued.has(arg)) {
			const value = args[index + 1];
			if (value === undefined || value.startsWith("-")) {
				missingValue.push(arg);
			} else {
				values.set(arg, value);
				index += 1;
			}
		} else if (booleans.has(arg)) {
			flags.add(arg);
		} else if (arg.startsWith("-")) {
			unknown.push(arg);
		} else {
			positional.push(arg);
		}
	}

	return { help, positional, values, flags, unknown, missingValue };
}

/**
 * Usage error for unknown or value-less flags, or null when the args are clean.
 *
 * @param {ReturnType<typeof parseStrictArgs>} parsed
 */
export function strictArgsError(parsed) {
	if (parsed.unknown.length > 0) {
		return `Unknown option(s): ${parsed.unknown.join(", ")}`;
	}
	if (parsed.missingValue.length > 0) {
		return `Missing value for: ${parsed.missingValue.join(", ")}`;
	}
	return null;
}
