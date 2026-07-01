/**
 * Machine contract verification in lane worktree (handoff §4.5, SP-154/SP-155).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import micromatch from "micromatch";
import { parseAggregateLineCoverage } from "../../scripts/coverage-parse.mjs";
import { DEFAULT_TASKS_ROOT } from "../config/spine-init-constants.mjs";
import { resolveContractMode } from "../tasks/packet/validate-contract.mjs";

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
 * @param {string} relPath
 */
function gitFirstCommitTouchingPath(worktreePath, relPath) {
	try {
		const output = execFileSync("git", ["log", "--reverse", "--format=%H", "--", relPath], {
			cwd: worktreePath,
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
 * @param {string} worktreePath
 * @param {string} sinceCommit
 * @param {string} baseRef
 * @param {string} pattern
 */
function listPathsChangedSinceCommit(worktreePath, sinceCommit, baseRef, pattern) {
	try {
		const output = execFileSync(
			"git",
			["diff", "--name-only", `${sinceCommit}..${baseRef}`, "--", pattern],
			{
				cwd: worktreePath,
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
 * Resolve PROMPT.md path relative to worktree from lane delivery changes or config.
 *
 * @param {string} worktreePath
 * @param {string[]} changedFiles
 * @param {object} [config]
 * @returns {string | null}
 */
export function resolvePromptRelPath(worktreePath, changedFiles, config = {}) {
	if (typeof config.promptRelPath === "string" && config.promptRelPath.trim()) {
		return config.promptRelPath.replace(/\\/g, "/");
	}
	if (typeof config.taskFolder === "string" && config.taskFolder.trim()) {
		const rel = path.relative(worktreePath, config.taskFolder).replace(/\\/g, "/");
		if (rel && !rel.startsWith("..")) {
			return `${rel}/PROMPT.md`;
		}
	}

	const tasksRoot = String(config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT).replace(/\\/g, "/");
	/** @type {Set<string>} */
	const taskDirs = new Set();
	for (const file of changedFiles) {
		const normalized = String(file).replace(/\\/g, "/");
		const match = normalized.match(new RegExp(`^${tasksRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/`));
		if (match?.[1]) {
			taskDirs.add(match[1]);
		}
	}
	if (taskDirs.size === 1) {
		return `${tasksRoot}/${[...taskDirs][0]}/PROMPT.md`;
	}
	return null;
}

/**
 * True when scope path changed on baseRef after the task PROMPT first landed (issue #56).
 *
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string | null} promptRelPath
 * @param {string} baseRef
 */
export function isFileScopePatternPrelanded(worktreePath, pattern, promptRelPath, baseRef = "main") {
	if (!promptRelPath) {
		return false;
	}
	const introCommit = gitFirstCommitTouchingPath(worktreePath, promptRelPath);
	if (!introCommit) {
		return false;
	}
	const changedPaths = listPathsChangedSinceCommit(worktreePath, introCommit, baseRef, pattern);
	return changedPaths.some((filePath) => matchesContractPattern(filePath, pattern));
}

/**
 * @param {string[]} changedFiles
 * @param {string} [tasksRoot]
 */
export function hasSpineTaskDeliveryChanges(changedFiles, tasksRoot = DEFAULT_TASKS_ROOT) {
	const prefix = `${String(tasksRoot).replace(/\\/g, "/")}/`;
	return changedFiles.some((file) => String(file).replace(/\\/g, "/").startsWith(prefix));
}

/**
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 */
function artifactsAllExist(worktreePath, parsedContract) {
	for (const artifactPath of parsedContract.artifactsMustExist ?? []) {
		if (!findArtifactMatch(worktreePath, artifactPath).ok) {
			return false;
		}
	}
	return true;
}

/**
 * @param {string} worktreePath
 * @param {string} pattern
 * @param {string[]} changedFiles
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} config
 * @param {string} baseBranch
 * @param {{ testCommandOk: boolean }} delivery
 */
function isPrelandedFileScopeSatisfied(
	worktreePath,
	pattern,
	changedFiles,
	parsedContract,
	config,
	baseBranch,
	delivery,
) {
	const matchedInLane = changedFiles.some((file) => matchesContractPattern(file, pattern));
	if (matchedInLane) {
		return false;
	}
	const promptRelPath = resolvePromptRelPath(worktreePath, changedFiles, config);
	if (!isFileScopePatternPrelanded(worktreePath, pattern, promptRelPath, baseBranch)) {
		return false;
	}
	if (parsedContract.testCommand && !delivery.testCommandOk) {
		return false;
	}
	if ((parsedContract.artifactsMustExist?.length ?? 0) > 0 && !artifactsAllExist(worktreePath, parsedContract)) {
		return false;
	}
	return true;
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
	const tasksRoot = config.paths?.tasksRoot ?? DEFAULT_TASKS_ROOT;
	const hasDelivery = hasSpineTaskDeliveryChanges(changedFiles, tasksRoot);
	/** @type {string[]} */
	const failures = [];
	for (const pattern of patterns) {
		const matched = changedFiles.some((file) => matchesContractPattern(file, pattern));
		if (matched) {
			continue;
		}
		if (
			hasDelivery &&
			isFileScopePatternPrelanded(
				worktreePath,
				pattern,
				resolvePromptRelPath(worktreePath, changedFiles, config),
				baseBranch,
			)
		) {
			continue;
		}
		failures.push(`Contract fileScopeMustChange: no matching changes for ${pattern}`);
	}
	return { ok: failures.length === 0, failures };
}

/**
 * @param {string} worktreePath
 * @param {string} [baseBranch]
 */
export function listChangedFiles(worktreePath, baseBranch = "main") {
	try {
		const output = execFileSync("git", ["diff", "--name-only", `${baseBranch}...HEAD`], {
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
 * @param {string} command
 */
function runContractTestCommand(worktreePath, command) {
	const trimmed = String(command ?? "").trim();
	if (!trimmed || trimmed === "true") {
		return { ok: true, exitCode: 0, output: "" };
	}

	const shell = process.env.SHELL || (process.platform === "win32" ? "cmd.exe" : "/bin/sh");
	const shellFlag = process.platform === "win32" ? "/c" : "-c";
	const result = spawnSync(shell, [shellFlag, trimmed], {
		cwd: worktreePath,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		timeout: 10 * 60 * 1000,
		maxBuffer: 256 * 1024,
	});

	const exitCode = Number(result.status ?? 1);
	const stdout = String(result.stdout ?? "");
	const stderr = String(result.stderr ?? "");
	const output = `${stdout}\n${stderr}`;
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
 * @param {string} worktreePath
 * @param {ReturnType<import("../tasks/packet/parse-prompt.mjs").parseContract>} parsedContract
 * @param {object} [config]
 * @returns {{ ok: boolean, checks: Array<{ field: string, ok: boolean, message: string }> }}
 */
export function verifyContract(worktreePath, parsedContract, config = {}) {
	/** @type {Array<{ field: string, ok: boolean, message: string }>} */
	const checks = [];
	const baseBranch = config?.baseBranch ?? "main";
	const changedFiles = listChangedFiles(worktreePath, baseBranch);

	let testCommandOutput = "";
	let testCommandOk = true;
	if (parsedContract.testCommand) {
		const result = runContractTestCommand(worktreePath, parsedContract.testCommand);
		testCommandOutput = result.output;
		testCommandOk = result.ok;
		checks.push({
			field: "testCommand",
			ok: result.ok,
			message: result.ok
				? "testCommand passed"
				: `Contract testCommand failed (exit ${result.exitCode}): ${result.summary || "(no output)"}`,
		});
	}

	for (const pattern of parsedContract.fileScopeMustChange ?? []) {
		const matched = changedFiles.some((file) => matchesContractPattern(file, pattern));
		const prelanded = !matched &&
			isPrelandedFileScopeSatisfied(
				worktreePath,
				pattern,
				changedFiles,
				parsedContract,
				config,
				baseBranch,
				{ testCommandOk },
			);
		const ok = matched || prelanded;
		checks.push({
			field: "fileScopeMustChange",
			ok,
			message: matched
				? `fileScopeMustChange matched: ${pattern}`
				: prelanded
					? `fileScopeMustChange pre-landed on ${baseBranch}: ${pattern}`
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
	};
}
