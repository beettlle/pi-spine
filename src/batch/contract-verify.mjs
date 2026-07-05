/**
 * Machine contract verification in lane worktree (handoff §4.5, SP-154/SP-155).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import micromatch from "micromatch";
import { parseAggregateLineCoverage } from "../../scripts/coverage-parse.mjs";
import { resolveContractMode } from "../tasks/packet/validate-contract.mjs";
import {
	isBaseFileScopeSatisfied,
	isBaseScopeSatisfied,
	isPrelandedFileScopeSatisfied,
	isStubPrelandedFileScopeSatisfied,
} from "./contract-prelanded.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	sanitizeFlutterBuildBeforeAnalyze,
	shouldCleanFlutterBuildBeforeAnalyze,
} from "./lane-dirty-check.mjs";

export { resolvePromptRelPath, isFileScopePatternPrelanded, hasSpineTaskDeliveryChanges } from "./contract-prelanded.mjs";

/** Default stdout/stderr capture limit for contract testCommand (issue #86). */
export const CONTRACT_TEST_COMMAND_MAX_BUFFER = 10 * 1024 * 1024;

/** Default number of retries for failed testCommand (SP-485, issue #136). */
export const CONTRACT_TEST_DEFAULT_RETRIES = 1;

/** Default delay in ms between testCommand retry attempts. */
export const CONTRACT_TEST_RETRY_DELAY_MS = 5000;

/**
 * Worker-only env keys stripped from contract testCommand subprocesses so full-suite
 * tests match operator re-run outside worker-host (SP-491, issue #155).
 */
export const CONTRACT_TEST_WORKER_ENV_KEYS = ["SPINE_IS_WORKER"];

/**
 * Build env for contract testCommand subprocess — omits worker-only keys inherited from
 * worker-host.mjs that would false-fail batch-spawn integration tests (SP-482 guard).
 * Preserves parent batch id as SPINE_PARENT_BATCH_ID so nested-spawn guard can block
 * live engines in lane worktrees while still allowing isolated fixture tests (#162).
 *
 * @param {NodeJS.ProcessEnv} [sourceEnv]
 * @returns {NodeJS.ProcessEnv}
 */
export function buildContractTestEnv(sourceEnv = process.env) {
	const env = { ...sourceEnv };
	for (const key of CONTRACT_TEST_WORKER_ENV_KEYS) {
		delete env[key];
	}
	if (env.SPINE_BATCH_ID && !env.SPINE_PARENT_BATCH_ID) {
		env.SPINE_PARENT_BATCH_ID = env.SPINE_BATCH_ID;
	}
	delete env.SPINE_BATCH_ID;
	return env;
}

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
 * @param {number} byteCount
 */
function formatMaxBufferLabel(byteCount) {
	const mib = byteCount / (1024 * 1024);
	if (mib >= 1 && Number.isInteger(mib)) {
		return `${mib}MB`;
	}
	if (byteCount >= 1024) {
		return `${Math.round(byteCount / 1024)}KB`;
	}
	return `${byteCount}B`;
}

/**
 * Block the current thread for the given duration without busy-waiting.
 * Safe for CLI/batch tools; not suitable for servers.
 *
 * @param {number} ms
 */
function sleepSync(ms) {
	if (ms <= 0) return;
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Write a failure log for a contract testCommand attempt to the task's .reviews/ directory.
 * Returns the written path, or null if taskFolder is not provided.
 *
 * @param {string | undefined} taskFolder
 * @param {string} command
 * @param {{ exitCode: number, output: string, bufferOverflow?: boolean }} result
 * @param {number} attempt
 * @param {number} totalAttempts
 * @returns {string | null}
 */
export function writeContractFailureLog(taskFolder, command, result, attempt, totalAttempts) {
	if (!taskFolder) return null;
	const reviewsDir = path.join(taskFolder, ".reviews");
	fs.mkdirSync(reviewsDir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const logPath = path.join(reviewsDir, `contract-fail-${ts}.log`);
	const header = [
		"Contract testCommand failure log",
		`Command: ${command}`,
		`Exit code: ${result.exitCode}`,
		`Attempt: ${attempt} of ${totalAttempts}`,
		`Timestamp: ${new Date().toISOString()}`,
		`Buffer overflow: ${result.bufferOverflow ? "yes" : "no"}`,
		"---",
		"",
	].join("\n");
	fs.writeFileSync(logPath, header + (result.output ?? ""), "utf-8");
	return logPath;
}

/**
 * @param {string} worktreePath
 * @param {string} command
 * @param {{ maxBuffer?: number }} [options]
 */
export function runContractTestCommand(worktreePath, command, options = {}) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed || trimmed === "true") {
		return { ok: true, exitCode: 0, output: "" };
	}

	const maxBuffer = options.maxBuffer ?? CONTRACT_TEST_COMMAND_MAX_BUFFER;
	const shell = process.env.SHELL || (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
	const shellFlag = process.platform === "win32" ? "/c" : "-c";
	const result = spawnSync(shell, [shellFlag, trimmed], {
		cwd: worktreePath,
		env: buildContractTestEnv(),
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 10 * 60 * 1000,
		maxBuffer,
	});

	const stdout = String(result.stdout ?? "");
	const stderr = String(result.stderr ?? "");
	const output = `${stdout}\n${stderr}`;

	if (result.error?.code === "ENOBUFS") {
		const limitLabel = formatMaxBufferLabel(maxBuffer);
		return {
			ok: false,
			exitCode: Number(result.status ?? 255),
			output,
			bufferOverflow: true,
			summary: `testCommand output exceeded maxBuffer (${limitLabel}); use a scoped testCommand instead of full-suite commands. Command: ${trimmed}`,
		};
	}

	const exitCode = Number(result.status ?? 1);
	if (exitCode === 0) {
		return { ok: true, exitCode: 0, output };
	}

	const summary = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n").slice(0, 500);
	return { ok: false, exitCode, output, summary };
}

/**
 * @param {string} worktreePath
 * @param {object} config
 */
function resolveCoverageCommand(config) {
	return (
		config?.testing?.testWithCoverage ??
		config?.testing?.test ??
		"npm run coverage:check"
	);
}

/**
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} config
 * @param {string} [testCommandOutput]
 */
function resolveLineCoverage(worktreePath, parsedContract, config, testCommandOutput = "") {
	let output = testCommandOutput;
	if (parsedContract.minLineCoverage != null) {
		const parsedFromTest = parseAggregateLineCoverage(output);
		if (parsedFromTest != null) {
			return parsedFromTest;
		}
		const coverageCommand = resolveCoverageCommand(config);
		const coverageResult = runContractTestCommand(worktreePath, coverageCommand);
		output = coverageResult.output;
	}
	return parseAggregateLineCoverage(output);
}

/**
 * @param {string} worktreePath
 * @param {string} artifactPattern
 * @returns {{ ok: boolean, matchedPath?: string }}
 */
function findArtifactMatch(worktreePath, artifactPattern) {
	const normalized = String(artifactPattern ?? "").replace(/\\/g, "/");
	if (!normalized) {
		return { ok: false };
	}

	if (!/[*?[\]{}]/.test(normalized)) {
		const fullPath = path.join(worktreePath, normalized);
		return fs.existsSync(fullPath) ? { ok: true, matchedPath: normalized } : { ok: false };
	}

	const baseDir = path.dirname(normalized);
	const searchRoot = path.join(worktreePath, baseDir);
	if (!fs.existsSync(searchRoot)) {
		return { ok: false };
	}

	/** @type {Array<{ abs: string, rel: string }>} */
	const stack = [{ abs: searchRoot, rel: baseDir === "." ? "" : baseDir }];
	while (stack.length > 0) {
		const { abs, rel } = stack.pop();
		for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
			const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
			const entryAbs = path.join(abs, entry.name);
			if (entry.isDirectory()) {
				stack.push({ abs: entryAbs, rel: entryRel });
				continue;
			}
			if (micromatch.isMatch(entryRel, normalized)) {
				return { ok: true, matchedPath: entryRel };
			}
		}
	}

	return { ok: false };
}

/**
 * Prepare lane worktree before contract testCommand (Flutter analyzer hygiene #78).
 *
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} [config]
 * @returns {{ hygieneApplied: boolean, cleaned?: boolean, buildDir?: string, reason?: string }}
 */
export function prepareContractVerifyEnvironment(worktreePath, parsedContract, config = {}) {
	const testCommand = parsedContract?.testCommand;
	if (!testCommand || !shouldCleanFlutterBuildBeforeAnalyze(testCommand, config)) {
		return { hygieneApplied: false };
	}

	const result = sanitizeFlutterBuildBeforeAnalyze(worktreePath);
	return { hygieneApplied: true, ...result };
}

/**
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} [config]
 * @param {string} [config.baseBranch]
 * @param {string} [config.sinceCommit] When set, scope file-scope checks to `sinceCommit..HEAD` (serialized lanes).
 * @param {string} [config.taskStartCommit] Alias for `sinceCommit` (SP-415 journal resolution; anchor stable across retry/resume per SP-478).
 * @param {string} [config.projectRoot] Repo root for journal events (optional).
 * @param {string} [config.batchId] Batch ID for journal events (optional).
 * @param {string} [config.taskId] Task ID for journal events (optional).
 * @param {string} [config.taskFolder] Task folder path for writing failure logs to .reviews/ (optional).
 * @returns {{ ok: boolean, checks: Array<{ field: string, ok: boolean, message: string }>, retries?: number }}
 */
export function verifyContract(worktreePath, parsedContract, config = {}) {
	/** @type {Array<{ field: string, ok: boolean, message: string }>} */
	const checks = [];
	const baseBranch = config?.baseBranch ?? "main";
	const sinceCommit = config?.sinceCommit ?? config?.taskStartCommit ?? undefined;
	const changedFiles = listChangedFiles(worktreePath, baseBranch, sinceCommit);

	prepareContractVerifyEnvironment(worktreePath, parsedContract, config);

	let testCommandOutput = "";
	let testCommandOk = true;
	let retriedCount = 0;
	if (parsedContract.testCommand) {
		const maxRetries = config?.contract?.testRetries ?? CONTRACT_TEST_DEFAULT_RETRIES;
		const retryDelayMs = config?.contract?.testRetryDelayMs ?? CONTRACT_TEST_RETRY_DELAY_MS;
		const totalAttempts = maxRetries + 1;
		let lastResult = null;
		let successAttempt = 0;

		for (let attempt = 1; attempt <= totalAttempts; attempt++) {
			lastResult = runContractTestCommand(worktreePath, parsedContract.testCommand, {
				maxBuffer: config?.contractTestMaxBuffer,
			});

			if (lastResult.ok) {
				successAttempt = attempt;
				break;
			}

			writeContractFailureLog(
				config?.taskFolder,
				parsedContract.testCommand,
				lastResult,
				attempt,
				totalAttempts,
			);

			if (attempt < totalAttempts) {
				retriedCount++;
				if (config?.projectRoot && config?.batchId) {
					appendJournalEvent(config.projectRoot, config.batchId, "contract.test_retry", {
						taskId: config?.taskId,
						attempt,
						exitCode: lastResult.exitCode,
						totalAttempts,
					});
				}
				sleepSync(retryDelayMs);
			}
		}

		testCommandOutput = lastResult.output;
		testCommandOk = lastResult.ok;
		const attemptLabel = successAttempt > 1
			? ` (passed on attempt ${successAttempt} of ${totalAttempts})`
			: "";
		checks.push({
			field: "testCommand",
			ok: lastResult.ok,
			message: lastResult.ok
				? `testCommand passed${attemptLabel}`
				: lastResult.bufferOverflow
					? `Contract ${lastResult.summary}`
					: `Contract testCommand failed after ${totalAttempts} attempt(s) (exit ${lastResult.exitCode}): ${lastResult.summary || "(no output)"}`,
		});
	}

	for (const pattern of parsedContract.fileScopeMustChange ?? []) {
		const matched = changedFiles.some((file) =>
			pattern.endsWith("/") ? file.startsWith(pattern) : matchesContractPattern(file, pattern),
		);
		const prelanded = !matched &&
			isPrelandedFileScopeSatisfied(
				worktreePath,
				pattern,
				changedFiles,
				parsedContract,
				config,
				baseBranch,
				{ testCommandOk },
				(worktree, artifactPath) => findArtifactMatch(worktree, artifactPath).ok,
			);
		const baseSatisfied = !matched && !prelanded &&
			isBaseFileScopeSatisfied(
				worktreePath,
				pattern,
				changedFiles,
				parsedContract,
				baseBranch,
				{ testCommandOk },
				(worktree, artifactPath) => findArtifactMatch(worktree, artifactPath).ok,
				config,
			);
		const ok = matched || prelanded || baseSatisfied;
		checks.push({
			field: "fileScopeMustChange",
			ok,
			message: matched
				? `fileScopeMustChange matched: ${pattern}`
				: prelanded
					? `fileScopeMustChange pre-landed on ${baseBranch}: ${pattern}`
					: baseSatisfied
						? `fileScopeMustChange satisfied on ${baseBranch}: ${pattern}`
						: `Contract fileScopeMustChange: no matching changes for ${pattern}`,
		});
	}

	for (const pattern of parsedContract.fileScopeMustNotChange ?? []) {
		const forbidden = changedFiles.filter((file) => matchesContractPattern(file, pattern));
		if (forbidden.length === 0) {
			checks.push({
				field: "fileScopeMustNotChange",
				ok: true,
				message: `fileScopeMustNotChange respected: ${pattern}`,
			});
		} else {
			for (const file of forbidden) {
				checks.push({
					field: "fileScopeMustNotChange",
					ok: false,
					message: `Contract fileScopeMustNotChange: forbidden change ${file}`,
				});
			}
		}
	}

	if (parsedContract.minLineCoverage != null) {
		const actual = resolveLineCoverage(worktreePath, parsedContract, config, testCommandOutput);
		const required = parsedContract.minLineCoverage;
		if (actual == null) {
			checks.push({
				field: "minLineCoverage",
				ok: false,
				message: `Contract minLineCoverage: could not parse coverage output (required ${required}%)`,
			});
		} else {
			const ok = actual >= required;
			checks.push({
				field: "minLineCoverage",
				ok,
				message: ok
					? `minLineCoverage met: ${actual.toFixed(2)}% >= ${required}%`
					: `Contract minLineCoverage: ${actual.toFixed(2)}% < ${required}%`,
			});
		}
	}

	for (const artifactPath of parsedContract.artifactsMustExist ?? []) {
		const match = findArtifactMatch(worktreePath, artifactPath);
		checks.push({
			field: "artifactsMustExist",
			ok: match.ok,
			message: match.ok
				? `artifact exists: ${match.matchedPath ?? artifactPath}`
				: `Contract artifactsMustExist: missing ${artifactPath}`,
		});
	}

	return {
		ok: checks.length === 0 || checks.every((check) => check.ok),
		checks,
		...(retriedCount > 0 ? { retries: retriedCount } : {}),
	};
}
