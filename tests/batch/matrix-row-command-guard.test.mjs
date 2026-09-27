// @ts-nocheck
/**
 * SP-781 / #297 — matrix execute rows refuse shell metacharacters before spawn.
 *
 * The parse-time metachar check (#268) validates the raw runCommand template,
 * but `substituteRowCommand` runs afterward: a row value like `a; printf PWNED`
 * used to inject a second command into `/bin/sh -c`. These tests pin the
 * runtime guard in `runMatrixSubLane` (the enforcement boundary named by
 * parse-prompt.mjs): dangerous row values fail the row before any shell runs,
 * `&&` chains stay allowed, and the refusal journals `matrix.sub_lane.failed`.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	findContractCommandMetacharIssue,
	isRefusedContractMetacharCommand,
} from "../../src/tasks/packet/parse-prompt.mjs";
import { removeMatrixSubLaneWorktree, substituteRowCommand } from "../../src/batch/engine-lanes/matrix.mjs";
import { runMatrixSubLane } from "../../src/batch/engine-lanes/matrix-run.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/** A clean template that relies on `&&` chaining (allowed by the #268 grammar). */
const RUN_COMMAND = "mkdir -p out && echo {matrix.value} > out/{matrix.run_id}.txt";

/* ------------------------------------------------------------------ */
/* Unit: the guard sees post-substitution commands                     */
/* ------------------------------------------------------------------ */

test("guard catches shell metacharacters introduced by row substitution (#297)", () => {
	const dangerous = [
		[";", "alpha; printf PWNED > pwned.txt", /shell sequencing \(;\)/],
		["$(", "alpha$(printf PWNED > pwned.txt)", /shell variable expansion \(\$\)/],
		["backtick", "alpha`printf PWNED > pwned.txt`", /shell command substitution \(backticks\)/],
		["lone &", "alpha & printf PWNED > pwned.txt", /shell background operator \(&\)/],
	];
	for (const [label, value, issueRe] of dangerous) {
		const command = substituteRowCommand(RUN_COMMAND, { run_id: "a", value });
		assert.equal(
			isRefusedContractMetacharCommand(command),
			true,
			`row value with ${label} must be refused after substitution: ${command}`,
		);
		assert.match(findContractCommandMetacharIssue(command), issueRe);
	}
});

test("guard keeps the #268 grammar: && chains and benign row values stay allowed", () => {
	assert.equal(
		isRefusedContractMetacharCommand(substituteRowCommand(RUN_COMMAND, { run_id: "a", value: "alpha" })),
		false,
		"benign value in an && chained template must not be refused",
	);
	assert.equal(
		isRefusedContractMetacharCommand(
			substituteRowCommand(RUN_COMMAND, { run_id: "a", value: "alpha && echo chained" }),
		),
		false,
		"&& inside a row value follows the same grammar as #268 and is not refused",
	);
});

/* ------------------------------------------------------------------ */
/* runMatrixSubLane: refused rows never spawn a shell                  */
/* ------------------------------------------------------------------ */

function executeMatrixPrompt(taskId, runCommand) {
	return `# Task: ${taskId} — Matrix guard
**Size:** S
**Type:** execute

## Mission
Row values must never inject shell metacharacters into runCommand.

## Dependencies
**None**

## File Scope
- \`out/\`

## Matrix
| run_id | value |
|-------|-------|
| a | alpha |
| b | beta |

## Steps
### Step 1: Run per row

## Contract
| Field | Value |
|-------|-------|
| runCommand | \`${runCommand}\` |
| fileScopeMustChange | \`out/{matrix.run_id}.txt\` |
| testCommand | \`test -f out/{matrix.run_id}.txt\` |

## Testing
Refused rows never spawn a shell.

## Completion Criteria
- [ ] done

## Do NOT
- Fail
`;
}

async function withExecuteMatrixFixture(taskId, runCommand, fn) {
	const projectRoot = await initGitRepo("spine-sp781-guard-");
	try {
		const folderRel = path.join("spine-tasks", `${taskId}-matrix-guard`);
		const folder = path.join(projectRoot, folderRel);
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(path.join(folder, "PROMPT.md"), executeMatrixPrompt(taskId, runCommand), "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { [taskId]: [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task packet"], { cwd: projectRoot, stdio: "ignore" });
		return await fn({ projectRoot, folderRel });
	} finally {
		await destroyGitRepo(projectRoot);
	}
}

function readJournalEvents(projectRoot, batchId) {
	const journalPath = path.join(projectRoot, ".spine", "runtime", batchId, "journal", "events.jsonl");
	return fs
	.readFileSync(journalPath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function runGuardRow({ projectRoot, folderRel, taskId, batchId, value }) {
	return runMatrixSubLane({
		projectRoot,
		batchId,
		laneNumber: 1,
		taskId,
		laneBranch: "main",
		laneCorrelationId: `corr-${batchId}`,
		row: { rowId: "a", values: { run_id: "a", value } },
		matrixType: "execute",
		parentTaskFolderAbs: path.join(projectRoot, folderRel),
		taskFolderRel: folderRel,
		config: {},
		baseBranch: "main",
	});
}

test("runMatrixSubLane refuses a row value that injects `;` — no spawn, no side effect, row failed (#297)", () =>
	withExecuteMatrixFixture("TP-781", RUN_COMMAND, async ({ projectRoot, folderRel }) => {
		const batchId = "batch-sp781-refused";
		const result = await runGuardRow({
			projectRoot,
			folderRel,
			taskId: "TP-781",
			batchId,
			value: "alpha; printf PWNED > pwned.txt",
		});

		assert.equal(result.ok, false);
		assert.equal(result.exitCode, 1);
		assert.match(result.output, /matrix row command refused before spawn/);
		assert.match(result.output, /row 'a'/, "refusal names the row id");
		assert.match(result.output, /shell sequencing \(;\)/, "refusal names the detected issue");
		assert.match(result.output, /printf PWNED/, "refusal names the offending command");

		// No shell ever ran in the row worktree: neither the clean `mkdir -p out`
		// prefix nor the injected second command produced anything.
		assert.equal(fs.existsSync(path.join(result.worktreePath, "pwned.txt")), false, "injected command must not run");
		assert.equal(fs.existsSync(path.join(result.worktreePath, "out")), false, "even the clean prefix must not run");

		// The existing failed-row path journals matrix.sub_lane.failed with the refusal.
		const failed = readJournalEvents(projectRoot, batchId).find(
			(e) => e.type === "matrix.sub_lane.failed" && e.payload?.rowId === "a",
		);
		assert.ok(failed, "matrix.sub_lane.failed must be journaled for the refused row");
		assert.equal(failed.payload.exitCode, 1);
		assert.match(String(failed.payload.output), /refused before spawn/);

		removeMatrixSubLaneWorktree(projectRoot, result.worktreePath, result.branch);
	}));

test("every PROMPT-listed metachar in a row value fails the row before spawn (#297)", async () => {
	const cases = [
		["alpha; printf PWNED > pwned.txt", /shell sequencing \(;\)/],
		["alpha$(printf PWNED > pwned.txt)", /shell variable expansion \(\$\)/],
		["alpha`printf PWNED > pwned.txt`", /shell command substitution \(backticks\)/],
		["alpha & printf PWNED > pwned.txt", /shell background operator \(&\)/],
	];
	for (const [index, [value, issueRe]] of cases.entries()) {
		await withExecuteMatrixFixture("TP-782", RUN_COMMAND, async ({ projectRoot, folderRel }) => {
			const batchId = `batch-sp782-case-${index}`;
			const result = await runGuardRow({
				projectRoot,
				folderRel,
				taskId: "TP-782",
				batchId,
				value,
			});

			assert.equal(result.ok, false, `value ${JSON.stringify(value)} must fail the row`);
			assert.equal(result.exitCode, 1);
			assert.match(result.output, /matrix row command refused before spawn/);
			assert.match(result.output, issueRe);
			assert.equal(fs.existsSync(path.join(result.worktreePath, "pwned.txt")), false, `no side effect for ${JSON.stringify(value)}`);
			assert.equal(fs.existsSync(path.join(result.worktreePath, "out")), false, `no prefix ran for ${JSON.stringify(value)}`);

			const failed = readJournalEvents(projectRoot, batchId).find(
				(e) => e.type === "matrix.sub_lane.failed" && e.payload?.rowId === "a",
			);
			assert.ok(failed, `matrix.sub_lane.failed journaled for ${JSON.stringify(value)}`);

			removeMatrixSubLaneWorktree(projectRoot, result.worktreePath, result.branch);
		});
	}
});

test("runMatrixSubLane still runs && chained runCommands with benign row values (#268 grammar preserved)", () =>
	withExecuteMatrixFixture("TP-783", RUN_COMMAND, async ({ projectRoot, folderRel }) => {
		const result = await runGuardRow({
			projectRoot,
			folderRel,
			taskId: "TP-783",
			batchId: "batch-sp783-allowed",
			value: "alpha",
		});

		assert.equal(result.ok, true, `benign && chained row should succeed: ${result.output}`);
		const fileA = execFileSync("git", ["show", `${result.branch}:out/a.txt`], {
			cwd: projectRoot,
			encoding: "utf-8",
		});
		assert.match(fileA, /alpha/, "row output committed to the row branch");

		removeMatrixSubLaneWorktree(projectRoot, result.worktreePath, result.branch);
	}));
