// @ts-nocheck
/**
 * Contract testCommand execution, npm guard, and verifyContract (SP-603 / SP-541).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import micromatch from "micromatch";
import { parseAggregateLineCoverage } from "../../scripts/coverage-parse.mjs";
import {
	isBaseFileScopeSatisfied,
	isPrelandedFileScopeSatisfied,
	isResumeBaselineFileScopeSatisfied,
} from "./contract-prelanded.mjs";
import {
	listChangedFiles,
	matchesContractPattern,
} from "./contract-parse.mjs";
import { appendJournalEvent } from "./journal.mjs";
import {
	sanitizeFlutterBuildBeforeAnalyze,
	shouldCleanFlutterBuildBeforeAnalyze,
} from "./lane-dirty-check.mjs";
import {
	NPM_TEST_DASH_DASH_RE,
	TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT,
} from "../tasks/validate-contract-warn.mjs";
import { formatRefusedContractMetacharMessage, isRefusedContractMetacharCommand } from "../tasks/packet/parse-prompt.mjs";

// Shared pre-spawn refusal envelope for the npm-scope (#187) and metachar (#268) guards.
function refusedBeforeSpawnResult(summary) {
	return { ok: false, exitCode: 1, output: summary, summary, refusedBeforeSpawn: true };
}

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
 * Defense in depth: block `npm test -- <path>` before subprocess spawn (issue #187, SP-541).
 *
 * @param {string} command
 * @returns {boolean}
 */
export function isRefusedNpmTestDashDashCommand(command) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed || trimmed === "true") {
		return false;
	}
	return NPM_TEST_DASH_DASH_RE.test(trimmed);
}

/**
 * @param {string} command
 * @returns {string}
 */
function formatRefusedNpmTestDashDashMessage(command) {
	return `Contract testCommand refused before spawn: npm test -- <path> is blocked at runtime (command: ${command}). ${TEST_COMMAND_NPM_TEST_DASH_DASH_FIX_HINT}`;
}

/**

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

	if (isRefusedNpmTestDashDashCommand(trimmed)) {
		return refusedBeforeSpawnResult(formatRefusedNpmTestDashDashMessage(trimmed));
	}
	if (isRefusedContractMetacharCommand(trimmed)) {
		return refusedBeforeSpawnResult(formatRefusedContractMetacharMessage(trimmed));
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
	const committedFiles = listChangedFiles(worktreePath, baseBranch, sinceCommit);
	
	let indexAndWorktreeFiles = [];
	try {
		const stdout = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: worktreePath, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
		indexAndWorktreeFiles = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	} catch {
		// Ignore git diff failures; fall back to committedFiles only.
	}

	const changedFiles = [...new Set([...committedFiles, ...indexAndWorktreeFiles])];

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
		const resumeBaseline = !matched && !prelanded && sinceCommit &&
			isResumeBaselineFileScopeSatisfied(
				worktreePath,
				pattern,
				changedFiles,
				sinceCommit,
				baseBranch,
				parsedContract,
				{ testCommandOk },
				(worktree, artifactPath) => findArtifactMatch(worktree, artifactPath).ok,
			);
		const baseSatisfied = !matched && !prelanded && !resumeBaseline &&
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
		const ok = matched || prelanded || resumeBaseline || baseSatisfied;
		checks.push({
			field: "fileScopeMustChange",
			ok,
			message: matched
				? `fileScopeMustChange matched: ${pattern}`
				: prelanded
					? `fileScopeMustChange pre-landed on ${baseBranch}: ${pattern}`
					: resumeBaseline
						? `fileScopeMustChange pre-landed at resume baseline: ${pattern}`
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
