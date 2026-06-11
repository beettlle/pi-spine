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

const OPTIONAL_SECTIONS = ["Testing", "Context to Read First", "Environment", "Documentation Requirements"];

const H2_SECTION_RE = /^## (.+)$/gm;
const STEP_HEADING_RE = /^### Step (\d+): (.+)$/gm;
const SIZE_LINE_RE = /^\*\*Size:\*\*\s*(S|M|L|XL)\s*$/im;

/** Normative contract table fields per handoff §4.1. */
export const CONTRACT_FIELD_NAMES = Object.freeze([
	"testCommand",
	"fileScopeMustChange",
	"fileScopeMustNotChange",
	"minLineCoverage",
	"artifactsMustExist",
]);

const CONTRACT_KNOWN_FIELDS = new Set(CONTRACT_FIELD_NAMES);
const CONTRACT_TABLE_HEADER_RE = /^\|\s*Field\s*\|\s*Value\s*\|$/i;
const CONTRACT_TABLE_SEPARATOR_RE = /^\|[\s\-:|]+\|$/;
const CONTRACT_TABLE_ROW_RE = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;
const TEST_COMMAND_MAX_LENGTH = 500;

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
	const sizeMatch = SIZE_LINE_RE.exec(markdown);
	const size = sizeMatch ? sizeMatch[1].toUpperCase() : null;

	return {
		taskId,
		title,
		size,
		headingLine,
		sections,
		steps,
		fileScope,
		dependencies,
		hasTesting,
		missingSections,
		requiredSections: REQUIRED_SECTIONS,
		optionalSections: OPTIONAL_SECTIONS,
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

	return { ok: errors.length === 0, errors, prompt };
}

/**
 * Parse the `## Contract` Markdown table from PROMPT.md (handoff §4.3).
 *
 * @param {string} markdown PROMPT.md contents
 * @returns {{
 *   testCommand: string | null,
 *   fileScopeMustChange: string[],
 *   fileScopeMustNotChange: string[],
 *   minLineCoverage: number | null,
 *   artifactsMustExist: string[],
 *   rawTableValid: boolean,
 *   errors: string[],
 *   unknownFields: string[],
 *   hasSection: boolean,
 * }}
 */
export function parseContract(markdown) {
	const sections = extractH2Sections(markdown);
	const contractSection = sections.Contract ?? "";

	/** @type {ReturnType<typeof parseContract>} */
	const parsed = {
		testCommand: null,
		fileScopeMustChange: [],
		fileScopeMustNotChange: [],
		minLineCoverage: null,
		artifactsMustExist: [],
		rawTableValid: false,
		errors: [],
		unknownFields: [],
		hasSection: Object.hasOwn(sections, "Contract"),
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

		applyContractField(parsed, field, value);
	}

	return parsed;
}

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
			parsed.testCommand = command;
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

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parseContractPathList(raw) {
	return raw
		.split(",")
		.map((part) => parseContractScalar(part.trim()))
		.filter(Boolean);
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
	for (const line of depsSection.split(/\r?\n/)) {
		const bullet = line.match(/^-\s+\*{0,2}([A-Z][A-Z0-9]*-\d+)\*{0,2}/);
		if (bullet) {
			if (!ids.includes(bullet[1])) ids.push(bullet[1]);
			continue;
		}
		const bare = line.match(/^-\s+([A-Z][A-Z0-9]*-\d+)\b/);
		if (bare) {
			if (!ids.includes(bare[1])) ids.push(bare[1]);
			continue;
		}
		const requires = line.match(/\*+Requires:\*+\s*(?:[a-z0-9-]+\/)?([A-Z][A-Z0-9]*-\d+)/i);
		if (requires && !ids.includes(requires[1])) ids.push(requires[1]);
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
		const match = line.match(/^-\s+`([^`]+)`/);
		if (match) paths.push(match[1]);
	}
	return paths;
}

function lineNumberAt(text, index) {
	return text.slice(0, index).split(/\r?\n/).length;
}
