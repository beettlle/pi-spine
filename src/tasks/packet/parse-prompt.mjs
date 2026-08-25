// @ts-nocheck
import { parseSizeLineFromMarkdown } from "./size-line.mjs";

import { parseMatrixTable } from "../../planner/matrix.mjs";

/** PRD §13.4 — em dash (U+2014) required between ID and title. */
export const TASK_HEADING_RE = /^# Task: ([A-Z][A-Z0-9]*-\d+) — (.+)$/m;

const REQUIRED_SECTIONS = [
	"Mission",
	"Dependencies",
	"File Scope",
	"Steps",
	"Completion Criteria",
	"Do NOT",
];

const OPTIONAL_SECTIONS = ["Testing", "Context to Read First", "Environment", "Documentation Requirements", "Matrix"];

const H2_SECTION_RE = /^## (.+)$/gm;
const STEP_HEADING_RE = /^### Step (\d+): (.+)$/gm;

/** Normative contract table fields per handoff §4.1. */
export const CONTRACT_FIELD_NAMES = Object.freeze([
	"testCommand",
	"runCommand",
	"fileScopeMustChange",
	"fileScopeMustNotChange",
	"minLineCoverage",
	"artifactsMustExist",
	"stallTimeoutMinutes",
	"extendGraceOnFileScope",
]);

const CONTRACT_KNOWN_FIELDS = new Set(CONTRACT_FIELD_NAMES);
const CONTRACT_TABLE_HEADER_RE = /^\|\s*Field\s*\|\s*Value\s*\|$/i;
const CONTRACT_TABLE_SEPARATOR_RE = /^\|[\s\-:|]+\|$/;
const CONTRACT_TABLE_ROW_RE = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;
const TEST_COMMAND_MAX_LENGTH = 500;

/**
 * Quote-aware scan for shell metacharacters forbidden in contract commands (#268).
 *
 * Contract testCommand / runCommand execute through a shell, so expansion and
 * sequencing operators are an injection surface. Mirrors the #254 gate-evidence
 * grammar: `&&` stays the only allowed chain separator (house style is
 * `npm run typecheck && node --test …`), while `$`, backticks, `;`, `|` (which
 * covers `||`), a lone `&`, and unquoted newlines fail closed. Single-quoted
 * text is literal data (`printf '%s' 'a | b'` stays valid); `$` and backticks
 * are rejected even inside double quotes because they still expand there;
 * unclosed quotes fail closed.
 *
 * @param {string} command
 * @returns {string | null} rejection reason, or null when the command is safe
 */
export function findContractCommandMetacharIssue(command) {
	const text = String(command ?? "");
	/** @type {"'" | '"' | null} */
	let quote = null;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		if (quote === "'") {
			// Single-quoted content is literal in POSIX shells; only the closing
			// quote matters, so metacharacters there are data, not syntax.
			if (ch === "'") quote = null;
			continue;
		}

		if (ch === "\\" && i + 1 < text.length) {
			// Escaped characters are literal outside quotes and inside double
			// quotes, so `\;` / `\$` cannot sequence or expand anything.
			i += 1;
			continue;
		}

		if (quote === '"') {
			if (ch === '"') {
				quote = null;
				continue;
			}
			// `$` and backticks expand inside double quotes; other characters are
			// literal there, so quoted `;` / `|` data is allowed.
			if (ch === "$") return "shell variable expansion ($ in double quotes)";
			if (ch === "`") return "shell command substitution (backticks in double quotes)";
			continue;
		}

		if (ch === "'") {
			quote = "'";
			continue;
		}
		if (ch === '"') {
			quote = '"';
			continue;
		}
		if (ch === "$") return "shell variable expansion ($)";
		if (ch === "`") return "shell command substitution (backticks)";
		if (ch === ";") return "shell sequencing (;)";
		if (ch === "|") return "shell pipe (| or ||)";
		if (ch === "\n" || ch === "\r") return "shell sequencing (newline)";
		if (ch === "&") {
			if (text[i + 1] === "&") {
				// `&&` is the documented chain separator (mirrors #254 Phase B).
				i += 1;
				continue;
			}
			return "shell background operator (&)";
		}
	}

	if (quote) return "unclosed quote";
	return null;
}

/**
 * Defense in depth: reject shell metacharacters in contract testCommand before the
 * shell spawns (#268). `&&` chains stay allowed (mirrors the #254 gate-evidence
 * grammar); `$`, backticks, `;`, `|`, `||`, and lone `&` fail closed. The runtime
 * guard is the enforcement boundary because matrix row substitution can reintroduce
 * metacharacters after parse-time validation.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isRefusedContractMetacharCommand(command) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed || trimmed === "true") {
		return false;
	}
	return findContractCommandMetacharIssue(trimmed) !== null;
}

/**
 * Refusal copy for the contract verify path — deliberately distinct from the #254
 * gate-evidence messages ("evidence command contains …").
 *
 * @param {string} command
 * @returns {string}
 */
export function formatRefusedContractMetacharMessage(command) {
	const issue = findContractCommandMetacharIssue(String(command ?? "").trim());
	return `Contract testCommand refused before spawn: ${issue ?? "shell metacharacters"} (command: ${command}). Contract testCommand runs through a shell; remove $, backticks, ;, |, || or lone & — && chains are allowed (#268).`;
}
export const SEE_FILE_SCOPE_RE = /^see\s+file\s+scope$/i;
const CONTRACT_EM_DASH_PLACEHOLDER_RE = /^[—\-]$/;
const CONTRACT_NONE_VALUES = new Set([
	"—",
	"-",
	"none",
	"n/a",
	"na",
	"(none beyond tests)",
	"none beyond tests",
]);

/**
 * @param {string} markdown PROMPT.md contents
 */
export function parsePrompt(markdown) {
	const headingMatch = TASK_HEADING_RE.exec(markdown);
	const taskId = headingMatch?.[1] ?? null;
	const title = headingMatch?.[2]?.trim() ?? null;
	const headingLine = headingMatch ? lineNumberAt(markdown, headingMatch.index) : null;

	const sections = extractH2Sections(markdown);
	const steps = parseSteps(sections.Steps ?? "");
	const fileScope = parseBulletPaths(sections["File Scope"] ?? "");
	const dependencies = parsePromptDependencies(sections.Dependencies ?? "");
	const hasTesting =
		Boolean(sections.Testing) ||
		steps.some((step) => /testing/i.test(step.title));

	const missingSections = REQUIRED_SECTIONS.filter((name) => !sections[name]);
	const size = parseSizeLineFromMarkdown(markdown);
	const typeMatch = /^\*\*Type:\*\*\s*(llm|execute)\s*$/im.exec(markdown);
	const type = typeMatch ? typeMatch[1].toLowerCase() : "llm";
	
	let matrix = null;
	let matrixColumns = null;
	if (sections.Matrix) {
		const parsedMatrix = parseMatrixTable(sections.Matrix);
		if (parsedMatrix.rows.length > 0) {
			matrix = parsedMatrix.rows;
			matrixColumns = parsedMatrix.columns;
		}
	}

	return {
		taskId,
		title,
		size,
		type,
		headingLine,
		sections,
		steps,
		fileScope,
		dependencies,
		hasTesting,
		missingSections,
		requiredSections: REQUIRED_SECTIONS,
		optionalSections: OPTIONAL_SECTIONS,
		...(matrix ? { matrix, matrixColumns } : {})
	};
}

/**
 * @param {string} markdown
 */
export function validatePrompt(markdown) {
	const prompt = parsePrompt(markdown);
	const errors = [];

	if (!prompt.taskId || !prompt.title) {
		errors.push(
			"Missing or invalid heading; expected `# Task: PREFIX-### — Name` with em dash (U+2014)",
		);
	}

	if (prompt.missingSections.length > 0) {
		errors.push(`Missing required sections: ${prompt.missingSections.join(", ")}`);
	}

	if (!prompt.hasTesting) {
		errors.push('Missing testing coverage: add `## Testing` or a step titled "Testing"');
	}

	if (prompt.steps.length === 0) {
		errors.push("No steps found; expected `### Step N: ...` headings under ## Steps");
	}

	if (prompt.size === "XL") {
		errors.push('Size XL is not allowed — split into multiple S/M tasks (see create-spine-tasks skill)');
	}

	errors.push(...collectDuplicateStepNumberErrors(prompt.steps));

	if (prompt.type === "execute") {
		const contract = parseContract(markdown);
		if (!contract.testCommand && !contract.runCommand) {
			errors.push("Type: execute tasks require a testCommand or runCommand in the ## Contract section");
		}
	}

	return { ok: errors.length === 0, errors, prompt };
}

/**
 * @param {Array<{ number: number, title: string }>} steps
 * @returns {string[]}
 */
function collectDuplicateStepNumberErrors(steps) {
	/** @type {Map<number, string[]>} */
	const titlesByNumber = new Map();

	for (const step of steps) {
		const titles = titlesByNumber.get(step.number) ?? [];
		titles.push(step.title);
		titlesByNumber.set(step.number, titles);
	}

	/** @type {string[]} */
	const errors = [];
	for (const [number, titles] of [...titlesByNumber.entries()].sort((a, b) => a[0] - b[0])) {
		if (titles.length <= 1) {
			continue;
		}
		const quotedTitles = titles.map((title) => `"${title}"`).join(", ");
		errors.push(`Duplicate step number ${number} in ## Steps: ${quotedTitles}`);
	}

	return errors;
}

/**
 * Parse the `## Contract` Markdown table from PROMPT.md (handoff §4.3).
 *
 * @param {string} markdown PROMPT.md contents
 * @returns {{
 *   testCommand: string | null,
 *   runCommand: string | null,
 *   fileScopeMustChange: string[],
 *   fileScopeMustNotChange: string[],
 *   minLineCoverage: number | null,
 *   artifactsMustExist: string[],
 *   stallTimeoutMinutes: number | null,
 *   extendGraceOnFileScope: boolean | null,
 *   rawTableValid: boolean,
 *   errors: string[],
 *   unknownFields: string[],
 *   hasSection: boolean,
 *   rawFieldValues: Record<string, string>,
 *   placeholderIssues: string[],
 * }}
 */
export function parseContract(markdown) {
	const sections = extractH2Sections(markdown);
	const contractSection = sections.Contract ?? "";
	const fileScopePaths = parseBulletPaths(sections["File Scope"] ?? "");

	/** @type {ReturnType<typeof parseContract>} */
	const parsed = {
		testCommand: null,
		runCommand: null,
		fileScopeMustChange: [],
		fileScopeMustNotChange: [],
		minLineCoverage: null,
		artifactsMustExist: [],
		stallTimeoutMinutes: null,
		extendGraceOnFileScope: null,
		rawTableValid: false,
		errors: [],
		unknownFields: [],
		hasSection: Object.hasOwn(sections, "Contract"),
		rawFieldValues: {},
		placeholderIssues: [],
	};

	if (!parsed.hasSection) {
		return parsed;
	}

	const tableRows = extractContractTableRows(contractSection);
	if (tableRows === null) {
		parsed.errors.push('Contract section must contain a Markdown table with header row "| Field | Value |"');
		return parsed;
	}

	parsed.rawTableValid = true;
	const seenFields = new Set();

	for (const { field, value } of tableRows) {
		if (seenFields.has(field)) {
			parsed.errors.push(`Duplicate contract field row: ${field}`);
			continue;
		}
		seenFields.add(field);

		if (!CONTRACT_KNOWN_FIELDS.has(field)) {
			parsed.unknownFields.push(field);
			continue;
		}

		parsed.rawFieldValues[field] = value;
		applyContractField(parsed, field, value);
	}

	resolveContractFileScopeReferences(parsed, fileScopePaths);
	parsed.placeholderIssues = detectContractPlaceholderIssues(parsed, fileScopePaths);

	return parsed;
}

/**
 * @param {ReturnType<typeof parseContract>} parsed
 * @param {string[]} fileScopePaths
 * @returns {string[]}
 */
export function detectContractPlaceholderIssues(parsed, fileScopePaths) {
	/** @type {string[]} */
	const issues = [];
	const raw = parsed.rawFieldValues ?? {};

	for (const field of ["fileScopeMustChange", "fileScopeMustNotChange", "artifactsMustExist"]) {
		const value = String(raw[field] ?? "").trim();
		if (!value) {
			continue;
		}

		if (SEE_FILE_SCOPE_RE.test(value)) {
			if (fileScopePaths.length === 0) {
				issues.push(
					`Contract ${field}: unresolved "see File Scope" placeholder (empty File Scope section)`,
				);
			}
			continue;
		}

		if (CONTRACT_EM_DASH_PLACEHOLDER_RE.test(value)) {
			issues.push(`Contract ${field}: em-dash placeholder; use an empty cell instead`);
		}
	}

	return issues;
}

/**
 * Expand contract placeholders such as "see File Scope" into concrete paths.
 *
 * @param {ReturnType<typeof parseContract>} parsed
 * @param {string[]} fileScopePaths
 */
export function resolveContractFileScopeReferences(parsed, fileScopePaths) {
	/** @type {string[]} */
	const expanded = [];
	for (const pattern of parsed.fileScopeMustChange ?? []) {
		if (SEE_FILE_SCOPE_RE.test(pattern.trim())) {
			expanded.push(...fileScopePaths);
			continue;
		}
		expanded.push(pattern);
	}
	parsed.fileScopeMustChange = [...new Set(expanded)];
}

const CONTRACT_METACHAR_FIX_HINT =
	"contract commands reject $, backticks, ;, |, || and lone & — && chains are allowed (#268)";

/**
 * @param {ReturnType<typeof parseContract>} parsed
 * @param {string} field
 * @param {string} rawValue
 */
function applyContractField(parsed, field, rawValue) {
	const value = rawValue.trim();
	if (!value) {
		return;
	}

	switch (field) {
		case "testCommand": {
			const command = parseContractScalar(value);
			if (command.includes("\n")) {
				parsed.errors.push("Contract testCommand must not contain newlines");
				return;
			}
			if (command.length > TEST_COMMAND_MAX_LENGTH) {
				parsed.errors.push(`Contract testCommand exceeds ${TEST_COMMAND_MAX_LENGTH} characters`);
				return;
			}
			const testCommandIssue = findContractCommandMetacharIssue(command);
			if (testCommandIssue) {
				parsed.errors.push(
					`Contract testCommand contains forbidden shell metacharacters: ${testCommandIssue}; ${CONTRACT_METACHAR_FIX_HINT}`,
				);
				return;
			}
			parsed.testCommand = command;
			return;
		}
		case "runCommand": {
			const command = parseContractScalar(value);
			if (command.includes("\n")) {
				parsed.errors.push("Contract runCommand must not contain newlines");
				return;
			}
			if (command.length > TEST_COMMAND_MAX_LENGTH) {
				parsed.errors.push(`Contract runCommand exceeds ${TEST_COMMAND_MAX_LENGTH} characters`);
				return;
			}
			const runCommandIssue = findContractCommandMetacharIssue(command);
			if (runCommandIssue) {
				parsed.errors.push(
					`Contract runCommand contains forbidden shell metacharacters: ${runCommandIssue}; ${CONTRACT_METACHAR_FIX_HINT}`,
				);
				return;
			}
			parsed.runCommand = command;
			return;
		}
		case "fileScopeMustChange":
			parsed.fileScopeMustChange = parseContractPathList(value);
			return;
		case "fileScopeMustNotChange":
			parsed.fileScopeMustNotChange = parseContractPathList(value);
			return;
		case "artifactsMustExist":
			parsed.artifactsMustExist = parseContractPathList(value);
			return;
		case "minLineCoverage": {
			const coverage = parseContractScalar(value);
			if (!/^\d+$/.test(coverage)) {
				parsed.errors.push("Contract minLineCoverage must be an integer between 0 and 100");
				return;
			}
			const numeric = Number(coverage);
			if (numeric < 0 || numeric > 100) {
				parsed.errors.push("Contract minLineCoverage must be an integer between 0 and 100");
				return;
			}
			parsed.minLineCoverage = numeric;
			return;
		}
		case "stallTimeoutMinutes": {
			const minutes = parseContractScalar(value);
			if (!/^\d+(\.\d+)?$/.test(minutes)) {
				parsed.errors.push("Contract stallTimeoutMinutes must be a positive number");
				return;
			}
			const numeric = Number(minutes);
			if (numeric <= 0) {
				parsed.errors.push("Contract stallTimeoutMinutes must be a positive number");
				return;
			}
			parsed.stallTimeoutMinutes = numeric;
			return;
		}
		case "extendGraceOnFileScope": {
			const flag = parseContractScalar(value).toLowerCase();
			if (flag === "true") {
				parsed.extendGraceOnFileScope = true;
				return;
			}
			if (flag === "false") {
				parsed.extendGraceOnFileScope = false;
				return;
			}
			parsed.errors.push("Contract extendGraceOnFileScope must be true or false");
			return;
		}
		default:
			return;
	}
}

/**
 * @param {string} section
 * @returns {Array<{ field: string, value: string }> | null}
 */
function extractContractTableRows(section) {
	/** @type {Array<{ field: string, value: string }>} */
	const rows = [];
	let sawHeader = false;
	let sawSeparator = false;

	for (const line of section.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("|")) {
			continue;
		}

		if (CONTRACT_TABLE_HEADER_RE.test(trimmed)) {
			sawHeader = true;
			continue;
		}

		if (CONTRACT_TABLE_SEPARATOR_RE.test(trimmed)) {
			if (!sawHeader) {
				return null;
			}
			sawSeparator = true;
			continue;
		}

		const match = trimmed.match(CONTRACT_TABLE_ROW_RE);
		if (!match) {
			return null;
		}

		if (!sawHeader || !sawSeparator) {
			return null;
		}

		rows.push({ field: match[1].trim(), value: match[2].trim() });
	}

	if (!sawHeader || !sawSeparator) {
		return null;
	}

	return rows;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function parseContractScalar(raw) {
	const backtick = raw.match(/^`([^`]*)`$/);
	if (backtick) {
		return backtick[1];
	}
	return raw;
}

/** Comma-separated paths inside one backtick pair (authoring anti-pattern). */
const CONTRACT_COMMA_IN_SINGLE_BACKTICK_RE = /^`[^`,]+,[^`]+`$/;

/**
 * Detect contract path-list cells that comma-separate paths inside one backtick wrapper.
 *
 * @param {Record<string, string>} rawFieldValues
 * @param {string[]} fields
 * @returns {string[]}
 */
export function detectCommaInSingleBacktickPathLists(rawFieldValues, fields) {
	/** @type {string[]} */
	const issues = [];
	for (const field of fields) {
		const value = String(rawFieldValues?.[field] ?? "").trim();
		if (!value) {
			continue;
		}
		if (CONTRACT_COMMA_IN_SINGLE_BACKTICK_RE.test(value)) {
			issues.push(
				`Contract ${field}: comma-separated paths inside one backtick pair; use per-path backticks (e.g. \`path-a\`, \`path-b\`)`,
			);
		}
	}
	return issues;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseContractPathList(raw) {
	const trimmed = raw.trim();
	const singleBacktick = trimmed.match(/^`([^`]+)`$/);
	const source = singleBacktick ? singleBacktick[1] : trimmed;
	return source
		.split(",")
		.map((part) => parseContractScalar(part.trim()))
		.filter((part) => part && !isContractNoneValue(part));
}

/**
 * @param {string} value
 */
function isContractNoneValue(value) {
	const normalized = String(value ?? "").trim().toLowerCase();
	return !normalized || CONTRACT_NONE_VALUES.has(normalized);
}

/**
 * @param {string} depsSection
 * @returns {string[]}
 */
export function parsePromptDependencies(depsSection) {
	const trimmed = depsSection.trim();
	if (!trimmed || /\*\*None\*\*/i.test(trimmed) || /^-\s+\*\*None\*\*/im.test(trimmed)) {
		return [];
	}

	const ids = [];
	// Set-backed membership so dedup is O(1) per line instead of O(N) (#271);
	// `ids` keeps first-seen bullet order for the return value.
	const seenIds = new Set();
	for (const line of depsSection.split(/\r?\n/)) {
		const bullet = line.match(/^-\s+\*{0,2}([A-Z][A-Z0-9]*-\d+)\*{0,2}/);
		if (bullet) {
			if (!seenIds.has(bullet[1])) {
				seenIds.add(bullet[1]);
				ids.push(bullet[1]);
			}
			continue;
		}
		const bare = line.match(/^-\s+([A-Z][A-Z0-9]*-\d+)\b/);
		if (bare) {
			if (!seenIds.has(bare[1])) {
				seenIds.add(bare[1]);
				ids.push(bare[1]);
			}
			continue;
		}
		const requires = line.match(/\*+Requires:\*+\s*(?:[a-z0-9-]+\/)?([A-Z][A-Z0-9]*-\d+)/i);
		if (requires && !seenIds.has(requires[1])) {
			seenIds.add(requires[1]);
			ids.push(requires[1]);
		}
	}
	return ids;
}

/**
 * @param {string} content
 * @returns {Record<string, string>}
 */
function extractH2Sections(content) {
	const sections = {};
	const matches = [...content.matchAll(H2_SECTION_RE)];

	for (let i = 0; i < matches.length; i++) {
		const name = matches[i][1].trim();
		const start = matches[i].index + matches[i][0].length;
		const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
		sections[name] = content.slice(start, end).trim();
	}

	return sections;
}

/**
 * @param {string} stepsSection
 */
function parseSteps(stepsSection) {
	const steps = [];
	const matches = [...stepsSection.matchAll(STEP_HEADING_RE)];

	for (let i = 0; i < matches.length; i++) {
		const number = Number(matches[i][1]);
		const title = matches[i][2].trim();
		const start = matches[i].index + matches[i][0].length;
		const end = i + 1 < matches.length ? matches[i + 1].index : stepsSection.length;
		steps.push({ number, title, body: stepsSection.slice(start, end).trim() });
	}

	return steps;
}

/**
 * @param {string} section
 * @returns {string[]}
 */
function parseBulletPaths(section) {
	const paths = [];
	for (const line of section.split(/\r?\n/)) {
		if (/\(optional\b/i.test(line) || /\bonly if\b/i.test(line)) {
			continue;
		}
		const match = line.match(/^-\s+`([^`]+)`/);
		if (match) paths.push(match[1]);
	}
	return paths;
}

function lineNumberAt(text, index) {
	return text.slice(0, index).split(/\r?\n/).length;
}
