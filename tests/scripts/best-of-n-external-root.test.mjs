import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	buildPiSpawnEnv,
	parseEmptyLogTimeoutMs,
	resolvePromptArg,
	resolvePromptArgs,
} from "../../scripts/best-of-n.mjs";
import { configureGitIdentity } from "../helpers/git-fixture.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bestOfNScript = path.join(repoRoot, "scripts/best-of-n.mjs");

/**
 * @param {string} prefix
 */
async function initBareGitRepo(prefix) {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
	execFileSync("git", ["init"], { cwd: projectRoot, stdio: "ignore" });
	configureGitIdentity(projectRoot);
	writeFileSync(path.join(projectRoot, "README.md"), "# fixture\n", "utf-8");
	execFileSync("git", ["add", "README.md"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "init"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["branch", "-M", "main"], { cwd: projectRoot, stdio: "ignore" });
	return projectRoot;
}

/**
 * @param {string} mockBin
 * @param {{ hang?: boolean }} [opts]
 */
function writeMockPi(mockBin, opts = {}) {
	mkdirSync(mockBin, { recursive: true });
	const hangBody = opts.hang
		? 'trap "exit 143" TERM\nwhile true; do sleep 1; done'
		: `echo "BON_PI_DIAG cwd=$(pwd)"
echo "BON_PI_DIAG ROOT_WORKTREE_PATH=$ROOT_WORKTREE_PATH"
echo "BON_PI_DIAG argv=$*"`;
	const script = `#!/bin/bash
set -euo pipefail
if [[ "\${1:-}" == "--list-models" ]]; then
  printf 'provider model\\n'
  printf 'cursor auto\\n'
  exit 0
fi
${hangBody}
exit 0
`;
	const mockPath = path.join(mockBin, "pi");
	writeFileSync(mockPath, script, "utf-8");
	chmodSync(mockPath, 0o755);
}

/**
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string }} [opts]
 */
function runBestOfN(args, opts = {}) {
	return spawnSync(process.execPath, [bestOfNScript, ...args], {
		cwd: opts.cwd ?? repoRoot,
		env: opts.env ?? process.env,
		encoding: "utf-8",
	});
}

test("resolvePromptArg resolves relative @files from invoke cwd", () => {
	const invokeCwd = mkdtempSync(path.join(os.tmpdir(), "bon-prompt-"));
	const promptPath = path.join(invokeCwd, "prompt.md");
	writeFileSync(promptPath, "# prompt\n", "utf-8");
	assert.equal(resolvePromptArg("@prompt.md", invokeCwd), `@${promptPath}`);
});

test("resolvePromptArgs keeps non-file args unchanged", () => {
	const invokeCwd = mkdtempSync(path.join(os.tmpdir(), "bon-prompt-"));
	assert.deepEqual(resolvePromptArgs(["hello", "world"], invokeCwd), ["hello", "world"]);
});

test("buildPiSpawnEnv sets ROOT_WORKTREE_PATH for external worktrees", () => {
	const projectRoot = "/tmp/external-repo";
	const worktreePath = "/tmp/external-repo/.worktrees/bon-run/model";
	const env = buildPiSpawnEnv(projectRoot, worktreePath);
	assert.equal(env.ROOT_WORKTREE_PATH, projectRoot);
	assert.equal(env.PI_WORKTREE_PATH, worktreePath);
});

test("parseEmptyLogTimeoutMs reads BON_EMPTY_LOG_TIMEOUT_MS", () => {
	assert.equal(parseEmptyLogTimeoutMs("1500"), 1500);
	assert.equal(parseEmptyLogTimeoutMs(""), 120_000);
});

test("dry-run external project-root records resolved prompt and worktree cwd", async () => {
	const externalRoot = await initBareGitRepo("bon-external-");
	const mockBin = mkdtempSync(path.join(os.tmpdir(), "bon-mock-"));
	writeMockPi(mockBin);

	const promptDir = mkdtempSync(path.join(os.tmpdir(), "bon-invoke-"));
	const promptPath = path.join(promptDir, "task.md");
	writeFileSync(promptPath, "# task\n", "utf-8");

	try {
		const result = runBestOfN(
			["--dry-run", "--project-root", externalRoot, "-m", "cursor/auto", "@task.md"],
			{
				cwd: promptDir,
				env: { ...process.env, PATH: `${mockBin}:${process.env.PATH ?? ""}` },
			},
		);
		assert.equal(result.status, 0, result.stderr);

		const runRoot = path.join(externalRoot, ".worktrees");
		const runDirs = readdirSync(runRoot).filter((name) => name.startsWith("bon-"));
		assert.ok(runDirs.length > 0, "expected bon run directory");

		const logPath = path.join(runRoot, runDirs[0], "auto", "bon-run.log");
		const log = readFileSync(logPath, "utf-8");
		assert.match(log, new RegExp(`cwd=${path.join(runRoot, runDirs[0], "auto")}`));
		assert.match(log, /--approve/);
		assert.ok(log.includes("task.md"), log);
	} finally {
		await rm(externalRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});

test("external project-root spawn writes early mock output with ROOT_WORKTREE_PATH", async () => {
	const externalRoot = await initBareGitRepo("bon-external-live-");
	const mockBin = mkdtempSync(path.join(os.tmpdir(), "bon-mock-live-"));
	writeMockPi(mockBin);

	const promptDir = mkdtempSync(path.join(os.tmpdir(), "bon-invoke-live-"));
	const promptPath = path.join(promptDir, "task.md");
	await writeFile(promptPath, "# task\n", "utf-8");

	try {
		const result = runBestOfN(
			["--project-root", externalRoot, "-m", "cursor/auto", "@task.md"],
			{
				cwd: promptDir,
				env: { ...process.env, PATH: `${mockBin}:${process.env.PATH ?? ""}` },
			},
		);
		assert.equal(result.status, 0, result.stderr);

		const runRoot = path.join(externalRoot, ".worktrees");
		const runDirs = readdirSync(runRoot).filter((name) => name.startsWith("bon-"));
		const logPath = path.join(runRoot, runDirs[0], "auto", "bon-run.log");
		const log = readFileSync(logPath, "utf-8");
		assert.match(log, /BON_PI_DIAG cwd=/);
		assert.ok(log.includes(path.basename(externalRoot)), log);
		assert.match(log, /BON_PI_DIAG ROOT_WORKTREE_PATH=/);
		assert.match(log, /--approve/);
		assert.ok(log.includes("task.md"), log);
	} finally {
		await rm(externalRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});

test("empty-log watchdog terminates silent pi and surfaces stderr in bon-run.log", async () => {
	const externalRoot = await initBareGitRepo("bon-external-hang-");
	const mockBin = mkdtempSync(path.join(os.tmpdir(), "bon-mock-hang-"));
	writeMockPi(mockBin, { hang: true });

	try {
		const result = runBestOfN(
			["--project-root", externalRoot, "-m", "cursor/auto", "say hello"],
			{
				env: {
					...process.env,
					PATH: `${mockBin}:${process.env.PATH ?? ""}`,
					BON_EMPTY_LOG_TIMEOUT_MS: "800",
				},
			},
		);
		assert.notEqual(result.status, 0, "expected non-zero exit after empty-log timeout");

		const runRoot = path.join(externalRoot, ".worktrees");
		const runDirs = readdirSync(runRoot).filter((name) => name.startsWith("bon-"));
		const logPath = path.join(runRoot, runDirs[0], "auto", "bon-run.log");
		const log = readFileSync(logPath, "utf-8");
		assert.match(log, /pi produced no output after 800ms/);
	} finally {
		await rm(externalRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});
