/**
 * Agent model/thinking pin resolution for reviewer spawns (issue #53 / SP-369).
 */

/**
 * @param {object} config
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null} Pin value or null to omit `--model`
 */
export function resolveReviewerModelPin(config, reviewType) {
	const reviewer = config?.agents?.reviewer;
	if (!reviewer) return null;

	const typePin = reviewer[reviewType]?.model;
	if (typeof typePin === "string" && typePin.length > 0 && typePin !== "inherit") {
		return typePin;
	}

	const topPin = reviewer.model;
	if (typeof topPin === "string" && topPin.length > 0 && topPin !== "inherit") {
		return topPin;
	}

	return null;
}

/**
 * @param {object} config
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null} Pin value or null to omit `--thinking`
 */
export function resolveReviewerThinkingPin(config, reviewType) {
	const reviewer = config?.agents?.reviewer;
	if (!reviewer) return null;

	const typePin = reviewer[reviewType]?.thinking;
	if (typeof typePin === "string" && typePin.length > 0) {
		if (typePin === "off") return null;
		if (typePin !== "inherit") return typePin;
	}

	const topPin = reviewer.thinking;
	if (typeof topPin === "string" && topPin.length > 0 && topPin !== "inherit" && topPin !== "off") {
		return topPin;
	}

	return null;
}
