/**
 * Cursor rules discovery foundation (SP-089).
 * @module config/cursor-rules
 */

export { parseCursorRuleFrontmatter } from "./parse-frontmatter.mjs";
export {
	DEFAULT_RULES_PROFILE,
	RULES_PROFILE_REL_PATH,
	loadRulesProfile,
	mergeRulesProfile,
	validateRulesProfile,
} from "./profile.mjs";
