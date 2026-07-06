// @ts-nocheck
/**
 * Minimal YAML frontmatter parser for `.cursor/rules/*.{mdc,md}`.
 */

const FRONTMATTER_OPEN_RE = /^---\r?\n/;
const KEY_VALUE_RE = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;

/**
 * @typedef {"ok" | "skip" | "warn"} CursorRuleParseStatus
 */

/**
 * @typedef {object} CursorRuleFrontmatterResult
 * @property {CursorRuleParseStatus} parseStatus
 * @property {string} relPath Path relative to `.cursor/rules/` (posix)
 * @property {boolean} alwaysApply
 * @property {string|null} description
 * @property {string[]} globs Normalized glob patterns (empty when absent or `[]`)
 * @property {string[]} warnings Non-fatal parse issues
 */

/**
 * @param {string} content Full file contents
 * @param {string} relPath Path relative to `.cursor/rules/` (posix)
 * @returns {CursorRuleFrontmatterResult}
 */
export function parseCursorRuleFrontmatter(content, relPath) {
	const normalizedRel = relPath.replace(/\\/g, "/");
	if (!FRONTMATTER_OPEN_RE.test(content)) {
		return emptyResult(normalizedRel, "skip");
	}

	const bodyStart = content.indexOf("\n---");
	if (bodyStart === -1) {
		return {
			...emptyResult(normalizedRel, "warn"),
			warnings: ["unclosed frontmatter fence"],
		};
	}

	const fenceEnd = bodyStart + 1;
	const rawBlock = content.slice(content.match(FRONTMATTER_OPEN_RE)[0].length, fenceEnd);
	const parsed = parseFrontmatterBlock(rawBlock);
	const warnings = [...parsed.warnings];

	if (parsed.unrecognizedKeys.length > 0) {
		warnings.push(`unrecognized frontmatter keys: ${parsed.unrecognizedKeys.join(", ")}`);
	}

	const parseStatus = warnings.length > 0 ? "warn" : "ok";

	return {
		parseStatus,
		relPath: normalizedRel,
		alwaysApply: parsed.alwaysApply,
		description: parsed.description,
		globs: parsed.globs,
		warnings,
	};
}

/**
 * @param {string} relPath
 * @param {CursorRuleParseStatus} parseStatus
 * @returns {CursorRuleFrontmatterResult}
 */
function emptyResult(relPath, parseStatus) {
	return {
		parseStatus,
		relPath,
		alwaysApply: false,
		description: null,
		globs: [],
		warnings: [],
	};
}

/**
 * @param {string} block
 */
function parseFrontmatterBlock(block) {
	/** @type {string[]} */
	const warnings = [];
	/** @type {string[]} */
	const unrecognizedKeys = [];
	let alwaysApply = false;
	/** @type {string|null} */
	let description = null;
	/** @type {string[]} */
	let globs = [];
	let sawGlobs = false;

	for (const line of block.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) {
			continue;
		}

		const match = KEY_VALUE_RE.exec(trimmed);
		if (!match) {
			warnings.push(`ignored non key-value line: ${trimmed}`);
			continue;
		}

		const key = match[1];
		const rawValue = match[2].trim();

		if (key === "alwaysApply") {
			const coerced = coerceBoolean(rawValue);
			if (coerced === null) {
				warnings.push(`invalid alwaysApply value: ${rawValue}`);
			} else {
				alwaysApply = coerced;
			}
			continue;
		}

		if (key === "description") {
			description = parseYamlString(rawValue);
			continue;
		}

		if (key === "globs") {
			sawGlobs = true;
			const parsedGlobs = parseGlobsValue(rawValue);
			globs = parsedGlobs.globs;
			if (parsedGlobs.warning) {
				warnings.push(parsedGlobs.warning);
			}
			continue;
		}

		unrecognizedKeys.push(key);
	}

	if (!sawGlobs) {
		globs = [];
	}

	return {
		alwaysApply,
		description,
		globs,
		warnings,
		unrecognizedKeys,
	};
}

/**
 * @param {string} raw
 * @returns {boolean|null}
 */
function coerceBoolean(raw) {
	const normalized = raw.trim().toLowerCase();
	if (normalized === "true" || normalized === "yes" || normalized === "1") {
		return true;
	}
	if (normalized === "false" || normalized === "no" || normalized === "0" || normalized === "") {
		return false;
	}
	return null;
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
function parseYamlString(raw) {
	const trimmed = raw.trim();
	if (trimmed === "" || trimmed === '""' || trimmed === "''") {
		return "";
	}
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

/**
 * @param {string} raw
 * @returns {{ globs: string[], warning?: string }}
 */
function parseGlobsValue(raw) {
	const trimmed = raw.trim();
	if (trimmed === "[]") {
		return { globs: [] };
	}

	if (trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (!Array.isArray(parsed)) {
				return { globs: [], warning: `globs must be an array: ${trimmed}` };
			}
			const globs = [];
			for (const entry of parsed) {
				if (typeof entry !== "string" || !entry.trim()) {
					return { globs: [], warning: `globs array entries must be non-empty strings` };
				}
				globs.push(entry.trim());
			}
			return { globs };
		} catch {
			return { globs: [], warning: `cannot parse globs array: ${trimmed}` };
		}
	}

	const unquoted = parseYamlString(trimmed) ?? "";
	if (unquoted === "") {
		return { globs: [] };
	}

	return {
		globs: unquoted
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean),
	};
}
