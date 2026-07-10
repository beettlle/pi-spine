// @ts-nocheck
/**
 * Contract field parsing, changed-file listing, and file-scope matchers (SP-585).
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import micromatch from "micromatch";
import { resolveContractMode } from "../tasks/packet/validate-contract.mjs";
import {
	isBaseScopeSatisfied,
	isStubPrelandedFileScopeSatisfied,
} from "./contract-prelanded.mjs";

/**
 * @param {string} taskId
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} [config]
 */
export function shouldRunContractVerify(taskId, parsedContract, config = {}) {
	const mode = resolveContractMode({
		mode: config.contract?.mode,
		taskId,
		legacyTaskIdPrefixes: config.contract?.legacyTaskIdPrefixes,
	});
	if (mode === "legacy") return false;
	if (!parsedContract?.hasSection) return false;

	return Boolean(
		parsedContract.testCommand ||
			(parsedContract.fileScopeMustChange?.length ?? 0) > 0 ||
			(parsedContract.fileScopeMustNotChange?.length ?? 0) > 0 ||
			parsedContract.minLineCoverage != null ||
			(parsedContract.artifactsMustExist?.length ?? 0) > 0,
	);
}

/**
 * Exit-verification tasks (§8 phase exit) must not stub-complete without contract pass.
 *
 * @param {string} promptMarkdown
 */
export function isExitVerificationTask(promptMarkdown) {
	const text = String(promptMarkdown ?? "");
	if (/^#\s*Task:.*exit verification/im.test(text)) {
		return true;
	}
	if (/^##\s*Exit verification/im.test(text)) {
		return true;
	}
	if (/Phase\s+\d+\s+exit verification/i.test(text)) {
		return true;
	}
	return false;
}

/**
 * @param {string} promptMarkdown
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} [config]
 */
export function shouldRunContractVerifyForWorker(promptMarkdown, parsedContract, config = {}) {
	if (!shouldRunContractVerify(null, parsedContract, config)) {
		return false;
	}
	const stubMode =
		process.env.SPINE_WORKER_STUB === "1" || process.env.SPINE_WORKER_STUB === "true";
	if (!stubMode) {
		return true;
	}
	return isExitVerificationTask(promptMarkdown);
}

/**
 * @returns {boolean}
 */
export function isStubWorkerMode() {
	return process.env.SPINE_WORKER_STUB === "1" || process.env.SPINE_WORKER_STUB === "true";
}

/**
 * Legacy stub workers write "Task: stub" in `.DONE` body.
 *
 * @param {string} doneContent
 */
export function isLegacyStubDoneMarker(doneContent) {
	return /Task:\s*stub/i.test(String(doneContent ?? ""));
}

/**
 * @param {string} donePath
 */
export function isLegacyStubDoneFile(donePath) {
	if (!fs.existsSync(donePath)) {
		return false;
	}
	return isLegacyStubDoneMarker(fs.readFileSync(donePath, "utf-8"));
}

/**
 * Lane commit enforces `fileScopeMustChange` when stub mode is active or `.DONE` is legacy stub.
 *
 * @param {string} donePath
 */
export function shouldEnforceStubContractAtLaneCommit(donePath) {
	if (isStubWorkerMode()) {
		return true;
	}
	return isLegacyStubDoneFile(donePath);
}

/**
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 */
export function hasReleaseCriticalContract(parsedContract) {
	return (parsedContract?.fileScopeMustChange?.length ?? 0) > 0;
}

/**
 * @param {string} worktreePath
 */
function listUntrackedFiles(worktreePath) {
	try {
		const output = execFileSync("git", ["ls-files", "-o", "--exclude-standard"], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		});
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * @param {string} worktreePath
 * @param {string} baseBranch
 * @param {string[]} [pendingPaths]
 */
export function listEffectiveChangedFiles(worktreePath, baseBranch = "main", pendingPaths = []) {
	return [
		...new Set([
			...listChangedFiles(worktreePath, baseBranch),
			...pendingPaths,
			...listUntrackedFiles(worktreePath),
		]),
	];
}

/**
 * @param {string} worktreePath
 * @param {string} [baseBranch]
 * @param {string} [sinceCommit] When set, diff `sinceCommit..HEAD` instead of `baseBranch...HEAD`.
 */
export function listChangedFiles(worktreePath, baseBranch = "main", sinceCommit = undefined) {
	const scopedSince = String(sinceCommit ?? "").trim();
	const diffRange =
		scopedSince.length > 0 ? `${scopedSince}..HEAD` : `${baseBranch}...HEAD`;

	try {
		const output = execFileSync("git", ["diff", "--name-only", diffRange], {
			cwd: worktreePath,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		});
		return output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	} catch {
		if (scopedSince.length > 0) {
			return [];
		}
		try {
			const output = execFileSync("git", ["diff", "--name-only", "HEAD"], {
				cwd: worktreePath,
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				timeout: 30_000,
			});
			return output
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean);
		} catch {
			return [];
		}
	}
}

/**
 * @param {string} file
 * @param {string} pattern
 */
export function matchesContractPattern(file, pattern) {
	return micromatch.isMatch(file, pattern, { dot: true });
}

/**
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {string} [baseBranch]
 * @param {string[]} [pendingPaths] Uncommitted paths about to be lane-committed
 * @param {object} [config]
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function verifyStubFileScopeMustChange(
	worktreePath,
	parsedContract,
	baseBranch = "main",
	pendingPaths = [],
	config = {},
) {
	const patterns = parsedContract?.fileScopeMustChange ?? [];
	if (patterns.length === 0) {
		return { ok: true, failures: [] };
	}

	const changedFiles = listEffectiveChangedFiles(worktreePath, baseBranch, pendingPaths);
	/** @type {string[]} */
	const failures = [];
	for (const pattern of patterns) {
		const matched = changedFiles.some((file) =>
			pattern.endsWith("/") ? file.startsWith(pattern) : matchesContractPattern(file, pattern),
		);
		if (matched) {
			continue;
		}
		if (isStubPrelandedFileScopeSatisfied(worktreePath, pattern, changedFiles, config, baseBranch)) {
			continue;
		}
		if (isBaseScopeSatisfied(worktreePath, pattern, changedFiles, baseBranch, config)) {
			continue;
		}
		failures.push(`Contract fileScopeMustChange: no matching changes for ${pattern}`);
	}
	return { ok: failures.length === 0, failures };
}
