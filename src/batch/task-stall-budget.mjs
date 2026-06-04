/**
 * Per-task stall timeout budget from PROMPT Size (SP-088).
 */

import fs from "node:fs";
import path from "node:path";
import { resolveStallConfig } from "./heartbeat.mjs";

const SIZE_LINE_RE = /^\*\*Size:\*\*\s*(S|M|L|XL)\s*$/im;

/** Minimum stall timeout minutes by packet size (floor for real pi work). */
export const STALL_MINUTES_BY_SIZE = Object.freeze({
	S: 90,
	M: 180,
	L: 300,
});

/**
 * @param {string} markdown
 * @returns {"S"|"M"|"L"|"XL"|null}
 */
export function parseTaskSizeFromMarkdown(markdown) {
	const match = SIZE_LINE_RE.exec(markdown);
	return match ? /** @type {"S"|"M"|"L"|"XL"} */ (match[1].toUpperCase()) : null;
}

/**
 * @param {string} taskFolder
 * @returns {"S"|"M"|"L"|"XL"|null}
 */
export function parseTaskSizeFromFolder(taskFolder) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	if (!fs.existsSync(promptPath)) return null;
	return parseTaskSizeFromMarkdown(fs.readFileSync(promptPath, "utf-8"));
}

/**
 * @param {"S"|"M"|"L"|"XL"|null} size
 * @param {object} [config]
 */
export function resolveTaskStallMinutes(size, config = {}) {
	const configured = Number(config.lanes?.stallTimeoutMinutes);
	const configMinutes = Number.isFinite(configured) && configured > 0 ? configured : 60;
	const sizeMinutes =
		size && size in STALL_MINUTES_BY_SIZE
			? STALL_MINUTES_BY_SIZE[/** @type {keyof typeof STALL_MINUTES_BY_SIZE} */ (size)]
			: null;
	return sizeMinutes ? Math.max(configMinutes, sizeMinutes) : configMinutes;
}

/**
 * @param {object} params
 * @param {object} [params.config]
 * @param {string|null} [params.taskSize]
 */
export function resolveStallConfigForTask({ config = {}, taskSize = null }) {
	const stallTimeoutMinutes = resolveTaskStallMinutes(taskSize, config);
	return resolveStallConfig({
		...config,
		lanes: {
			...(config.lanes ?? {}),
			stallTimeoutMinutes,
		},
	});
}
