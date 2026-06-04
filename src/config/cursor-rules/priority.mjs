/**
 * Stable ordering for worker rule selection (SP-091).
 */

/** @typedef {'alwaysInclude' | 'always' | 'glob' | 'standards'} RuleSelectionSource */

/**
 * Lower rank sorts earlier in the injected path list.
 *
 * @param {RuleSelectionSource} source
 * @returns {number}
 */
export function priorityRank(source) {
	switch (source) {
		case "alwaysInclude":
			return 0;
		case "always":
			return 1;
		case "glob":
			return 2;
		case "standards":
			return 3;
		default:
			return 9;
	}
}
