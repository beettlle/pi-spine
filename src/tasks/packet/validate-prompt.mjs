// @ts-nocheck
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
import { collectExecuteReviewLevelWarnings } from "../validate-contract-warn.mjs";
import { resolveEffectiveReviewer } from "../../config/agent-model-resolve.mjs";
import { isSameModelFamily } from "../../config/model-family.mjs";
import { PROMPT_PROFILE_NAME_RE } from "./parse-prompt.mjs";
import { parseReviewLevel } from "../../batch/review-shared.mjs";

/** Operator-facing hint when fileScopeMustChange may already be satisfied on main. */
export const STALE_FILE_SCOPE_AMENDMENT_HINT =
	"Amend PROMPT.md ## Contract before batch start (e.g. point fileScopeMustChange at delivery artifacts such as STATUS.md, or add an ## Amendments note documenting pre-landed implementation)";

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Per-type reviewer model pin (type-specific wins over top-level; `inherit` is no pin).
 *
 * @param {Record<string, any>} reviewer
 * @param {"plan"|"code"|"final"} reviewType
 * @returns {string|null}
 */
function pickReviewerModel(reviewer, reviewType) {
	for (const candidate of [reviewer[reviewType]?.model, reviewer.model]) {
		if (typeof candidate === "string" && candidate !== "" && candidate !== "inherit") {
			return candidate;
		}
	}
	return null;
}

/**
 * Warnings for per-task agent fields on `**Type:** execute` tasks (no LLM worker/reviewer).
 *
 * @param {ReturnType<typeof validatePromptStructure>["prompt"]} prompt
 * @returns {string[]}
 */
function collectExecuteAgentFieldWarnings(prompt) {
	if (prompt.type !== "execute") return [];
	/** @type {string[]} */
	const warnings = [];
	for (const [label, value] of [
		["Profile", prompt.profile],
		["Thinking", prompt.thinking],
		["Reviewer Profile", prompt.reviewerProfile],
	]) {
		if (value !== null) {
			warnings.push(
				`**${label}:** is ignored on a **Type:** execute task (no LLM worker or reviewer to configure)`,
			);
		}
	}
	return warnings;
}

/**
 * Config-aware checks of `**Profile:**` / `**Reviewer Profile:**` against `agents` (SP-833 / #355).
 * Skipped by callers when no `agents` option is supplied (planner, queue).
 *
 * @param {ReturnType<typeof validatePromptStructure>["prompt"]} prompt
 * @param {Record<string, any>} agents Effective `config.agents`
 * @returns {{ errors: string[], warnings: string[] }}
 */
function collectAgentProfileFindings(prompt, agents) {
	/** @type {string[]} */
	const errors = [];
	/** @type {string[]} */
	const warnings = [];
	if (prompt.type === "execute") return { errors, warnings };
	if (prompt.profile === null && prompt.reviewerProfile === null) return { errors, warnings };

	const profiles = isRecord(agents.profiles) ? agents.profiles : {};
	const definedNames = Object.keys(profiles);
	const known = (name) => PROMPT_PROFILE_NAME_RE.test(name) && Object.hasOwn(profiles, name);
	const hint = definedNames.length > 0 ? ` (defined: ${definedNames.join(", ")})` : " (none defined)";

	const wellFormed = (name) => name === null || PROMPT_PROFILE_NAME_RE.test(name);
	let resolvable = true;
	if (prompt.profile !== null && wellFormed(prompt.profile) && !known(prompt.profile)) {
		errors.push(`**Profile:** "${prompt.profile}" is not defined in agents.profiles${hint}`);
		resolvable = false;
	}
	if (prompt.reviewerProfile !== null && wellFormed(prompt.reviewerProfile)) {
		if (!known(prompt.reviewerProfile)) {
			errors.push(
				`**Reviewer Profile:** "${prompt.reviewerProfile}" is not defined in agents.profiles${hint}`,
			);
			resolvable = false;
		} else if (!isRecord(profiles[prompt.reviewerProfile]?.reviewer)) {
			warnings.push(
				`**Reviewer Profile:** "${prompt.reviewerProfile}" has no reviewer block; it falls back to the next reviewer precedence level`,
			);
		}
	}

	// Malformed names already fail structural validation; unknown names already errored above.
	if (!resolvable || !wellFormed(prompt.profile) || !wellFormed(prompt.reviewerProfile)) {
		return { errors, warnings };
	}

	const workerModel =
		(prompt.profile !== null ? profiles[prompt.profile]?.worker?.model : null) ??
		agents.worker?.model ??
		null;
	/** @type {Array<"plan"|"code"|"final">} */
	const reviewTypes = [];
	/** @type {Set<string>} */
	const models = new Set();
	let subject = "effective reviewer";
	const reviewerBlock =
		prompt.reviewerProfile !== null ? profiles[prompt.reviewerProfile]?.reviewer : null;
	if (prompt.reviewerProfile !== null && isRecord(reviewerBlock)) {
		// The named profile itself must be cross-family; fallback candidates do not rescue it.
		subject = `**Reviewer Profile:** "${prompt.reviewerProfile}"`;
		for (const reviewType of ["plan", "code", "final"]) {
			const model = pickReviewerModel(reviewerBlock, reviewType);
			if (isSameModelFamily(model, workerModel)) {
				reviewTypes.push(reviewType);
				models.add(model);
			}
		}
	} else {
		const resolved = resolveEffectiveReviewer(
			{ agents },
			{
				promptReviewerProfile: prompt.reviewerProfile,
				workerProfile: prompt.profile,
				workerModel,
			},
		);
		for (const entry of resolved.blocked) {
			if (entry.reason === "same_model_family") {
				reviewTypes.push(entry.reviewType);
				models.add(resolved[entry.reviewType].model);
			} else if (entry.reason === "unknown_reviewer_profile") {
				errors.push(
					"Reviewer profile resolution failed: a referenced reviewerProfile is not defined in agents.profiles",
				);
				break;
			}
		}
	}
	if (reviewTypes.length > 0) {
		errors.push(
			`${subject} uses model "${[...models].join(", ")}" in the same model family as the worker model "${workerModel}" (${reviewTypes.join(", ")} review); pick a cross-family reviewer`,
		);
	}
	return { errors, warnings };
}

/**
 * Validate PROMPT.md structure and ## Contract per contract.mode (handoff §3.1, §4.4).
 *
 * @param {string} markdown PROMPT.md contents
 * @param {{ mode?: string, legacyTaskIdPrefixes?: string[], contract?: { mode?: string, legacyTaskIdPrefixes?: string[] }, agents?: Record<string, any> }} [options]
 *   `agents` (effective `config.agents`) enables profile-name and reviewer-family checks (SP-833).
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
		taskSize: structure.prompt.size,
		legacyTaskIdPrefixes,
	});

	errors.push(...contractValidation.errors);

	const warnings = [...contractValidation.warnings];
	warnings.push(
		...collectExecuteReviewLevelWarnings({
			type: structure.prompt.type,
			reviewLevel: parseReviewLevel(markdown),
		}),
	);

	warnings.push(...collectExecuteAgentFieldWarnings(structure.prompt));

	if (isRecord(options.agents)) {
		const findings = collectAgentProfileFindings(structure.prompt, options.agents);
		errors.push(...findings.errors);
		warnings.push(...findings.warnings);
	}

	return {
		ok: errors.length === 0,
		errors,
		warnings,
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
