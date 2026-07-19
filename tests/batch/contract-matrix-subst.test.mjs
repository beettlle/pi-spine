import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
	applyMatrixRowToContract,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import { parseContract } from "../../src/tasks/packet/parse-prompt.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

/** A matrix PROMPT whose contract references {matrix.run_id}. */
const MATRIX_PROMPT = `# Task: SP-900 — Matrix contract fixture

## Mission
Substitute matrix variables in contract fields.

## Dependencies
- **None**

## File Scope
- \`src/runner.mjs\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test -- {matrix.run_id}\` |
| fileScopeMustChange | \`src/runner-{matrix.run_id}.mjs\` |
| artifactsMustExist | \`out/{matrix.run_id}.log\` |
| minLineCoverage | 77 |

## Steps
### Step 1: Run
- [ ] run

## Completion Criteria
- [ ] done

## Do NOT
- nothing
`;

test("applyMatrixRowToContract: substitutes testCommand per matrix row", () => {
	const contract = parseContract(MATRIX_PROMPT);
	const nodeRow = applyMatrixRowToContract(contract, { run_id: "node" });
	assert.strictEqual(nodeRow.testCommand, "npm test -- node");

	const goRow = applyMatrixRowToContract(contract, { run_id: "go" });
	assert.strictEqual(goRow.testCommand, "npm test -- go");

	// Same template, different rows -> deterministic, independent results.
	assert.notStrictEqual(nodeRow.testCommand, goRow.testCommand);
});

test("applyMatrixRowToContract: resolves fileScopeMustChange with {matrix.run_id}", () => {
	const contract = parseContract(MATRIX_PROMPT);
	const out = applyMatrixRowToContract(contract, { run_id: "node" });
	assert.deepStrictEqual(out.fileScopeMustChange, ["src/runner-node.mjs"]);
});

test("applyMatrixRowToContract: resolves artifactsMustExist with the row value", () => {
	const contract = parseContract(MATRIX_PROMPT);
	const out = applyMatrixRowToContract(contract, { run_id: "go" });
	assert.deepStrictEqual(out.artifactsMustExist, ["out/go.log"]);
});

test("applyMatrixRowToContract: passes numeric fields through unchanged", () => {
	const contract = parseContract(MATRIX_PROMPT);
	const out = applyMatrixRowToContract(contract, { run_id: "node" });
	assert.strictEqual(out.minLineCoverage, 77);
});

test("applyMatrixRowToContract: returns the parsed contract unchanged for non-matrix tasks", () => {
	const contract = parseContract(MATRIX_PROMPT);
	// No row supplied -> identity return (original placeholders preserved).
	assert.strictEqual(applyMatrixRowToContract(contract, null), contract);
	assert.strictEqual(applyMatrixRowToContract(contract, undefined), contract);
	assert.strictEqual(applyMatrixRowToContract(contract, {}), contract);

	const empty = applyMatrixRowToContract(contract, {});
	assert.deepStrictEqual(empty.fileScopeMustChange, ["src/runner-{matrix.run_id}.mjs"]);
});

test("applyMatrixRowToContract: does not mutate the input contract", () => {
	const contract = parseContract(MATRIX_PROMPT);
	applyMatrixRowToContract(contract, { run_id: "node" });
	assert.strictEqual(contract.testCommand, "npm test -- {matrix.run_id}");
	assert.deepStrictEqual(contract.fileScopeMustChange, ["src/runner-{matrix.run_id}.mjs"]);
});

test("applyMatrixRowToContract: fails loud on unknown column references", () => {
	const contract = parseContract(MATRIX_PROMPT);
	assert.throws(
		() => applyMatrixRowToContract(contract, { other: "x" }),
		/Unknown matrix variable reference: \{matrix\.run_id\}/,
	);
});

test("applyMatrixRowToContract: tolerates sparse contracts with null/missing list fields", () => {
	// A minimal contract missing optional list fields must not throw.
	const sparse = {
		testCommand: "npm t {matrix.run_id}",
		runCommand: null,
		fileScopeMustChange: null,
		fileScopeMustNotChange: undefined,
		artifactsMustExist: [],
		minLineCoverage: null,
	};
	const out = applyMatrixRowToContract(sparse, { run_id: "node" });
	assert.strictEqual(out.testCommand, "npm t node");
	assert.strictEqual(out.runCommand, null);
	assert.strictEqual(out.fileScopeMustChange, null);
	assert.strictEqual(out.fileScopeMustNotChange, undefined);
	assert.deepStrictEqual(out.artifactsMustExist, []);
});

test("verifyContract: applies config.matrixRow so fileScopeMustChange matches per row", async () => {
	const worktreePath = await initGitRepo("spine-matrix-contract-");
	try {
		const contract = parseContract(MATRIX_PROMPT);
		// testCommand 'true' always passes; isolate the file-scope substitution check.
		const scoped = {
			...contract,
			testCommand: "true",
			minLineCoverage: null,
			artifactsMustExist: [],
		};

		execFileSync("git", ["checkout", "-b", "lane-1"], { cwd: worktreePath, stdio: "ignore" });
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		fs.writeFileSync(
			path.join(worktreePath, "src", "runner-node.mjs"),
			"export const node = 1;\n",
		);
		execFileSync("git", ["add", "src/runner-node.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "matrix row node"], { cwd: worktreePath, stdio: "ignore" });

		// With the matrix row, the placeholder resolves to src/runner-node.mjs and matches.
		const result = verifyContract(worktreePath, scoped, { matrixRow: { run_id: "node" } });
		assert.ok(result.ok, `expected ok with matrix row; checks: ${JSON.stringify(result.checks)}`);

		const scopeCheck = result.checks.find((c) => c.field === "fileScopeMustChange");
		assert.ok(scopeCheck, "fileScopeMustChange check present");
		assert.ok(scopeCheck.ok, "fileScopeMustChange matched after substitution");
		assert.match(scopeCheck.message, /runner-node\.mjs/);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});

test("verifyContract: omits matrixRow for non-matrix tasks (backwards compatible)", async () => {
	const worktreePath = await initGitRepo("spine-matrix-norow-");
	try {
		// A plain non-matrix contract: no placeholders, no matrixRow passed.
		const plain = parseContract(
			MATRIX_PROMPT.replace(/\{matrix\.run_id\}/g, "shared"),
		);
		const scoped = {
			...plain,
			testCommand: "true",
			minLineCoverage: null,
			artifactsMustExist: [],		};

		execFileSync("git", ["checkout", "-b", "lane-1"], { cwd: worktreePath, stdio: "ignore" });
		fs.mkdirSync(path.join(worktreePath, "src"), { recursive: true });
		fs.writeFileSync(
			path.join(worktreePath, "src", "runner-shared.mjs"),
			"export const shared = 1;\n",
		);
		execFileSync("git", ["add", "src/runner-shared.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "non-matrix"], { cwd: worktreePath, stdio: "ignore" });

		// No matrixRow -> parsed contract used verbatim -> file scope matches.
		const result = verifyContract(worktreePath, scoped, {});
		assert.ok(result.ok, `non-matrix verify expected ok; checks: ${JSON.stringify(result.checks)}`);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});
