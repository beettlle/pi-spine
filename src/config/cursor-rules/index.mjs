/**
 * Cursor rules discovery (SP-089 parser/profile, SP-090 manifest).
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
export {
	buildCursorRuleManifestEntry,
	classifyCursorRuleSpineClass,
	CURSOR_RULES_ROOT_REL,
	DISCOVER_MAX_FILE_BYTES,
	DISCOVER_MAX_FILES,
	discoverCursorRules,
	getCursorRuleExclusionReason,
	loadRulesManifest,
	RULES_MANIFEST_REL_PATH,
	writeRulesManifestAtomic,
} from "./discover.mjs";
