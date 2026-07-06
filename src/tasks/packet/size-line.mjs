/** Shared `**Size:**` line parser for PROMPT.md task packets. */

export const SIZE_LINE_RE = /^\*\*Size:\*\*\s*(S|M|L|XL)\s*$/im;

/**
 * @param {string} markdown
 * @returns {"S"|"M"|"L"|"XL"|null}
 */
export function parseSizeLineFromMarkdown(markdown) {
	const match = SIZE_LINE_RE.exec(markdown);
	return match ? /** @type {"S"|"M"|"L"|"XL"} */ (match[1].toUpperCase()) : null;
}
