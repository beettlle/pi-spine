/**
 * Shared fail-loud PROMPT validation helpers (planner, preflight, rules CLI, batch engine).
 */

import { execFileSync } from "node:child_process";

import { matchesContractPattern } from "../../batch/contract-verify.mjs";
import { CONTRACT_DEFAULTS } from "../../config/defaults.mjs";
import {
	parseContract,
	validatePrompt as validatePromptStructure,
} from "./parse-prompt.mjs";
import { validateContract } from "./validate-contract.mjs";

/** Operator-facing hint when fileScopeMustChange may already be satisfied on main. */
export const STALE_FILE_SCOPE_AMENDMENT_HINT =
	"Amend PROMPT.md ## Contract before batch start (e.g. point fileScopeMustChange at delivery artifacts such as STATUS.md, or add an ## Amendments note documenting pre-landed implementation)";

/**
 * Validate PROMPT.md structure and ## Contract per contract.mode (handoff §3.1, §4.4).
 *
 * @param {string} markdown PROMPT.md contents
 * @param {{ mode?: string, legacyTaskIdPrefixes?: string[], contract?: { mode?: string, legacyTaskIdPrefixes?: string[] } }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[], prompt: ReturnType<typeof parsePrompt>, contract: ReturnType<typeof parseContract> }}
 */
export function validatePrompt(markdown, options = {}) {
	const structure = validatePromptStructure(markdown);
	const errors = [...structure.errors];
	const mode =
		options.mode ??
		options.contract?.mode ??
		"optional";
	const legacyTaskIdPrefixes =
		options.legacyTaskIdPrefixes ??
		options.contract?.legacyTaskIdPrefixes ??
		[...CONTRACT_DEFAULTS.legacyTaskIdPrefixes];

	const contract = parseContract(markdown);
	const contractValidation = validateContract(contract, {
		mode,
		taskId: structure.prompt.taskId,
		legacyTaskIdPrefixes,
	});

	errors.push(...contractValidation.errors);

	return {
		ok: errors.length === 0,
		errors,
		warnings: contractValidation.warnings,
		prompt: structure.prompt,
		contract,
	};
}

/**
 * @param {{ validation?: { ok?: boolean, errors?: string[] }, promptPath?: string }} packet
 * @param {string} taskId
 * @returns {{ taskId: string, promptPath?: string, errors: string[] } | null}
 */
export function collectPromptValidationFailure(packet, taskId) {
	if (packet.validation?.ok) return null;
	return {
		taskId,
		promptPath: packet.promptPath,
		errors: packet.validation?.errors ?? ["Unknown PROMPT validation failure"],
	};
}

/**
 * @param {Array<{ taskId: string, promptPath?: string, errors: string[] }>} failures
 */
export function formatPromptValidationFailures(failures) {
	if (failures.length === 0) return "PROMPT validation failed";
	if (failures.length === 1) {
		const [failure] = failures;
		const location = failure.promptPath ? ` (${failure.promptPath})` : "";
		return `Invalid PROMPT for ${failure.taskId}${location}:\n${formatErrorLines(failure.errors)}`;
	}

	const lines = [`PROMPT validation failed for ${failures.length} task(s):`];
	for (const failure of failures) {
		const location = failure.promptPath ? ` (${failure.promptPath})` : "";
		lines.push(`${failure.taskId}${location}:`);
		lines.push(formatErrorLines(failure.errors));
	}
	return lines.join("\n");
}

/**
 * @param {{ validation?: { ok?: boolean, errors?: string[] }, promptPath?: string }} packet
 * @param {string} taskId
 */
export function assertValidTaskPacket(packet, taskId) {
	const failure = collectPromptValidationFailure(packet, taskId);
	if (!failure) return;
	throw new Error(formatPromptValidationFailures([failure]));
}

/**
 * @param {string[]} errors
 */
function formatErrorLines(errors) {
	return errors.map((error) => `  - ${error}`).join("\n");
}

/**
 * @param {string} projectRoot
 * @param {string} relPath
 */
function gitFirstCommitTouchingPath(projectRoot, relPath) {
	try {
		const output = execFileSync("git", ["log", "--reverse", "--format=%H", "--", relPath], {
			cwd: projectRoot,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		}).trim();
		return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
	} catch {
		return null;
	}
}

/**
 * @param {string} projectRoot
 * @param {string} [baseRef]
 */
function resolveComparisonBaseRef(projectRoot, baseRef = "main") {
	try {
		execFileSync("git", ["rev-parse", "--verify", baseRef], {
			cwd: projectRoot,
			stdio: "ignore",
			timeout: 5000,
		});
		return baseRef;
	} catch {
		return "HEAD";
	}
}

/**
 * @param {string} projectRoot
 * @param {string} sinceCommit
 * @param {string} baseRef
 * @param {string} pattern
 */
function listPathsChangedSinceCommit(projectRoot, sinceCommit, baseRef, pattern) {
	try {
		const output = execFileSync(
			"git",
			["diff", "--name-only", `${sinceCommit}..${baseRef}`, "--", pattern],
			{
				cwd: projectRoot,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 10_000,
			},
		);
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Warn when fileScopeMustChange paths were already modified on main after the task PROMPT was introduced.
 *
 * @param {string} projectRoot
 * @param {ReturnType<typeof parseContract>} parsedContract
 * @param {string} promptRelPath Path to PROMPT.md relative to projectRoot
 * @param {{ baseRef?: string }} [options]
 * @returns {string[]}
 */
export function collectStaleFileScopeMustChangeWarnings(
	projectRoot,
	parsedContract,
	promptRelPath,
	options = {},
) {
	const patterns = parsedContract?.fileScopeMustChange ?? [];
	if (patterns.length === 0) {
		return [];
	}

	const introCommit = gitFirstCommitTouchingPath(projectRoot, promptRelPath);
	if (!introCommit) {
		return [];
	}

	const baseRef = resolveComparisonBaseRef(projectRoot, options.baseRef ?? "main");
	/** @type {string[]} */
	const stalePatterns = [];

	for (const pattern of patterns) {
		const changedPaths = listPathsChangedSinceCommit(
			projectRoot,
			introCommit,
			baseRef,
			pattern,
		);
		const matching = changedPaths.filter((filePath) =>
			matchesContractPattern(filePath, pattern),
		);
		if (matching.length > 0) {
			stalePatterns.push(pattern);
		}
	}

	if (stalePatterns.length === 0) {
		return [];
	}

	const preview = stalePatterns.slice(0, 5).join(", ");
	const suffix = stalePatterns.length > 5 ? ` (+${stalePatterns.length - 5} more)` : "";
	return [
		`Contract fileScopeMustChange path(s) (${preview}${suffix}) already changed on ${baseRef} since task was added — implementation may be pre-landed and will not diff in a new lane. ${STALE_FILE_SCOPE_AMENDMENT_HINT}`,
	];
}
