import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import {
	listChangedFiles,
	matchesContractPattern,
	shouldRunContractVerify,
	verifyContract,
} from "../../src/batch/contract-verify.mjs";
import { parseAggregateLineCoverage } from "../../scripts/coverage-parse.mjs";

async function withWorktree(run) {
	const worktreePath = await mkdtemp(path.join(os.tmpdir(), "spine-contract-verify-"));
	try {
		await run(worktreePath);
	} finally {
		await rm(worktreePath, { recursive: true, force: true });
	}
}

test("verifyContract passes when testCommand exits 0", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: "true",
			artifactsMustExist: [],
		});

		assert.equal(result.ok, true);
		assert.equal(result.checks.length, 1);
		assert.equal(result.checks[0].field, "testCommand");
		assert.equal(result.checks[0].ok, true);
	});
});

test("verifyContract fails when testCommand exits non-zero", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: "false",
			artifactsMustExist: [],
		});

		assert.equal(result.ok, false);
		assert.equal(result.checks[0].field, "testCommand");
		assert.equal(result.checks[0].ok, false);
		assert.match(result.checks[0].message, /Contract testCommand failed \(exit 1\)/);
	});
});

test("verifyContract checks artifactsMustExist paths in worktree", async () => {
	await withWorktree((worktreePath) => {
		const artifactRel = "artifacts/proof.txt";
		fs.mkdirSync(path.join(worktreePath, "artifacts"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, artifactRel), "ok", "utf-8");

		const result = verifyContract(worktreePath, {
			testCommand: null,
			artifactsMustExist: [artifactRel, "missing/file.txt"],
		});

		assert.equal(result.ok, false);
		assert.equal(result.checks.length, 2);
		assert.equal(result.checks[0].ok, true);
		assert.equal(result.checks[1].ok, false);
		assert.equal(result.checks[1].message, "Contract artifactsMustExist: missing missing/file.txt");
	});
});

test("verifyContract returns ok with empty checks when contract has no verify fields", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: null,
			artifactsMustExist: [],
		});

		assert.equal(result.ok, true);
		assert.deepEqual(result.checks, []);
	});
});

test("verifyContract enforces fileScopeMustChange and fileScopeMustNotChange", async () => {
	const worktreePath = await initGitRepo("spine-contract-scope-");
	try {
		fs.mkdirSync(path.join(worktreePath, "src", "batch"), { recursive: true });
		fs.mkdirSync(path.join(worktreePath, "src", "planner"), { recursive: true });
		fs.writeFileSync(path.join(worktreePath, "src/batch/review.mjs"), "export const x = 1;\n");
		fs.writeFileSync(path.join(worktreePath, "src/planner/index.mjs"), "export const y = 1;\n");
		execFileSync("git", ["add", "-A"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "init"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["checkout", "-b", "lane-1"], { cwd: worktreePath, stdio: "ignore" });
		fs.writeFileSync(path.join(worktreePath, "src/planner/index.mjs"), "export const y = 2;\n");
		execFileSync("git", ["add", "src/planner/index.mjs"], { cwd: worktreePath, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "planner change"], { cwd: worktreePath, stdio: "ignore" });

		const changed = listChangedFiles(worktreePath, "main");
		assert.ok(changed.includes("src/planner/index.mjs"));

		const result = verifyContract(
			worktreePath,
			{
				testCommand: "true",
				fileScopeMustChange: ["src/planner/index.mjs"],
				fileScopeMustNotChange: ["src/batch/**"],
				artifactsMustExist: [],
			},
			{ baseBranch: "main" },
		);

		assert.equal(result.ok, true);

		const forbidden = verifyContract(
			worktreePath,
			{
				testCommand: null,
				fileScopeMustChange: ["src/missing.mjs"],
				fileScopeMustNotChange: [],
				artifactsMustExist: [],
			},
			{ baseBranch: "main" },
		);
		assert.equal(forbidden.ok, false);
		const scopeCheck = forbidden.checks.find((check) => check.field === "fileScopeMustChange");
		assert.match(scopeCheck?.message ?? "", /no matching changes/);
	} finally {
		await destroyGitRepo(worktreePath);
	}
});

test("verifyContract checks minLineCoverage from command output", async () => {
	await withWorktree((worktreePath) => {
		const result = verifyContract(worktreePath, {
			testCommand: "printf '%s\\n' 'all files          |    82.50 |'",
			minLineCoverage: 77,
			artifactsMustExist: [],
		});

		assert.equal(result.ok, true);
		const coverageCheck = result.checks.find((check) => check.field === "minLineCoverage");
		assert.ok(coverageCheck?.ok);
		assert.match(coverageCheck.message, /82\.50%/);
	});
});

test("shouldRunContractVerify skips legacy TP-* tasks and absent contract sections", () => {
	assert.equal(
		shouldRunContractVerify(
			"TP-012",
			{ hasSection: true, testCommand: "true", fileScopeMustChange: [], fileScopeMustNotChange: [], minLineCoverage: null, artifactsMustExist: [] },
			{ contract: { mode: "required", legacyTaskIdPrefixes: ["TP-"] } },
		),
		false,
	);
	assert.equal(
		shouldRunContractVerify(
			"SP-155",
			{ hasSection: false, testCommand: null, fileScopeMustChange: [], fileScopeMustNotChange: [], minLineCoverage: null, artifactsMustExist: [] },
			{ contract: { mode: "required" } },
		),
		false,
	);
	assert.equal(
		shouldRunContractVerify(
			"SP-155",
			{ hasSection: true, testCommand: "true", fileScopeMustChange: [], fileScopeMustNotChange: [], minLineCoverage: null, artifactsMustExist: [] },
			{ contract: { mode: "required" } },
		),
		true,
	);
});

test("matchesContractPattern supports glob paths", () => {
	assert.equal(matchesContractPattern("src/planner/index.mjs", "src/planner/**"), true);
	assert.equal(matchesContractPattern("README.md", "src/**"), false);
});

test("parseAggregateLineCoverage parses coverage table rows", () => {
	const pct = parseAggregateLineCoverage("all files          |    83.44 |        |\n");
	assert.equal(pct, 83.44);
});
