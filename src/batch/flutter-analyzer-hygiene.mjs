/**
 * Flutter analyzer / build hygiene for lane worktrees (#78).
 * Extracted from lane-dirty-check.mjs so that module stays under the LOC cap.
 */

import fs from "node:fs";
import path from "node:path";

/** Flutter build output dir that can pollute unscoped `flutter analyze` (#78). */
export const FLUTTER_BUILD_DIR = "build";

/**
 * @param {string} segment
 * @returns {boolean}
 */
export function isUnscopedFlutterAnalyzeSegment(segment) {
	const trimmed = String(segment ?? "").trim().toLowerCase();
	if (!/\bflutter\s+analyze\b/.test(trimmed)) {
		return false;
	}

	const match = trimmed.match(/\bflutter\s+analyze\b(.*)$/);
	if (!match) {
		return false;
	}

	const remainder = (match[1] ?? "").trim();
	if (!remainder) {
		return true;
	}

	for (const token of remainder.split(/\s+/)) {
		if (token.startsWith("-")) {
			continue;
		}
		return false;
	}

	return true;
}

/**
 * True when testCommand invokes unscoped `flutter analyze` (whole project tree).
 * Scoped forms like `flutter analyze lib test` are excluded.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isUnscopedFlutterAnalyzeCommand(command) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed) {
		return false;
	}

	const segments = trimmed
		.split(/&&|;/)
		.map((segment) => segment.trim())
		.filter(Boolean);
	return segments.some((segment) => isUnscopedFlutterAnalyzeSegment(segment));
}

/**
 * True when testCommand combines flutter analyze with flutter test.
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isFlutterAnalyzeTestCompoundCommand(command) {
	const trimmed = String(command ?? "").trim().toLowerCase();
	return /\bflutter\s+analyze\b/.test(trimmed) && /\bflutter\s+test\b/.test(trimmed);
}

/**
 * Whether contract verify should remove `build/` before running testCommand.
 *
 * @param {string} testCommand
 * @param {{ contract?: { flutterAnalyzerHygiene?: boolean } }} [config]
 * @returns {boolean}
 */
export function shouldCleanFlutterBuildBeforeAnalyze(testCommand, config = {}) {
	const enabled = config?.contract?.flutterAnalyzerHygiene ?? true;
	if (!enabled) {
		return false;
	}
	return isUnscopedFlutterAnalyzeCommand(testCommand);
}

/**
 * Remove stale Flutter build artifacts so unscoped analyze does not scan SourcePackages (#78).
 *
 * @param {string} worktreePath
 * @param {{ enabled?: boolean }} [options]
 * @returns {{ cleaned: boolean, buildDir?: string, reason?: string }}
 */
export function sanitizeFlutterBuildBeforeAnalyze(worktreePath, { enabled = true } = {}) {
	if (!enabled) {
		return { cleaned: false, reason: "disabled" };
	}

	const buildPath = path.join(worktreePath, FLUTTER_BUILD_DIR);
	if (!fs.existsSync(buildPath)) {
		return { cleaned: false, reason: "no_build_dir" };
	}

	fs.rmSync(buildPath, { recursive: true, force: true });
	return { cleaned: true, buildDir: FLUTTER_BUILD_DIR };
}
