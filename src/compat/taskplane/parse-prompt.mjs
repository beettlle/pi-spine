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

	return {
		taskId,
		title,
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

	return { ok: errors.length === 0, errors, prompt };
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
