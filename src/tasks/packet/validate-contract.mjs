// @ts-nocheck
/**
 * Validate-time checks for PROMPT.md `## Contract` tables (handoff §4.4).
 */

import micromatch from "micromatch";

import { matchesContractPattern } from "../../batch/contract-verify.mjs";
import {
	collectNpmTestDashDashErrors,
	collectTestCommandScopeWarnings,
} from "../validate-contract-warn.mjs";
import { detectCommaInSingleBacktickPathLists } from "./parse-prompt.mjs";

/** Operator-facing hint when must-not-change blocks worker orchestration artifacts. */
export const FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT =
	"Remove spine-tasks paths from fileScopeMustNotChange; workers must update STATUS.md, create .DONE, and may write .reviews/. See skills/create-spine-tasks/references/contract-template.md#filescopemustnotchange-semantics";

const DEFAULT_TASKS_ROOT = "spine-tasks";

/** Probe paths for any task folder orchestration outputs (not the current task id). */
const SPINE_TASKS_ORCHESTRATION_PROBES = [
	`${DEFAULT_TASKS_ROOT}/SP-999-example-slug/STATUS.md`,
	`${DEFAULT_TASKS_ROOT}/SP-999-example-slug/.DONE`,
	`${DEFAULT_TASKS_ROOT}/SP-999-example-slug/.reviews/1.md`,
];

const CURRENT_TASK_ORCHESTRATION_SUFFIXES = ["STATUS.md", ".DONE", ".reviews/1.md"];

const GLOB_PROBE = "__probe__.mjs";

/**
 * Resolve effective contract validation mode (handoff §3.1).
 *
 * @param {{ mode?: string, taskId?: string | null, legacyTaskIdPrefixes?: string[] }} [options]
 * @returns {"required" | "optional" | "legacy"}
 */
export function resolveContractMode(options = {}) {
	const globalMode = options.mode ?? "optional";
	if (globalMode === "legacy") {
		return "legacy";
	}

	const taskId = options.taskId ?? null;
	const legacyPrefixes = options.legacyTaskIdPrefixes ?? [];
	if (taskId && legacyPrefixes.some((prefix) => taskId.startsWith(prefix))) {
		return "legacy";
	}

	return globalMode === "required" ? "required" : "optional";
}

/**
 * @param {ReturnType<import("./parse-prompt.mjs").parseContract>} parsed
 * @param {{ mode?: string, taskId?: string | null, taskSize?: "S"|"M"|"L"|"XL"|null, legacyTaskIdPrefixes?: string[] }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[], mode: "required" | "optional" | "legacy" }}
 */
export function validateContract(parsed, options = {}) {
	const mode = resolveContractMode(options);
	const errors = [...(parsed.errors ?? [])];
	const warnings = [];

	if (mode === "legacy") {
		return { ok: errors.length === 0, errors, warnings, mode };
	}

	if (!parsed.hasSection) {
		if (mode === "required") {
			errors.push("Missing ## Contract section");
		} else if (mode === "optional") {
			warnings.push("Missing ## Contract section");
		}
		return { ok: errors.length === 0, errors, warnings, mode };
	}

	if (!parsed.rawTableValid) {
		return { ok: errors.length === 0, errors, warnings, mode };
	}

	for (const field of parsed.unknownFields ?? []) {
		warnings.push(`Unknown contract field: ${field}`);
	}

	if (isContractTableEmpty(parsed) && mode === "required") {
		errors.push("Contract table is empty");
	}

	for (const placeholderIssue of parsed.placeholderIssues ?? []) {
		if (mode === "required") {
			errors.push(placeholderIssue);
		} else {
			warnings.push(placeholderIssue);
		}
	}

	for (const authoringIssue of detectCommaInSingleBacktickPathLists(parsed.rawFieldValues ?? {}, [
		"fileScopeMustChange",
		"artifactsMustExist",
	])) {
		if (mode === "required") {
			errors.push(authoringIssue);
		} else {
			warnings.push(authoringIssue);
		}
	}

	for (const field of ["fileScopeMustChange", "fileScopeMustNotChange", "artifactsMustExist"]) {
		for (const pattern of parsed[field] ?? []) {
			if (!isValidContractGlob(pattern)) {
				errors.push(`Contract ${field}: invalid glob pattern "${pattern}"`);
			}
		}
	}

	warnings.push(
		...collectFileScopeMustNotChangeWarnings(parsed, {
			taskId: options.taskId ?? null,
			tasksRoot: options.tasksRoot ?? DEFAULT_TASKS_ROOT,
		}),
	);

	if (mode === "required") {
		errors.push(
			...collectNpmTestDashDashErrors(parsed, {
				taskSize: options.taskSize ?? null,
			}),
		);
	}

	warnings.push(
		...collectTestCommandScopeWarnings(parsed, {
			taskSize: options.taskSize ?? null,
			mode,
		}),
	);

	return { ok: errors.length === 0, errors, warnings, mode };
}

/**
 * Warn when fileScopeMustNotChange blocks spine-tasks orchestration artifacts (issue #63).
 *
 * @param {ReturnType<import("./parse-prompt.mjs").parseContract>} parsed
 * @param {{ taskId?: string | null, tasksRoot?: string }} [options]
 * @returns {string[]}
 */
export function collectFileScopeMustNotChangeWarnings(parsed, options = {}) {
	const patterns = parsed?.fileScopeMustNotChange ?? [];
	if (patterns.length === 0) {
		return [];
	}

	const tasksRoot = options.tasksRoot ?? DEFAULT_TASKS_ROOT;
	const taskId = options.taskId ?? null;
	/** @type {string[]} */
	const warnings = [];

	for (const pattern of patterns) {
		const bansSpineTasksRoot = patternBlocksSpineTasksOrchestration(pattern, tasksRoot);
		const bansCurrentTaskFolder =
			!bansSpineTasksRoot && patternBlocksCurrentTaskFolder(pattern, taskId, tasksRoot);

		if (bansSpineTasksRoot) {
			warnings.push(
				`Contract fileScopeMustNotChange: "${pattern}" blocks required worker orchestration artifacts under ${tasksRoot}/. ${FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT}`,
			);
			continue;
		}

		if (bansCurrentTaskFolder) {
			warnings.push(
				`Contract fileScopeMustNotChange: "${pattern}" blocks required worker outputs for this task folder. ${FILE_SCOPE_MUST_NOT_SPINE_TASKS_FIX_HINT}`,
			);
		}
	}

	return warnings;
}

/**
 * @param {string} pattern
 * @param {string} tasksRoot
 */
function patternBlocksSpineTasksOrchestration(pattern, tasksRoot) {
	const probes = SPINE_TASKS_ORCHESTRATION_PROBES.map((probe) =>
		probe.replace(DEFAULT_TASKS_ROOT, tasksRoot),
	);
	return probes.some((probe) => matchesContractPattern(probe, pattern));
}

/**
 * @param {string} pattern
 * @param {string | null} taskId
 * @param {string} tasksRoot
 */
function patternBlocksCurrentTaskFolder(pattern, taskId, tasksRoot) {
	if (!taskId) {
		return false;
	}

	const slugPrefix = `${tasksRoot}/${taskId}-`;
	const exactPrefix = `${tasksRoot}/${taskId}/`;
	if (!pattern.startsWith(slugPrefix) && !pattern.startsWith(exactPrefix)) {
		return false;
	}

	const folderBase = pattern.replace(/\/(\*\*|\*)(\/(\*\*|\*))?$/, "");
	const probes = CURRENT_TASK_ORCHESTRATION_SUFFIXES.map((suffix) => `${folderBase}/${suffix}`);
	return probes.some((probe) => matchesContractPattern(probe, pattern));
}

/**
 * @param {ReturnType<import("./parse-prompt.mjs").parseContract>} parsed
 */
function isContractTableEmpty(parsed) {
	return (
		parsed.testCommand === null &&
		parsed.fileScopeMustChange.length === 0 &&
		parsed.fileScopeMustNotChange.length === 0 &&
		parsed.minLineCoverage === null &&
		parsed.artifactsMustExist.length === 0 &&
		parsed.matrixMaxParallel === null &&
		(parsed.unknownFields?.length ?? 0) === 0
	);
}

/**
 * @param {string} pattern
 * @returns {boolean}
 */
function isValidContractGlob(pattern) {
	const trimmed = String(pattern ?? "").trim();
	if (!trimmed || trimmed.includes("\n")) {
		return false;
	}

	try {
		micromatch.isMatch(GLOB_PROBE, trimmed);
		micromatch.isMatch(trimmed, GLOB_PROBE);
		return true;
	} catch {
		return false;
	}
}
