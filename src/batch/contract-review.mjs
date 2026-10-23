/**
 * Contract reviewCommand step (SP-845).
 *
 * Runs once after testCommand passes, with its own timeout
 * (`contract.reviewTimeoutMs`) and an explicit policy (`contract.reviewPolicy`
 * = `blocking` | `advisory`). No retries: reviewers resume their own session,
 * so a re-run would re-review rather than resume.
 *
 * Blocking: a non-zero exit or a timeout fails the contract with a
 * `reviewCommand` check. Advisory: the check passes, but the engine journals
 * `contract.review_advisory` and appends a row to the task STATUS.md
 * Discoveries table so the failure stays visible.
 */

import fs from "node:fs";
import path from "node:path";

import { CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS } from "../config/contract.mjs";
import { findContractCommandMetacharIssue } from "../tasks/packet/parse-prompt.mjs";
import { appendJournalEvent } from "./journal.mjs";
import { buildContractTestEnv, runShellCommandAsync } from "./contract-spawn.mjs";

/** Default stdout/stderr capture limit for contract reviewCommand (mirrors #86). */
export const CONTRACT_REVIEW_COMMAND_MAX_BUFFER = 10 * 1024 * 1024;

/** Policy applied when `contract.reviewPolicy` is unset — reviews block. */
export const CONTRACT_REVIEW_POLICY_DEFAULT = "blocking";

/**
 * @typedef {Object} ContractReviewCommandResult
 * @property {boolean} ok
 * @property {number} exitCode
 * @property {string} output
 * @property {boolean} [timedOut]
 * @property {boolean} [bufferOverflow]
 * @property {boolean} [refusedBeforeSpawn]
 * @property {string} [summary]
 */

/**
 * @param {number} timeoutMs
 * @returns {string} e.g. "20 min" / "0.5 min", matching runContractTestCommand labels.
 */
export function formatReviewTimeoutLabel(timeoutMs) {
	return `${(timeoutMs / 60000).toFixed(2).replace(/\.?0+$/, "")} min`;
}

/**
 * Shared pre-spawn refusal envelope, mirroring contract-exec's shape.
 *
 * @param {string} summary
 */
function refusedBeforeSpawnResult(summary) {
	return { ok: false, exitCode: 1, output: summary, summary, refusedBeforeSpawn: true };
}

/**
 * Run the contract reviewCommand once.
 *
 * Mirrors runContractTestCommand's shell semantics ($SHELL, capped capture,
 * tree-kill on timeout) minus the npm-scope guard and retries — reviewCommand
 * never retries. "true" and empty commands pass without spawning, like
 * testCommand.
 *
 * @param {string} worktreePath
 * @param {string} command
 * @param {{ timeoutMs?: number, maxBuffer?: number }} [options]
 * @returns {Promise<ContractReviewCommandResult>}
 */
export async function runContractReviewCommand(worktreePath, command, options = {}) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed || trimmed === "true") {
		return { ok: true, exitCode: 0, output: "" };
	}

	// Defense in depth: parse-prompt already rejects these at packet parse
	// time; matrix-row substitution can still inject them afterwards (SP-781).
	if (trimmed.includes("\n")) {
		return refusedBeforeSpawnResult("Contract reviewCommand must not contain newlines");
	}
	const metacharIssue = findContractCommandMetacharIssue(trimmed);
	if (metacharIssue) {
		return refusedBeforeSpawnResult(
			`Contract reviewCommand refused before spawn: ${metacharIssue} (command: ${trimmed}). reviewCommand runs through a shell; remove $, backticks, ;, |, || or lone & — && chains are allowed (#268).`,
		);
	}

	const timeoutMs = options.timeoutMs ?? CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS;
	const maxBuffer = options.maxBuffer ?? CONTRACT_REVIEW_COMMAND_MAX_BUFFER;
	const result = await runShellCommandAsync(worktreePath, trimmed, {
		env: buildContractTestEnv(),
		timeoutMs,
		maxBuffer,
	});

	const output = `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}`;

	if (result.timedOut) {
		return {
			ok: false,
			exitCode: Number(result.exitCode ?? 1),
			output,
			timedOut: true,
			summary: `reviewCommand timed out after ${formatReviewTimeoutLabel(timeoutMs)} and was terminated`,
		};
	}

	if (result.truncated) {
		return {
			ok: false,
			exitCode: Number(result.exitCode ?? 255),
			output,
			bufferOverflow: true,
			summary: `reviewCommand output exceeded maxBuffer (${maxBuffer} bytes); use a scoped reviewCommand instead. Command: ${trimmed}`,
		};
	}

	const exitCode = Number(result.exitCode ?? 1);
	if (exitCode === 0) {
		return { ok: true, exitCode: 0, output };
	}

	const detail = [
		String(result.stdout ?? "").trim(),
		String(result.stderr ?? "").trim(),
	]
		.filter(Boolean)
		.join("\n")
		.slice(0, 500);
	return {
		ok: false,
		exitCode,
		output,
		summary: `reviewCommand failed (exit ${exitCode})${detail ? `: ${detail}` : ""}`,
	};
}

/**
 * Resolve review step options from spine config (SP-845): the review timeout
 * defaults to 20 minutes and is independent of `contract.testTimeoutMs`; the
 * policy defaults to blocking.
 *
 * @param {{ contract?: { reviewTimeoutMs?: number, reviewPolicy?: string } }} [config]
 * @returns {{ timeoutMs: number, policy: "blocking" | "advisory" }}
 */
export function resolveContractReviewOptions(config = {}) {
	return {
		timeoutMs: config?.contract?.reviewTimeoutMs ?? CONTRACT_REVIEW_TIMEOUT_DEFAULT_MS,
		policy:
			config?.contract?.reviewPolicy === "advisory"
				? "advisory"
				: CONTRACT_REVIEW_POLICY_DEFAULT,
	};
}

/**
 * Run the contract review step and build the `reviewCommand` check.
 *
 * @param {string} worktreePath
 * @param {{ reviewCommand?: string | null }} parsedContract
 * @param {{ contract?: { reviewTimeoutMs?: number, reviewPolicy?: string, testRetries?: number, testTimeoutMs?: number }, contractTestMaxBuffer?: number, projectRoot?: string, batchId?: string, taskId?: string, taskFolder?: string }} [config]
 *   verifyContract config — reads `contract.reviewTimeoutMs`,
 *   `contract.reviewPolicy`, `contractTestMaxBuffer`, plus projectRoot/batchId/
 *   taskId/taskFolder for advisory journaling.
 * @returns {Promise<{ field: "reviewCommand", ok: boolean, message: string } | null>}
 *   null when the contract has no reviewCommand.
 */
export async function runContractReviewStep(worktreePath, parsedContract, config = {}) {
	const command = parsedContract?.reviewCommand;
	if (!command) return null;

	const { timeoutMs, policy } = resolveContractReviewOptions(config);
	const result = await runContractReviewCommand(worktreePath, command, {
		timeoutMs,
		maxBuffer: config?.contractTestMaxBuffer,
	});

	if (result.ok) {
		return { field: "reviewCommand", ok: true, message: "reviewCommand passed" };
	}

	const detail = result.summary ?? `reviewCommand failed (exit ${result.exitCode})`;
	if (policy === "advisory") {
		recordReviewAdvisory(config, {
			exitCode: result.exitCode,
			timedOut: result.timedOut === true,
			summary: detail,
		});
		return {
			field: "reviewCommand",
			ok: true,
			message: `Contract reviewCommand failed (advisory, not blocking): ${detail}`,
		};
	}

	return { field: "reviewCommand", ok: false, message: `Contract reviewCommand failed: ${detail}` };
}

/**
 * Advisory review failures never block, but they must stay visible: journal a
 * `contract.review_advisory` event and append a row to the task STATUS.md
 * Discoveries table.
 *
 * @param {{ contract?: { reviewTimeoutMs?: number, reviewPolicy?: string }, contractTestMaxBuffer?: number, projectRoot?: string, batchId?: string, taskId?: string, taskFolder?: string }} config
 * @param {{ exitCode: number, timedOut: boolean, summary: string }} payload
 */
function recordReviewAdvisory(config, payload) {
	if (config?.projectRoot && config?.batchId) {
		appendJournalEvent(config.projectRoot, config.batchId, "contract.review_advisory", {
			taskId: config?.taskId,
			exitCode: payload.exitCode,
			timedOut: payload.timedOut,
			summary: String(payload.summary ?? "").slice(0, 200),
		});
	}
	appendReviewAdvisoryDiscovery(config?.taskFolder, payload.summary);
}

/**
 * Append one row to the task STATUS.md Discoveries table (SP-845 advisory).
 * Best-effort: skips silently when the task folder or Discoveries table is
 * missing; never throws into contract verification.
 *
 * @param {string | undefined} taskFolder
 * @param {string | undefined} summary
 * @returns {boolean} true when a row was appended
 */
export function appendReviewAdvisoryDiscovery(taskFolder, summary) {
	if (!taskFolder) return false;
	const statusPath = path.join(taskFolder, "STATUS.md");
	let content;
	try {
		content = fs.readFileSync(statusPath, "utf-8");
	} catch {
		return false;
	}
	const lines = content.split("\n");
	const headingIndex = lines.findIndex((line) => line.trim() === "## Discoveries");
	if (headingIndex === -1) return false;

	const cell = String(summary ?? "reviewCommand failed (advisory)")
		.replace(/\|/g, "\\|")
		.replace(/\r?\n/g, " ")
		.slice(0, 160);
	const row = `| ${cell} | advisory — noted, not blocking | contract review step |`;

	// Insert after the Discoveries table's header separator so newest-first
	// ordering matches the template; fall back to directly under the heading.
	let insertAt = headingIndex + 1;
	for (let index = headingIndex + 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.startsWith("## ")) break;
		if (/^\|[\s|-]+$/.test(line)) {
			insertAt = index + 1;
			break;
		}
	}

	lines.splice(insertAt, 0, row);
	try {
		fs.writeFileSync(statusPath, lines.join("\n"), "utf-8");
	} catch {
		return false;
	}
	return true;
}
