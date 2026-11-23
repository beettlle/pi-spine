/**
 * Shared Mission issue-link parser (SP-887 / #383, format rules from #147).
 *
 * #147 standard: `Closes #N` (fully resolves) or `Partial #N` (one of several),
 * with or without a trailing colon. SP-889 (board selection) reuses this module —
 * keep it leaf-pure: no fs, no git, no config imports.
 */

/**
 * A keyword run: the link keyword plus every `#N` ref that follows it on the
 * same clause (`Closes #1, #2`). Requires a word boundary so `Encloses` /
 * `Partials` never match, and a following ref so prose (`Closes the gap`)
 * never matches.
 */
const LINK_RUN_RE = /\b(closes|partial)\s*:?\s*#(\d+)(?:[\s,;]+#\d+)*/gi;

/** Individual `#N` refs inside a matched run. */
const ISSUE_REF_RE = /#(\d+)/g;

/**
 * @typedef {object} MissionIssueLinks
 * @property {number[]} closes Issues the task fully resolves (closed on land).
 * @property {number[]} partial Issues the task partially addresses (comment only).
 */

/**
 * @param {string} text Raw text to scan.
 * @param {"closes"|"partial"} action Action keyword of this pass.
 * @returns {number[]} Deduped issue numbers, in first-appearance order.
 */
function collectIssueNumbers(text, action) {
	/** @type {number[]} */
	const found = [];
	/** @type {Set<number>} */
	const seen = new Set();
	LINK_RUN_RE.lastIndex = 0;
	/** @type {RegExpExecArray | null} */
	let run;
	while ((run = LINK_RUN_RE.exec(text)) !== null) {
		if (run[1].toLowerCase() !== action) continue;
		const refs = run[0].match(ISSUE_REF_RE) ?? [];
		for (const ref of refs) {
			const issue = Number(ref.slice(1));
			if (!Number.isInteger(issue) || issue <= 0 || seen.has(issue)) continue;
			seen.add(issue);
			found.push(issue);
		}
	}
	return found;
}

/**
 * Parse Mission issue links (`Closes #N` / `Partial #N`, colon optional,
 * case-insensitive). An issue listed under both keywords resolves to
 * `closes` — the explicit full-resolution intent wins over the partial note.
 *
 * @param {string} missionText Mission section text (any PROMPT.md section text).
 * @returns {MissionIssueLinks} `{ closes, partial }`; empty arrays when no links.
 */
export function parseMissionIssueLinks(missionText) {
	const text = String(missionText ?? "");
	const closes = collectIssueNumbers(text, "closes");
	const partial = collectIssueNumbers(text, "partial").filter((issue) => !closes.includes(issue));
	return { closes, partial };
}

/**
 * Flatten parsed links into per-issue action entries, closes before partial,
 * stable within each action.
 *
 * @param {MissionIssueLinks} links Parsed links from `parseMissionIssueLinks`.
 * @returns {Array<{ issue: number, action: "close"|"comment" }>}
 */
export function issueLinkActions(links) {
	const { closes = [], partial = [] } = links ?? {};
	return [
		...closes.map((issue) => ({ issue, action: /** @type {"close"} */ ("close") })),
		...partial.map((issue) => ({ issue, action: /** @type {"comment"} */ ("comment") })),
	];
}
