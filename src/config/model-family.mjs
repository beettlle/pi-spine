/**
 * Model family classification for reviewer/worker independence checks (SP-832 / #355).
 *
 * Families are coarser than providers (`cursor/gemini-3.1-pro` and `google/gemini-2.5-pro`
 * are both "gemini"). Do not reuse `resolvePoolId` from quota-snapshot — that is provider-keyed.
 */

/** @typedef {"gemini"|"claude"|"glm"|"kimi"|"gpt"|"qwen"|"unknown"} ModelFamily */

/** @type {ReadonlyArray<readonly [RegExp, ModelFamily]>} */
const NAME_FAMILY_RULES = Object.freeze([
	[/^gemini/, "gemini"],
	[/^claude/, "claude"],
	[/^glm/, "glm"],
	[/^kimi/, "kimi"],
	[/^k\d/, "kimi"],
	[/^gpt/, "gpt"],
	[/^o\d/, "gpt"],
	[/^qwen/, "qwen"],
]);

/** @type {Readonly<Record<string, ModelFamily>>} */
const PROVIDER_FAMILY = Object.freeze({
	google: "gemini",
	anthropic: "claude",
	zai: "glm",
	"kimi-coding": "kimi",
});

/**
 * @param {unknown} model Model id such as `google/gemini-2.5-pro`, `inherit`, or null.
 * @returns {ModelFamily}
 */
export function resolveModelFamily(model) {
	if (typeof model !== "string") return "unknown";
	const normalized = model.trim().toLowerCase();
	if (normalized === "") return "unknown";

	const slash = normalized.indexOf("/");
	const provider = slash === -1 ? "" : normalized.slice(0, slash);
	const name = normalized.slice(normalized.lastIndexOf("/") + 1);

	for (const [pattern, family] of NAME_FAMILY_RULES) {
		if (pattern.test(name)) return family;
	}
	return PROVIDER_FAMILY[provider] ?? "unknown";
}

/**
 * True only when both models resolve to the same known family.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function isSameModelFamily(a, b) {
	const familyA = resolveModelFamily(a);
	if (familyA === "unknown") return false;
	return familyA === resolveModelFamily(b);
}
