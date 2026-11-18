/**
 * Contract testCommand metachar hardening (#268 / SP-723).
 *
 * Covers the quote-aware scanner, parse-time rejection in parseContract, and the
 * fail-closed runtime refusal in runContractTestCommand / verifyContract — all with
 * error copy distinct from the #254 gate-evidence path ("evidence command …").
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import {
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import {
	findContractCommandMetacharIssue,
	isRefusedContractMetacharCommand,
	parseContract,
} from "../../src/tasks/packet/parse-prompt.mjs";
import {
	collectArtifactTraversalWarnings,
	isUnsafeArtifactScopePattern,
} from "../../src/tasks/validate-contract-warn.mjs";

async function withGitRepoNoCommits(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-norev-"));
	try {
		// git init without commits: `git diff --name-only HEAD` fails deterministically
		// (no HEAD revision) even when the tmpdir happens to sit inside a parent repo.
		runGit(worktreePath, ["init"]);
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-metachar-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

function runGit(cwd, args) {
	execFileSync("git", args, { cwd, stdio: "ignore" });
}

function buildPrompt(contractRow) {
	return [
		"# Task: SP-001 — Metachar fixture",
		"",
		"## Contract",
		"",
		"| Field | Value |",
		"|-------|-------|",
		contractRow,
		"",
	].join("\n");
}

test("isRefusedContractMetacharCommand rejects $, backticks, ;, |, || and lone &", () => {
	const refused = [
		["echo $HOME", "dollar expansion"],
		["echo $(whoami)", "command substitution"],
		["echo ${SPINE_VAR}", "brace expansion"],
		["echo `whoami`", "backticks"],
		["npm test; npm run build", "semicolon"],
		["npm test | tee out.txt", "pipe"],
		["npm test || npm run build", "double pipe"],
		["npm run a & npm run b", "lone ampersand"],
		["npm run a &", "trailing background"],
		["echo \"$(rm -rf x)\"", "expansion inside double quotes"],
		["echo 'safe'; echo '$unsafe'", "metachar after quoted data"],
		["echo 'unclosed", "unclosed single quote"],
		["echo \"unclosed", "unclosed double quote"],
		["npm run a\nnpm run b", "newline sequencing"],
	];
	for (const [command, label] of refused) {
		assert.equal(
			isRefusedContractMetacharCommand(command),
			true,
			`expected refusal for ${label}: ${JSON.stringify(command)}`,
		);
		assert.ok(
			findContractCommandMetacharIssue(command),
			`scanner should report an issue for ${label}`,
		);
	}
});

test("isRefusedContractMetacharCommand allows && chains, quoted data and plain commands", () => {
	const allowed = [
		"true",
		"npm test",
		"npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-exec.test.mjs",
		"printf '%s\\n' 'all files          |    82.50 |'",
		"grep -q 'contract testCommand' docs/a.md && grep -q 'gate evidence' docs/b.md",
		"node -e \"process.exit(0)\"",
		"echo \"quoted ; pipe | data\"",
		"FOO=bar node script.mjs",
		"echo escaped \\; semicolon",
	];
	for (const command of allowed) {
		assert.equal(isRefusedContractMetacharCommand(command), false, JSON.stringify(command));
		assert.equal(findContractCommandMetacharIssue(command), null, JSON.stringify(command));
	}
	assert.equal(isRefusedContractMetacharCommand(""), false);
	assert.equal(isRefusedContractMetacharCommand("  true  "), false);
	assert.equal(isRefusedContractMetacharCommand(null), false);
});

test("runContractTestCommand refuses metachars before spawn with distinct copy", async () => {
	await withWorktree(async (worktreePath) => {
		const markerPath = path.join(worktreePath, "spawn-marker.txt");
		const command = `node -e "require('node:fs').writeFileSync('spawn-marker.txt', 'pwned')" ; node -e "process.exit(0)"`;

		const result = await runContractTestCommand(worktreePath, command);

		assert.equal(result.ok, false);
		assert.equal(result.refusedBeforeSpawn, true);
		assert.equal(result.exitCode, 1);
		assert.match(result.summary, /refused before spawn/i);
		assert.match(result.summary, /shell sequencing \(;\)/);
		assert.match(result.summary, /&& chains are allowed/);
		assert.match(result.summary, /#268/);
		// Distinct from the #254 gate-evidence path copy.
		assert.doesNotMatch(result.summary, /evidence command/);
		assert.equal(fs.existsSync(markerPath), false, "subprocess must not run when command is refused");
	});
});

test("runContractTestCommand refusal copy is distinct per rejected construct", async () => {
	await withWorktree(async (worktreePath) => {
		assert.match((await runContractTestCommand(worktreePath, "echo $HOME")).summary, /variable expansion/);
		assert.match((await runContractTestCommand(worktreePath, "echo `id`")).summary, /command substitution/);
		assert.match((await runContractTestCommand(worktreePath, "a | b")).summary, /shell pipe/);
		assert.match((await runContractTestCommand(worktreePath, "a & b")).summary, /background/);
		assert.match((await runContractTestCommand(worktreePath, "echo 'x")).summary, /unclosed quote/);
	});
});

test("npm test -- guard copy still wins when both refusals apply", async () => {
	await withWorktree(async (worktreePath) => {
		const command = "npm test -- tests/foo.test.mjs; node -e \"process.exit(1)\"";
		const result = await runContractTestCommand(worktreePath, command);
		assert.equal(result.refusedBeforeSpawn, true);
		assert.match(result.summary, /npm test -- <path>/);
		assert.doesNotMatch(result.summary, /shell sequencing/);
	});
});

test("runContractTestCommand executes valid && chain commands", async () => {
	await withWorktree(async (worktreePath) => {
		const result = await runContractTestCommand(
			worktreePath,
			'node -e "process.exit(0)" && node -e "process.exit(0)"',
		);
		assert.equal(result.ok, true, result.output);
	});
});

test("verifyContract surfaces metachar refusal as contract failure", async () => {
	await withWorktree(async (worktreePath) => {
		const result = await verifyContract(
			worktreePath,
			{ testCommand: "echo $HOME" },
			{ contract: { testRetries: 0 } },
		);

		assert.equal(result.ok, false);
		const testCheck = result.checks.find((check) => check.field === "testCommand");
		assert.ok(testCheck);
		assert.equal(testCheck.ok, false);
		assert.match(testCheck.message, /refused before spawn/i);
		assert.match(testCheck.message, /variable expansion/);
		assert.doesNotMatch(testCheck.message, /evidence command/);
	});
});

test("parseContract rejects metachars in testCommand at parse time", () => {
	const parsed = parseContract(buildPrompt("| testCommand | `echo $HOME` |"));
	assert.equal(parsed.testCommand, null);
	assert.match(
		parsed.errors.join("\n"),
		/Contract testCommand contains forbidden shell metacharacters: shell variable expansion \(\$\)/,
	);
	assert.match(parsed.errors.join("\n"), /&& chains are allowed \(#268\)/);
});

test("parseContract rejects metachars in runCommand at parse time", () => {
	const parsed = parseContract(buildPrompt("| runCommand | `npm test; npm run build` |"));
	assert.equal(parsed.runCommand, null);
	assert.match(
		parsed.errors.join("\n"),
		/Contract runCommand contains forbidden shell metacharacters: shell sequencing \(;\)/,
	);
});

test("parseContract keeps happy-path && testCommand fixtures valid", () => {
	const parsed = parseContract(
		buildPrompt(
			"| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-exec.test.mjs` |",
		),
	);
	assert.equal(parsed.errors.length, 0);
	assert.equal(
		parsed.testCommand,
		"npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/batch/contract-exec.test.mjs",
	);
});

// --------------------------------------------------------------------------
// #309 / SP-867 — fail-closed contract evidence
//
// 1. artifactsMustExist patterns with `..` or absolute paths are rejected
//    (never probe outside the lane worktree, even when the target exists there).
// 2. double-star globs walk from the longest literal prefix, so `src/**` +
//    `/*.md` matches real nested files instead of a literal `src/**` directory.
// 3. a failed `git diff --name-only HEAD` must fail fileScopeMustNotChange —
//    not pass on an empty changed-file list.
// --------------------------------------------------------------------------

test("isUnsafeArtifactScopePattern flags parent-directory and absolute patterns", () => {
	for (const unsafe of [
		"../outside.txt",
		"src/../../outside.txt",
		"a/../..",
		"/etc/hosts",
		"C:/Windows",
		"C:\\Windows",
	]) {
		assert.equal(isUnsafeArtifactScopePattern(unsafe), true, unsafe);
	}
	for (const safe of ["src/batch/contract-exec.mjs", "tests/**", "out/run-1.log", "**"]) {
		assert.equal(isUnsafeArtifactScopePattern(safe), false, safe);
	}
	assert.equal(isUnsafeArtifactScopePattern(""), false);
	assert.equal(isUnsafeArtifactScopePattern(null), false);
});

test("collectArtifactTraversalWarnings flags only escaping artifactsMustExist patterns", () => {
	const warnings = collectArtifactTraversalWarnings({
		artifactsMustExist: ["../escape.md", "ok/nested.md", "/absolute.md"],
	});
	assert.equal(warnings.length, 2);
	assert.match(warnings[0], /\.\.\/escape\.md/);
	assert.match(warnings[1], /\/absolute\.md/);
	assert.deepEqual(
		collectArtifactTraversalWarnings({ artifactsMustExist: ["ok/nested.md"] }),
		[],
	);
	assert.deepEqual(collectArtifactTraversalWarnings(undefined), []);
});

test("verifyContract rejects parent-directory and absolute artifactsMustExist patterns (#309)", async () => {
	await withWorktree(async (worktreePath) => {
		// The file EXISTS just outside the worktree — the contract must still fail:
		// traversal must never probe or be satisfied by host files.
		const outsideFile = path.join(path.dirname(worktreePath), "sp867-outside-proof.txt");
		fs.writeFileSync(outsideFile, "host file", "utf-8");
		try {
			const result = await verifyContract(worktreePath, {
				testCommand: "true",
				artifactsMustExist: ["../sp867-outside-proof.txt", "a/../../sp867-outside-proof.txt", "/etc/hosts"],
			}, { contract: { testRetries: 0 } });

			assert.equal(result.ok, false);
			const artifactChecks = result.checks.filter((check) => check.field === "artifactsMustExist");
			assert.equal(artifactChecks.length, 3);
			for (const check of artifactChecks) {
				assert.equal(check.ok, false);
				assert.match(check.message, /rejected unsafe pattern/);
				assert.match(check.message, /#309/);
			}
		} finally {
			fs.rmSync(outsideFile, { force: true });
		}
	});
});

test("verifyContract matches double-star glob patterns under the worktree (#309)", async () => {
	await withWorktree(async (worktreePath) => {
		fs.mkdirSync(path.join(worktreePath, "src", "batch", "deep"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "src", "batch", "deep", "note.md"), "hit", "utf-8");
		fs.mkdirSync(path.join(worktreePath, "docs"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "docs", "guide.md"), "hit", "utf-8");

		const result = await verifyContract(worktreePath, {
			testCommand: "true",
			artifactsMustExist: [
				"src/**/*.md",
				"docs/**",
				"**/*.md",
				// Still fail-closed on genuine misses.
				"src/**/*.ts",
				"nope/**/*.md",
			],
		}, { contract: { testRetries: 0 } });

		assert.equal(result.ok, false);
		// artifactsMustExist checks appear in pattern order.
		const artifactChecks = result.checks.filter((check) => check.field === "artifactsMustExist");
		assert.equal(artifactChecks.length, 5);

		// `src/**` + `/*.md` matches nested files (was a literal `src/**` dir before #309).
		assert.equal(artifactChecks[0].ok, true);
		assert.match(artifactChecks[0].message, /artifact exists: src\/batch\/deep\/note\.md/);
		// Trailing `**` still matches files directly under the literal prefix.
		assert.equal(artifactChecks[1].ok, true);
		assert.match(artifactChecks[1].message, /artifact exists: docs\/guide\.md/);
		// Rooted `**` walks the whole worktree.
		assert.equal(artifactChecks[2].ok, true);
		assert.match(artifactChecks[2].message, /artifact exists: .+\.md/);
		// Genuine misses still fail.
		assert.equal(artifactChecks[3].ok, false);
		assert.match(artifactChecks[3].message, /missing src\/\*\*\/\*\.ts/);
		assert.equal(artifactChecks[4].ok, false);
		assert.match(artifactChecks[4].message, /missing nope\/\*\*\/\*\.md/);
	});
});

test("verifyContract fails fileScopeMustNotChange when git diff fails (#309)", async () => {
	await withGitRepoNoCommits(async (worktreePath) => {
		const result = await verifyContract(worktreePath, {
			testCommand: "true",
			fileScopeMustChange: [],
			fileScopeMustNotChange: [".review/**"],
			artifactsMustExist: [],
		}, { contract: { testRetries: 0 } });

		assert.equal(result.ok, false, JSON.stringify(result.checks));
		const diffCheck = result.checks.find(
			(check) => check.field === "fileScopeMustNotChange",
		);
		assert.ok(diffCheck, "expected a fileScopeMustNotChange check");
		assert.equal(diffCheck.ok, false);
		assert.match(diffCheck.message, /git diff --name-only HEAD failed/);
		assert.match(diffCheck.message, /#309/);
		assert.ok(
			!result.checks.some((check) => check.message.includes("respected")),
			"must-not-change must not be reported respected when the diff failed",
		);
	});
});

test("verifyContract without must-not-change patterns does not invent a git-diff failure check (#309)", async () => {
	await withGitRepoNoCommits(async (worktreePath) => {
		const result = await verifyContract(worktreePath, {
			testCommand: "true",
			fileScopeMustChange: [],
			fileScopeMustNotChange: [],
			artifactsMustExist: [],
		}, { contract: { testRetries: 0 } });

		assert.equal(result.ok, true);
		assert.deepEqual(
			result.checks.map((check) => check.field),
			["testCommand"],
		);
	});
});
