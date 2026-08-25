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
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { isRefusedContractMetacharCommand } from "../../src/batch/contract-exec.mjs";
import {
	runContractTestCommand,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import {
	findContractCommandMetacharIssue,
	parseContract,
} from "../../src/tasks/packet/parse-prompt.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-metachar-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
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
	await withWorktree((worktreePath) => {
		const markerPath = path.join(worktreePath, "spawn-marker.txt");
		const command = `node -e "require('node:fs').writeFileSync('spawn-marker.txt', 'pwned')" ; node -e "process.exit(0)"`;

		const result = runContractTestCommand(worktreePath, command);

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
	await withWorktree((worktreePath) => {
		assert.match(runContractTestCommand(worktreePath, "echo $HOME").summary, /variable expansion/);
		assert.match(runContractTestCommand(worktreePath, "echo `id`").summary, /command substitution/);
		assert.match(runContractTestCommand(worktreePath, "a | b").summary, /shell pipe/);
		assert.match(runContractTestCommand(worktreePath, "a & b").summary, /background/);
		assert.match(runContractTestCommand(worktreePath, "echo 'x").summary, /unclosed quote/);
	});
});

test("npm test -- guard copy still wins when both refusals apply", async () => {
	await withWorktree((worktreePath) => {
		const command = "npm test -- tests/foo.test.mjs; node -e \"process.exit(1)\"";
		const result = runContractTestCommand(worktreePath, command);
		assert.equal(result.refusedBeforeSpawn, true);
		assert.match(result.summary, /npm test -- <path>/);
		assert.doesNotMatch(result.summary, /shell sequencing/);
	});
});

test("runContractTestCommand executes valid && chain commands", async () => {
	await withWorktree((worktreePath) => {
		const result = runContractTestCommand(
			worktreePath,
			'node -e "process.exit(0)" && node -e "process.exit(0)"',
		);
		assert.equal(result.ok, true, result.output);
	});
});

test("verifyContract surfaces metachar refusal as contract failure", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(
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
